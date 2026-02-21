import { NextRequest, NextResponse } from 'next/server';
import { getWeeklyRecapRecipients } from '@/lib/email-preferences';
import { sendBatchEmails } from '@/lib/email';
import { weeklyRecapEmail } from '@/lib/email-templates';
import { d1 } from '@/lib/d1';
import { getStreak } from '@/lib/streaks';
import { verifyCronSecret, getTrendingTopic } from '@/lib/cron-helpers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    // 1. Get global trending topic (last 7 days)
    const trending = await getTrendingTopic();
    const trendingTopic = trending?.topic || 'Artificial Intelligence';

    // 2. Get recipients (paginate to cover all subscribers)
    const recipients = await getWeeklyRecapRecipients(500, 0);
    if (recipients.length === 0) {
      return NextResponse.json({ message: 'No recipients' });
    }

    const emails = [];

    for (const r of recipients) {
      // Get User Stats
      // Parallelize queries for speed
      const [totalResult, bestResult, streakResult] = await Promise.all([
        d1.query(
          `SELECT COUNT(*) as total FROM debates WHERE user_id = ? AND created_at >= date('now', '-7 days')`,
          [r.user_id]
        ),
        d1.query(
          `SELECT topic, json_extract(score_data, '$.debateScore.userScore') as score
           FROM debates
           WHERE user_id = ? AND created_at >= date('now', '-7 days') AND score_data IS NOT NULL
           ORDER BY CAST(score AS INTEGER) DESC LIMIT 1`,
          [r.user_id]
        ),
        getStreak(r.user_id)
      ]);

      const totalDebates = (totalResult.result?.[0]?.total as number) || 0;
      const bestRow = bestResult.result?.[0] as Record<string, any> | undefined;
      const bestScore = (bestRow?.score as number) || 0;
      const bestTopic = (bestRow?.topic as string) || '';
      const streakCount = streakResult.currentStreak;

      // Create email content
      const { subject, html } = weeklyRecapEmail({
        stats: {
          totalDebates,
          bestScore,
          bestTopic,
          streakCount,
        },
        trendingTopic,
        unsubscribeToken: r.unsubscribe_token,
      });

      emails.push({
        to: r.email,
        subject,
        html,
        tags: [{ name: 'type', value: 'weekly_recap' }],
      });
    }

    // Send batch
    const result = await sendBatchEmails(emails);

    return NextResponse.json({
      sent: result.sent,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Weekly recap error:', error);
    return NextResponse.json({ error: 'Failed to send weekly recap' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
