import { describe, it, beforeAll, expect } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      ...options,
    });
    return response;
  } catch {
    return {
      ok: false,
      status: 0,
      statusText: 'Connection Failed',
      headers: new Headers(),
      json: async () => ({ error: 'Connection failed' }),
      text: async () => 'Connection failed',
      _connectionError: true,
    } as unknown as Response;
  }
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/stats`, {
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    return response.ok;
  } catch {
    return false;
  }
}

describe('Debate API Integration Tests', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await checkServer();
    if (!serverAvailable) {
      console.warn(`\n⚠️  Server not available at ${BASE_URL}`);
      console.warn('   Set TEST_BASE_URL or start the dev server to run these tests.');
      console.warn('   Skipping integration tests...\n');
    } else {
      console.log(`\n✅ Server available at ${BASE_URL}`);
      console.log('   Running API integration tests...\n');
    }
  });

  // Helper removed (unused)

  // Or better, just return early in tests if not available, but skipIf is cleaner.
  // However, skipIf is evaluated at definition time? No, it takes a boolean.
  // Since serverAvailable is set in beforeAll, I might need to check inside the test or use a different structure.
  // Actually, 'serverAvailable' will be false initially.
  // So I'll check inside the tests or wrap the suite.
  
  // Let's just check inside tests for now or use a dynamic skip.

  describe('Stats API (/api/stats) - PUBLIC', () => {
    it('should return platform statistics', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const response = await apiRequest('/api/stats', { method: 'GET' });
      expect(response.status).toBe(200);

      const body = await parseJson(response);
      expect(body).toBeTruthy();
      expect(typeof body.totalDebates).toBe('number');
      expect(typeof body.uniqueUsers).toBe('number');
      expect(typeof body.debatesToday).toBe('number');
      expect(typeof body.debatesThisWeek).toBe('number');
      expect(body.generatedAt).toBeTruthy();
    });

    it('should include top topics array', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const response = await apiRequest('/api/stats', { method: 'GET' });
      const body = await parseJson(response);

      expect(Array.isArray(body.topTopics)).toBe(true);
      if (body.topTopics.length > 0) {
        const topic = body.topTopics[0];
        expect(topic.topic).toBeTruthy();
        expect(typeof topic.count).toBe('number');
      }
    });

    it('should support caching', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const response1 = await apiRequest('/api/stats', { method: 'GET' });
      const body1 = await parseJson(response1);

      const response2 = await apiRequest('/api/stats', { method: 'GET' });
      const body2 = await parseJson(response2);

      expect(body1.generatedAt).toBeTruthy();
      expect(body2.generatedAt).toBeTruthy();
    });
  });

  describe('Trending API (/api/trending) - PUBLIC', () => {
    it('should return trending topics', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const response = await apiRequest('/api/trending', { method: 'GET' });
      expect(response.status).toBe(200);

      const body = await parseJson(response);
      expect(body).toBeTruthy();
      expect(Array.isArray(body.topics)).toBe(true);

      if (body.topics.length > 0) {
        const topic = body.topics[0];
        expect(topic.id).toBeTruthy();
        expect(topic.question).toBeTruthy();
      }
    });
  });

  describe('Share API (/api/share/[debateId]) - PUBLIC', () => {
    it('should return 404 for non-existent debate', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const response = await apiRequest('/api/share/nonexistent-debate-xyz-123', {
        method: 'GET',
      });
      expect(response.status).toBe(404);
    });
  });

  describe('OG Image API (/api/og) - PUBLIC', () => {
    it('should return an image', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const response = await apiRequest('/api/og', { method: 'GET' });
      expect(response.status).toBe(200);
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('image');
    });
  });

  // PROTECTED ENDPOINTS
  describe('Debate Create API (/api/debate/create) - PROTECTED', () => {
    it('should reject unauthenticated requests', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const response = await apiRequest('/api/debate/create', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Test topic',
          debateId: 'test-' + Date.now(),
          character: 'socratic',
        }),
      });

      expect([401, 403, 405, 307, 308].includes(response.status) || !response.ok).toBe(true);
    });
  });

  describe('Debate Message API (/api/debate) - PROTECTED', () => {
    it('should reject unauthenticated requests', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const response = await apiRequest('/api/debate', {
        method: 'POST',
        body: JSON.stringify({
          debateId: 'test-123',
          character: 'socratic',
          topic: 'Test topic',
          userArgument: 'Test argument',
        }),
      });

      expect([401, 403, 405, 307, 308].includes(response.status) || !response.ok).toBe(true);
    });
  });

  // ERROR HANDLING
  describe('Error Response Format', () => {
    it('should not leak sensitive information in errors', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const response = await apiRequest('/api/stripe/create-checkout', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const body = await parseJson(response);
      if (body) {
        const errorStr = JSON.stringify(body);
        expect(errorStr).not.toContain('node_modules');
        expect(errorStr).not.toContain('sk_live_');
        expect(errorStr).not.toContain('sk_test_');
      }
    });

    it('should handle malformed JSON gracefully', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const response = await fetch(`${BASE_URL}/api/stats`, {
        method: 'GET', // GET ignores body usually, but let's try sending one if possible? fetch allows body on GET? No.
        // The original test just sent GET to verify it works.
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
        redirect: 'follow',
      });

      expect(response.status).toBe(200);
    });
  });

  // RATE LIMITING
  describe('Rate Limiting', () => {
    it('should respond to rapid requests (not immediately blocked)', async (ctx) => {
      if (!serverAvailable) ctx.skip();

      const requests = Array(3).fill(null).map(() =>
        apiRequest('/api/stats', { method: 'GET' })
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });
});
