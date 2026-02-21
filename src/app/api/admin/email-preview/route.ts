/**
 * GET /api/admin/email-preview?template=welcome
 *
 * Renders email templates as raw HTML for visual preview.
 * Admin-only (ADMIN_SECRET required).
 *
 * Templates: welcome, daily_topic, streak_warning, challenge, weekly_recap, win_back, unsubscribe
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  welcomeEmail,
  dailyTopicEmail,
  streakWarningEmail,
  challengeNotificationEmail,
  weeklyRecapEmail,
  winBackEmail,
  unsubscribeConfirmationEmail,
} from '@/lib/email-templates';

export async function GET(request: NextRequest) {
  // Auth check
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    // In dev, allow without auth
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const template = request.nextUrl.searchParams.get('template') || 'welcome';

  const templates: Record<string, () => { subject: string; html: string }> = {
    welcome: () => welcomeEmail({ name: 'Cole', unsubscribeToken: 'test' }),
    daily_topic: () => dailyTopicEmail({
      topic: 'AI will replace most white-collar jobs within 10 years',
      persona: 'The Pragmatist',
      category: 'technology',
      unsubscribeToken: 'test',
    }),
    streak_warning: () => streakWarningEmail({ streak: 14, unsubscribeToken: 'test' }),
    challenge: () => challengeNotificationEmail({
      topic: 'Social media does more harm than good',
      userScore: 82,
      opponentScore: 76,
      unsubscribeToken: 'test',
    }),
    weekly_recap: () => weeklyRecapEmail({
      stats: { totalDebates: 12, bestScore: 91, bestTopic: 'Free will is an illusion', streakCount: 7 },
      trendingTopic: 'Should AI have legal rights?',
      unsubscribeToken: 'test',
    }),
    win_back: () => winBackEmail({
      trendingTopic: 'Universal basic income is inevitable',
      count: 247,
      aiWinPct: 63,
      unsubscribeToken: 'test',
    }),
    unsubscribe: () => unsubscribeConfirmationEmail({
      email: 'cole@example.com',
      unsubscribeToken: 'test',
    }),
  };

  const templateFn = templates[template];
  if (!templateFn) {
    const available = Object.keys(templates).join(', ');
    return NextResponse.json({ error: `Unknown template. Available: ${available}` }, { status: 400 });
  }

  const { html } = templateFn();

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
