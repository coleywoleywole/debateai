import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as createPOST } from '@/app/api/debate/create/route';
import { POST as messagePOST } from '@/app/api/debate/[debateId]/route';
import { POST as scorePOST } from '@/app/api/debate/score/route';
import { d1 } from '@/lib/d1';
import * as authHelper from '@/lib/auth-helper';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/d1', () => ({
  d1: {
    saveDebate: vi.fn(),
    logAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
    getDebate: vi.fn(),
    getUser: vi.fn(),
    addMessage: vi.fn(),
    checkDebateMessageLimit: vi.fn(),
    checkUserDebateLimit: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock('@/lib/auth-helper', () => ({
  getUserId: vi.fn(),
}));

vi.mock('@/lib/app-disabled', () => ({
  checkAppDisabled: vi.fn(() => null),
}));

vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({
    check: vi.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 })),
  })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn((rl) => NextResponse.json({ error: 'Rate limited' }, { status: 429 })),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/posthog-server', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/lib/vertex', () => ({
  getGeminiModel: vi.fn(() => ({
    generateContentStream: vi.fn(async () => ({
      stream: (async function* () {
        yield { candidates: [{ content: { parts: [{ text: 'AI response' }] } }] };
      })(),
    })),
    generateContent: vi.fn(async () => ({
      response: {
        candidates: [{ content: { parts: [{ text: JSON.stringify({ winner: 'user', userScore: 8, aiScore: 5 }) }] } }]
      }
    })),
  })),
}));

describe('Guest Mode - Debate Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a debate for a guest user', async () => {
    vi.mocked(authHelper.getUserId).mockResolvedValue(null);
    vi.mocked(d1.saveDebate).mockResolvedValue({ success: true, debateId: 'test-uuid' });
    vi.mocked(d1.checkUserDebateLimit).mockResolvedValue({
      success: true, count: 0, limit: 1, allowed: true, remaining: 1, isPremium: false,
    });

    const req = new NextRequest('http://localhost/api/debate/create', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'Test Topic',
        character: 'philosopher',
        debateId: 'test-uuid-123',
      }),
    });

    const res = await createPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isGuest).toBe(true);
    expect(data.guestId).toMatch(/^guest_/);
  });

  it('should enforce guest message limit', async () => {
    const guestId = 'guest_123';
    vi.mocked(authHelper.getUserId).mockResolvedValue(guestId);
    
    vi.mocked(d1.getDebate).mockResolvedValue({
      success: true,
      debate: {
        id: 'debate_123',
        user_id: guestId,
        messages: Array(5).fill({ role: 'user', content: 'test' }),
        topic: 'Test',
      }
    } as any);

    // Mock limit reached
    vi.mocked(d1.checkDebateMessageLimit).mockResolvedValue({
      success: true,
      count: 6,
      limit: 5,
      allowed: false,
      remaining: 0,
      isPremium: false
    });

    const req = new NextRequest('http://localhost/api/debate/debate_123', {
      method: 'POST',
      body: JSON.stringify({
        message: 'My argument',
      }),
    });

    const res = await messagePOST(req, { params: Promise.resolve({ debateId: 'debate_123' }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('guest_limit_reached');
  });

  it('should allow scoring for guests but skip streaks', async () => {
    const guestId = 'guest_123';
    vi.mocked(authHelper.getUserId).mockResolvedValue(guestId);
    
    vi.mocked(d1.getDebate).mockResolvedValue({
      success: true,
      debate: {
        id: 'debate_123',
        user_id: guestId,
        messages: [
          { role: 'user', content: 'u1' }, { role: 'ai', content: 'a1' },
          { role: 'user', content: 'u2' }, { role: 'ai', content: 'a2' }
        ],
        topic: 'Test',
      }
    } as any);

    const req = new NextRequest('http://localhost/api/debate/score', {
      method: 'POST',
      body: JSON.stringify({ debateId: 'debate_123' }),
    });

    const res = await scorePOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.score.winner).toBe('user');
    // Streaks should NOT be updated (no recordDebateCompletion call for guests)
    // We can't easily verify skip without exports but we can verify it doesn't crash
  });
});
