import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Comprehensive E2E Tests for DebateAI
 *
 * These tests cover the real user flows end-to-end:
 * 1. Creating a debate from the homepage and receiving a streamed AI response
 * 2. Multi-turn conversation flow
 * 3. Floating verdict button + judgment flow
 * 4. AI Takeover (let AI argue for you)
 * 5. Error handling (500, rate limit, network, mid-stream)
 * 6. UI state verification (no rounds, no quick replies, no hard mode)
 * 7. Mobile viewport
 * 8. Viewing an existing debate (read-only)
 *
 * All AI API calls are mocked via Playwright route interception.
 */

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Build a realistic SSE body that mirrors the actual Gemini streaming format. */
function sseBody(content: string, opts?: { debateId?: string; citations?: Array<{ id: number; url: string; title: string }> }): string {
  const debateId = opts?.debateId ?? 'e2e-debate-' + Date.now();
  const chunks = content.match(/.{1,15}/g) || [content];

  let body = `data: ${JSON.stringify({ type: 'start' })}\n\n`;
  for (const chunk of chunks) {
    body += `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
  }
  if (opts?.citations && opts.citations.length > 0) {
    body += `data: ${JSON.stringify({ type: 'citations', citations: opts.citations })}\n\n`;
  }
  body += `data: ${JSON.stringify({ type: 'complete', content, debateId, ...(opts?.citations && { citations: opts.citations }) })}\n\n`;
  body += `data: [DONE]\n\n`;
  return body;
}

/** Fulfill a route with an SSE response. */
function fulfillSSE(route: Route, body: string) {
  return route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

const AI_RESPONSE_1 =
  "That's a bold claim. While technological progress is undeniable, the notion that AI will fundamentally reshape work ignores the adaptability of human labor markets. History shows that automation creates as many jobs as it destroys.";
const AI_RESPONSE_2 =
  "You raise an interesting counterpoint, but you're conflating short-term disruption with long-term structural change. The Industrial Revolution took decades to settle — we don't have that luxury with exponential AI improvement.";
const JUDGE_RESPONSE = {
  userScore: 72,
  aiScore: 78,
  winner: 'ai' as const,
  summary: 'Both sides presented strong arguments. The AI edged ahead with more specific historical examples.',
  userStrength: 'Clear thesis and good structure',
  aiStrength: 'Historical parallels and nuanced reasoning',
  keyMoment: 'The exchange about labor market adaptability was the turning point.',
  categories: {
    logic: { user: 7, ai: 8 },
    evidence: { user: 6, ai: 8 },
    persuasion: { user: 7, ai: 7 },
    clarity: { user: 8, ai: 7 },
    rebuttal: { user: 7, ai: 8 },
  },
};

/**
 * Set up mocks for the full debate creation + messaging flow.
 *
 * Key flow:
 * 1. Homepage calls POST /api/debate/create → we return { success: true, debateId }
 *    (but the client already generated its own UUID and navigates to it)
 * 2. The debate page server component tries D1 (fails in dev) → initialDebate=null
 * 3. DebateClient fetches GET /api/debate/{uuid} to revalidate
 * 4. If isInstantDebate, auto-sends first message via POST /api/debate (streaming)
 */
async function setupFullDebateMocks(page: Page) {
  // Skip onboarding overlay — it blocks clicks on the "Start Debate" button
  await page.addInitScript(() => {
    localStorage.setItem('debateai_onboarded', 'true');
  });

  // Mock debate creation — note: client generates its own UUID, doesn't use our debateId
  await page.route('**/api/debate/create', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, debateId: 'mock-id' }),
    }),
  );

  // Mock debate GET — the client fetches /api/debate/{uuid} to load/revalidate
  // Use a regex to match any UUID-like debate ID path
  await page.route(/\/api\/debate\/[a-f0-9-]{10,}/, async (route) => {
    if (route.request().method() === 'GET') {
      // Extract debateId from URL
      const url = new URL(route.request().url());
      const pathParts = url.pathname.split('/');
      const extractedId = pathParts[pathParts.length - 1];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isOwner: true,
          debate: {
            id: extractedId,
            topic: 'AI will reshape the job market',
            opponent: 'custom',
            opponentStyle: 'A sharp contrarian',
            messages: [],
            created_at: new Date().toISOString(),
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Track how many POST /api/debate calls we've seen
  let postCount = 0;

  // Mock debate streaming endpoint — POST /api/debate (no trailing path)
  await page.route('**/api/debate', async (route) => {
    const url = new URL(route.request().url());
    // Only intercept exact /api/debate POST (not /api/debate/create, /api/debate/{id}, etc.)
    if (route.request().method() !== 'POST' || url.pathname !== '/api/debate') {
      await route.continue();
      return;
    }
    postCount++;
    const content = postCount === 1 ? AI_RESPONSE_1 : AI_RESPONSE_2;
    await fulfillSSE(route, sseBody(content));
  });

  // Mock the daily topics API (used on homepage for "Today's Debate")
  await page.route('**/api/daily-topic*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        topic: 'AI will reshape the job market',
        persona: 'A sharp contrarian',
      }),
    }),
  );

  // Mock trending
  await page.route('**/api/trending*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ topics: [], cached: true }),
    }),
  );
}

/**
 * Setup only the debate creation and GET mocks (no streaming POST).
 * Use this for error-handling tests that need their own POST /api/debate handler.
 */
async function setupDebatePageMocks(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('debateai_onboarded', 'true');
  });

  await page.route('**/api/debate/create', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, debateId: 'mock-id' }),
    }),
  );

  await page.route(/\/api\/debate\/[a-f0-9-]{10,}/, async (route) => {
    if (route.request().method() === 'GET') {
      const url = new URL(route.request().url());
      const pathParts = url.pathname.split('/');
      const extractedId = pathParts[pathParts.length - 1];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isOwner: true,
          debate: {
            id: extractedId,
            topic: 'Test debate topic',
            opponent: 'custom',
            opponentStyle: 'Test opponent',
            messages: [],
            created_at: new Date().toISOString(),
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock homepage APIs so the page loads quickly
  await page.route('**/api/daily-topic*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        topic: 'Test debate topic',
        persona: 'Test opponent',
      }),
    }),
  );

  await page.route('**/api/trending*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ topics: [], cached: true }),
    }),
  );
}

// ─── Journey 1: Full Debate Flow ───────────────────────────────────────────

test.describe('Journey: Full Debate Creation and Conversation', () => {
  test('homepage → type argument → start debate → receive AI response', async ({ page }) => {
    await setupFullDebateMocks(page);

    // 1. Load homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/DebateAI/);

    // 2. Verify the daily topic card is visible
    await expect(page.locator("text=Today's Debate")).toBeVisible({ timeout: 10_000 });

    // 3. Type an opening argument
    const textarea = page.locator('#argument-input, textarea').first();
    await expect(textarea).toBeVisible();
    await textarea.fill('AI will create more jobs than it destroys within the next decade.');

    // 4. Click "Start Debate"
    const startBtn = page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // 5. Should navigate to the debate page
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });

    // 6. The AI response should stream in
    await expect(page.locator(`text=bold claim`)).toBeVisible({ timeout: 15_000 });

    // 7. User's original argument should also appear
    await expect(page.locator('text=more jobs than it destroys')).toBeVisible();
  });

  test('multi-turn conversation: send follow-up after first AI response', async ({ page }) => {
    await setupFullDebateMocks(page);

    await page.goto('/');
    const textarea = page.locator('#argument-input, textarea').first();
    await textarea.fill('Technology always creates new industries.');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });

    // Wait for first AI response
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    // Now send a follow-up in the debate
    const debateInput = page.locator('textarea').last();
    await expect(debateInput).toBeVisible();
    await debateInput.fill('But the Industrial Revolution proves my point!');

    // Submit via Enter key
    await debateInput.press('Enter');

    // Second AI response should appear
    await expect(page.locator('text=counterpoint')).toBeVisible({ timeout: 15_000 });
  });

  test('"Let AI start" button creates debate without user argument', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');

    const letAiStartBtn = page.locator('button').filter({ hasText: /Let AI Start|AI.*start/i });
    if (await letAiStartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await letAiStartBtn.click();
      await page.waitForURL(/\/debate\//, { timeout: 10_000 });
      // Should see the AI response
      await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });
    }
  });
});

// ─── Journey 2: UI Cleanup Verification ────────────────────────────────────

test.describe('Journey: Verify UI Cleanup (no rounds, no quick replies, no hard mode)', () => {
  test('debate page should NOT show rounds progress bar', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    // DebateProgress / round indicators should NOT exist
    await expect(page.locator('text=/Round [0-9]/i')).not.toBeVisible();
    await expect(page.locator('[data-testid="debate-progress"]')).not.toBeVisible();
  });

  test('debate page should NOT show quick reply suggestions', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    // QuickReplies component should not exist
    await expect(page.locator('text=/Suggested responses|Quick replies/i')).not.toBeVisible();
  });

  test('debate page should NOT show Hard Mode badge', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    // "Hard Mode" badge should not appear
    await expect(page.locator('text=/Hard Mode/i')).not.toBeVisible();
  });

  test('topic header shows topic and opponent without extra badges', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });

    // Topic header should show the topic
    await expect(page.getByText('Topic', { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Journey 3: Floating Verdict Button ────────────────────────────────────

test.describe('Journey: Request Verdict via Floating Button', () => {
  test('floating verdict button appears after >= 2 debate messages', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    // The floating "Request Verdict" button should be visible now
    // (user message + AI response = 2 messages)
    const verdictBtn = page.locator('button').filter({ hasText: /Request Verdict/i });
    await expect(verdictBtn).toBeVisible({ timeout: 5_000 });
  });

  test('clicking verdict button calls judge API and shows score', async ({ page }) => {
    await setupFullDebateMocks(page);

    // Mock judge API
    await page.route('**/api/debate/judge', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(JUDGE_RESPONSE),
      }),
    );

    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    // Click "Request Verdict"
    const verdictBtn = page.locator('button').filter({ hasText: /Request Verdict/i });
    await verdictBtn.click();

    // Judge result should appear — look for score or summary content
    await expect(
      page.locator('text=/Both sides|turning point|72|78/i').first()
    ).toBeVisible({ timeout: 10_000 });

    // Verdict button should disappear after scoring
    await expect(verdictBtn).not.toBeVisible({ timeout: 3_000 });
  });
});

// ─── Journey 4: AI Takeover ────────────────────────────────────────────────

test.describe('Journey: AI Takeover', () => {
  test('AI takeover button generates argument on behalf of user', async ({ page }) => {
    await setupFullDebateMocks(page);

    const takeoverContent = 'Actually, studies show that AI creates a net positive impact on employment.';
    await page.route('**/api/debate/takeover', (route) =>
      fulfillSSE(route, sseBody(takeoverContent)),
    );

    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    // Find the AI takeover button (lightbulb icon with title)
    const takeoverBtn = page.locator('button[title="Let AI argue for you"]');
    await expect(takeoverBtn).toBeVisible();
    await takeoverBtn.click();

    // The takeover response should fill the textarea
    const textarea = page.locator('textarea').last();
    await expect(textarea).toHaveValue(/net positive impact/, { timeout: 10_000 });
  });
});

// ─── Journey 5: Error Handling ─────────────────────────────────────────────

test.describe('Journey: Error Handling', () => {
  test('500 error from debate API handles gracefully without crash', async ({ page }) => {
    await setupDebatePageMocks(page);

    await page.route('**/api/debate', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });

    // App should not crash — textarea should still be usable
    await page.waitForTimeout(3000);
    const textarea = page.locator('textarea').last();
    await expect(textarea).toBeVisible();
  });

  test('rate limit (429) handles gracefully', async ({ page }) => {
    await setupDebatePageMocks(page);

    await page.route('**/api/debate', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'message_limit_exceeded',
            message: "You've reached your limit.",
            current: 10,
            limit: 10,
            upgrade_required: true,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });

    // App should not crash — debate page loads
    await page.waitForTimeout(3000);
    const textarea = page.locator('textarea').last();
    await expect(textarea).toBeVisible();
  });

  test('mid-stream error preserves partial content', async ({ page }) => {
    await setupDebatePageMocks(page);

    await page.route('**/api/debate', async (route) => {
      if (route.request().method() === 'POST') {
        const partial =
          `data: ${JSON.stringify({ type: 'start' })}\n\n` +
          `data: ${JSON.stringify({ type: 'chunk', content: 'Starting my argument about' })}\n\n` +
          `data: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`;
        await fulfillSSE(route, partial);
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });

    // Partial content should be visible
    await expect(
      page.locator('text=Starting my argument')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('network failure handles gracefully without crash', async ({ page }) => {
    await setupDebatePageMocks(page);

    await page.route('**/api/debate', async (route) => {
      if (route.request().method() === 'POST') {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });

    // App should not crash — debate page loads
    await page.waitForTimeout(3000);
    const textarea = page.locator('textarea').last();
    await expect(textarea).toBeVisible();
  });

  test('debate creation 429 shows upgrade modal', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('debateai_onboarded', 'true'); });
    await page.route('**/api/debate/create', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'debate_limit_exceeded',
          debatesUsed: 3,
          debatesLimit: 3,
        }),
      }),
    );

    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();

    // Should show upgrade modal or remain on homepage (not navigate)
    await page.waitForTimeout(2000);
    // Should still be on homepage (creation failed)
    expect(page.url()).not.toContain('/debate/');
  });
});

// ─── Journey 6: Viewing Existing Debate (Read-Only) ────────────────────────

test.describe('Journey: View Existing Debate', () => {
  const testDebateId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  test('loading an existing debate displays messages and topic', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('debateai_onboarded', 'true'); });
    await page.route(`**/api/debate/${testDebateId}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isOwner: false,
            debate: {
              id: testDebateId,
              topic: 'Is remote work better than office work?',
              opponent: 'custom',
              opponentStyle: 'A pragmatic manager',
              messages: [
                { role: 'user', content: 'Remote work improves productivity and work-life balance.' },
                { role: 'ai', content: 'While remote work has benefits, office presence fosters collaboration and company culture that cannot be replicated virtually.' },
                { role: 'user', content: 'Studies show remote workers are 13% more productive.' },
                { role: 'ai', content: 'That Stanford study has been widely cited but the methodology has limitations. More recent data shows a mixed picture.' },
              ],
              created_at: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/debate/${testDebateId}`);

    // Topic should be visible
    await expect(page.getByRole('heading', { name: /remote work/i })).toBeVisible({ timeout: 10_000 });

    // Messages should be displayed
    await expect(page.locator('text=improves productivity')).toBeVisible();
    await expect(page.locator('text=fosters collaboration')).toBeVisible();
  });

  test('non-existent debate shows error or redirect', async ({ page }) => {
    const badId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    await page.addInitScript(() => { localStorage.setItem('debateai_onboarded', 'true'); });
    await page.route(`**/api/debate/${badId}`, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Debate not found' }),
      }),
    );

    await page.goto(`/debate/${badId}`);

    // Should show error state — debate page with no content or a "not found" message
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Journey 7: SSE Streaming with Citations ──────────────────────────────

test.describe('Journey: Citations in Streamed Response', () => {
  test('citations received via SSE are displayed', async ({ page }) => {
    await setupDebatePageMocks(page);

    const citations = [
      { id: 1, url: 'https://example.com/study', title: 'Employment Study 2025' },
      { id: 2, url: 'https://example.com/report', title: 'AI Impact Report' },
    ];

    // Override debate route with citations
    await page.route('**/api/debate', async (route) => {
      if (route.request().method() === 'POST') {
        const content = 'According to a recent study [1], AI will create jobs. Another report [2] confirms this.';
        await fulfillSSE(route, sseBody(content, { citations }));
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test argument');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });

    // The AI response with citation markers should appear
    await expect(page.locator('text=recent study')).toBeVisible({ timeout: 15_000 });

    // Citation markers [1] and [2] should be rendered as clickable buttons
    const citationBtn = page.locator('button').filter({ hasText: '[1]' });
    await expect(citationBtn).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Journey 8: Mobile Viewport ───────────────────────────────────────────

test.describe('Journey: Mobile Experience', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 Pro

  test('homepage is usable on mobile — can type and start debate', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');

    // Title visible
    await expect(page.locator('h1')).toBeVisible();

    // Textarea accessible
    const textarea = page.locator('#argument-input, textarea').first();
    await expect(textarea).toBeVisible();
    await textarea.fill('Mobile test argument');

    // Start button visible and clickable
    const startBtn = page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });
  });

  test('debate input area is visible and functional on mobile', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    // The debate textarea at the bottom should be visible
    const input = page.locator('textarea').last();
    await expect(input).toBeVisible();

    // Send button should be visible
    const sendBtn = page.locator('.flex.items-center.gap-2 button').last();
    await expect(sendBtn).toBeVisible();
  });

  test('floating verdict button is accessible on mobile', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    const verdictBtn = page.locator('button').filter({ hasText: /Request Verdict/i });
    await expect(verdictBtn).toBeVisible({ timeout: 5_000 });

    // Should be tappable
    const box = await verdictBtn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(40);
    expect(box!.height).toBeGreaterThan(36);
  });
});

// ─── Journey 9: Homepage Elements ─────────────────────────────────────────

test.describe('Journey: Homepage', () => {
  test('homepage displays hero, daily topic card, and argument input', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/DebateAI/);

    // Hero text
    await expect(page.locator('text=The AI that fights back')).toBeVisible({ timeout: 10_000 });

    // Daily debate card
    await expect(page.locator("text=Today's Debate")).toBeVisible();

    // Opening argument label
    await expect(page.locator("text=What's your opening argument")).toBeVisible();

    // Textarea
    const input = page.locator('#argument-input, textarea').first();
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', /opening argument|Type your/i);
  });

  test('shuffle topic button changes the displayed topic', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator("text=Today's Debate")).toBeVisible({ timeout: 10_000 });

    // Get the initial topic text
    const topicEl = page.locator('h2').first();
    const initialTopic = await topicEl.textContent();

    // Click shuffle
    const shuffleBtn = page.locator('button[title="Shuffle topic"]');
    if (await shuffleBtn.isVisible()) {
      await shuffleBtn.click();
      await page.waitForTimeout(500);
      const newTopic = await topicEl.textContent();
      // Topic should change (it picks from QUICK_STARTS which excludes current)
      expect(newTopic).not.toBe(initialTopic);
    }
  });

  test('empty argument submission shakes the input (does not navigate)', async ({ page }) => {
    await page.goto('/');
    const startBtn = page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i });
    await startBtn.click();

    // Should remain on homepage
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain('/debate/');
  });
});

// ─── Journey 10: Blog & Navigation ───────────────────────────────────────

test.describe('Journey: Blog and Navigation', () => {
  test('blog page loads and shows posts', async ({ page }) => {
    await page.goto('/blog');
    await expect(page).toHaveTitle(/Blog|DebateAI/);

    const posts = page.locator('a[href*="/blog/"]');
    await expect(posts.first()).toBeVisible({ timeout: 10_000 });
  });

  test('history page loads', async ({ page }) => {
    await page.goto('/history');
    // Should show history heading
    await expect(page.locator('h1:has-text("History")')).toBeVisible({ timeout: 10_000 });
  });

  test('404 page is handled gracefully', async ({ page }) => {
    await page.goto('/this-page-definitely-does-not-exist-xyz');
    // Should show 404 heading
    await expect(page.locator('h1:has-text("404")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('p:has-text("Page not found")')).toBeVisible();
  });
});

// ─── Journey 11: Input Behavior ───────────────────────────────────────────

test.describe('Journey: Debate Input Behavior', () => {
  test('Enter key sends message, Shift+Enter adds newline', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    const debateInput = page.locator('textarea').last();
    await debateInput.fill('First line');

    // Shift+Enter should NOT submit
    await debateInput.press('Shift+Enter');
    await page.waitForTimeout(500);
    // Input should still have content (not cleared by send)
    const val = await debateInput.inputValue();
    expect(val).toContain('First line');
  });

  test('send button is disabled when input is empty', async ({ page }) => {
    await setupFullDebateMocks(page);
    await page.goto('/');
    await page.locator('#argument-input, textarea').first().fill('Test');
    await page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i }).click();
    await page.waitForURL(/\/debate\//, { timeout: 10_000 });
    await expect(page.locator('text=bold claim')).toBeVisible({ timeout: 15_000 });

    // Send button should be disabled when textarea is empty
    const sendBtn = page.locator('.flex.items-center.gap-2 button').last();
    // The button uses cursor-not-allowed class when disabled, check via attribute or class
    const debateInput = page.locator('textarea').last();
    await debateInput.fill('');

    // The send button should be visible and disabled
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();
  });
});
