import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../src/app/api/debates/route';
import { d1 } from '../../src/lib/d1';

// Mock dependencies
vi.mock('@/lib/auth-helper', () => ({
  getUserId: vi.fn().mockResolvedValue('user_123'),
}));

vi.mock('@/lib/app-disabled', () => ({
  checkAppDisabled: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/api-errors', () => ({
  // Simple mock implementation of withErrorHandler
  withErrorHandler: (fn: any) => fn,
  errors: {
    unauthorized: () => new Error('Unauthorized'),
    badRequest: (msg: string) => new Error(`BadRequest: ${msg}`),
  }
}));

// Mock d1 module
vi.mock('@/lib/d1', () => ({
  d1: {
    query: vi.fn(),
  },
}));

describe('GET /api/debates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle missing opponent_style by using fallback from score_data', async () => {
    // Mock request
    const request = new Request('http://localhost:3000/api/debates?limit=10&offset=0');

    // Mock D1 response (without opponent_style column)
    const mockDbResult = {
      success: true,
      result: [
        {
          id: 'debate_1',
          opponent: 'Socrates',
          // opponent_style is missing
          topic: 'Philosophy',
          message_count: 5,
          created_at: '2023-01-01',
          score_data: JSON.stringify({ opponentStyle: 'Intellectual' }),
        },
      ],
    };

    // Mock count query as well
    (d1.query as any)
      .mockResolvedValueOnce(mockDbResult) // First query (debates)
      .mockResolvedValueOnce({ success: true, result: [{ total: 1 }] }); // Second query (count)

    const response = await GET(request);
    const data = await response.json();

    expect(data.debates).toHaveLength(1);
    expect(data.debates[0].opponentStyle).toBe('Intellectual');
  });

  it('should use default opponentStyle if missing in score_data', async () => {
    const request = new Request('http://localhost:3000/api/debates?limit=10&offset=0');

    const mockDbResult = {
      success: true,
      result: [
        {
          id: 'debate_2',
          opponent: 'Trump',
          topic: 'Politics',
          message_count: 3,
          created_at: '2023-01-02',
          score_data: null, // No score_data
        },
      ],
    };

    (d1.query as any)
      .mockResolvedValueOnce(mockDbResult)
      .mockResolvedValueOnce({ success: true, result: [{ total: 1 }] });

    const response = await GET(request);
    const data = await response.json();

    expect(data.debates).toHaveLength(1);
    expect(data.debates[0].opponentStyle).toBe('Trump');
  });

  it('should handle missing query parameters by using defaults', async () => {
    // Mock request without any query params
    const request = new Request('http://localhost:3000/api/debates');

    // Mock D1 responses
    (d1.query as any)
      .mockResolvedValueOnce({ success: true, result: [] })
      .mockResolvedValueOnce({ success: true, result: [{ total: 0 }] });

    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.pagination.limit).toBe(20);
    expect(data.pagination.offset).toBe(0);
  });
});
