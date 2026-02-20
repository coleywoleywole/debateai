import { NextRequest, NextResponse } from 'next/server';
import { d1 } from '@/lib/d1';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'edge';

const ipLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateCheck = ipLimiter.check(ip);
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck);
  }

  try {
    const body = await req.json();
    const { event, properties } = body;

    if (!event) {
      return NextResponse.json({ success: false, error: 'Missing event name' }, { status: 400 });
    }

    // Extract common fields if available in properties
    const debateId = properties.debateId || properties.debate_id;
    
    // Attempt to get user ID from properties or headers if authenticated (optional enhancement)
    // For now, trust properties as analytics.ts or the caller should provide it.
    const userId = properties.userId || properties.user_id; 
    const sessionId = properties.sessionId || properties.session_id;

    // Log to D1
    await d1.logAnalyticsEvent({
      eventType: event,
      debateId,
      userId,
      sessionId,
      properties,
      url: req.headers.get('referer') || req.url,
      userAgent: req.headers.get('user-agent') || undefined,
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
