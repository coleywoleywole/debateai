/**
 * Email preferences — D1 persistence layer.
 *
 * Table: email_preferences
 *   - user_id           (PK, FK to users)
 *   - email             (cached from Clerk/users table)
 *   - daily_digest      (0/1 — daily topic email)
 *   - challenge_notify  (0/1 — someone debates other side)
 *   - weekly_recap      (0/1 — weekly stats email)
 *   - unsubscribe_token (unique, for one-click unsubscribe)
 *   - unsubscribed_at   (null if active)
 */

import { d1 } from './d1';
import { currentUser } from '@clerk/nextjs/server';
import { welcomeEmail } from './email-templates';
import { sendEmail } from './email';

export interface EmailPreferences {
  user_id: string;
  email: string;
  daily_digest: number;
  challenge_notify: number;
  weekly_recap: number;
  welcome_email_sent: number;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

export async function createEmailPreferencesTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS email_preferences (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      daily_digest INTEGER NOT NULL DEFAULT 1,
      challenge_notify INTEGER NOT NULL DEFAULT 1,
      weekly_recap INTEGER NOT NULL DEFAULT 1,
      welcome_email_sent INTEGER NOT NULL DEFAULT 0,
      unsubscribe_token TEXT NOT NULL UNIQUE,
      unsubscribed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_email_prefs_token ON email_preferences(unsubscribe_token)`,
    `CREATE INDEX IF NOT EXISTS idx_email_prefs_daily ON email_preferences(daily_digest, unsubscribed_at)`,
  ];

  for (const sql of queries) {
    await d1.query(sql);
  }
}

/* ------------------------------------------------------------------ */
/*  CRUD                                                               */
/* ------------------------------------------------------------------ */

/**
 * Get or create email preferences for a user.
 * If no record exists, creates one with all emails opted-in.
 */
export async function getOrCreatePreferences(userId: string, email: string): Promise<EmailPreferences> {
  // Try to get existing
  const result = await d1.query(
    'SELECT * FROM email_preferences WHERE user_id = ? LIMIT 1',
    [userId],
  );

  if (result.success && result.result && result.result.length > 0) {
    const prefs = result.result[0] as unknown as EmailPreferences;
    // Update email if it changed
    if (prefs.email !== email) {
      await d1.query(
        "UPDATE email_preferences SET email = ?, updated_at = datetime('now') WHERE user_id = ?",
        [email, userId],
      );
      prefs.email = email;
    }
    return prefs;
  }

  // Create new preferences (all opted in by default)
  const token = crypto.randomUUID();
  await d1.query(
    `INSERT INTO email_preferences (user_id, email, daily_digest, challenge_notify, weekly_recap, unsubscribe_token, welcome_email_sent)
     VALUES (?, ?, 1, 1, 1, ?, 0)`,
    [userId, email, token],
  );

  return {
    user_id: userId,
    email,
    daily_digest: 1,
    challenge_notify: 1,
    weekly_recap: 1,
    welcome_email_sent: 0,
    unsubscribe_token: token,
    unsubscribed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Ensures the welcome email is sent exactly once to a user.
 * Call this in any common authenticated entry point (e.g. GET /api/notifications).
 */
export async function ensureWelcomeEmail(userId: string) {
  if (userId.startsWith('guest_')) return;

  try {
    // 1. Get user details from Clerk (contains email + name)
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    if (!email) return;

    // 2. Get or create preferences (creates record if missing)
    const prefs = await getOrCreatePreferences(userId, email);

    // 3. If already sent, skip
    if (prefs.welcome_email_sent) return;

    // 4. Send the email
    const name = user.firstName || user.username || 'there';
    const { subject, html } = welcomeEmail({
      name,
      unsubscribeToken: prefs.unsubscribe_token,
    });

    const result = await sendEmail({
      to: email,
      subject,
      html,
      tags: [{ name: 'category', value: 'welcome' }],
    });

    // 5. Mark as sent if successful
    if (result.success) {
      await d1.query(
        'UPDATE email_preferences SET welcome_email_sent = 1, updated_at = datetime(\'now\') WHERE user_id = ?',
        [userId]
      );
    }
  } catch (error) {
    console.error('Failed to ensure welcome email:', error);
    // Silent fail — don't block the caller
  }
}

/**
 * Update email preferences.
 */
export async function updatePreferences(
  userId: string,
  patch: Partial<Pick<EmailPreferences, 'daily_digest' | 'challenge_notify' | 'weekly_recap'>>,
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, val] of Object.entries(patch)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      params.push(val);
    }
  }

  if (sets.length === 0) return true;

  sets.push("updated_at = datetime('now')");
  // If re-enabling any preference, clear unsubscribed_at
  if (Object.values(patch).some((v) => v === 1)) {
    sets.push('unsubscribed_at = NULL');
  }
  params.push(userId);

  const result = await d1.query(
    `UPDATE email_preferences SET ${sets.join(', ')} WHERE user_id = ?`,
    params,
  );
  return result.success;
}

/**
 * Unsubscribe by token (one-click, CAN-SPAM compliant).
 * Sets all preferences to 0 and records unsubscribe timestamp.
 */
export async function unsubscribeByToken(token: string): Promise<{ success: boolean; email?: string }> {
  // Find the user by token
  const result = await d1.query(
    'SELECT user_id, email FROM email_preferences WHERE unsubscribe_token = ? LIMIT 1',
    [token],
  );

  if (!result.success || !result.result || result.result.length === 0) {
    return { success: false };
  }

  const row = result.result[0] as Record<string, unknown>;

  // Unsubscribe from all
  await d1.query(
    `UPDATE email_preferences
     SET daily_digest = 0, challenge_notify = 0, weekly_recap = 0,
         unsubscribed_at = datetime('now'), updated_at = datetime('now')
     WHERE unsubscribe_token = ?`,
    [token],
  );

  return { success: true, email: row.email as string };
}

/**
 * Get all users opted in to daily digest (not unsubscribed).
 */
export async function getDailyDigestRecipients(limit = 500, offset = 0): Promise<EmailPreferences[]> {
  const result = await d1.query(
    `SELECT * FROM email_preferences
     WHERE daily_digest = 1 AND unsubscribed_at IS NULL
     ORDER BY created_at
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return (result.result ?? []) as unknown as EmailPreferences[];
}

/**
 * Get all users opted in to weekly recap (not unsubscribed).
 */
export async function getWeeklyRecapRecipients(limit = 500, offset = 0): Promise<EmailPreferences[]> {
  const result = await d1.query(
    `SELECT * FROM email_preferences
     WHERE weekly_recap = 1 AND unsubscribed_at IS NULL
     ORDER BY created_at
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return (result.result ?? []) as unknown as EmailPreferences[];
}

/**
 * Count daily digest subscribers.
 */
export async function getDailyDigestCount(): Promise<number> {
  const result = await d1.query(
    'SELECT COUNT(*) as count FROM email_preferences WHERE daily_digest = 1 AND unsubscribed_at IS NULL',
  );
  if (result.success && result.result && result.result.length > 0) {
    return (result.result[0] as Record<string, unknown>).count as number;
  }
  return 0;
}
