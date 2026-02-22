import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { d1 } from '@/lib/d1';
import { checkAppDisabled } from '@/lib/app-disabled';
import { errors, withErrorHandler } from '@/lib/api-errors';

export const GET = withErrorHandler(async () => {
  // Check if app is disabled
  const disabledResponse = checkAppDisabled();
  if (disabledResponse) return disabledResponse;

  const { userId } = await auth();

  if (!userId) {
    throw errors.unauthorized();
  }

  // LOCAL DEVELOPMENT BYPASS - always return premium for local testing
  if (
    process.env.NODE_ENV === 'development' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.LOCAL_DEV_BYPASS === 'true')
  ) {
    return NextResponse.json({
      isPremium: true,
      isSubscribed: true,
      stripePlan: 'premium',
      subscriptionStatus: 'active',
      currentPeriodEnd: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      cancelAtPeriodEnd: false,
    });
  }

  const user = await d1.getUser(userId);
  const debateLimit = await d1.checkUserDebateLimit(userId);

  if (!user) {
    // No user record means free tier
    return NextResponse.json({
      isPremium: false,
      isSubscribed: false,
      stripePlan: null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      debatesUsed: debateLimit.count,
      debatesLimit: debateLimit.limit,
    });
  }

  const isPremium = user.subscription_status === 'active' && user.stripe_plan === 'premium';

  return NextResponse.json({
    isPremium,
    isSubscribed: isPremium,
    stripePlan: user.stripe_plan,
    subscriptionStatus: user.subscription_status,
    currentPeriodEnd: user.current_period_end,
    cancelAtPeriodEnd: user.cancel_at_period_end,
    debatesUsed: debateLimit.count,
    debatesLimit: debateLimit.limit,
  });
});
