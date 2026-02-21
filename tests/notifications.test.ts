/**
 * Tests for src/lib/notifications.ts
 *
 * Validates notification creation with preference checks, score/streak/challenge
 * notification builders, sendStreakWarnings cron logic, and CRUD operations.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { d1 } from '@/lib/d1';

// Mock the email module (imported by notifications.ts)
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, id: 'email-123' }),
}));

vi.mock('@/lib/email-templates', () => ({
  streakWarningEmail: vi.fn(() => ({ subject: 'Streak Warning', html: '<h1>Warning</h1>' })),
  challengeNotificationEmail: vi.fn(() => ({ subject: 'Challenge', html: '<h1>Challenge</h1>' })),
}));

import {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  pruneOldNotifications,
  notifyScoreResult,
  notifyStreakMilestone,
  sendStreakWarnings,
  notifyChallenge,
  getPreferences,
} from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import { streakWarningEmail, challengeNotificationEmail } from '@/lib/email-templates';

const mockQuery = vi.mocked(d1.query);
const mockSendEmail = vi.mocked(sendEmail);
const mockStreakWarningEmail = vi.mocked(streakWarningEmail);
const mockChallengeNotificationEmail = vi.mocked(challengeNotificationEmail);

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.mockResolvedValue({ success: true, result: [] });
});

// ── getPreferences ──────────────────────────────────────────────

describe('getPreferences', () => {
  it('returns defaults when user has no saved preferences', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    const prefs = await getPreferences('user-1');

    expect(prefs).toEqual({
      streakWarning: true,
      challenge: true,
      scoreResult: true,
      milestone: true,
    });
  });

  it('returns saved preferences from database', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ streak_warning: 0, challenge: 1, score_result: 0, milestone: 1 }],
    });

    const prefs = await getPreferences('user-1');

    expect(prefs.streakWarning).toBe(false);
    expect(prefs.challenge).toBe(true);
    expect(prefs.scoreResult).toBe(false);
    expect(prefs.milestone).toBe(true);
  });

  it('queries correct table with correct user_id', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await getPreferences('user-abc');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('notification_preferences'),
      ['user-abc'],
    );
  });
});

// ── createNotification ──────────────────────────────────────────

describe('createNotification', () => {
  it('checks user preferences before inserting', async () => {
    // Preferences query: all enabled (default empty = defaults)
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    // INSERT
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await createNotification('user-1', 'score_result', 'Title', 'Message');

    // First call is preferences check
    expect(mockQuery.mock.calls[0][0]).toContain('notification_preferences');
    // Second call is INSERT
    expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO notifications');
  });

  it('skips INSERT when user opted out of that notification type', async () => {
    // User has score_result disabled
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ streak_warning: 1, challenge: 1, score_result: 0, milestone: 1 }],
    });

    const result = await createNotification('user-1', 'score_result', 'Title', 'Message');

    expect(result).toBe(false);
    // Only 1 call (preferences), no INSERT
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('returns true on successful insert', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert

    const result = await createNotification('user-1', 'challenge', 'Challenge!', 'Msg');

    expect(result).toBe(true);
  });

  it('passes correct parameters to INSERT', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert

    await createNotification('user-1', 'streak_warning', 'Warning', 'Your streak!', '/dashboard');

    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO notifications');
    const params = insertCall[1] as unknown[];
    // params: [id, userId, type, title, message, link]
    expect(params[1]).toBe('user-1');
    expect(params[2]).toBe('streak_warning');
    expect(params[3]).toBe('Warning');
    expect(params[4]).toBe('Your streak!');
    expect(params[5]).toBe('/dashboard');
  });

  it('passes null link when not provided', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert

    await createNotification('user-1', 'milestone', 'Milestone!', 'Great job');

    const insertCall = mockQuery.mock.calls[1];
    const params = insertCall[1] as unknown[];
    expect(params[5]).toBeNull(); // link
  });

  it('correctly maps each notification type to preference key', async () => {
    const types = [
      { type: 'streak_warning' as const, prefKey: 'streak_warning' },
      { type: 'challenge' as const, prefKey: 'challenge' },
      { type: 'score_result' as const, prefKey: 'score_result' },
      { type: 'milestone' as const, prefKey: 'milestone' },
    ];

    for (const { type, prefKey } of types) {
      vi.clearAllMocks();

      // Disable only the relevant preference
      const prefs: Record<string, number> = {
        streak_warning: 1,
        challenge: 1,
        score_result: 1,
        milestone: 1,
      };
      prefs[prefKey] = 0;

      mockQuery.mockResolvedValueOnce({ success: true, result: [prefs] });

      const result = await createNotification('user-1', type, 'T', 'M');
      expect(result).toBe(false);
      // Only prefs query, no INSERT
      expect(mockQuery).toHaveBeenCalledTimes(1);
    }
  });
});

// ── getNotifications ────────────────────────────────────────────

describe('getNotifications', () => {
  it('returns correct shape with notifications and unreadCount', async () => {
    // Notifications query
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [
        {
          id: 'notif-1',
          user_id: 'user-1',
          type: 'score_result',
          title: 'Debate Scored',
          message: 'You won!',
          link: '/debate/123',
          read: 0,
          created_at: '2024-01-15T10:00:00Z',
        },
      ],
    });
    // Unread count query
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ cnt: 3 }],
    });

    const result = await getNotifications('user-1');

    expect(result.notifications).toHaveLength(1);
    expect(result.unreadCount).toBe(3);

    const notif = result.notifications[0];
    expect(notif.id).toBe('notif-1');
    expect(notif.userId).toBe('user-1');
    expect(notif.type).toBe('score_result');
    expect(notif.title).toBe('Debate Scored');
    expect(notif.message).toBe('You won!');
    expect(notif.link).toBe('/debate/123');
    expect(notif.read).toBe(false); // 0 -> false
    expect(notif.createdAt).toBe('2024-01-15T10:00:00Z');
  });

  it('passes correct LIMIT and OFFSET to query', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [{ cnt: 0 }] });

    await getNotifications('user-1', 10, 5);

    const selectCall = mockQuery.mock.calls[0];
    expect(selectCall[1]).toEqual(['user-1', 10, 5]);
    expect(selectCall[0]).toContain('LIMIT ? OFFSET ?');
  });

  it('uses default limit=20 and offset=0', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [{ cnt: 0 }] });

    await getNotifications('user-1');

    const selectCall = mockQuery.mock.calls[0];
    expect(selectCall[1]).toEqual(['user-1', 20, 0]);
  });

  it('returns empty array and 0 count on failure', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, result: null });
    mockQuery.mockResolvedValueOnce({ success: false, result: null });

    const result = await getNotifications('user-1');

    expect(result.notifications).toEqual([]);
    expect(result.unreadCount).toBe(0);
  });

  it('maps read=1 to true and read=0 to false', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [
        { id: '1', user_id: 'u', type: 'milestone', title: 'T', message: 'M', link: null, read: 1, created_at: 'ts' },
        { id: '2', user_id: 'u', type: 'milestone', title: 'T', message: 'M', link: null, read: 0, created_at: 'ts' },
      ],
    });
    mockQuery.mockResolvedValueOnce({ success: true, result: [{ cnt: 1 }] });

    const result = await getNotifications('u');

    expect(result.notifications[0].read).toBe(true);
    expect(result.notifications[1].read).toBe(false);
  });

  it('returns null link when link is empty string or null', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [
        { id: '1', user_id: 'u', type: 'milestone', title: 'T', message: 'M', link: '', read: 0, created_at: 'ts' },
        { id: '2', user_id: 'u', type: 'milestone', title: 'T', message: 'M', link: null, read: 0, created_at: 'ts' },
      ],
    });
    mockQuery.mockResolvedValueOnce({ success: true, result: [{ cnt: 0 }] });

    const result = await getNotifications('u');

    expect(result.notifications[0].link).toBeNull();
    expect(result.notifications[1].link).toBeNull();
  });
});

// ── markAsRead ──────────────────────────────────────────────────

describe('markAsRead', () => {
  it('passes correct SQL with notification ID and user ID', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await markAsRead('user-1', 'notif-abc');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notifications SET read = 1'),
      ['notif-abc', 'user-1'],
    );
    // Verify it scopes by BOTH id AND user_id (security: user can only mark their own)
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE id = ? AND user_id = ?');
  });

  it('returns success status from D1', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    expect(await markAsRead('u', 'n')).toBe(true);

    mockQuery.mockResolvedValueOnce({ success: false, result: [] });
    expect(await markAsRead('u', 'n')).toBe(false);
  });
});

// ── markAllAsRead ───────────────────────────────────────────────

describe('markAllAsRead', () => {
  it('updates all unread notifications for the user', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await markAllAsRead('user-1');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notifications SET read = 1'),
      ['user-1'],
    );
    // Should only update unread ones (read = 0)
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE user_id = ? AND read = 0');
  });

  it('returns success status', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    expect(await markAllAsRead('u')).toBe(true);
  });
});

// ── pruneOldNotifications ───────────────────────────────────────

describe('pruneOldNotifications', () => {
  it('deletes notifications older than 30 days', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await pruneOldNotifications();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM notifications WHERE created_at < datetime('now', '-30 days')"),
    );
  });
});

// ── notifyScoreResult ───────────────────────────────────────────

describe('notifyScoreResult', () => {
  it('builds correct title and message for a WIN', async () => {
    // Prefs check
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    // INSERT
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await notifyScoreResult('user-1', 'Is AI sentient?', 'win', 85, 'debate-123');

    const insertCall = mockQuery.mock.calls[1];
    const params = insertCall[1] as unknown[];
    // title
    expect(params[3]).toContain('Debate Scored');
    // message should contain "You won!" and score
    expect(params[4]).toContain('You won!');
    expect(params[4]).toContain('85');
    expect(params[4]).toContain('Is AI sentient?');
    // link
    expect(params[5]).toBe('/debate/debate-123');
  });

  it('builds correct message for a LOSS', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await notifyScoreResult('user-1', 'Topic', 'loss', 40, 'debate-456');

    const params = mockQuery.mock.calls[1][1] as unknown[];
    expect(params[4]).toContain('AI takes this round');
    expect(params[4]).toContain('40');
  });

  it('builds correct message for a DRAW', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await notifyScoreResult('user-1', 'Topic', 'draw', 72, 'debate-789');

    const params = mockQuery.mock.calls[1][1] as unknown[];
    expect(params[4]).toContain("It's a draw!");
    expect(params[4]).toContain('72');
  });

  it('truncates long topics to 50 characters', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    const longTopic = 'A'.repeat(100);
    await notifyScoreResult('user-1', longTopic, 'win', 80, 'd-1');

    const params = mockQuery.mock.calls[1][1] as unknown[];
    const message = params[4] as string;
    // Truncated topic should be at most 50 chars (49 + ellipsis)
    expect(message.length).toBeLessThan(100 + 50); // message includes prefix text
    expect(message).toContain('…');
  });

  it('uses correct notification type "score_result"', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await notifyScoreResult('user-1', 'Topic', 'win', 80, 'd-1');

    const params = mockQuery.mock.calls[1][1] as unknown[];
    expect(params[2]).toBe('score_result');
  });
});

// ── notifyStreakMilestone ────────────────────────────────────────

describe('notifyStreakMilestone', () => {
  it('fires at milestone numbers: 7, 14, 30, 60, 100', async () => {
    const milestones = [7, 14, 30, 60, 100];

    for (const streak of milestones) {
      vi.clearAllMocks();
      mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
      mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert

      await notifyStreakMilestone('user-1', streak);

      // Should have called createNotification -> 2 queries (prefs + insert)
      expect(mockQuery).toHaveBeenCalledTimes(2);

      const params = mockQuery.mock.calls[1][1] as unknown[];
      expect(params[2]).toBe('milestone');
      expect(params[3]).toContain(`${streak}-Day Streak`);
    }
  });

  it('skips non-milestone numbers', async () => {
    const nonMilestones = [1, 2, 5, 8, 13, 15, 29, 31, 50, 99, 101];

    for (const streak of nonMilestones) {
      vi.clearAllMocks();

      await notifyStreakMilestone('user-1', streak);

      // Should not make ANY queries
      expect(mockQuery).not.toHaveBeenCalled();
    }
  });

  it('includes appropriate message for each milestone', async () => {
    const expectedMessages: Record<number, string> = {
      7: 'building a habit',
      14: 'leveling up',
      30: 'debate machine',
      60: 'truly dedicated',
      100: '100-day streak',
    };

    for (const [streak, expectedText] of Object.entries(expectedMessages)) {
      vi.clearAllMocks();
      mockQuery.mockResolvedValueOnce({ success: true, result: [] });
      mockQuery.mockResolvedValueOnce({ success: true, result: [] });

      await notifyStreakMilestone('user-1', Number(streak));

      const params = mockQuery.mock.calls[1][1] as unknown[];
      expect(params[4]).toContain(expectedText);
    }
  });

  it('uses increasingly intense emoji for higher streaks', async () => {
    // streak < 14: single fire
    vi.clearAllMocks();
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    await notifyStreakMilestone('user-1', 7);
    let title = (mockQuery.mock.calls[1][1] as unknown[])[3] as string;
    expect(title).toContain('🔥');
    expect(title).not.toContain('🔥🔥');

    // streak >= 14 && < 30: double fire
    vi.clearAllMocks();
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    await notifyStreakMilestone('user-1', 14);
    title = (mockQuery.mock.calls[1][1] as unknown[])[3] as string;
    expect(title).toContain('🔥🔥');

    // streak >= 30: triple fire
    vi.clearAllMocks();
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    await notifyStreakMilestone('user-1', 30);
    title = (mockQuery.mock.calls[1][1] as unknown[])[3] as string;
    expect(title).toContain('🔥🔥🔥');
  });

  it('links to /explore', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await notifyStreakMilestone('user-1', 7);

    const params = mockQuery.mock.calls[1][1] as unknown[];
    expect(params[5]).toBe('/explore');
  });
});

// ── sendStreakWarnings ───────────────────────────────────────────

describe('sendStreakWarnings', () => {
  it('queries user_streaks joined with email_preferences (NOT users table)', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // Main query
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // pruneOldNotifications

    await sendStreakWarnings();

    const mainQuery = mockQuery.mock.calls[0][0] as string;
    // Must join email_preferences, not users table
    expect(mainQuery).toContain('email_preferences');
    expect(mainQuery).toContain('user_streaks');
    // Should get email from email_preferences
    expect(mainQuery).toContain('ep.email');
    // Should get unsubscribe_token from email_preferences
    expect(mainQuery).toContain('ep.unsubscribe_token');
  });

  it('uses yesterday date as parameter', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prune

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(now);

    await sendStreakWarnings();

    const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
    expect(mockQuery.mock.calls[0][1]).toEqual([yesterday]);

    vi.restoreAllMocks();
  });

  it('creates notification and sends email for each user with email', async () => {
    // Main query returns 2 users
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [
        { user_id: 'user-1', current_streak: 5, email: 'alice@test.com', unsubscribe_token: 'tok-1' },
        { user_id: 'user-2', current_streak: 10, email: 'bob@test.com', unsubscribe_token: 'tok-2' },
      ],
    });

    // For each user: getPreferences + createNotification INSERT
    // User 1: prefs check (defaults)
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    // User 1: INSERT notification
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    // User 2: prefs check
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    // User 2: INSERT notification
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    // pruneOldNotifications
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    const sent = await sendStreakWarnings();

    expect(sent).toBe(2);

    // Should have sent 2 emails
    expect(mockSendEmail).toHaveBeenCalledTimes(2);

    // Verify first email
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'alice@test.com',
      subject: 'Streak Warning',
      html: '<h1>Warning</h1>',
      tags: [{ name: 'category', value: 'streak_warning' }],
    });
  });

  it('uses unsubscribe_token from email_preferences (not user_id)', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [
        { user_id: 'user-1', current_streak: 5, email: 'alice@test.com', unsubscribe_token: 'special-tok-abc' },
      ],
    });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prune

    await sendStreakWarnings();

    // streakWarningEmail should be called with the token from email_preferences
    expect(mockStreakWarningEmail).toHaveBeenCalledWith({
      streak: 5,
      unsubscribeToken: 'special-tok-abc',
    });
  });

  it('falls back to user_id when unsubscribe_token is null', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [
        { user_id: 'user-1', current_streak: 5, email: 'alice@test.com', unsubscribe_token: null },
      ],
    });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prune

    await sendStreakWarnings();

    expect(mockStreakWarningEmail).toHaveBeenCalledWith({
      streak: 5,
      unsubscribeToken: 'user-1', // Falls back to userId
    });
  });

  it('skips email when user has no email (but still creates notification)', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [
        { user_id: 'user-1', current_streak: 5, email: null, unsubscribe_token: 'tok-1' },
      ],
    });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prune

    const sent = await sendStreakWarnings();

    expect(sent).toBe(1); // Notification was created
    expect(mockSendEmail).not.toHaveBeenCalled(); // But no email sent
  });

  it('skips email AND notification when user opted out of streak_warning', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [
        { user_id: 'user-1', current_streak: 5, email: 'alice@test.com', unsubscribe_token: 'tok-1' },
      ],
    });
    // User has streak_warning disabled
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ streak_warning: 0, challenge: 1, score_result: 1, milestone: 1 }],
    });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prune

    const sent = await sendStreakWarnings();

    expect(sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('calls pruneOldNotifications at the end', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // main query
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prune

    await sendStreakWarnings();

    // Last query should be the prune
    const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
    expect(lastCall[0]).toContain('DELETE FROM notifications');
    expect(lastCall[0]).toContain('-30 days');
  });

  it('returns 0 when main query fails', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, result: null });

    const sent = await sendStreakWarnings();

    expect(sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('filters for users with streak >= 2 and last_debate_date = yesterday', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prune

    await sendStreakWarnings();

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('us.current_streak >= 2');
    expect(sql).toContain('us.last_debate_date = ?');
  });

  it('passes streak count to streakWarningEmail template', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [
        { user_id: 'user-1', current_streak: 42, email: 'alice@test.com', unsubscribe_token: 'tok-1' },
      ],
    });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prune

    await sendStreakWarnings();

    expect(mockStreakWarningEmail).toHaveBeenCalledWith(
      expect.objectContaining({ streak: 42 }),
    );
  });
});

// ── notifyChallenge ─────────────────────────────────────────────

describe('notifyChallenge', () => {
  it('creates notification with correct title and message', async () => {
    // createNotification: prefs check
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    // createNotification: INSERT
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    // Email lookup
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ email: 'target@test.com' }],
    });

    await notifyChallenge('user-1', 'AliceDebater', 'UBI is good', 'debate-1', 80, 70);

    // Verify notification INSERT params
    const insertCall = mockQuery.mock.calls[1];
    const params = insertCall[1] as unknown[];
    expect(params[2]).toBe('challenge'); // type
    expect(params[3]).toContain('Challenged'); // title
    expect(params[4]).toContain('AliceDebater'); // message contains challenger name
    expect(params[4]).toContain('UBI is good'); // message contains topic
    expect(params[5]).toBe('/debate/debate-1'); // link
  });

  it('sends email when user has email in users table', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ email: 'target@test.com' }],
    }); // email lookup

    await notifyChallenge('user-1', 'Challenger', 'Topic', 'debate-1', 80, 70);

    expect(mockChallengeNotificationEmail).toHaveBeenCalledWith({
      topic: 'Topic',
      userScore: 80,
      opponentScore: 70,
      unsubscribeToken: 'user-1',
    });

    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'target@test.com',
      subject: 'Challenge',
      html: '<h1>Challenge</h1>',
      tags: [{ name: 'category', value: 'challenge' }],
    });
  });

  it('does NOT send email when user has no email', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // email lookup returns empty

    await notifyChallenge('user-1', 'Challenger', 'Topic', 'debate-1', 80, 70);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('does NOT send email when notification creation was skipped (user opted out)', async () => {
    // User opted out of challenge notifications
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ streak_warning: 1, challenge: 0, score_result: 1, milestone: 1 }],
    });

    await notifyChallenge('user-1', 'Challenger', 'Topic', 'debate-1', 80, 70);

    // Should not even look up email
    expect(mockQuery).toHaveBeenCalledTimes(1); // Only the prefs check
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('does NOT send email when email field is null', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ email: null }],
    }); // email exists but null

    await notifyChallenge('user-1', 'Challenger', 'Topic', 'debate-1', 80, 70);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('looks up email from users table (not email_preferences)', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert
    mockQuery.mockResolvedValueOnce({ success: true, result: [{ email: 'a@b.com' }] }); // email lookup

    await notifyChallenge('user-1', 'C', 'T', 'd', 1, 2);

    // The email lookup query should query users table
    const emailLookupCall = mockQuery.mock.calls[2];
    expect(emailLookupCall[0]).toContain('SELECT email FROM users');
    expect(emailLookupCall[1]).toEqual(['user-1']);
  });

  it('truncates long topic in notification message', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // prefs
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // insert
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // no email

    const longTopic = 'X'.repeat(100);
    await notifyChallenge('user-1', 'Challenger', longTopic, 'debate-1', 80, 70);

    const params = mockQuery.mock.calls[1][1] as unknown[];
    const message = params[4] as string;
    // The topic portion should be truncated
    expect(message).toContain('…');
  });
});
