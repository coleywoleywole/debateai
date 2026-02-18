import { NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-helper';
import { getScoringPrompt } from '@/lib/scoring';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { errors, validateBody } from '@/lib/api-errors';
import { judgeDebateSchema } from '@/lib/api-schemas';
import { logger } from '@/lib/logger';
import { getGeminiModel } from '@/lib/vertex';

const log = logger.scope('debate.judge');

// Use Gemini Flash as requested (optimized for speed/cost)
const model = getGeminiModel('gemini-2.5-flash', {
  generationConfig: {
    responseMimeType: 'application/json'
  }
});

// 5 judging requests per minute per user
const userLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });
const ipLimiter = createRateLimiter({ maxRequests: 15, windowMs: 60_000 });

export async function POST(request: Request) {
  try {
    const ipRl = ipLimiter.check(getClientIp(request));
    if (!ipRl.allowed) {
      return rateLimitResponse(ipRl);
    }

    const userId = await getUserId();
    if (!userId) {
      return errors.unauthorized();
    }

    // Skip user rate limit for guests (IP limit still applies)
    let userRl;
    if (!userId.startsWith('guest_')) {
      userRl = userLimiter.check(`user:${userId}`);
      if (!userRl.allowed) {
        return rateLimitResponse(userRl);
      }
    }

    const { debateId, topic, messages } = await validateBody(request, judgeDebateSchema);

    log.info('judging.started', { debateId, topic: topic.slice(0, 100), messageCount: messages.length });

    // Generate the judging prompt
    const judgePrompt = getScoringPrompt(topic, messages);

    // Call Gemini
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: judgePrompt }] }]
    });

    const response = await result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let judgment: any;
    try {
      // Gemini usually respects JSON mode, but we strip markdown just in case
      let jsonText = text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }
      judgment = JSON.parse(jsonText);
    } catch (e) {
      log.error('judging.failed.parse', { debateId, rawResponse: text, error: e instanceof Error ? e.message : String(e) });
      return errors.internal('Failed to parse judge\'s verdict. The AI may have returned an invalid format.');
    }

    log.info('judging.completed', { debateId, winner: judgment.winner });

    // Return the raw JSON judgment for the client to handle
    return NextResponse.json(judgment);

  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    log.error('judging.failed.api', { error: error instanceof Error ? error.message : String(error) });
    return errors.internal('An unexpected error occurred while judging the debate.');
  }
}
