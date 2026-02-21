/**
 * POST /api/cron/send-daily-digest
 *
 * Called by Vercel Cron at 9am PST (17:00 UTC) daily.
 * Sends the daily topic email to all opted-in users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentDailyTopic } from '@/lib/daily-topics-db';
import { getDailyDigestRecipients, getDailyDigestCount } from '@/lib/email-preferences';
import { sendBatchEmails } from '@/lib/email';
import { dailyTopicEmail } from '@/lib/email-templates';
import { verifyCronSecret } from '@/lib/cron-helpers';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60s for batch sending

export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    // 1. Get today's topic
    const topic = await getCurrentDailyTopic();

    if (!topic) {
      console.error('Daily digest: No topic available');
      return NextResponse.json(
        { error: 'No daily topic available' },
        { status: 500 },
      );
    }

    // 2. Get subscriber count
    const totalRecipients = await getDailyDigestCount();

    if (totalRecipients === 0) {
      return NextResponse.json({
        sent: 0,
        total: 0,
        message: 'No subscribers for daily digest',
      });
    }

    // 3. Send in batches (500 at a time from D1, 100 per Resend batch)
    let totalSent = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];
    let offset = 0;
    const batchSize = 500;

    while (offset < totalRecipients) {
      const recipients = await getDailyDigestRecipients(batchSize, offset);
      if (recipients.length === 0) break;

      // Build emails
      const emails = recipients.map((r) => {
        const { subject, html } = dailyTopicEmail({
          topic: topic.topic,
          persona: topic.persona,
          category: topic.category,
          unsubscribeToken: r.unsubscribe_token,
        });

        return {
          to: r.email,
          subject,
          html,
          tags: [
            { name: 'type', value: 'daily_digest' },
            { name: 'topic_category', value: topic.category },
          ],
        };
      });

      const result = await sendBatchEmails(emails);
      totalSent += result.sent;
      totalFailed += result.failed;
      allErrors.push(...result.errors);

      offset += batchSize;
    }

    console.log(
      `Daily digest sent: ${totalSent} sent, ${totalFailed} failed, topic: "${topic.topic}"`,
    );

    return NextResponse.json({
      sent: totalSent,
      failed: totalFailed,
      total: totalRecipients,
      topic: topic.topic,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (error) {
    console.error('Daily digest cron error:', error);
    return NextResponse.json({ error: 'Failed to send daily digest' }, { status: 500 });
  }
}

// Support GET for manual trigger / Vercel Cron
export async function GET(request: NextRequest) {
  return POST(request);
}
