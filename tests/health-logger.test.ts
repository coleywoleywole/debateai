/**
 * Tests for /api/health endpoint and structured logger.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { d1 } from '@/lib/d1';
import { logger } from '@/lib/logger';

vi.mock('@/lib/d1');

// ── /api/health ─────────────────────────────────────────────────

describe('GET /api/health', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      ...originalEnv,
      CLOUDFLARE_D1_DATABASE_ID: 'test-db-id',
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLERK_SECRET_KEY: 'test-clerk-key',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'test-clerk-pub-key',
      AGENTMAIL_API_KEY: 'test-agentmail-key',
      NEXT_PUBLIC_POSTHOG_KEY: 'test-posthog-key',
      NEXT_PUBLIC_POSTHOG_HOST: 'test-posthog-host',
      GOOGLE_CREDENTIALS_JSON: '{}',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns healthy status when all checks pass', async () => {
    vi.mocked(d1.query).mockResolvedValue({ success: true, result: [{ ping: 1 }] });

    const { GET } = await import('@/app/api/health/route');
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.config.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.latencyMs).toBeDefined();
  });

  it('returns degraded when database is down', async () => {
    vi.mocked(d1.query).mockRejectedValue(new Error('Connection refused'));

    const { GET } = await import('@/app/api/health/route');
    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('error');
  });

  it('returns no-store cache header', async () => {
    vi.mocked(d1.query).mockResolvedValue({ success: true, result: [{ ping: 1 }] });

    const { GET } = await import('@/app/api/health/route');
    const res = await GET();

    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('includes version from env', async () => {
    vi.mocked(d1.query).mockResolvedValue({ success: true, result: [{ ping: 1 }] });

    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const body = await res.json();

    expect(body.version).toBeDefined();
  });
});

// ── Structured Logger ───────────────────────────────────────────

describe('logger', () => {
  it('logs info level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test.event', { key: 'value' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('test.event');
    spy.mockRestore();
  });

  it('logs error level', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('test.error', { message: 'something broke' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('test.error');
    spy.mockRestore();
  });

  it('logs warn level', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('test.warning');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('test.warning');
    spy.mockRestore();
  });

  it('creates scoped logger', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = logger.scope('debate');
    log.info('created', { debateId: '123' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('debate.created');
    spy.mockRestore();
  });

  it('includes data in log output', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test', { userId: 'abc', count: 5 });

    const logged = spy.mock.calls[0][0];
    expect(logged).toContain('userId');
    expect(logged).toContain('abc');
    spy.mockRestore();
  });
});
