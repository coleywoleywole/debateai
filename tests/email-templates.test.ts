/**
 * Tests for src/lib/email-templates.ts
 *
 * Validates email template generation: correct subjects, HTML output,
 * unsubscribe links, escapeHtml XSS prevention, conditional content.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock email.ts since email-templates imports getUnsubscribeUrl and getDebateUrl
vi.mock('@/lib/email', () => ({
  getUnsubscribeUrl: vi.fn(
    (token: string) => `https://debateai.org/api/email/unsubscribe?token=${encodeURIComponent(token)}`,
  ),
  getDebateUrl: vi.fn((topic?: string) =>
    topic
      ? `https://debateai.org/?topic=${encodeURIComponent(topic)}`
      : 'https://debateai.org/debate',
  ),
}));

import {
  welcomeEmail,
  dailyTopicEmail,
  streakWarningEmail,
  weeklyRecapEmail,
  challengeNotificationEmail,
  unsubscribeConfirmationEmail,
  winBackEmail,
} from '@/lib/email-templates';

// ── welcomeEmail ──────────────────────────────────────────────────

describe('welcomeEmail', () => {
  it('returns subject and html with non-empty values', () => {
    const result = welcomeEmail({ name: 'Alice', unsubscribeToken: 'tok-123' });
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
    expect(typeof result.subject).toBe('string');
    expect(typeof result.html).toBe('string');
  });

  it('uses the provided name in the greeting', () => {
    const result = welcomeEmail({ name: 'Alice', unsubscribeToken: 'tok-123' });
    expect(result.html).toContain('Hey Alice');
  });

  it('defaults greeting to "Welcome" when no name provided', () => {
    const result = welcomeEmail({ unsubscribeToken: 'tok-123' });
    expect(result.html).toContain("Welcome, you're in.");
    // Should NOT contain "Hey undefined" or "Hey null"
    expect(result.html).not.toContain('Hey undefined');
    expect(result.html).not.toContain('Hey null');
  });

  it('includes unsubscribe link in HTML', () => {
    const result = welcomeEmail({ name: 'Bob', unsubscribeToken: 'tok-abc' });
    expect(result.html).toContain('unsubscribe');
    expect(result.html).toContain('tok-abc');
  });

  it('escapes HTML in the name to prevent XSS', () => {
    const result = welcomeEmail({ name: '<script>alert("xss")</script>', unsubscribeToken: 'tok-123' });
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('subject line is stable and expected', () => {
    const result = welcomeEmail({ unsubscribeToken: 'tok-123' });
    expect(result.subject).toBe("You're in — your first debate topic drops tomorrow at 9am");
  });
});

// ── dailyTopicEmail ───────────────────────────────────────────────

describe('dailyTopicEmail', () => {
  const baseOpts = {
    topic: 'Is AI art real art?',
    persona: 'Socrates',
    category: 'philosophy',
    unsubscribeToken: 'tok-daily',
  };

  it('returns subject and html with non-empty values', () => {
    const result = dailyTopicEmail(baseOpts);
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
  });

  it('includes the topic in the subject line', () => {
    const result = dailyTopicEmail(baseOpts);
    expect(result.subject).toContain('Is AI art real art?');
    expect(result.subject).toBe("Today's debate: Is AI art real art?");
  });

  it('includes the topic in the HTML body', () => {
    const result = dailyTopicEmail(baseOpts);
    expect(result.html).toContain('Is AI art real art?');
  });

  it('includes the persona name in the HTML body', () => {
    const result = dailyTopicEmail(baseOpts);
    expect(result.html).toContain('Socrates');
  });

  it('includes the category emoji for known categories', () => {
    const result = dailyTopicEmail(baseOpts);
    // philosophy maps to brain emoji
    expect(result.html).toContain('🧠');
  });

  it('uses fallback emoji for unknown categories', () => {
    const result = dailyTopicEmail({ ...baseOpts, category: 'unknown-category' });
    expect(result.html).toContain('💡');
  });

  it('includes unsubscribe link', () => {
    const result = dailyTopicEmail(baseOpts);
    expect(result.html).toContain('Unsubscribe');
    expect(result.html).toContain('tok-daily');
  });

  it('escapes HTML in topic to prevent XSS', () => {
    const result = dailyTopicEmail({
      ...baseOpts,
      topic: '<script>alert("xss")</script>',
    });
    expect(result.html).not.toContain('<script>alert');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in persona name', () => {
    const result = dailyTopicEmail({
      ...baseOpts,
      persona: '<img src=x onerror=alert(1)>',
    });
    expect(result.html).not.toContain('<img src=x');
    expect(result.html).toContain('&lt;img');
  });
});

// ── streakWarningEmail ────────────────────────────────────────────

describe('streakWarningEmail', () => {
  it('returns subject and html with non-empty values', () => {
    const result = streakWarningEmail({ streak: 7, unsubscribeToken: 'tok-streak' });
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
  });

  it('includes streak count in the subject line', () => {
    const result = streakWarningEmail({ streak: 14, unsubscribeToken: 'tok-streak' });
    expect(result.subject).toContain('14');
    expect(result.subject).toBe('⚠️ Your 14-day streak expires in a few hours');
  });

  it('includes streak count in the body', () => {
    const result = streakWarningEmail({ streak: 30, unsubscribeToken: 'tok-streak' });
    expect(result.html).toContain('30-day streak');
    expect(result.html).toContain('30 days in a row');
  });

  it('includes unsubscribe link', () => {
    const result = streakWarningEmail({ streak: 5, unsubscribeToken: 'tok-streak' });
    expect(result.html).toContain('Unsubscribe');
    expect(result.html).toContain('tok-streak');
  });

  it('includes urgency messaging', () => {
    const result = streakWarningEmail({ streak: 5, unsubscribeToken: 'tok-streak' });
    expect(result.html).toContain('midnight UTC');
    expect(result.html).toContain('Streak Expires Soon');
  });
});

// ── weeklyRecapEmail ──────────────────────────────────────────────

describe('weeklyRecapEmail', () => {
  const activeStats = {
    totalDebates: 5,
    bestScore: 92,
    bestTopic: 'Is free will an illusion?',
    streakCount: 3,
  };

  it('returns subject and html with non-empty values', () => {
    const result = weeklyRecapEmail({
      stats: activeStats,
      trendingTopic: 'AI Ethics',
      unsubscribeToken: 'tok-recap',
    });
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
  });

  it('shows "You took the week off" when totalDebates === 0', () => {
    const result = weeklyRecapEmail({
      stats: { totalDebates: 0, bestScore: 0, bestTopic: '', streakCount: 0 },
      trendingTopic: 'Some trending topic',
      unsubscribeToken: 'tok-recap',
    });
    expect(result.html).toContain('You took the week off');
    // Should NOT contain the stats grid
    expect(result.html).not.toContain('Weekly Recap');
    expect(result.html).not.toContain('Best Performance');
  });

  it('shows stats when totalDebates > 0', () => {
    const result = weeklyRecapEmail({
      stats: activeStats,
      trendingTopic: 'AI Ethics',
      unsubscribeToken: 'tok-recap',
    });
    expect(result.html).toContain('Weekly Recap');
    expect(result.html).toContain('5'); // total debates
    expect(result.html).toContain('92%'); // best score
    expect(result.html).toContain('Is free will an illusion?'); // best topic
    expect(result.html).toContain('3'); // streak count
  });

  it('includes best score section only when bestScore > 0', () => {
    const noScoreStats = { ...activeStats, bestScore: 0 };
    const result = weeklyRecapEmail({
      stats: noScoreStats,
      trendingTopic: 'AI Ethics',
      unsubscribeToken: 'tok-recap',
    });
    expect(result.html).not.toContain('Best Performance');
  });

  it('includes trending topic regardless of debate count', () => {
    const zeroResult = weeklyRecapEmail({
      stats: { totalDebates: 0, bestScore: 0, bestTopic: '', streakCount: 0 },
      trendingTopic: 'Climate Change',
      unsubscribeToken: 'tok-recap',
    });
    expect(zeroResult.html).toContain('Climate Change');
    expect(zeroResult.html).toContain('Trending this week');

    const activeResult = weeklyRecapEmail({
      stats: activeStats,
      trendingTopic: 'Climate Change',
      unsubscribeToken: 'tok-recap',
    });
    expect(activeResult.html).toContain('Climate Change');
  });

  it('subject includes debate count and best score', () => {
    const result = weeklyRecapEmail({
      stats: activeStats,
      trendingTopic: 'AI',
      unsubscribeToken: 'tok-recap',
    });
    expect(result.subject).toContain('5 debates');
    expect(result.subject).toContain('92% best score');
  });

  it('subject omits best score when it is 0', () => {
    const result = weeklyRecapEmail({
      stats: { totalDebates: 3, bestScore: 0, bestTopic: '', streakCount: 0 },
      trendingTopic: 'AI',
      unsubscribeToken: 'tok-recap',
    });
    expect(result.subject).toContain('3 debates');
    expect(result.subject).not.toContain('best score');
  });

  it('escapes HTML in bestTopic and trendingTopic', () => {
    const result = weeklyRecapEmail({
      stats: { ...activeStats, bestTopic: '<script>xss</script>' },
      trendingTopic: '<img onerror=alert(1)>',
      unsubscribeToken: 'tok-recap',
    });
    expect(result.html).not.toContain('<script>xss');
    expect(result.html).not.toContain('<img onerror');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).toContain('&lt;img');
  });

  it('includes unsubscribe link', () => {
    const result = weeklyRecapEmail({
      stats: activeStats,
      trendingTopic: 'AI',
      unsubscribeToken: 'tok-recap',
    });
    expect(result.html).toContain('Unsubscribe');
    expect(result.html).toContain('tok-recap');
  });
});

// ── challengeNotificationEmail ────────────────────────────────────

describe('challengeNotificationEmail', () => {
  it('returns subject and html with non-empty values', () => {
    const result = challengeNotificationEmail({
      topic: 'Universal basic income',
      userScore: 80,
      opponentScore: 70,
      unsubscribeToken: 'tok-challenge',
    });
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
  });

  it('shows "You\'re winning!" when userScore > opponentScore', () => {
    const result = challengeNotificationEmail({
      topic: 'UBI',
      userScore: 85,
      opponentScore: 70,
      unsubscribeToken: 'tok-challenge',
    });
    expect(result.html).toContain("You're winning!");
    expect(result.html).not.toContain("They're ahead");
    expect(result.html).not.toContain("It's a tie!");
  });

  it('shows "They\'re ahead" when opponentScore > userScore', () => {
    const result = challengeNotificationEmail({
      topic: 'UBI',
      userScore: 60,
      opponentScore: 85,
      unsubscribeToken: 'tok-challenge',
    });
    expect(result.html).toContain("They're ahead");
    expect(result.html).not.toContain("You're winning!");
  });

  it('shows "It\'s a tie!" when scores are equal', () => {
    const result = challengeNotificationEmail({
      topic: 'UBI',
      userScore: 75,
      opponentScore: 75,
      unsubscribeToken: 'tok-challenge',
    });
    expect(result.html).toContain("It's a tie!");
  });

  it('includes both scores in the HTML', () => {
    const result = challengeNotificationEmail({
      topic: 'UBI',
      userScore: 80,
      opponentScore: 65,
      unsubscribeToken: 'tok-challenge',
    });
    expect(result.html).toContain('80');
    expect(result.html).toContain('65');
    expect(result.html).toContain('Your Score');
    expect(result.html).toContain('Their Score');
  });

  it('includes topic in subject line', () => {
    const result = challengeNotificationEmail({
      topic: 'Universal basic income',
      userScore: 80,
      opponentScore: 70,
      unsubscribeToken: 'tok-challenge',
    });
    expect(result.subject).toContain('Universal basic income');
  });

  it('escapes HTML in topic', () => {
    const result = challengeNotificationEmail({
      topic: '<script>alert("xss")</script>',
      userScore: 80,
      opponentScore: 70,
      unsubscribeToken: 'tok-challenge',
    });
    expect(result.html).not.toContain('<script>alert');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('includes unsubscribe link', () => {
    const result = challengeNotificationEmail({
      topic: 'UBI',
      userScore: 80,
      opponentScore: 70,
      unsubscribeToken: 'tok-challenge',
    });
    expect(result.html).toContain('Unsubscribe');
    expect(result.html).toContain('tok-challenge');
  });
});

// ── unsubscribeConfirmationEmail ──────────────────────────────────

describe('unsubscribeConfirmationEmail', () => {
  it('returns subject and html', () => {
    const result = unsubscribeConfirmationEmail({
      email: 'test@example.com',
      unsubscribeToken: 'tok-unsub',
    });
    expect(result.subject).toContain('unsubscribed');
    expect(result.html).toContain('unsubscribed');
  });

  it('includes re-subscribe link', () => {
    const result = unsubscribeConfirmationEmail({
      email: 'test@example.com',
      unsubscribeToken: 'tok-unsub',
    });
    expect(result.html).toContain('Re-subscribe');
  });
});

// ── winBackEmail ──────────────────────────────────────────────────

describe('winBackEmail', () => {
  it('returns subject and html with non-empty values', () => {
    const result = winBackEmail({
      trendingTopic: 'AI Ethics',
      count: 42,
      aiWinPct: 68,
      unsubscribeToken: 'tok-winback',
    });
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
  });

  it('includes debate count and AI win percentage', () => {
    const result = winBackEmail({
      trendingTopic: 'AI Ethics',
      count: 42,
      aiWinPct: 68,
      unsubscribeToken: 'tok-winback',
    });
    expect(result.html).toContain('42');
    expect(result.html).toContain('68%');
  });

  it('includes unsubscribe link', () => {
    const result = winBackEmail({
      trendingTopic: 'AI Ethics',
      count: 42,
      aiWinPct: 68,
      unsubscribeToken: 'tok-winback',
    });
    expect(result.html).toContain('Unsubscribe');
    expect(result.html).toContain('tok-winback');
  });
});

// ── escapeHtml (tested indirectly via templates) ──────────────────

describe('escapeHtml', () => {
  it('escapes all dangerous HTML characters via template injection', () => {
    const result = dailyTopicEmail({
      topic: '&<>"\'',
      persona: 'test',
      category: 'philosophy',
      unsubscribeToken: 'tok-test',
    });
    // The topic goes through escapeHtml before being inserted
    expect(result.html).toContain('&amp;');
    expect(result.html).toContain('&lt;');
    expect(result.html).toContain('&gt;');
    expect(result.html).toContain('&quot;');
    expect(result.html).toContain('&#039;');
  });

  it('prevents script injection via topic in dailyTopicEmail', () => {
    const result = dailyTopicEmail({
      topic: '<script>document.cookie</script>',
      persona: 'AI',
      category: 'technology',
      unsubscribeToken: 'tok-test',
    });
    // Raw script tags must NOT appear in output
    expect(result.html).not.toContain('<script>document.cookie</script>');
    // They should be escaped
    expect(result.html).toContain('&lt;script&gt;document.cookie&lt;/script&gt;');
  });

  it('prevents injection via persona name', () => {
    const result = dailyTopicEmail({
      topic: 'Normal topic',
      persona: '"><img src=x onerror=alert(1)>',
      category: 'ethics',
      unsubscribeToken: 'tok-test',
    });
    expect(result.html).not.toContain('onerror=alert(1)>');
  });
});
