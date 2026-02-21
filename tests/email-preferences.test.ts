/**
 * Tests for src/lib/email-preferences.ts
 *
 * Validates email preference CRUD, welcome email race condition handling,
 * unsubscribe by token, and preference update logic.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { d1 } from '@/lib/d1';
import { currentUser } from '@clerk/nextjs/server';

// Mock email and email-templates modules
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, id: 'email-123' }),
  syncContactToResend: vi.fn().mockResolvedValue({ success: true }),
  getUnsubscribeUrl: vi.fn((token: string) => `https://debateai.org/api/email/unsubscribe?token=${token}`),
  getDebateUrl: vi.fn(() => 'https://debateai.org/debate'),
}));

vi.mock('@/lib/email-templates', () => ({
  welcomeEmail: vi.fn(() => ({ subject: 'Welcome!', html: '<h1>Welcome</h1>' })),
}));

import {
  getOrCreatePreferences,
  ensureWelcomeEmail,
  updatePreferences,
  unsubscribeByToken,
} from '@/lib/email-preferences';
import { sendEmail, syncContactToResend } from '@/lib/email';
import { welcomeEmail } from '@/lib/email-templates';

const mockQuery = vi.mocked(d1.query);
const mockCurrentUser = vi.mocked(currentUser);
const mockSendEmail = vi.mocked(sendEmail);
const mockSyncContact = vi.mocked(syncContactToResend);
const mockWelcomeEmail = vi.mocked(welcomeEmail);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset default mock returns
  mockQuery.mockResolvedValue({ success: true, result: [] });
});

// ── getOrCreatePreferences ──────────────────────────────────────

describe('getOrCreatePreferences', () => {
  it('returns existing prefs when found in database', async () => {
    const existingPrefs = {
      user_id: 'user-1',
      email: 'alice@test.com',
      daily_digest: 1,
      challenge_notify: 0,
      weekly_recap: 1,
      welcome_email_sent: 1,
      unsubscribe_token: 'tok-existing',
      unsubscribed_at: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [existingPrefs],
    });

    const result = await getOrCreatePreferences('user-1', 'alice@test.com');

    expect(result.user_id).toBe('user-1');
    expect(result.email).toBe('alice@test.com');
    expect(result.daily_digest).toBe(1);
    expect(result.challenge_notify).toBe(0);
    expect(result.unsubscribe_token).toBe('tok-existing');
  });

  it('creates new record with defaults when not found', async () => {
    // First query: SELECT returns empty
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    // Second query: INSERT
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    const result = await getOrCreatePreferences('new-user', 'new@test.com');

    // Should have called INSERT
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO email_preferences');
    expect(insertCall[1]).toEqual(expect.arrayContaining(['new-user', 'new@test.com']));

    // Returns defaults
    expect(result.user_id).toBe('new-user');
    expect(result.email).toBe('new@test.com');
    expect(result.daily_digest).toBe(1);
    expect(result.challenge_notify).toBe(1);
    expect(result.weekly_recap).toBe(1);
    expect(result.welcome_email_sent).toBe(0);
    expect(result.unsubscribed_at).toBeNull();
    // Should have a generated UUID token
    expect(result.unsubscribe_token).toBeTruthy();
  });

  it('updates email if it changed', async () => {
    const existingPrefs = {
      user_id: 'user-1',
      email: 'old@test.com', // Different from what we'll pass
      daily_digest: 1,
      challenge_notify: 1,
      weekly_recap: 1,
      welcome_email_sent: 0,
      unsubscribe_token: 'tok-1',
      unsubscribed_at: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [existingPrefs],
    });
    // UPDATE for email change
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    const result = await getOrCreatePreferences('user-1', 'new@test.com');

    // Should have issued UPDATE for email change
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE email_preferences SET email');
    expect(updateCall[1]).toEqual(['new@test.com', 'user-1']);

    // Returned prefs should reflect new email
    expect(result.email).toBe('new@test.com');
  });

  it('does NOT update email when it matches', async () => {
    const existingPrefs = {
      user_id: 'user-1',
      email: 'same@test.com',
      daily_digest: 1,
      challenge_notify: 1,
      weekly_recap: 1,
      welcome_email_sent: 0,
      unsubscribe_token: 'tok-1',
      unsubscribed_at: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [existingPrefs],
    });

    await getOrCreatePreferences('user-1', 'same@test.com');

    // Only the SELECT, no UPDATE
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('includes unsubscribe_token in INSERT for new records', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // SELECT
    mockQuery.mockResolvedValueOnce({ success: true, result: [] }); // INSERT

    await getOrCreatePreferences('new-user', 'test@test.com');

    const insertCall = mockQuery.mock.calls[1];
    // Third param should be a UUID token
    const params = insertCall[1] as string[];
    expect(params[2]).toBeTruthy(); // token exists
    expect(params[2]).not.toBe('new-user'); // not just the user ID
  });
});

// ── ensureWelcomeEmail ──────────────────────────────────────────

describe('ensureWelcomeEmail', () => {
  it('skips for guest users', async () => {
    await ensureWelcomeEmail('guest_abc123');

    // Should not make any D1 queries
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('skips if already sent (early D1 check)', async () => {
    // D1 returns welcome_email_sent = 1
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ welcome_email_sent: 1 }],
    });

    await ensureWelcomeEmail('user-1');

    // Should have done only the initial check query, not called Clerk or sent email
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('welcome_email_sent'),
      ['user-1'],
    );
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('skips when user has no email in Clerk', async () => {
    // D1: not yet sent
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });
    // Clerk: no email
    mockCurrentUser.mockResolvedValueOnce({ emailAddresses: [] } as any);

    await ensureWelcomeEmail('user-1');

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('skips when prefs already show welcome_email_sent=1 (after getOrCreate)', async () => {
    // D1 check: welcome_email_sent is 0
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ welcome_email_sent: 0 }],
    });
    // Clerk returns email
    mockCurrentUser.mockResolvedValueOnce({
      emailAddresses: [{ emailAddress: 'test@test.com' }],
      firstName: 'Alice',
      lastName: null,
      username: 'alice',
    } as any);
    // getOrCreatePreferences SELECT returns prefs with welcome_email_sent = 1
    // (another request beat us to it)
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{
        user_id: 'user-1',
        email: 'test@test.com',
        daily_digest: 1,
        challenge_notify: 1,
        weekly_recap: 1,
        welcome_email_sent: 1,
        unsubscribe_token: 'tok-1',
        unsubscribed_at: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }],
    });

    await ensureWelcomeEmail('user-1');

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('uses atomic UPDATE with WHERE welcome_email_sent = 0 to prevent race condition', async () => {
    // D1 check: not yet sent
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ welcome_email_sent: 0 }],
    });
    // Clerk returns email
    mockCurrentUser.mockResolvedValueOnce({
      emailAddresses: [{ emailAddress: 'test@test.com' }],
      firstName: 'Alice',
      lastName: null,
      username: 'alice',
    } as any);
    // getOrCreatePreferences: returns existing
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{
        user_id: 'user-1',
        email: 'test@test.com',
        daily_digest: 1,
        challenge_notify: 1,
        weekly_recap: 1,
        welcome_email_sent: 0,
        unsubscribe_token: 'tok-1',
        unsubscribed_at: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }],
    });
    // Atomic claim: succeeds
    mockQuery.mockResolvedValueOnce({ success: true, result: [], meta: { changes: 1 } });

    await ensureWelcomeEmail('user-1');

    // Find the atomic UPDATE call
    const atomicCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('welcome_email_sent = 1') &&
        call[0].includes('welcome_email_sent = 0'),
    );
    expect(atomicCall).toBeDefined();
    // Verify it uses user_id AND welcome_email_sent = 0 in WHERE
    expect(atomicCall![0]).toContain('WHERE user_id = ? AND welcome_email_sent = 0');
  });

  it('does NOT send email when atomic claim fails (race condition lost)', async () => {
    // D1 check: not yet sent
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ welcome_email_sent: 0 }],
    });
    // Clerk returns email
    mockCurrentUser.mockResolvedValueOnce({
      emailAddresses: [{ emailAddress: 'test@test.com' }],
      firstName: 'Alice',
      lastName: null,
      username: 'alice',
    } as any);
    // getOrCreatePreferences
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{
        user_id: 'user-1',
        email: 'test@test.com',
        daily_digest: 1,
        challenge_notify: 1,
        weekly_recap: 1,
        welcome_email_sent: 0,
        unsubscribe_token: 'tok-1',
        unsubscribed_at: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }],
    });
    // Atomic claim: 0 changes (another request beat us)
    mockQuery.mockResolvedValueOnce({ success: true, result: [], meta: { changes: 0 } });

    await ensureWelcomeEmail('user-1');

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('calls syncContactToResend with user details', async () => {
    // D1 check: not yet sent
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ welcome_email_sent: 0 }],
    });
    // Clerk returns full user
    mockCurrentUser.mockResolvedValueOnce({
      emailAddresses: [{ emailAddress: 'alice@test.com' }],
      firstName: 'Alice',
      lastName: 'Smith',
      username: 'alice',
    } as any);
    // getOrCreatePreferences
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{
        user_id: 'user-1',
        email: 'alice@test.com',
        daily_digest: 1,
        challenge_notify: 1,
        weekly_recap: 1,
        welcome_email_sent: 0,
        unsubscribe_token: 'tok-1',
        unsubscribed_at: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }],
    });
    // Atomic claim: succeeds
    mockQuery.mockResolvedValueOnce({ success: true, result: [], meta: { changes: 1 } });

    await ensureWelcomeEmail('user-1');

    expect(mockSyncContact).toHaveBeenCalledWith({
      email: 'alice@test.com',
      firstName: 'Alice',
      lastName: 'Smith',
    });
  });

  it('sends welcome email with correct arguments when claim succeeds', async () => {
    // D1 check: not yet sent
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ welcome_email_sent: 0 }],
    });
    // Clerk
    mockCurrentUser.mockResolvedValueOnce({
      emailAddresses: [{ emailAddress: 'alice@test.com' }],
      firstName: 'Alice',
      lastName: null,
      username: 'alicedebater',
    } as any);
    // getOrCreatePreferences
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{
        user_id: 'user-1',
        email: 'alice@test.com',
        daily_digest: 1,
        challenge_notify: 1,
        weekly_recap: 1,
        welcome_email_sent: 0,
        unsubscribe_token: 'tok-alice',
        unsubscribed_at: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }],
    });
    // Atomic claim: succeeds
    mockQuery.mockResolvedValueOnce({ success: true, result: [], meta: { changes: 1 } });

    await ensureWelcomeEmail('user-1');

    // welcomeEmail template should be called with name and token
    expect(mockWelcomeEmail).toHaveBeenCalledWith({
      name: 'Alice',
      unsubscribeToken: 'tok-alice',
    });

    // sendEmail should be called with the template output
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'alice@test.com',
      subject: 'Welcome!',
      html: '<h1>Welcome</h1>',
      tags: [{ name: 'category', value: 'welcome' }],
    });
  });

  it('uses username when firstName is not available', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ welcome_email_sent: 0 }],
    });
    mockCurrentUser.mockResolvedValueOnce({
      emailAddresses: [{ emailAddress: 'bob@test.com' }],
      firstName: null,
      lastName: null,
      username: 'bob_debater',
    } as any);
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{
        user_id: 'user-2',
        email: 'bob@test.com',
        daily_digest: 1,
        challenge_notify: 1,
        weekly_recap: 1,
        welcome_email_sent: 0,
        unsubscribe_token: 'tok-bob',
        unsubscribed_at: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }],
    });
    mockQuery.mockResolvedValueOnce({ success: true, result: [], meta: { changes: 1 } });

    await ensureWelcomeEmail('user-2');

    // Should fall back to username
    expect(mockWelcomeEmail).toHaveBeenCalledWith({
      name: 'bob_debater',
      unsubscribeToken: 'tok-bob',
    });
  });

  it('uses "there" when neither firstName nor username available', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ welcome_email_sent: 0 }],
    });
    mockCurrentUser.mockResolvedValueOnce({
      emailAddresses: [{ emailAddress: 'anon@test.com' }],
      firstName: null,
      lastName: null,
      username: null,
    } as any);
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{
        user_id: 'user-3',
        email: 'anon@test.com',
        daily_digest: 1,
        challenge_notify: 1,
        weekly_recap: 1,
        welcome_email_sent: 0,
        unsubscribe_token: 'tok-anon',
        unsubscribed_at: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      }],
    });
    mockQuery.mockResolvedValueOnce({ success: true, result: [], meta: { changes: 1 } });

    await ensureWelcomeEmail('user-3');

    expect(mockWelcomeEmail).toHaveBeenCalledWith({
      name: 'there',
      unsubscribeToken: 'tok-anon',
    });
  });

  it('silently catches errors without throwing', async () => {
    // D1 throws
    mockQuery.mockRejectedValueOnce(new Error('D1 is down'));

    // Should not throw
    await expect(ensureWelcomeEmail('user-1')).resolves.toBeUndefined();
  });
});

// ── updatePreferences ───────────────────────────────────────────

describe('updatePreferences', () => {
  it('builds correct UPDATE SQL with provided fields', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await updatePreferences('user-1', { daily_digest: 0, weekly_recap: 0 });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('UPDATE email_preferences SET');
    expect(sql).toContain('daily_digest = ?');
    expect(sql).toContain('weekly_recap = ?');
    expect(sql).toContain('WHERE user_id = ?');
    expect(params).toContain(0); // daily_digest value
    expect(params).toContain('user-1');
  });

  it('clears unsubscribed_at when re-enabling a pref (value = 1)', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await updatePreferences('user-1', { daily_digest: 1 });

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('unsubscribed_at = NULL');
  });

  it('does NOT clear unsubscribed_at when all values are 0', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await updatePreferences('user-1', { daily_digest: 0, challenge_notify: 0 });

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toContain('unsubscribed_at = NULL');
  });

  it('returns true when no fields provided (noop)', async () => {
    const result = await updatePreferences('user-1', {});

    expect(result).toBe(true);
    // Should not query D1 at all
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('includes updated_at in every update', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await updatePreferences('user-1', { challenge_notify: 1 });

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("updated_at = datetime('now')");
  });

  it('returns the success status from D1', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, result: [] });

    const result = await updatePreferences('user-1', { daily_digest: 1 });

    expect(result).toBe(false);
  });
});

// ── unsubscribeByToken ──────────────────────────────────────────

describe('unsubscribeByToken', () => {
  it('returns success: false when token not found', async () => {
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    const result = await unsubscribeByToken('nonexistent-token');

    expect(result.success).toBe(false);
    expect(result.email).toBeUndefined();
  });

  it('sets all prefs to 0 and records unsubscribed_at timestamp', async () => {
    // Token lookup
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ user_id: 'user-1', email: 'alice@test.com' }],
    });
    // Unsubscribe UPDATE
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    const result = await unsubscribeByToken('valid-token');

    expect(result.success).toBe(true);
    expect(result.email).toBe('alice@test.com');

    // Verify the UPDATE query
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain('daily_digest = 0');
    expect(updateCall[0]).toContain('challenge_notify = 0');
    expect(updateCall[0]).toContain('weekly_recap = 0');
    expect(updateCall[0]).toContain("unsubscribed_at = datetime('now')");
    expect(updateCall[0]).toContain('WHERE unsubscribe_token = ?');
    expect(updateCall[1]).toEqual(['valid-token']);
  });

  it('looks up user by unsubscribe_token, not user_id', async () => {
    mockQuery.mockResolvedValueOnce({
      success: true,
      result: [{ user_id: 'user-1', email: 'alice@test.com' }],
    });
    mockQuery.mockResolvedValueOnce({ success: true, result: [] });

    await unsubscribeByToken('my-unique-token');

    // Verify lookup query uses token
    const selectCall = mockQuery.mock.calls[0];
    expect(selectCall[0]).toContain('WHERE unsubscribe_token = ?');
    expect(selectCall[1]).toEqual(['my-unique-token']);
  });

  it('returns success: false when D1 fails on lookup', async () => {
    mockQuery.mockResolvedValueOnce({ success: false, result: null });

    const result = await unsubscribeByToken('some-token');

    expect(result.success).toBe(false);
  });
});
