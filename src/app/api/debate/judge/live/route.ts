import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-helper';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { errors } from '@/lib/api-errors';
import { logger } from '@/lib/logger';
import { getGeminiModel } from '@/lib/vertex';
import { z } from 'zod';
import {
  getLiveJudgeSystemPrompt,
  getLiveJudgeUserPrompt,
  type LiveJudgeFeedback,
} from '@/lib/live-judge';

const log = logger.scope('debate.judge.live');

const requestSchema = z.object({
  debateId: z.string().min(1),
  topic: z.string().min(1),
  latestExchange: z.object({
    user: z.string().min(1),
    ai: z.string().min(1),
  }),
  runningSummary: z.string().optional(),
});

// 10 live-judge requests per minute per user
const userLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });
const ipLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });

export async function POST(request: Request) {
  const ipRl = ipLimiter.check(getClientIp(request));
  if (!ipRl.allowed) return rateLimitResponse(ipRl);

  try {
    const userId = await getUserId();
    if (!userId) return errors.unauthorized();

    const userRl = userLimiter.check(`user:${userId}`);
    if (!userRl.allowed) return rateLimitResponse(userRl);

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { topic, latestExchange, runningSummary } = parsed.data;

    const systemPrompt = getLiveJudgeSystemPrompt();
    const userPrompt = getLiveJudgeUserPrompt(
      topic,
      latestExchange.user,
      latestExchange.ai,
      runningSummary,
    );

    const model = getGeminiModel('gemini-2.5-flash-lite', {
      systemInstruction: systemPrompt,
      generationConfig: {
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    });

    const responseText =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON — strip markdown fences if model wraps them
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let feedback: LiveJudgeFeedback;

    try {
      feedback = JSON.parse(cleaned);
    } catch {
      log.error('json.parse_failed', { responseText: responseText.slice(0, 500) });
      return NextResponse.json(
        { error: 'Failed to parse judge response' },
        { status: 502 },
      );
    }

    // Basic shape validation
    if (
      typeof feedback.overallScore !== 'number' ||
      !Array.isArray(feedback.strengths) ||
      !Array.isArray(feedback.weaknesses) ||
      typeof feedback.tip !== 'string'
    ) {
      log.error('shape.invalid', { feedback });
      return NextResponse.json(
        { error: 'Invalid judge response shape' },
        { status: 502 },
      );
    }

    // Clamp score
    feedback.overallScore = Math.max(0, Math.min(100, Math.round(feedback.overallScore)));

    return NextResponse.json({ feedback });
  } catch (error) {
    log.error('live_judge.error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Live judge failed' },
      { status: 500 },
    );
  }
}
