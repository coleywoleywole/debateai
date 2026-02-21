/**
 * In-app notification system.
 *
 * All state lives in D1. Notifications are created by backend triggers
 * (score, streak, challenge) and read by the NotificationBell component.
 */

import { d1 } from './d1';
import { sendEmail } from './email';
import { streakWarningEmail, challengeNotificationEmail } from './email-templates';

// ── Types ────────────────────────────────────────────────────────

export type NotificationType = 'score_result' | 'streak_warning' | 'milestone' | 'challenge';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  streakWarning: boolean;
  challenge: boolean;
  scoreResult: boolean;
  milestone: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  streakWarning: true,
  challenge: true,
  scoreResult: true,
  milestone: true,
};

// Map notification type to preference key
const TYPE_TO_PREF: Record<NotificationType, keyof NotificationPreferences> = {
  streak_warning: 'streakWarning',
  challenge: 'challenge',
  score_result: 'scoreResult',
  milestone: 'milestone',
};

// ── Table Creation ───────────────────────────────────────────────

export async function createNotificationTables() {
  await d1.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await d1.query(`CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, read, created_at DESC)`);
  await d1.query(`CREATE INDEX IF NOT EXISTS idx_notif_user_created ON notifications(user_id, created_at DESC)`);

  await d1.query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT PRIMARY KEY,
      streak_warning INTEGER DEFAULT 1,
      challenge INTEGER DEFAULT 1,
      score_result INTEGER DEFAULT 1,
      milestone INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// ── Preferences ──────────────────────────────────────────────────

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const result = await d1.query(
    `SELECT streak_warning, challenge, score_result, milestone FROM notification_preferences WHERE user_id = ?`,
    [userId],
  );

  if (!result.success || !result.result || result.result.length === 0) {
    return { ...DEFAULT_PREFERENCES };
  }

  const row = result.result[0] as Record<string, unknown>;
  return {
    streakWarning: Boolean(row.streak_warning),
    challenge: Boolean(row.challenge),
    scoreResult: Boolean(row.score_result),
    milestone: Boolean(row.milestone),
  };
}

export async function updatePreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  // Upsert
  const current = await getPreferences(userId);
  const merged = { ...current, ...prefs };

  await d1.query(
    `INSERT INTO notification_preferences (user_id, streak_warning, challenge, score_result, milestone, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       streak_warning = excluded.streak_warning,
       challenge = excluded.challenge,
       score_result = excluded.score_result,
       milestone = excluded.milestone,
       updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      merged.streakWarning ? 1 : 0,
      merged.challenge ? 1 : 0,
      merged.scoreResult ? 1 : 0,
      merged.milestone ? 1 : 0,
    ],
  );

  return merged;
}

// ── Notification CRUD ────────────────────────────────────────────

/**
 * Create a notification for a user.
 * Respects user preferences — skips silently if the type is disabled.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
): Promise<boolean> {
  // Check preference
  const prefs = await getPreferences(userId);
  const prefKey = TYPE_TO_PREF[type];
  if (!prefs[prefKey]) {
    return false; // User opted out
  }

  const id = crypto.randomUUID();
  const result = await d1.query(
    `INSERT INTO notifications (id, user_id, type, title, message, link, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
    [id, userId, type, title, message, link || null],
  );

  return result.success;
}

/**
 * Get recent notifications for a user.
 */
export async function getNotifications(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  // Get notifications
  const result = await d1.query(
    `SELECT id, user_id, type, title, message, link, read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  );

  // Get unread count
  const countResult = await d1.query(
    `SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND read = 0`,
    [userId],
  );

  const notifications: Notification[] =
    result.success && result.result
      ? result.result.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: r.id as string,
            userId: r.user_id as string,
            type: r.type as NotificationType,
            title: r.title as string,
            message: r.message as string,
            link: (r.link as string) || null,
            read: Boolean(r.read),
            createdAt: r.created_at as string,
          };
        })
      : [];

  const unreadCount =
    countResult.success && countResult.result && countResult.result.length > 0
      ? ((countResult.result[0] as Record<string, unknown>).cnt as number) || 0
      : 0;

  return { notifications, unreadCount };
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(userId: string, notificationId: string): Promise<boolean> {
  const result = await d1.query(
    `UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`,
    [notificationId, userId],
  );
  return result.success;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<boolean> {
  const result = await d1.query(
    `UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`,
    [userId],
  );
  return result.success;
}

/**
 * Clean up old notifications (>30 days). Call periodically.
 */
export async function pruneOldNotifications(): Promise<void> {
  await d1.query(
    `DELETE FROM notifications WHERE created_at < datetime('now', '-30 days')`,
  );
}

// ── Notification Helpers (fire-and-forget) ───────────────────────

/** Milestone streak thresholds */
const STREAK_MILESTONES = [7, 14, 30, 60, 100];

const MS_PER_DAY = 86_400_000;

/**
 * Fire score result notification after a debate is scored.
 */
export async function notifyScoreResult(
  userId: string,
  topic: string,
  result: 'win' | 'loss' | 'draw',
  userScore: number,
  debateId: string,
) {
  const emoji = result === 'win' ? '🏆' : result === 'draw' ? '🤝' : '📊';
  const outcomeText = result === 'win' ? 'You won!' : result === 'draw' ? "It's a draw!" : 'AI takes this round';
  const title = `${emoji} Debate Scored`;
  const message = `${outcomeText} Score: ${userScore}/100 on "${truncate(topic, 50)}"`;

  await createNotification(userId, 'score_result', title, message, `/debate/${debateId}`);
}

/**
 * Fire milestone notification when a streak threshold is reached.
 */
export async function notifyStreakMilestone(userId: string, streak: number) {
  if (!STREAK_MILESTONES.includes(streak)) return;

  const emoji = streak >= 30 ? '🔥🔥🔥' : streak >= 14 ? '🔥🔥' : '🔥';
  const title = `${emoji} ${streak}-Day Streak!`;
  const messages: Record<number, string> = {
    7: "A full week of debates! You're building a habit.",
    14: 'Two weeks strong! Your argumentation is leveling up.',
    30: "30 days! You're a debate machine. Incredible commitment.",
    60: '60 days of daily debate! You are truly dedicated.',
    100: '💯 100-day streak! You are a debate legend.',
  };

  await createNotification(
    userId,
    'milestone',
    title,
    messages[streak] || `${streak}-day streak achieved!`,
    '/explore',
  );
}

/**
 * Fire streak warning for users whose streak will expire soon.
 * Called by cron job.
 */
export async function sendStreakWarnings(): Promise<number> {
  const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString().slice(0, 10);

  // Find users who debated yesterday but not today, with streak >= 2
  // JOIN with email_preferences to get email (more reliable than users table)
  const result = await d1.query(
    `SELECT us.user_id, us.current_streak, ep.email, ep.unsubscribe_token
     FROM user_streaks us
     LEFT JOIN email_preferences ep ON us.user_id = ep.user_id
     WHERE us.last_debate_date = ? AND us.current_streak >= 2`,
    [yesterday],
  );

  if (!result.success || !result.result) return 0;

  let sent = 0;
  for (const row of result.result) {
    const r = row as Record<string, unknown>;
    const userId = r.user_id as string;
    const streak = (r.current_streak as number) || 0;
    const email = r.email as string | null;
    const unsubscribeToken = (r.unsubscribe_token as string) || userId;

    // 1. Create in-app notification (checks preferences)
    const created = await createNotification(
      userId,
      'streak_warning',
      '⚠️ Streak Expiring!',
      `Your ${streak}-day streak expires at midnight UTC! Debate now to keep it alive.`,
      '/',
    );

    // 2. Send email if user has email and opted in (created === true)
    if (created && email) {
      const { subject, html } = streakWarningEmail({
        streak,
        unsubscribeToken,
      });
      
      await sendEmail({
        to: email,
        subject,
        html,
        tags: [{ name: 'category', value: 'streak_warning' }]
      });
    }

    if (created) sent++;
  }

  // Also prune old notifications while we're here
  await pruneOldNotifications();

  return sent;
}

/**
 * Fire challenge notification.
 */
export async function notifyChallenge(
  userId: string,
  challengerName: string,
  topic: string,
  debateId: string,
  userScore: number,
  challengerScore: number,
) {
  // 1. Create in-app notification (respects preferences)
  const created = await createNotification(
    userId,
    'challenge',
    '⚔️ You\'ve Been Challenged!',
    `${challengerName} challenged you to debate "${truncate(topic, 50)}"`,
    `/debate/${debateId}`,
  );

  // 2. Send email if enabled and email available
  if (created) {
    const userResult = await d1.query(`SELECT email FROM users WHERE user_id = ?`, [userId]);
    
    if (userResult.success && userResult.result && userResult.result.length > 0) {
      const email = (userResult.result[0] as any).email;
      
      if (email) {
        const { subject, html } = challengeNotificationEmail({
          topic,
          userScore,
          opponentScore: challengerScore,
          unsubscribeToken: userId,
        });

        await sendEmail({
          to: email,
          subject,
          html,
          tags: [{ name: 'category', value: 'challenge' }],
        });
      }
    }
  }
}

// ── Utils ────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
