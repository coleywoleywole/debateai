import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-helper';
import { d1 } from '@/lib/d1';
import { getScoringPrompt, DebateScore } from '@/lib/scoring';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { errors, withErrorHandler, validateBody } from '@/lib/api-errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { recordDebateCompletion } from '@/lib/streaks';
import { notifyScoreResult, notifyStreakMilestone } from '@/lib/notifications';
import { currentUser } from '@clerk/nextjs/server';
import { getGeminiModel } from '@/lib/vertex';

const log = logger.scope('debate.score');

// Simple schema for score endpoint
const scoreRequestSchema = z.object({
  debateId: z.string().min(1, 'Debate ID is required'),
});

// 5 scoring requests per minute per user (prevents spam-scoring)
const userLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });
const ipLimiter = createRateLimiter({ maxRequests: 15, windowMs: 60_000 });

/**
 * POST /api/debate/score
 *
 * Scores a completed debate. Requires at least 2 exchanges (4 messages).
 * Stores the result in the debate's score_data column.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const ipRl = ipLimiter.check(getClientIp(request));
  if (!ipRl.allowed) {
    return rateLimitResponse(ipRl) as unknown as NextResponse;
  }

  const userId = await getUserId();
  if (!userId) {
    throw errors.unauthorized();
  }

  const userRl = userLimiter.check(`user:${userId}`);
  if (!userRl.allowed) {
    return rateLimitResponse(userRl) as unknown as NextResponse;
  }

  const { debateId } = await validateBody(request, scoreRequestSchema);

  // Fetch the debate
  const debateResult = await d1.getDebate(debateId);
  if (!debateResult.success || !debateResult.debate) {
    throw errors.notFound('Debate not found');
  }

  const debate = debateResult.debate;

  // Verify ownership
  if (debate.user_id !== userId) {
    throw errors.forbidden('You do not have access to this debate');
  }

  // Check if already scored
  const existingScoreData = debate.score_data as Record<string, unknown> | null;
  if (existingScoreData?.debateScore) {
    return NextResponse.json({
      score: existingScoreData.debateScore,
      cached: true,
    });
  }

  // Need at least 2 user messages + 2 AI messages to score
  const messages = (debate.messages as Array<{ role: string; content: string }>) || [];
  const userMsgs = messages.filter(m => m.role === 'user');
  const aiMsgs = messages.filter(m => m.role === 'ai');

  if (userMsgs.length < 2 || aiMsgs.length < 2) {
    throw errors.badRequest('Need at least 2 exchanges to score a debate');
  }

  // Generate score
  const topic = (debate.topic as string) || 'Unknown topic';
  
  log.info('scoring.started', { debateId, topic: topic.slice(0, 50), msgCount: messages.length });

  const scoringPrompt = getScoringPrompt(topic, messages);

  // Use Gemini Flash (3 or 2.0 Exp)
  const model = getGeminiModel('gemini-2.0-flash-exp', {
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: scoringPrompt }] }],
  });

  const response = await result.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON response — handle potential markdown wrapping
  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }

  let score: DebateScore;
  try {
    score = JSON.parse(jsonText) as DebateScore;
  } catch {
    console.error('Failed to parse scoring response:', text);
    throw errors.internal('Failed to parse debate score');
  }

  // Validate score structure
  if (!score.winner || typeof score.userScore !== 'number' || typeof score.aiScore !== 'number') {
    throw errors.internal('Invalid score format returned');
  }

  // Save score to database — preserve existing score_data fields
  const updatedScoreData = {
    ...existingScoreData,
    debateScore: score,
    scoredAt: new Date().toISOString(),
  };

  await d1.query(
    'UPDATE debates SET score_data = ?, user_score = ?, ai_score = ? WHERE id = ?',
    [
      JSON.stringify(updatedScoreData),
      score.userScore,
      score.aiScore,
      debateId,
    ]
  );

  // ── Update streak + points + leaderboard ────────────────
  try {
    const user = await currentUser();
    const displayName = user?.firstName
      ? `${user.firstName}${user.lastName ? ` ${user.lastName.charAt(0)}.` : ''}`
      : user?.username || undefined;

    const debateResult2 = score.winner === 'user' ? 'win' : score.winner === 'ai' ? 'loss' : 'draw';
    const streakResult = await recordDebateCompletion(userId, debateResult2, score.userScore, displayName);

    // Fire notifications (non-blocking)
    await notifyScoreResult(userId, topic, debateResult2, score.userScore, debateId);
    if (streakResult) {
      await notifyStreakMilestone(userId, streakResult.currentStreak);
    }
  } catch (err) {
    // Non-blocking — scoring still succeeds even if streak/notification update fails
    console.error('Failed to update streak/points/notifications:', err);
  }

  log.info('completed', {
    debateId,
    winner: score.winner,
    userScore: score.userScore,
    aiScore: score.aiScore,
  });

  await d1.logAnalyticsEvent({
    eventType: 'debate_ended',
    debateId,
    userId,
    properties: {
      winner: score.winner,
      userScore: score.userScore,
      aiScore: score.aiScore,
      reason: 'completed'
    }
  });

  return NextResponse.json({ score, cached: false });
});
