/**
 * Send all 6 email templates as test emails.
 * Usage: tsx scripts/send-test-emails.ts
 */

import { Resend } from 'resend';
import {
  dailyTopicEmail,
  welcomeEmail,
  unsubscribeConfirmationEmail,
  weeklyRecapEmail,
  challengeNotificationEmail,
  streakWarningEmail,
  winBackEmail,
} from '../src/lib/email-templates';

const RESEND_KEY = process.env.RESEND_API_KEY || 're_97d9gs4L_CUPJ7voAnWqikzunLyMJMhjg';
const FROM = process.env.EMAIL_FROM || 'DebateAI <debateai@colegottdank.com>';
const TO = 'colegottdank@gmail.com';

// Set env for templates
process.env.NEXT_PUBLIC_APP_URL = 'https://www.debateai.org';

const resend = new Resend(RESEND_KEY);

const templates = [
  { name: 'Welcome', ...welcomeEmail({ name: 'Cole', unsubscribeToken: 'test-token' }) },
  { name: 'Daily Topic', ...dailyTopicEmail({ topic: 'AI will replace most white-collar jobs within 10 years', persona: 'The Pragmatist', category: 'technology', unsubscribeToken: 'test-token' }) },
  { name: 'Streak Warning', ...streakWarningEmail({ streak: 14, unsubscribeToken: 'test-token' }) },
  { name: 'Challenge', ...challengeNotificationEmail({ topic: 'Social media does more harm than good', userScore: 82, opponentScore: 76, unsubscribeToken: 'test-token' }) },
  { name: 'Weekly Recap', ...weeklyRecapEmail({ stats: { totalDebates: 12, bestScore: 91, bestTopic: 'Free will is an illusion', streakCount: 7 }, trendingTopic: 'Should AI have legal rights?', unsubscribeToken: 'test-token' }) },
  { name: 'Win-back', ...winBackEmail({ trendingTopic: 'Universal basic income is inevitable', count: 247, aiWinPct: 63, unsubscribeToken: 'test-token' }) },
];

async function main() {
  for (const t of templates) {
    // Add delay between sends to respect rate limits
    const result = await resend.emails.send({
      from: FROM,
      to: TO,
      subject: `[TEST] ${t.name}: ${t.subject}`,
      html: t.html,
    });

    if (result.error) {
      console.error(`FAIL ${t.name}:`, result.error.message);
    } else {
      console.log(`SENT ${t.name}: ${result.data?.id}`);
    }

    // Wait 1s between sends
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\nDone! Check colegottdank@gmail.com for 6 test emails.');
}

main().catch(console.error);
