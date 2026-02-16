import { NextResponse } from 'next/server';
import { z } from 'zod';
import { d1 } from '@/lib/d1';
import { getUserId } from '@/lib/auth-helper';
import { errors, validateBody } from '@/lib/api-errors';
import { trackEvent } from '@/lib/posthog-server';
import { GUEST_MESSAGE_LIMIT } from '@/lib/limits';
import { calculateRound, isDebateCompleted } from '@/lib/debate-state';

// Schema for POST body
const addMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000),
  aiTakeover: z.boolean().optional().default(false),
});

// In-memory fallback for when D1 is not configured
const memoryDebates = new Map<string, unknown>();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  try {
    const { debateId } = await params;
    const userId = await getUserId();

    if (!debateId) {
      return errors.badRequest('Debate ID required');
    }

    // Try memory first
    const memoryDebate = memoryDebates.get(debateId);
    if (memoryDebate) {
      return NextResponse.json({
        debate: memoryDebate,
        isOwner: true,
        isAuthenticated: !!userId,
      });
    }

    // Try D1
    const result = await d1.getDebate(debateId);

    if (result.success && result.debate) {
      const isOwner = userId ? result.debate.user_id === userId : false;
      const isAuthenticated = !!userId;

      // Strip sensitive fields from public response
       
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { user_id, ...safeDebate } = result.debate as Record<
        string,
        unknown
      >;

      return NextResponse.json({
        debate: safeDebate,
        isOwner,
        isAuthenticated,
      });
    }

    return errors.notFound('Debate not found');
  } catch (error) {
    // If it's already a NextResponse (from our error helpers), return it
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Get debate error:', error);
    return errors.internal('Failed to retrieve debate');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  let userId = 'anonymous';
  let debateId = '';

  try {
    const resolvedParams = await params;
    debateId = resolvedParams.debateId;
    const authUserId = await getUserId();
    if (authUserId) userId = authUserId;

    if (!debateId) {
      return errors.badRequest('Debate ID required');
    }

    const { message, aiTakeover } = await validateBody(request, addMessageSchema);

    // Get or create debate in memory
    let debate = memoryDebates.get(debateId) as Record<string, unknown> | undefined;

    if (!debate) {
      // Try to get from D1
      const debateResult = await d1.getDebate(debateId);
      if (debateResult.success && debateResult.debate) {
        debate = debateResult.debate as Record<string, unknown>;
      } else {
        // Create a new memory debate
        debate = {
          id: debateId,
          user_id: userId,
          opponent: 'custom',
          opponentStyle: 'AI Opponent',
          topic: 'Debate',
          messages: [],
          created_at: new Date().toISOString(),
          current_round: 1,
          total_rounds: 3,
          status: 'active',
        };
      }
      memoryDebates.set(debateId, debate);
    }

    // Check if debate is completed
    if (debate.status === 'completed') {
      return NextResponse.json({
        success: false,
        error: 'debate_completed',
        message: 'This debate has already finished.',
      });
    }

    // Check for guest message limit
    const debateOwnerId = (debate.user_id as string) || '';
    const isGuest = debateOwnerId.startsWith('guest_');
    
    if (isGuest) {
      const messages = Array.isArray(debate.messages) ? debate.messages as any[] : [];
      const userMessageCount = messages.filter(m => m.role === 'user').length;
      // Limit: GUEST_MESSAGE_LIMIT user messages
      if (userMessageCount >= GUEST_MESSAGE_LIMIT) {
        return NextResponse.json({
          success: false,
          error: 'guest_limit_reached',
          message: 'You have reached the free limit. Please sign up to continue.',
          limit: GUEST_MESSAGE_LIMIT
        }, { status: 403 });
      }
    }

    // Determine current round
    const existingMessages = Array.isArray(debate.messages) ? debate.messages as any[] : [];
    // System (0) + User(1) + AI(2) ...
    // Round 1: User msg at index 1 (count 1->2)
    // Round 2: User msg at index 3 (count 3->4)
    // Round 3: User msg at index 5 (count 5->6)
    
    const msgCount = existingMessages.length;
    const currentRound = calculateRound(msgCount);

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
      aiAssisted: aiTakeover,
      created_at: new Date().toISOString(),
    };

    const messages = Array.isArray(debate.messages) ? debate.messages : [];
    debate.messages = [...messages, userMessage];
    debate.current_round = currentRound;

    // Track user message (Fire and forget, but await to ensure execution in serverless)
    await trackEvent(userId, 'debate_message_sent', {
      debateId,
      messageCount: (debate.messages as any[]).length,
      role: 'user',
      topic: debate.topic,
      isAiAssisted: aiTakeover,
      round: currentRound
    });

    // Try to save to D1 (update round info)
    try {
      await d1.addMessage(debateId, userMessage, { currentRound });
    } catch {
      console.log('D1 save failed, using memory only');
    }

    // Generate AI response
    const start = Date.now();
    const aiResponse = await generateAIResponse(
      debate,
      debate.messages as Array<{ role: string; content: string }>,
      message
    );
    const duration = Date.now() - start;

    console.log(`[LATENCY] Debate ${debateId}: AI response time ${duration}ms`);

    // Add AI message
    const aiMessage = {
      role: 'ai',
      content: aiResponse,
      created_at: new Date().toISOString(),
    };

    (debate.messages as Array<unknown>).push(aiMessage);

    // Update status if round 3 is done (Sys + 3 User + 3 AI = 7 messages)
    // After pushing AI message, length is msgCount + 2
    const finalMsgCount = (debate.messages as Array<unknown>).length;
    let newStatus = debate.status as string;
    
    if (isDebateCompleted(finalMsgCount)) {
      newStatus = 'completed';
      debate.status = 'completed';
    }

    // Track AI response
    await trackEvent(userId, 'debate_ai_response_generated', {
      debateId,
      messageCount: finalMsgCount,
      role: 'ai',
      duration_ms: duration,
      topic: debate.topic,
      opponent: debate.opponentStyle || debate.opponent || 'default',
      round: currentRound,
      status: newStatus
    });

    // Try to save AI message to D1 with status update
    try {
      await d1.addMessage(debateId, aiMessage, { status: newStatus });
    } catch {
      console.log('D1 save failed for AI message, using memory only');
    }

    return NextResponse.json({
      success: true,
      userMessage,
      aiMessage,
      currentRound,
      status: newStatus,
      totalRounds: 3
    });
  } catch (error) {
    // If it's already a NextResponse (from our error helpers), return it
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Post message error:', error);
    
    // Track error
    await trackEvent(userId || 'system', 'debate_error', {
      debateId,
      error: error instanceof Error ? error.message : String(error),
      path: 'api/debate/[debateId]'
    });

    return errors.internal('Failed to send message');
  }
}

// Helper function to generate AI response
async function generateAIResponse(
  debate: Record<string, unknown>,
  messages: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<string> {
  // Check if we have an AI service configured
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
  const AI_API_KEY = process.env.AI_API_KEY;

  if (AI_SERVICE_URL && AI_API_KEY) {
    try {
      const response = await fetch(AI_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
          topic: debate.topic,
          opponent: debate.opponentStyle || debate.opponent || debate.character,
          messages: messages,
          userMessage: userMessage,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.response || data.message || data.content;
      }
    } catch (error) {
      console.error('AI service error:', error);
    }
  }

  // Fallback responses based on persona
  const fallbacks: Record<string, string[]> = {
    'Elon Musk': [
      "I disagree. The free market will naturally find the right balance without government intervention. History has shown that excessive regulation often creates more problems than it solves.",
      "We need to move fast and break things. That's how innovation happens. Bureaucracy slows down progress.",
      "Regulation stifles innovation. Let the market self-regulate through competition and consumer choice.",
      "The best solutions come from free people experimenting, not from government committees writing rules about technology they don't understand.",
    ],
    'Jordan Peterson': [
      "That's a simplistic view. Let's examine the deeper psychological and historical patterns at play here...",
      "You need to consider the archetypal structures underlying this issue. Order and chaos must be balanced.",
      "Have you considered the long-term consequences of that position? We must think carefully about the path we choose.",
    ],
    'Alexandria Ocasio-Cortez': [
      "We need systemic change, not band-aid solutions. The current system isn't working for everyday people.",
      "This is about justice and equity. We can't ignore the marginalized communities affected by these policies.",
      "The data clearly shows we need bold action. Incrementalism won't solve the scale of this problem.",
    ],
    'Ben Shapiro': [
      "Facts don't care about your feelings. Let's look at the actual data here.",
      "Your argument is emotionally appealing but logically flawed. Here's why...",
      "The statistics tell a different story. Let's examine the evidence objectively.",
    ],
    default: [
      "That's an interesting perspective. However, I see it differently based on the evidence available.",
      "I understand your point, but consider this counterargument...",
      "While that sounds reasonable, there's another side to consider that you may have overlooked.",
      "Let me offer a different perspective on this issue...",
      "That's a compelling argument, but I think there are some flaws in the reasoning.",
      "Can you provide more evidence to support that claim?",
      "I'm not convinced. The premise seems slightly flawed.",
      "That's one way to look at it, but what about the unintended consequences?",
      "Interesting, but does that hold up under scrutiny?",
      "Let's dig deeper into that assumption. Is it really true?",
    ],
  };

  const personaKey = String(
    debate.opponentStyle || debate.opponent || debate.character || 'default'
  );
  const personaResponses = fallbacks[personaKey] || fallbacks['default'];
  return personaResponses[Math.floor(Math.random() * personaResponses.length)];
}
