import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-helper";
import { d1 } from "@/lib/d1";
import { getDebatePrompt, getDailyPersona } from "@/lib/prompts";
import { getAggressiveDebatePrompt } from "@/lib/prompts.aggressive";
import { checkAppDisabled } from "@/lib/app-disabled";
import { createRateLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { errors, validateBody } from "@/lib/api-errors";
import { sendMessageSchema, SendMessageInput } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";
import { captureError } from "@/lib/sentry";
import { track } from "@/lib/analytics";
import { calculateNewState, POWERUPS, MOOD_PROMPTS, Mood } from "@/lib/mechanics";
import { getGeminiModel } from "@/lib/vertex";
import { Content } from "@google-cloud/vertexai";

const log = logger.scope('debate');

// 20 messages per minute per user
const userLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });

export async function POST(request: Request) {
  // Check if app is disabled
  const disabledResponse = checkAppDisabled();
  if (disabledResponse) return disabledResponse;

  // IP-based rate limit first (before auth check)
  const ip = getClientIp(request);
  const ipRl = await d1.checkRateLimit(`ip:${ip}`, 10, 60);
  if (!ipRl.allowed) {
    return rateLimitResponse({
      allowed: false,
      remaining: 0,
      resetAt: ipRl.resetAt,
      headers: {
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(ipRl.resetAt),
        'Retry-After': String(Math.max(0, ipRl.resetAt - Math.floor(Date.now()/1000)))
      }
    });
  }

  try {
    const userId = await getUserId();

    if (!userId) {
      return errors.unauthorized();
    }

    const userRl = userLimiter.check(`user:${userId}`);
    if (!userRl.allowed) return rateLimitResponse(userRl);

    let body: SendMessageInput;
    try {
      body = await validateBody(request, sendMessageSchema);
    } catch (error) {
      if (error instanceof NextResponse) return error;
      return errors.badRequest("Invalid request body");
    }

    const {
      character,
      opponentStyle,
      topic,
      userArgument,
      previousMessages,
      isAIAssisted,
      promptVariant,
      activePowerup,
      comboCount = 0,
      currentMood = 'neutral',
    } = body;
    
    let { debateId } = body;

    if (!debateId) {
      debateId = crypto.randomUUID();
    }

    const existingDebate = await d1.getDebate(debateId);
    let assignedVariant = 'default';

    if (existingDebate.success && (existingDebate as any).debate?.promptVariant) {
      assignedVariant = (existingDebate as any).debate.promptVariant as string;
    } else if (promptVariant) {
      assignedVariant = promptVariant;
    } else {
      const lastChar = userId.slice(-1);
      if (lastChar.charCodeAt(0) % 2 === 0) {
        assignedVariant = 'aggressive';
      }
    }

    log.info('message.received', {
      userId,
      debateId: debateId || 'new',
      topic: topic.slice(0, 100),
      character,
      messageIndex: previousMessages.length,
      isAIAssisted,
      promptVariant: assignedVariant,
    });
    
    if (!body.debateId) {
      const dup = await d1.findRecentDuplicate(userId, topic, 30);
      if (dup.found && dup.debateId) {
        return NextResponse.json({
          deduplicated: true,
          debateId: dup.debateId,
          message: "A debate on this topic was just created. Resuming that debate.",
        });
      }
    }

    // SAFETY SAVE: Persist user message immediately to prevent data loss on AI failure
    // This ensures "incomplete" debates are logged even if generation fails
    const safetyMessages = [...previousMessages, {
      role: "user",
      content: userArgument,
      ...(isAIAssisted && { aiAssisted: true }),
    }];

    await d1.saveDebate({
      userId,
      opponent: character,
      topic: topic,
      messages: safetyMessages,
      debateId,
      opponentStyle: (existingDebate as any).debate?.opponentStyle || opponentStyle,
      promptVariant: assignedVariant,
    });

    if (!body.debateId && previousMessages.length === 0) {
      track('debate_created', {
        debateId: debateId || 'pending',
        topic,
        opponent: character,
        source: 'quick_start',
        experiment_variant: assignedVariant as 'aggressive' | 'default',
      });
    }

    const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";
    const isLocalDev =
      process.env.NODE_ENV === "development" ||
      (process.env.NODE_ENV !== "production" && process.env.LOCAL_DEV_BYPASS === "true");
    if (debateId && !isTestMode && !isLocalDev) {
      const messageLimit = await d1.checkDebateMessageLimit(debateId);
      if (!messageLimit.allowed) {
        log.info('debate.limit_reached', { debateId, variant: assignedVariant });
        if (userId.startsWith('guest_')) {
          return errors.guestLimit(messageLimit.count, messageLimit.limit);
        }
        return errors.messageLimit(messageLimit.count, messageLimit.limit);
      }
    }

    let systemPrompt: string;
    const isFirstResponse = !previousMessages || previousMessages.length === 0;

    if (assignedVariant === 'aggressive') {
      systemPrompt = getAggressiveDebatePrompt(topic, isFirstResponse);
    } else {
      const persona = opponentStyle || getDailyPersona();
      systemPrompt = getDebatePrompt(persona, topic, isFirstResponse);
    }

    const { newCombo, newMood } = calculateNewState(userArgument, comboCount, currentMood as Mood);
    
    if (MOOD_PROMPTS[newMood]) {
      systemPrompt += `\n\n${MOOD_PROMPTS[newMood]}`;
    }

    if (activePowerup && POWERUPS[activePowerup]) {
      systemPrompt += `\n\n${POWERUPS[activePowerup].promptInjection}`;
    }
    
    // Gemini history format
    const history: Content[] = [];

    if (previousMessages && previousMessages.length > 0) {
      for (const msg of previousMessages) {
        if (!msg.content || msg.content.trim() === "") continue;

        if (msg.role === "user") {
          history.push({ role: "user", parts: [{ text: msg.content }] });
        } else if (msg.role === "ai") {
          history.push({ role: "model", parts: [{ text: msg.content }] });
        }
      }
    }

    // Initialize Gemini Model
    // Using gemini-2.0-flash-exp (Flash 2.0) as requested for speed/cost (or user specified "Gemini 3 Flash")
    // We'll map "Gemini 3 Flash" to "gemini-2.0-flash-exp" effectively until 3 is available
    const model = getGeminiModel("gemini-2.0-flash-exp", { systemInstruction: systemPrompt });

    // Inject reminder about citations
    // Gemini supports tools, but prompt engineering helps too
    const userMessage = `${userArgument}\n\n(Remember: Keep it short, under 120 words. If you state facts, verify them with Google Search.)`;

    // Listen for client disconnects
    request.signal.addEventListener("abort", () => {
      log.warn("debate.abandoned", {
        reason: "client_disconnect",
        debateId: debateId || 'unknown',
        userId,
        lastMessages: previousMessages?.slice(-5) || [],
        topic: topic?.slice(0, 50)
      });
    });

    const encoder = new TextEncoder();
    let controllerClosed = false;

    const streamResponse = new ReadableStream({
      async start(controller) {
        const streamStartTime = Date.now();
        try {
          log.info('stream.start', { debateId, userId });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "start" })}\n\n`)
          );

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "state", 
              data: { comboCount: newCombo, mood: newMood } 
            })}\n\n`)
          );

          const result = await model.generateContentStream({
            contents: [...history, { role: "user", parts: [{ text: userMessage }] }],
            tools: [{ googleSearchRetrieval: {} }], // Use Google Search Grounding
          });

          let accumulatedContent = "";
          let buffer = "";
          let lastFlushTime = Date.now();
          const BUFFER_TIME = 20;
          const BUFFER_SIZE = 8;
          const citations: any[] = [];
          const seenUrls = new Set<string>();
          let citationCounter = 1;

          const flushBuffer = () => {
            if (buffer && !controllerClosed) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "chunk",
                    content: buffer,
                  })}\n\n`
                )
              );
              buffer = "";
              lastFlushTime = Date.now();
            }
          };

          for await (const chunk of result.stream) {
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
            
            // Handle citations/grounding
            const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
            if (groundingMetadata?.groundingChunks) {
              for (const groundChunk of groundingMetadata.groundingChunks) {
                if (groundChunk.web && groundChunk.web.uri) {
                   const url = groundChunk.web.uri;
                   const title = groundChunk.web.title || new URL(url).hostname;
                   
                   if (!seenUrls.has(url)) {
                     seenUrls.add(url);
                     const citationData = {
                       id: citationCounter++,
                       url: url,
                       title: title,
                     };
                     citations.push(citationData);
                   }
                }
              }
            }

            accumulatedContent += text;

            for (const char of text) {
              buffer += char;
              const now = Date.now();
              if (buffer.length >= BUFFER_SIZE || (now - lastFlushTime >= BUFFER_TIME && buffer.length > 0)) {
                flushBuffer();
              }
            }
          }

          // Send citations if any
          if (citations.length > 0 && !controllerClosed) {
            flushBuffer();
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "citations",
                  citations: citations,
                })}\n\n`
              )
            );
          }

          if (buffer && !controllerClosed) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "chunk",
                  content: buffer,
                })}\n\n`
              )
            );
          }

          // Save the complete debate turn
          if (debateId && accumulatedContent) {
            // OPTIMIZATION: Use request context instead of fetching from DB
            // This reduces latency by avoiding a round-trip + large payload download
            
            let messages: any[] = [];
            
            if (previousMessages && previousMessages.length > 0) {
              messages = [...previousMessages];
            } else {
              // New debate: initialize with system message if starting fresh
              messages.push({
                role: 'system',
                content: `Welcome to the debate arena! Today's topic: "${topic}".${opponentStyle ? ` Your opponent's style: ${opponentStyle}` : ''}`
              });
            }

            messages.push({
              role: "user",
              content: userArgument,
              ...(isAIAssisted && { aiAssisted: true }),
            });
            messages.push({
              role: "ai",
              content: accumulatedContent,
              ...(citations.length > 0 && { citations }),
            });

            await d1.saveDebate({
              userId,
              opponent: character,
              topic: topic,
              messages: messages,
              debateId,
              opponentStyle,
              promptVariant: assignedVariant,
            });

            // Log analytics event
            await d1.logAnalyticsEvent({
              eventType: 'message_sent',
              debateId,
              userId,
              properties: {
                turnCount: Math.ceil(messages.length / 2),
                totalMessages: messages.length
              }
            });
          }

          if (!controllerClosed) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "complete",
                  content: accumulatedContent,
                  debateId: debateId,
                  ...(citations.length > 0 && { citations }),
                })}\n\n`
              )
            );
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            
            log.info('stream.complete', { 
              debateId, 
              durationMs: Date.now() - streamStartTime,
              contentLength: accumulatedContent.length,
              citationCount: citations.length
            });
          }
        } catch (error) {
          log.error('stream.failed', {
            debateId: debateId || 'unknown',
            error: error instanceof Error ? error.message : String(error),
            lastMessages: previousMessages?.slice(-5) || [],
            userId,
          });
          captureError(error, {
            tags: { route: 'debate', phase: 'streaming' },
            extra: { debateId, topic: topic?.slice(0, 100) },
          });
          if (!controllerClosed) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  error: "Failed to generate response",
                })}\n\n`
              )
            );
          }
        } finally {
          controllerClosed = true;
          controller.close();
        }
      },
    });

    return new NextResponse(streamResponse, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    log.error('api.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return errors.internal("Failed to generate debate response");
  }
}
