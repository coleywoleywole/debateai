import { describe, it, expect, vi, beforeEach } from 'vitest';
import { d1 } from '@/lib/d1';
import { getUserId } from '@/lib/auth-helper';
import { checkAppDisabled } from '@/lib/app-disabled';
import { getGeminiModel } from '@/lib/vertex';

// Mock dependencies
vi.mock('@/lib/auth-helper', () => ({
  getUserId: vi.fn(),
}));

vi.mock('@/lib/d1', () => ({
  d1: {
    checkDebateMessageLimit: vi.fn(),
  }
}));

vi.mock('@/lib/app-disabled', () => ({
  checkAppDisabled: vi.fn()
}));

// Mock Vertex AI (Gemini)
const generateContentStreamMock = vi.fn();
vi.mock('@/lib/vertex', () => ({
  getGeminiModel: vi.fn(() => ({
    generateContentStream: generateContentStreamMock
  }))
}));

// Helper to create mock requests
function makeRequest(
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): Request {
  return new Request('http://localhost/api/debate/takeover', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '1.2.3.4',
      ...headers,
    },
  });
}

describe('POST /api/debate/takeover', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getUserId).mockResolvedValue('test-user-123');
    vi.mocked(checkAppDisabled).mockReturnValue(null);
    vi.mocked(d1.checkDebateMessageLimit).mockResolvedValue({ allowed: true, count: 5, limit: 10, isPremium: false });

    // Mock successful stream response
    generateContentStreamMock.mockResolvedValue({
      stream: (async function* () {
        yield { candidates: [{ content: { parts: [{ text: 'AI response' }] } }] };
      })()
    });
    
    // Reset getGeminiModel mock return (since vi.fn defaults are used)
    vi.mocked(getGeminiModel).mockReturnValue({
      generateContentStream: generateContentStreamMock
    } as any);
  });

  it('validates request body', async () => {
    const { POST } = await import('@/app/api/debate/takeover/route');
    const res = await POST(makeRequest('POST', {}));
    
    expect(res.status).toBe(400); // expect validation error
  });

  it('calls Gemini with correct prompt', async () => {
    const { POST } = await import('@/app/api/debate/takeover/route');
    const res = await POST(makeRequest('POST', {
      debateId: 'debate-123',
      topic: 'Cats vs Dogs',
      previousMessages: [
        { role: 'user', content: 'Cats are better' },
        { role: 'ai', content: 'Dogs are loyal' }
      ],
      opponentStyle: 'Socratic'
    }));

    expect(res.status).toBe(200);
    
    // Verify Gemini was initialized
    expect(getGeminiModel).toHaveBeenCalledWith('gemini-2.0-flash-exp', expect.objectContaining({
      systemInstruction: expect.stringContaining('Socratic')
    }));

    // Verify generateContentStream was called
    expect(generateContentStreamMock).toHaveBeenCalledWith(expect.objectContaining({
      contents: [{ role: 'user', parts: [{ text: expect.stringContaining('Generate my response') }] }],
      tools: [{ googleSearchRetrieval: {} }]
    }));
  });
});
