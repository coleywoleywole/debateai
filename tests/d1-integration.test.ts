/**
 * D1 Integration Tests
 *
 * Tests the D1Client class by mocking global.fetch (NOT the d1 module itself).
 * This validates the actual query(), addMessage(), saveDebate(), getDebate(),
 * checkDebateMessageLimit(), and findRecentDuplicate() code paths.
 *
 * We vi.unmock('@/lib/d1') to undo the setup.ts mock and test real D1Client logic.
 * Env vars must be set before the D1Client singleton is constructed at import time.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Unmock d1 so we test the real D1Client code, not the setup.ts stub.
// The env vars are set in the beforeEach via a dynamic re-import approach,
// but since D1Client is a singleton created at module-load time, we need
// env vars already in place before import. Vitest hoists vi.unmock, and
// process.env assignments at top level run before dynamic imports too.
vi.unmock('@/lib/d1');

// ─── Helpers ────────────────────────────────────────────────────

const D1_URL = 'https://api.cloudflare.com/client/v4/accounts/test-account-id/d1/database/test-database-id/query';

/** Build a successful D1 API response containing the given rows. */
function d1Ok(rows: Record<string, unknown>[], meta?: Record<string, unknown>) {
  return {
    success: true,
    result: [{ results: rows, success: true, meta: meta ?? {} }],
  };
}

/** Build a failed D1 API response matching real Cloudflare D1 format.
 *  D1 returns errors as an array of objects: { success: false, errors: [{code, message}] }
 *  The D1Client.query() method does: error: data.errors || data.error
 *  So result.error ends up as an array of objects, NOT a plain string.
 */
function d1Fail(errorMsg: string, code = 7500) {
  return {
    success: false,
    errors: [{ code, message: errorMsg }],
  };
}

// We'll hold a reference to the d1 instance after dynamic import
let d1: any;
let fetchMock: ReturnType<typeof vi.fn>;

/** Track all fetch calls and return their parsed bodies. */
function getCalls(): Array<{ sql: string; params: unknown[] }> {
  return fetchMock.mock.calls.map(
    (call: any[]) => {
      const body = JSON.parse(call[1]?.body ?? '{}');
      return { sql: body.sql, params: body.params };
    }
  );
}

// ─── Setup / Teardown ───────────────────────────────────────────

beforeEach(async () => {
  // Set env vars before each test (in case any test clears them)
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
  process.env.CLOUDFLARE_D1_DATABASE_ID = 'test-database-id';
  process.env.CLOUDFLARE_API_TOKEN = 'test-api-token';
  process.env.CLOUDFLARE_EMAIL = 'test@example.com';

  // Clear module cache so D1Client gets reconstructed with fresh env vars
  vi.resetModules();

  // Mock fetch before importing d1
  fetchMock = vi.fn();
  global.fetch = fetchMock;

  // Dynamically import d1 (reconstructs the singleton with our env vars)
  const mod = await import('@/lib/d1');
  d1 = mod.d1;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════
// 1. Message persistence round-trip
// ═════════════════════════════════════════════════════════════════

describe('Message persistence round-trip', () => {
  it('saveDebate creates, addMessage appends, getDebate returns combined messages', async () => {
    const debateId = 'debate-round-trip';
    const initialMessages = [{ role: 'user', content: 'Hello' }];

    // ── Step 1: saveDebate (INSERT, no daily limit) ──
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([], { changes: 1 }),
    });

    const saveResult = await d1.saveDebate({
      debateId,
      userId: 'user-1',
      opponent: 'socratic',
      topic: 'AI ethics',
      messages: initialMessages,
    });

    expect(saveResult.success).toBe(true);
    expect(saveResult.debateId).toBe(debateId);

    // Verify the INSERT SQL was sent
    const insertCall = getCalls()[0];
    expect(insertCall.sql).toContain('INSERT INTO debates');
    expect(insertCall.params).toContain(debateId);

    // ── Step 2: addMessage — first fetches existing debate via getDebate ──
    const existingDebateRow = {
      id: debateId,
      user_id: 'user-1',
      opponent: 'socratic',
      topic: 'AI ethics',
      messages: JSON.stringify(initialMessages),
      score_data: null,
      username: null,
      author_display_name: null,
    };

    // addMessage calls getDebate internally, which is a SELECT
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([existingDebateRow]),
    });

    // Then addMessage does an UPDATE
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([], { changes: 1 }),
    });

    const addResult = await d1.addMessage(debateId, { role: 'assistant', content: 'I see your point.' });

    expect(addResult.success).toBe(true);

    // Verify the UPDATE includes both old + new messages
    const updateCall = getCalls()[getCalls().length - 1];
    expect(updateCall.sql).toContain('UPDATE debates SET messages');
    const updatedMessages = JSON.parse(updateCall.params[0] as string);
    expect(updatedMessages).toHaveLength(2);
    expect(updatedMessages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(updatedMessages[1]).toEqual({ role: 'assistant', content: 'I see your point.' });

    // ── Step 3: getDebate returns the debate with parsed messages ──
    const fullDebateRow = {
      id: debateId,
      user_id: 'user-1',
      opponent: 'socratic',
      topic: 'AI ethics',
      messages: JSON.stringify([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'I see your point.' },
      ]),
      score_data: null,
      username: 'testuser',
      author_display_name: 'Test User',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([fullDebateRow]),
    });

    const getResult = await d1.getDebate(debateId);

    expect(getResult.success).toBe(true);
    expect(getResult.debate).toBeDefined();
    expect(Array.isArray(getResult.debate!.messages)).toBe(true);
    expect((getResult.debate!.messages as any[]).length).toBe(2);
    expect((getResult.debate!.messages as any[])[1].content).toBe('I see your point.');
  });

  it('addMessage appends without overwriting existing messages', async () => {
    const existingMessages = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Reply to first' },
      { role: 'user', content: 'Second' },
    ];

    // getDebate SELECT
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        d1Ok([{
          id: 'debate-append',
          user_id: 'user-1',
          opponent: 'socratic',
          topic: 'Testing',
          messages: JSON.stringify(existingMessages),
          score_data: null,
          username: null,
          author_display_name: null,
        }]),
    });

    // UPDATE
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([], { changes: 1 }),
    });

    await d1.addMessage('debate-append', { role: 'assistant', content: 'Reply to second' });

    const updateCall = getCalls()[1];
    const updatedMessages = JSON.parse(updateCall.params[0] as string);
    expect(updatedMessages).toHaveLength(4);
    expect(updatedMessages[0].content).toBe('First');
    expect(updatedMessages[1].content).toBe('Reply to first');
    expect(updatedMessages[2].content).toBe('Second');
    expect(updatedMessages[3].content).toBe('Reply to second');
  });

  it('addMessage with state updates generates correct SQL columns', async () => {
    // getDebate SELECT
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        d1Ok([{
          id: 'debate-state',
          user_id: 'user-1',
          opponent: 'socratic',
          topic: 'State test',
          messages: JSON.stringify([{ role: 'user', content: 'arg' }]),
          score_data: null,
          username: null,
          author_display_name: null,
        }]),
    });

    // UPDATE
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([], { changes: 1 }),
    });

    await d1.addMessage(
      'debate-state',
      { role: 'assistant', content: 'final reply' },
      { currentRound: 3, status: 'completed', winner: 'user' }
    );

    const updateCall = getCalls()[1];
    expect(updateCall.sql).toContain('current_round = ?');
    expect(updateCall.sql).toContain('status = ?');
    expect(updateCall.sql).toContain('winner = ?');
    // Params order: messages, currentRound, status, winner, debateId
    expect(updateCall.params[1]).toBe(3);       // currentRound
    expect(updateCall.params[2]).toBe('completed'); // status
    expect(updateCall.params[3]).toBe('user');   // winner
    expect(updateCall.params[4]).toBe('debate-state'); // WHERE id = ?
  });

  it('addMessage returns error when debate not found', async () => {
    // getDebate SELECT returns no rows
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([]),
    });

    const result = await d1.addMessage('nonexistent', { role: 'user', content: 'hello' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Debate not found');
  });
});

// ═════════════════════════════════════════════════════════════════
// 2. Debate creation flows
// ═════════════════════════════════════════════════════════════════

describe('Debate creation flows', () => {
  it('saveDebate with daily limit check — within limit succeeds', async () => {
    // INSERT with WHERE subquery succeeds (changes = 1)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([], { changes: 1 }),
    });

    const result = await d1.saveDebate({
      debateId: 'debate-limited-ok',
      userId: 'user-1',
      opponent: 'socratic',
      topic: 'Limits',
      messages: [],
      dailyLimit: 3,
    });

    expect(result.success).toBe(true);
    expect(result.debateId).toBe('debate-limited-ok');

    // Verify the SQL uses the daily-limit subquery
    const call = getCalls()[0];
    expect(call.sql).toContain('WHERE (SELECT COUNT(*)');
    expect(call.sql).toContain("created_at >= date('now')");
    // Last two params should be userId and dailyLimit
    const params = call.params;
    expect(params[params.length - 2]).toBe('user-1');
    expect(params[params.length - 1]).toBe(3);
  });

  it('saveDebate with daily limit check — at limit fails with debate_limit_exceeded', async () => {
    // INSERT with WHERE subquery — 0 changes means limit hit
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([], { changes: 0 }),
    });

    const result = await d1.saveDebate({
      debateId: 'debate-limited-fail',
      userId: 'user-1',
      opponent: 'socratic',
      topic: 'Too many debates',
      messages: [],
      dailyLimit: 3,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('debate_limit_exceeded');
    expect(result.debateId).toBe('debate-limited-fail');
  });

  it('saveDebate handles duplicate by updating (UNIQUE constraint conflict)', async () => {
    // First INSERT fails with UNIQUE constraint error
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Fail('UNIQUE constraint failed: debates.id'),
    });

    // Then the UPDATE succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([], { changes: 1 }),
    });

    const result = await d1.saveDebate({
      debateId: 'debate-dup',
      userId: 'user-1',
      opponent: 'socratic',
      topic: 'Dup test',
      messages: [{ role: 'user', content: 'updated' }],
    });

    expect(result.success).toBe(true);

    // Verify the fallback UPDATE was issued
    const updateCall = getCalls()[1];
    expect(updateCall.sql).toContain('UPDATE debates SET');
    expect(updateCall.sql).toContain('WHERE id = ? AND user_id = ?');
  });

  it('saveDebate duplicate update fails when different user owns debate', async () => {
    // INSERT fails with UNIQUE constraint
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Fail('UNIQUE constraint failed: debates.id'),
    });

    // UPDATE succeeds but changes = 0 (user_id does not match)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([], { changes: 0 }),
    });

    const result = await d1.saveDebate({
      debateId: 'debate-stolen',
      userId: 'user-attacker',
      opponent: 'socratic',
      topic: 'Hijack attempt',
      messages: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Debate already exists');
  });

  it('saveDebate detects UNIQUE conflict from real D1 error array format (regression)', async () => {
    // This is the exact format D1 returns: errors as array of {code, message} objects
    // Previously, String([{code: 7500, message: "..."}]) gave "[object Object]"
    // which never matched "UNIQUE constraint", so the UPDATE branch was never taken.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        errors: [{ code: 7500, message: 'UNIQUE constraint failed: debates.id at offset 169: SQLITE_ERROR' }],
      }),
    });

    // The UPDATE fallback should fire
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([], { changes: 1 }),
    });

    const result = await d1.saveDebate({
      debateId: 'debate-regression',
      userId: 'user-1',
      opponent: 'socratic',
      topic: 'Regression test',
      messages: [
        { role: 'system', content: 'Welcome' },
        { role: 'user', content: 'My argument' },
        { role: 'ai', content: 'AI response' },
      ],
    });

    expect(result.success).toBe(true);

    // Verify UPDATE was actually issued (not silently skipped)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const updateCall = getCalls()[1];
    expect(updateCall.sql).toContain('UPDATE debates SET');
    expect(updateCall.sql).toContain('WHERE id = ? AND user_id = ?');

    // Verify messages were passed to the UPDATE
    const messagesParam = JSON.parse(updateCall.params[2] as string);
    expect(messagesParam).toHaveLength(3);
    expect(messagesParam[2].content).toBe('AI response');
  });

  it('findRecentDuplicate returns found=true when a match exists', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([{ id: 'debate-recent' }]),
    });

    const result = await d1.findRecentDuplicate('user-1', 'AI ethics');

    expect(result.found).toBe(true);
    expect(result.debateId).toBe('debate-recent');

    const call = getCalls()[0];
    expect(call.sql).toContain("datetime('now'");
    expect(call.params[0]).toBe('user-1');
    expect(call.params[1]).toBe('AI ethics');
  });

  it('findRecentDuplicate returns found=false when no match', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([]),
    });

    const result = await d1.findRecentDuplicate('user-1', 'New topic');

    expect(result.found).toBe(false);
    expect(result.debateId).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════
// 3. Score data round-trip
// ═════════════════════════════════════════════════════════════════

describe('Score data round-trip', () => {
  it('saveDebate writes score_data JSON, getDebate reads and parses it with metadata extraction', async () => {
    const scoreData = {
      debateScore: { winner: 'user', userScore: 9, aiScore: 7, summary: 'Strong argument' },
    };

    // ── saveDebate INSERT ──
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([], { changes: 1 }),
    });

    const saveResult = await d1.saveDebate({
      debateId: 'debate-score',
      userId: 'user-1',
      opponent: 'socratic',
      topic: 'Score test',
      messages: [{ role: 'user', content: 'Argument' }],
      userScore: 9,
      aiScore: 7,
      scoreData,
      opponentStyle: 'aggressive',
      promptVariant: 'v2',
    });

    expect(saveResult.success).toBe(true);

    // Verify score_data in the INSERT params — it should be a JSON string
    // containing the scoreData merged with opponentStyle and promptVariant
    const insertCall = getCalls()[0];
    const scoreDataParam = insertCall.params[7] as string; // 8th param = score_data
    const parsed = JSON.parse(scoreDataParam);
    expect(parsed.debateScore.winner).toBe('user');
    expect(parsed.opponentStyle).toBe('aggressive');
    expect(parsed.promptVariant).toBe('v2');

    // ── getDebate reads it back with parsed fields ──
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        d1Ok([{
          id: 'debate-score',
          user_id: 'user-1',
          opponent: 'socratic',
          topic: 'Score test',
          messages: JSON.stringify([{ role: 'user', content: 'Argument' }]),
          score_data: JSON.stringify({
            debateScore: { winner: 'user', userScore: 9, aiScore: 7, summary: 'Strong argument' },
            opponentStyle: 'aggressive',
            promptVariant: 'v2',
          }),
          user_score: 9,
          ai_score: 7,
          username: null,
          author_display_name: null,
        }]),
    });

    const getResult = await d1.getDebate('debate-score');

    expect(getResult.success).toBe(true);
    const debate = getResult.debate as any;
    // score_data should be parsed into an object
    expect(typeof debate.score_data).toBe('object');
    expect(debate.score_data.debateScore.winner).toBe('user');
    // Metadata extracted to top-level
    expect(debate.opponentStyle).toBe('aggressive');
    expect(debate.promptVariant).toBe('v2');
  });

  it('getDebate handles null score_data gracefully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        d1Ok([{
          id: 'debate-no-score',
          user_id: 'user-1',
          opponent: 'socratic',
          topic: 'No score',
          messages: JSON.stringify([]),
          score_data: null,
          username: null,
          author_display_name: null,
        }]),
    });

    const result = await d1.getDebate('debate-no-score');

    expect(result.success).toBe(true);
    expect(result.debate!.score_data).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════
// 4. Guest vs authenticated message limits
// ═════════════════════════════════════════════════════════════════

describe('Guest vs authenticated message limits', () => {
  it('returns correct limit for guest_ users (GUEST_MESSAGE_LIMIT = 5)', async () => {
    // First query: get user_id and msg_count
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([{ user_id: 'guest_abc123', msg_count: 2 }]),
    });

    // getUser query (for premium check) — guest won't be in users table
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([]),
    });

    const result = await d1.checkDebateMessageLimit('debate-guest');

    expect(result.limit).toBe(5); // GUEST_MESSAGE_LIMIT
    expect(result.isPremium).toBe(false);
    expect(result.allowed).toBe(true);
    // With 2 total messages, estimated user msgs = ceil(2/2) = 1
    expect(result.count).toBe(1);
    expect(result.remaining).toBe(4);
  });

  it('returns correct limit for regular (free) users (FREE_USER_MESSAGE_LIMIT = 10)', async () => {
    // First query: get user_id and msg_count
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([{ user_id: 'user_regular', msg_count: 4 }]),
    });

    // getUser query — regular user exists but not premium
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        d1Ok([{ user_id: 'user_regular', subscription_status: null, stripe_plan: null }]),
    });

    const result = await d1.checkDebateMessageLimit('debate-regular');

    expect(result.limit).toBe(10); // FREE_USER_MESSAGE_LIMIT
    expect(result.isPremium).toBe(false);
    expect(result.allowed).toBe(true);
    // 4 total messages, 4 < 10 so takes the quick path: estimated count = ceil(4/2) = 2
    expect(result.count).toBe(2);
  });

  it('returns unlimited for premium users', async () => {
    // First query: get user_id and msg_count
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([{ user_id: 'user_premium', msg_count: 20 }]),
    });

    // getUser query — premium user
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        d1Ok([{
          user_id: 'user_premium',
          subscription_status: 'active',
          stripe_plan: 'premium',
        }]),
    });

    const result = await d1.checkDebateMessageLimit('debate-premium');

    expect(result.limit).toBe(-1); // Unlimited
    expect(result.isPremium).toBe(true);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(-1);
  });

  it('returns exact count when near the limit (fetches full messages)', async () => {
    // First query: user_id and msg_count — msg_count >= limit triggers full fetch
    // For a regular user, limit=10, so msg_count >= 10 triggers exact count path
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([{ user_id: 'user_nearmax', msg_count: 12 }]),
    });

    // getUser query — not premium
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        d1Ok([{ user_id: 'user_nearmax', subscription_status: null, stripe_plan: null }]),
    });

    // Full messages fetch for exact count
    const messages = [
      { role: 'user', content: 'msg1' },
      { role: 'assistant', content: 'reply1' },
      { role: 'user', content: 'msg2' },
      { role: 'assistant', content: 'reply2' },
      { role: 'user', content: 'msg3' },
      { role: 'assistant', content: 'reply3' },
      { role: 'user', content: 'msg4' },
      { role: 'assistant', content: 'reply4' },
      { role: 'user', content: 'msg5' },
      { role: 'assistant', content: 'reply5' },
      { role: 'user', content: 'msg6' },
      { role: 'assistant', content: 'reply6' },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([{ messages: JSON.stringify(messages) }]),
    });

    const result = await d1.checkDebateMessageLimit('debate-nearmax');

    expect(result.limit).toBe(10); // FREE_USER_MESSAGE_LIMIT
    expect(result.count).toBe(6);  // 6 user messages
    expect(result.allowed).toBe(true); // 6 < 10
    expect(result.remaining).toBe(4);
  });

  it('returns allowed=false when at limit (exact count path)', async () => {
    // msg_count >= limit for guest (limit=5)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([{ user_id: 'guest_maxed', msg_count: 10 }]),
    });

    // getUser — no user record
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([]),
    });

    // Full messages fetch — 5 user messages (at limit)
    const messages = [
      { role: 'user', content: '1' }, { role: 'assistant', content: 'r1' },
      { role: 'user', content: '2' }, { role: 'assistant', content: 'r2' },
      { role: 'user', content: '3' }, { role: 'assistant', content: 'r3' },
      { role: 'user', content: '4' }, { role: 'assistant', content: 'r4' },
      { role: 'user', content: '5' }, { role: 'assistant', content: 'r5' },
    ];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([{ messages: JSON.stringify(messages) }]),
    });

    const result = await d1.checkDebateMessageLimit('debate-maxed');

    expect(result.limit).toBe(5); // GUEST_MESSAGE_LIMIT
    expect(result.count).toBe(5);
    expect(result.allowed).toBe(false); // 5 < 5 is false
    expect(result.remaining).toBe(0);
  });

  it('returns default values when debate not found', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([]),
    });

    const result = await d1.checkDebateMessageLimit('nonexistent');

    expect(result.success).toBe(false);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(2);
    expect(result.count).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════
// 5. D1Client.query() edge cases
// ═════════════════════════════════════════════════════════════════

describe('D1Client.query() low-level behavior', () => {
  it('sends correct URL, headers, and body to Cloudflare API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => d1Ok([{ count: 42 }]),
    });

    await d1.query('SELECT COUNT(*) as count FROM debates WHERE user_id = ?', ['user-1']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(D1_URL);
    expect(opts.method).toBe('POST');
    expect(opts.headers['Authorization']).toBe('Bearer test-api-token');
    expect(opts.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(opts.body);
    expect(body.sql).toBe('SELECT COUNT(*) as count FROM debates WHERE user_id = ?');
    expect(body.params).toEqual(['user-1']);
  });

  it('returns error when fetch throws (network failure)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await d1.query('SELECT 1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Query failed');
  });

  it('returns error when D1 API returns success: false', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        errors: [{ message: 'syntax error near SELECT' }],
      }),
    });

    const result = await d1.query('SLECT bad syntax');

    expect(result.success).toBe(false);
  });

  it('returns empty result when D1 returns no result[0]', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, result: [] }),
    });

    const result = await d1.query('SELECT 1');

    // NOTE: D1Client returns { success: false, result: [] } when result[0] is missing.
    // The result field is only present on the return when explicitly set.
    expect(result.success).toBe(false);
  });
});
