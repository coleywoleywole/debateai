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
import { signGuestId } from '@/lib/guest-token';
import { FREE_USER_DAILY_DEBATE_LIMIT, GUEST_DEBATE_LIMIT } from '@/lib/limits';
import { resolveCategory } from '@/lib/categories';
import { TOPIC_CATEGORIES } from '@/lib/topics';

const log = logger.scope('debate');

// 10 debates per minute per user (generous for normal use, blocks abuse)
const userLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });
// 30 per minute per IP as a fallback for pre-auth requests
const ipLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });
// Guest-specific IP rate limiter: 3 guest debates per day per IP
const guestIpLimiter = createRateLimiter({ maxRequests: 3, windowMs: 86_400_000 });

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

    let guestUuid = '';
    if (!userId) {
      // Guest mode: generate a signed guest ID
      guestUuid = crypto.randomUUID();
      userId = `guest_${guestUuid}`;
      isGuest = true;

      // IP-based guest debate limit (prevents discarding cookie to bypass per-user limit)
      const guestIpRl = guestIpLimiter.check(getClientIp(request));
      if (!guestIpRl.allowed) {
        return errors.guestDebateLimit(guestIpRl.remaining + 1, 3);
      }
    }

    // Per-user rate limit
    const userRl = userLimiter.check(`user:${userId}`);
    if (!userRl.allowed) {
      return errors.rateLimited({
        limit: 10,
        remaining: userRl.remaining,
        reset: Math.ceil(userRl.resetAt / 1000),
      });
    }

    // Check if user is premium (premium users skip daily limit)
    let isPremium = false;
    if (!isGuest) {
      const premiumCheck = await d1.checkUserDebateLimit(userId);
      if (premiumCheck.isPremium) {
        isPremium = true;
      } else if (premiumCheck.success && !premiumCheck.allowed) {
        return errors.debateLimit(premiumCheck.count, premiumCheck.limit);
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

    // Resolve category from topic (match against curated topics)
    let category: string | undefined;
    for (const cat of TOPIC_CATEGORIES) {
      if (cat.topics.some(t => t.question === topic)) {
        category = resolveCategory(cat.id);
        break;
      }
    }

    // Determine the daily limit for the atomic insert
    const dailyLimit = isPremium ? undefined : (isGuest ? GUEST_DEBATE_LIMIT : FREE_USER_DAILY_DEBATE_LIMIT);

    // Save the debate to the database with custom opponent info
    let saveResult: { success: boolean; debateId?: string; error?: string };
    try {
      saveResult = await d1.saveDebate({
        userId,
        opponent: effectiveOpponent as OpponentType,
        topic,
        messages: initialMessages,
        debateId,
        opponentStyle, // Save the custom style for later use
        promptVariant: experimentVariant, // Save the experiment variant
        category,
        dailyLimit,
      } as any);

      if (!saveResult.success) {
        if (saveResult.error === 'debate_limit_exceeded') {
          if (isGuest) {
            return errors.guestDebateLimit(dailyLimit || 1, dailyLimit || 1);
          }
          return errors.debateLimit(dailyLimit || 3, dailyLimit || 3);
        }
        throw new Error(saveResult.error || 'Failed to create debate');
      }
    } catch (dbError) {
      // In development, allow debates without D1 persistence
      if (process.env.NODE_ENV === 'development') {
        log.info('D1 unavailable in dev — proceeding without persistence', { debateId });
        saveResult = { success: true, debateId };
      } else {
        throw dbError;
      }
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

    // Log to internal analytics table (non-blocking, don't fail on error)
    d1.logAnalyticsEvent({
      eventType: 'debate_started',
      debateId: saveResult.debateId || debateId,
      userId,
      properties: {
        topic,
        opponent: effectiveOpponent,
        isGuest
      }
    }).catch(() => {});

    // Return success with rate limit headers
    const signedToken = isGuest ? signGuestId(guestUuid) : undefined;
    const response = NextResponse.json({
      success: true,
      debateId: saveResult.debateId || debateId,
      isGuest,
      guestId: isGuest ? userId : undefined
    });

    // Set signed guest cookie so subsequent requests are authenticated
    if (isGuest && signedToken) {
      response.cookies.set('guest_id', signedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    return withRateLimitHeaders(response, {
      limit: 10,
      remaining: userRl.remaining,
      reset: Math.ceil(userRl.resetAt / 1000),
    });
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
