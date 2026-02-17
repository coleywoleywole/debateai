import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/debate/[debateId]/route';
import { NextRequest } from 'next/server';
import { d1 } from '@/lib/d1';
import * as authHelperModule from '@/lib/auth-helper';

// Mock dependencies
vi.mock('@/lib/d1', () => ({
  d1: {
    getDebate: vi.fn(),
    addMessage: vi.fn(),
    checkDebateMessageLimit: vi.fn(),
    getUser: vi.fn(),
  },
}));

vi.mock('@/lib/auth-helper', () => ({
  getUserId: vi.fn(),
}));

vi.mock('@/lib/posthog-server', () => ({
  trackEvent: vi.fn(),
}));

// Mock AI response generation to avoid external calls
vi.mock('@/lib/debate-state', async () => {
  const actual = await vi.importActual('@/lib/debate-state');
  return {
    ...actual,
    // We keep actual logic for calculateRound/isDebateCompleted
  };
});

// Helper to create requests
function createRequest(debateId: string, body: any) {
  return new NextRequest(`http://localhost/api/debate/${debateId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Debate Rounds API', () => {
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authHelperModule.getUserId).mockResolvedValue(userId);
    vi.mocked(d1.getUser).mockResolvedValue({ subscription_status: 'active', stripe_plan: 'premium' }); // Bypass limits
  });

  it('should be Round 1 for first user message', async () => {
    const testId = 'test-debate-1';
    // Setup: Debate with just System message
    const mockDebate = {
      id: testId,
      user_id: userId,
      messages: [{ role: 'system', content: 'Welcome' }],
      status: 'active',
      current_round: 1,
    };
    
    vi.mocked(d1.getDebate).mockResolvedValue({ success: true, debate: mockDebate });
    vi.mocked(d1.addMessage).mockResolvedValue({ success: true });

    const req = createRequest(testId, { message: 'User Arg 1' });
    const params = Promise.resolve({ debateId: testId });
    const res = await POST(req, { params });
    const json = await res.json();

    // After AI reply, we are ready for Round 2
    expect(json.currentRound).toBe(2);
    expect(json.status).toBe('active');
    
    // Check D1 update for AI message
    const calls = vi.mocked(d1.addMessage).mock.calls;
    // Find call for AI message
    const aiCall = calls.find(c => c[1].role === 'ai');
    expect(aiCall).toBeDefined();
    
    // AI message adds msg #3 (Sys, User, AI)
    // calculateRound(3) -> 2. So nextRound passed to DB should be 2.
    expect(aiCall![2].currentRound).toBe(2); 
  });

  it('should be Round 2 for second user message', async () => {
    const testId = 'test-debate-2';
    // Setup: Debate with Sys, User1, AI1
    const mockDebate = {
      id: testId,
      user_id: userId,
      messages: [
        { role: 'system', content: 'Welcome' },
        { role: 'user', content: 'User 1' },
        { role: 'ai', content: 'AI 1' }
      ],
      status: 'active',
      current_round: 2, // Waiting for Round 2 input
    };
    
    vi.mocked(d1.getDebate).mockResolvedValue({ success: true, debate: mockDebate });
    vi.mocked(d1.addMessage).mockResolvedValue({ success: true });

    const req = createRequest(testId, { message: 'User Arg 2' });
    const params = Promise.resolve({ debateId: testId });
    const res = await POST(req, { params });
    const json = await res.json();

    // After AI reply, we are ready for Round 3
    expect(json.currentRound).toBe(3);
    
    // Check D1 update for AI message
    const calls = vi.mocked(d1.addMessage).mock.calls;
    const aiCall = calls.find(c => c[1].role === 'ai');
    
    // AI message adds msg #5 (Sys, U1, A1, U2, A2)
    // calculateRound(5) -> 3.
    expect(aiCall![2].currentRound).toBe(3);
  });

  it('should complete debate after Round 3', async () => {
    const testId = 'test-debate-3';
    // Setup: Debate with Sys, U1, A1, U2, A2
    const mockDebate = {
      id: testId,
      user_id: userId,
      messages: [
        { role: 'system', content: 'Welcome' },
        { role: 'user', content: 'U1' }, { role: 'ai', content: 'A1' },
        { role: 'user', content: 'U2' }, { role: 'ai', content: 'A2' }
      ],
      status: 'active',
      current_round: 3,
      user_score: 10,
      ai_score: 5
    };
    
    vi.mocked(d1.getDebate).mockResolvedValue({ success: true, debate: mockDebate });
    vi.mocked(d1.addMessage).mockResolvedValue({ success: true });

    const req = createRequest(testId, { message: 'User Arg 3' });
    const params = Promise.resolve({ debateId: testId });
    const res = await POST(req, { params });
    const json = await res.json();

    expect(json.currentRound).toBe(3);
    expect(json.status).toBe('completed');
    expect(json.winner).toBe('user');
    
    // Check D1 update for AI message
    const calls = vi.mocked(d1.addMessage).mock.calls;
    const aiCall = calls.find(c => c[1].role === 'ai');
    
    // AI message adds msg #7. isDebateCompleted(7) -> true.
    expect(aiCall![2].status).toBe('completed');
    expect(aiCall![2].winner).toBe('user');
  });
});
