/**
 * Vitest global setup — mocks for external dependencies.
 */
import { vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'test-user-123' }),
  currentUser: vi.fn().mockResolvedValue({
    emailAddresses: [{ emailAddress: 'test@example.com' }],
  }),
}));

vi.mock('@/lib/d1', () => ({
  d1: {
    query: vi.fn().mockResolvedValue({ success: true, result: [] }),
    getUser: vi.fn().mockResolvedValue(null),
    upsertUser: vi.fn().mockResolvedValue({ success: true }),
    getDebate: vi.fn().mockResolvedValue({ success: false, error: 'Not found' }),
    saveDebate: vi.fn().mockResolvedValue({ success: true }),
    checkDebateMessageLimit: vi.fn().mockResolvedValue({ allowed: true, count: 0, limit: 10, isPremium: false }),
    findRecentDuplicate: vi.fn().mockResolvedValue({ found: false }),
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { list: vi.fn().mockResolvedValue({ data: [] }), create: vi.fn().mockResolvedValue({ id: 'cus_test' }) },
    subscriptions: { list: vi.fn().mockResolvedValue({ data: [] }), retrieve: vi.fn().mockResolvedValue({ id: 'sub_test', status: 'active' }) },
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }) } },
    billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }) } },
    prices: { retrieve: vi.fn().mockResolvedValue({ unit_amount: 2000, currency: 'usd', recurring: { interval: 'month' } }) },
    webhooks: { constructEvent: vi.fn() },
  },
}));

vi.mock('@/lib/auth-helper', () => ({
  getUserId: vi.fn().mockResolvedValue('test-user-123'),
}));

vi.mock('@/lib/app-disabled', () => ({
  checkAppDisabled: vi.fn().mockReturnValue(null),
}));

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"winner":"user","userScore":8,"aiScore":6,"summary":"Good debate"}' }],
      }),
    };
  }
  return { default: MockAnthropic };
});

vi.mock('openai', () => {
  return { default: vi.fn().mockImplementation(() => ({ chat: { completions: { create: vi.fn() } } })) };
});

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

process.env.STRIPE_PRICE_ID = 'price_test123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.HELICONE_API_KEY = 'test-helicone-key';
process.env.AGENTMAIL_API_KEY = 'test-agentmail-key';
process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-ph-key';
process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://us.i.posthog.com';
process.env.GOOGLE_CREDENTIALS_JSON = '{"project_id":"test-project"}';
