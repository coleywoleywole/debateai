import { NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';
import { OpponentType } from '@/lib/opponents';
import { getUserId } from '@/lib/auth-helper';
import { checkAppDisabled } from '@/lib/app-disabled';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { errors, validateBody, withRateLimitHeaders } from '@/lib/api-errors';
import { createDebateSchema } from '@/lib/api-schemas';
import { logger } from '@/lib/logger';
import { track } from '@/lib/analytics';

const log = logger.scope('debate');

// 10 debates per minute per user (generous for normal use, blocks abuse)
const userLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });
// 30 per minute per IP as a fallback for pre-auth requests
const ipLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });

export async function POST(request: Request) {
  // Check if app is disabled
  const disabledResponse = checkAppDisabled();
  if (disabledResponse) return disabledResponse;

  // IP-based rate limit first (before auth, which is expensive)
  const ipRl = ipLimiter.check(getClientIp(request));
  if (!ipRl.allowed) {
    return errors.rateLimited({
      limit: ipRl.remaining + 1,
      remaining: ipRl.remaining,
      reset: Math.ceil(ipRl.resetAt / 1000),
    });
  }

  try {
    let userId = await getUserId();
    let isGuest = false;
    
    if (!userId) {
      // Guest mode: generate a temporary ID
      userId = `guest_${crypto.randomUUID()}`;
      isGuest = true;
    }

    // Per-user rate limit (skip for guests, use IP limit only)
    let userRl;
    if (!isGuest) {
      userRl = userLimiter.check(`user:${userId}`);
      if (!userRl.allowed) {
        return errors.rateLimited({
          limit: 10,
          remaining: userRl.remaining,
          reset: Math.ceil(userRl.resetAt / 1000),
        });
      }
    }

    // Validate request body with Zod
    const { character: opponent, opponentStyle, topic, debateId } = await validateBody(
      request,
      createDebateSchema
    );
    
    // Use custom style if provided, otherwise use the character type
    const effectiveOpponent = opponent || 'custom';

    // Create initial debate with welcome message
    const initialMessages = [{
      role: 'system',
      content: `Welcome to the debate arena! Today's topic: "${topic}".${opponentStyle ? ` Your opponent's style: ${opponentStyle}` : ''}`
    }];
    
    // Determine experiment variant for A/B test (same logic as debate route)
    // Simple deterministic hash: even/odd ASCII value of last char of userId
    const lastChar = userId.slice(-1);
    const experimentVariant = lastChar.charCodeAt(0) % 2 === 0 ? 'aggressive' : 'default';

    // Save the debate to the database with custom opponent info
    const saveResult = await d1.saveDebate({
      userId,
      opponent: effectiveOpponent as OpponentType,
      topic,
      messages: initialMessages,
      debateId,
      opponentStyle, // Save the custom style for later use
      promptVariant: experimentVariant, // Save the experiment variant
    } as any);
    
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to create debate');
    }
    
    log.info('created', {
      debateId: saveResult.debateId || debateId,
      topic: topic.slice(0, 100),
      opponent,
      userId,
      experimentVariant,
      isGuest
    });

    // Track debate creation with experiment variant for PostHog
    track('debate_created', {
      debateId: saveResult.debateId || debateId,
      topic,
      opponent: effectiveOpponent,
      source: 'custom_setup', // Default source, can be refined later
      experiment_variant: experimentVariant,
      is_guest: isGuest
    });

    // Log to internal analytics table
    await d1.logAnalyticsEvent({
      eventType: 'debate_started',
      debateId: saveResult.debateId || debateId,
      userId,
      properties: {
        topic,
        opponent: effectiveOpponent,
        isGuest
      }
    });

    // Return success with rate limit headers
    const response = NextResponse.json({ 
      success: true, 
      debateId: saveResult.debateId || debateId,
      isGuest,
      guestId: isGuest ? userId : undefined
    });

    if (userRl) {
      return withRateLimitHeaders(response, {
        limit: 10,
        remaining: userRl.remaining,
        reset: Math.ceil(userRl.resetAt / 1000),
      });
    }
    
    return response;
  } catch (error) {
    // If it's already a NextResponse (from validateBody), return it
    if (error instanceof NextResponse) {
      return error;
    }

    console.error('Create debate error:', error);
    return errors.internal('Failed to create debate');
  }
}

export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: 'POST, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
