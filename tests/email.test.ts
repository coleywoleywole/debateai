/**
 * Tests for src/lib/email.ts
 *
 * Validates email sending via Resend, batch sending, contact sync,
 * URL generation, and error handling when API key is missing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store mock instances so we can inspect calls
const mockEmailsSend = vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null });
const mockBatchSend = vi.fn().mockResolvedValue({ data: { id: 'batch-123' }, error: null });
const mockSegmentsList = vi.fn().mockResolvedValue({ data: { data: [], has_more: false }, error: null });
const mockSegmentsCreate = vi.fn().mockResolvedValue({ data: { id: 'seg-123', name: 'DebateAI' }, error: null });
const mockContactsCreate = vi.fn().mockResolvedValue({ data: { id: 'contact-123' }, error: null });
const mockContactsUpdate = vi.fn().mockResolvedValue({ data: { id: 'contact-123' }, error: null });

vi.mock('resend', () => {
  class MockResend {
    emails = { send: mockEmailsSend };
    batch = { send: mockBatchSend };
    segments = { list: mockSegmentsList, create: mockSegmentsCreate };
    contacts = { create: mockContactsCreate, update: mockContactsUpdate };
  }
  return { Resend: MockResend };
});

// We need to handle the module-level singleton pattern in email.ts
// The resendInstance is cached, so we need to reset modules between some tests
describe('email service', () => {
  let originalApiKey: string | undefined;
  let originalEmailFrom: string | undefined;
  let originalBaseUrl: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalApiKey = process.env.RESEND_API_KEY;
    originalEmailFrom = process.env.EMAIL_FROM;
    originalBaseUrl = process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    // Restore env
    if (originalApiKey !== undefined) process.env.RESEND_API_KEY = originalApiKey;
    else delete process.env.RESEND_API_KEY;
    if (originalEmailFrom !== undefined) process.env.EMAIL_FROM = originalEmailFrom;
    else delete process.env.EMAIL_FROM;
    if (originalBaseUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalBaseUrl;
    else delete process.env.NEXT_PUBLIC_APP_URL;
  });

  // ── sendEmail ─────────────────────────────────────────────────

  describe('sendEmail', () => {
    it('returns error when RESEND_API_KEY is not set', async () => {
      // Reset modules to clear cached resendInstance
      vi.resetModules();
      delete process.env.RESEND_API_KEY;

      // Re-import to get fresh module with no cached instance
      const { sendEmail } = await import('@/lib/email');
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('calls resend.emails.send with correct from/to/subject/html', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';
      process.env.EMAIL_FROM = 'DebateAI <digest@debateai.org>';

      const { sendEmail } = await import('@/lib/email');
      await sendEmail({
        to: 'alice@example.com',
        subject: 'Welcome!',
        html: '<h1>Welcome</h1>',
        tags: [{ name: 'category', value: 'welcome' }],
      });

      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(mockEmailsSend).toHaveBeenCalledWith({
        from: 'DebateAI <digest@debateai.org>',
        to: 'alice@example.com',
        subject: 'Welcome!',
        html: '<h1>Welcome</h1>',
        tags: [{ name: 'category', value: 'welcome' }],
      });
    });

    it('returns success with email ID on success', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';
      mockEmailsSend.mockResolvedValueOnce({ data: { id: 'msg-abc-123' }, error: null });

      const { sendEmail } = await import('@/lib/email');
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('msg-abc-123');
    });

    it('returns error when Resend API returns an error', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';
      mockEmailsSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid recipient' },
      });

      const { sendEmail } = await import('@/lib/email');
      const result = await sendEmail({
        to: 'bad-email',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid recipient');
    });

    it('catches thrown errors from Resend', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';
      mockEmailsSend.mockRejectedValueOnce(new Error('Network timeout'));

      const { sendEmail } = await import('@/lib/email');
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('uses default FROM address when EMAIL_FROM not set', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';
      delete process.env.EMAIL_FROM;

      const { sendEmail } = await import('@/lib/email');
      await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'DebateAI <noreply@debateai.org>',
        }),
      );
    });
  });

  // ── sendBatchEmails ───────────────────────────────────────────

  describe('sendBatchEmails', () => {
    it('returns failure when RESEND_API_KEY is not set', async () => {
      vi.resetModules();
      delete process.env.RESEND_API_KEY;

      const { sendBatchEmails } = await import('@/lib/email');
      const result = await sendBatchEmails([
        { to: 'a@test.com', subject: 'S', html: '<p>H</p>' },
      ]);

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Email service not configured');
    });

    it('sends a small batch in a single call', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';

      const { sendBatchEmails } = await import('@/lib/email');
      const emails = [
        { to: 'a@test.com', subject: 'S1', html: '<p>1</p>' },
        { to: 'b@test.com', subject: 'S2', html: '<p>2</p>' },
      ];

      const result = await sendBatchEmails(emails);

      expect(mockBatchSend).toHaveBeenCalledTimes(1);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('chunks into batches of 100', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';

      const { sendBatchEmails } = await import('@/lib/email');
      // Create 250 emails
      const emails = Array.from({ length: 250 }, (_, i) => ({
        to: `user${i}@test.com`,
        subject: `Subject ${i}`,
        html: `<p>${i}</p>`,
      }));

      const result = await sendBatchEmails(emails);

      // Should be called 3 times: 100 + 100 + 50
      expect(mockBatchSend).toHaveBeenCalledTimes(3);

      // Verify first batch has 100 items
      const firstBatchArg = mockBatchSend.mock.calls[0][0];
      expect(firstBatchArg).toHaveLength(100);

      // Verify second batch has 100 items
      const secondBatchArg = mockBatchSend.mock.calls[1][0];
      expect(secondBatchArg).toHaveLength(100);

      // Verify third batch has 50 items
      const thirdBatchArg = mockBatchSend.mock.calls[2][0];
      expect(thirdBatchArg).toHaveLength(50);

      expect(result.sent).toBe(250);
      expect(result.failed).toBe(0);
    });

    it('adds FROM address to each email in the batch', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';
      process.env.EMAIL_FROM = 'DebateAI <digest@debateai.org>';

      const { sendBatchEmails } = await import('@/lib/email');
      await sendBatchEmails([
        { to: 'a@test.com', subject: 'S', html: '<p>H</p>' },
      ]);

      const batchArg = mockBatchSend.mock.calls[0][0];
      expect(batchArg[0].from).toBe('DebateAI <digest@debateai.org>');
    });

    it('tracks failures per batch when Resend returns error', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';

      // First batch succeeds, second fails
      mockBatchSend
        .mockResolvedValueOnce({ data: { id: 'ok' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Rate limit exceeded' } });

      const { sendBatchEmails } = await import('@/lib/email');
      const emails = Array.from({ length: 150 }, (_, i) => ({
        to: `user${i}@test.com`,
        subject: 'S',
        html: '<p>H</p>',
      }));

      const result = await sendBatchEmails(emails);

      expect(result.sent).toBe(100); // First batch
      expect(result.failed).toBe(50); // Second batch
      expect(result.errors).toContain('Rate limit exceeded');
    });

    it('handles thrown exceptions in batch send', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';
      mockBatchSend.mockRejectedValueOnce(new Error('Connection reset'));

      const { sendBatchEmails } = await import('@/lib/email');
      const result = await sendBatchEmails([
        { to: 'a@test.com', subject: 'S', html: '<p>H</p>' },
      ]);

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Connection reset');
    });

    it('passes tags through to batch items', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';

      const { sendBatchEmails } = await import('@/lib/email');
      await sendBatchEmails([
        { to: 'a@test.com', subject: 'S', html: '<p>H</p>', tags: [{ name: 'cat', value: 'daily' }] },
      ]);

      const batchArg = mockBatchSend.mock.calls[0][0];
      expect(batchArg[0].tags).toEqual([{ name: 'cat', value: 'daily' }]);
    });
  });

  // ── syncContactToResend ───────────────────────────────────────

  describe('syncContactToResend', () => {
    it('returns failure when RESEND_API_KEY not set', async () => {
      vi.resetModules();
      delete process.env.RESEND_API_KEY;

      const { syncContactToResend } = await import('@/lib/email');
      const result = await syncContactToResend({ email: 'test@test.com' });
      expect(result.success).toBe(false);
    });

    it('creates contact with correct email and names', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';

      const { syncContactToResend } = await import('@/lib/email');
      const result = await syncContactToResend({
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
      });

      expect(mockContactsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Smith',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.contactId).toBe('contact-123');
    });

    it('falls back to update when contact already exists', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';

      // Make create fail with "already exists"
      mockContactsCreate.mockResolvedValueOnce({
        data: null,
        error: { message: 'Contact already exists' },
      });

      const { syncContactToResend } = await import('@/lib/email');
      const result = await syncContactToResend({
        email: 'existing@example.com',
        firstName: 'Bob',
      });

      expect(mockContactsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'existing@example.com',
          firstName: 'Bob',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('returns failure on non-"already exists" create error', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';

      mockContactsCreate.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid email format' },
      });

      const { syncContactToResend } = await import('@/lib/email');
      const result = await syncContactToResend({ email: 'bad' });

      expect(result.success).toBe(false);
      expect(mockContactsUpdate).not.toHaveBeenCalled();
    });

    it('looks up or creates DebateAI segment', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';

      // No existing segments
      mockSegmentsList.mockResolvedValueOnce({
        data: { data: [], has_more: false },
        error: null,
      });

      const { syncContactToResend } = await import('@/lib/email');
      await syncContactToResend({ email: 'test@test.com' });

      // Should call list first, then create since none found
      expect(mockSegmentsList).toHaveBeenCalled();
      expect(mockSegmentsCreate).toHaveBeenCalledWith({ name: 'DebateAI' });
    });

    it('reuses existing DebateAI segment', async () => {
      vi.resetModules();
      process.env.RESEND_API_KEY = 'test-resend-key';

      // Existing segment found
      mockSegmentsList.mockResolvedValueOnce({
        data: { data: [{ id: 'existing-seg', name: 'DebateAI' }], has_more: false },
        error: null,
      });

      const { syncContactToResend } = await import('@/lib/email');
      await syncContactToResend({ email: 'test@test.com' });

      expect(mockSegmentsList).toHaveBeenCalled();
      // Should NOT create a new segment since one exists
      expect(mockSegmentsCreate).not.toHaveBeenCalled();
    });
  });

  // ── getUnsubscribeUrl ─────────────────────────────────────────

  describe('getUnsubscribeUrl', () => {
    it('generates correct URL with encoded token', async () => {
      vi.resetModules();
      process.env.NEXT_PUBLIC_APP_URL = 'https://debateai.org';

      const { getUnsubscribeUrl } = await import('@/lib/email');
      const url = getUnsubscribeUrl('my-token-123');

      expect(url).toBe('https://debateai.org/api/email/unsubscribe?token=my-token-123');
    });

    it('encodes special characters in token', async () => {
      vi.resetModules();
      process.env.NEXT_PUBLIC_APP_URL = 'https://debateai.org';

      const { getUnsubscribeUrl } = await import('@/lib/email');
      const url = getUnsubscribeUrl('token with spaces&special=chars');

      expect(url).toContain('token%20with%20spaces%26special%3Dchars');
    });

    it('uses default BASE_URL when env not set', async () => {
      vi.resetModules();
      delete process.env.NEXT_PUBLIC_APP_URL;

      const { getUnsubscribeUrl } = await import('@/lib/email');
      const url = getUnsubscribeUrl('tok');

      expect(url).toContain('debateai.org');
      expect(url).toContain('tok');
    });
  });

  // ── getDebateUrl ──────────────────────────────────────────────

  describe('getDebateUrl', () => {
    it('returns /debate when no topic provided', async () => {
      vi.resetModules();
      process.env.NEXT_PUBLIC_APP_URL = 'https://debateai.org';

      const { getDebateUrl } = await import('@/lib/email');
      const url = getDebateUrl();

      expect(url).toBe('https://debateai.org/debate');
    });

    it('returns URL with topic param when topic provided', async () => {
      vi.resetModules();
      process.env.NEXT_PUBLIC_APP_URL = 'https://debateai.org';

      const { getDebateUrl } = await import('@/lib/email');
      const url = getDebateUrl('Is AI sentient?');

      expect(url).toBe('https://debateai.org/?topic=Is%20AI%20sentient%3F');
    });

    it('encodes special characters in topic', async () => {
      vi.resetModules();
      process.env.NEXT_PUBLIC_APP_URL = 'https://debateai.org';

      const { getDebateUrl } = await import('@/lib/email');
      const url = getDebateUrl('AI & Ethics: Who decides?');

      expect(url).toContain('AI%20%26%20Ethics');
    });
  });
});
