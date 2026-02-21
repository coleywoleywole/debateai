import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-errors';
import { sendStreakWarnings } from '@/lib/notifications';
import { verifyCronSecret } from '@/lib/cron-helpers';

/**
 * POST /api/cron/streak-warnings
 *
 * Vercel Cron endpoint. Fires streak warning notifications for users
 * whose streaks will expire at midnight UTC.
 *
 * Schedule: daily at 22:00 UTC (gives users ~2h to debate).
 */
export const POST = withErrorHandler(async (request: Request) => {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const sent = await sendStreakWarnings();

  return NextResponse.json({
    success: true,
    warningsSent: sent,
    timestamp: new Date().toISOString(),
  });
});

// Also support GET for Vercel Cron
export const GET = POST;
