import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/vote/route';
import { NextRequest } from 'next/server';
import * as d1Module from '@/lib/d1';
import * as authHelperModule from '@/lib/auth-helper';

// Mock dependencies
vi.mock('@/lib/d1', () => ({
  d1: {
    vote: vi.fn(),
    getVoteCounts: vi.fn(),
    logAnalyticsEvent: vi.fn(),
  },
}));

vi.mock('@/lib/auth-helper', () => ({
  getUserId: vi.fn(),
}));

// Helper to create requests
function createRequest(body: any) {
  return new NextRequest('http://localhost/api/vote', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Vote API (POST)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if debateId is missing', async () => {
    const req = createRequest({ vote: 'up' });
    const res = await POST(req);
    const json = await res.json();
    
    expect(res.status).toBe(400);
    expect(json.error).toBe('Missing debateId');
  });

  it('should return 400 if vote type is invalid', async () => {
    const req = createRequest({ debateId: 'deb-1', vote: 'invalid' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid vote type');
  });

  it('should allow vote=null (unvote)', async () => {
    // Mock user
    vi.mocked(authHelperModule.getUserId).mockResolvedValue('user_123');
    // Mock D1
    vi.mocked(d1Module.d1.vote).mockResolvedValue(undefined);
    vi.mocked(d1Module.d1.getVoteCounts).mockResolvedValue({ up: 0, down: 0 });

    const req = createRequest({ debateId: 'deb-1', vote: null });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(d1Module.d1.vote).toHaveBeenCalledWith('deb-1', 'user_123', null);
  });

  it('should use existing userId if authenticated', async () => {
    vi.mocked(authHelperModule.getUserId).mockResolvedValue('user_123');
    vi.mocked(d1Module.d1.vote).mockResolvedValue(undefined);
    vi.mocked(d1Module.d1.getVoteCounts).mockResolvedValue({ up: 1, down: 0 });

    const req = createRequest({ debateId: 'deb-1', vote: 'up' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.up).toBe(1);
    expect(d1Module.d1.vote).toHaveBeenCalledWith('deb-1', 'user_123', 'up');
    
    // Should not set cookie
    expect(res.cookies.get('guest_id')).toBeUndefined();
  });

  it('should generate guest ID if not authenticated', async () => {
    vi.mocked(authHelperModule.getUserId).mockResolvedValue(null);
    vi.mocked(d1Module.d1.vote).mockResolvedValue(undefined);
    vi.mocked(d1Module.d1.getVoteCounts).mockResolvedValue({ up: 1, down: 0 });

    const req = createRequest({ debateId: 'deb-1', vote: 'up' });
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    
    // Check D1 call
    const voteCall = vi.mocked(d1Module.d1.vote).mock.calls[0];
    expect(voteCall[0]).toBe('deb-1');
    expect(voteCall[1]).toMatch(/^guest_/);
    expect(voteCall[2]).toBe('up');

    // Check cookie
    const cookie = res.cookies.get('guest_id');
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBeDefined();
  });

  it('should handle database errors', async () => {
    vi.mocked(authHelperModule.getUserId).mockResolvedValue('user_123');
    vi.mocked(d1Module.d1.vote).mockRejectedValue(new Error('DB Error'));

    const req = createRequest({ debateId: 'deb-1', vote: 'up' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Internal Server Error');
  });
});
