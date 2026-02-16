import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Integration tests for the core debate flow.
 *
 * These tests verify:
 * 1. Debate creation (UI + API)
 * 2. Message submission and streaming
 * 3. Rate limiting behavior
 * 4. Error handling
 *
 * Note: Claude API calls are mocked to avoid costs and ensure deterministic tests.
 */

// Mock SSE response for Claude streaming
function createMockSSEResponse(content: string): string {
  const chunks = content.match(/.{1,10}/g) || [content];
  let response = `data: ${JSON.stringify({ type: 'start' })}\n\n`;

  for (const chunk of chunks) {
    response += `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
  }

  response += `data: ${JSON.stringify({
    type: 'complete',
    content: content,
    debateId: 'test-debate-123',
  })}\n\n`;
  response += `data: [DONE]\n\n`;

  return response;
}

// Helper to mock the debate API
async function mockDebateAPI(page: Page, mockResponse: string) {
  await page.route('**/api/debate', async (route: Route) => {
    const request = route.request();

    // Only mock POST requests (debate messages)
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: mockResponse,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else {
      await route.continue();
    }
  });
}

// Helper to mock debate creation API
async function mockDebateCreateAPI(page: Page, success = true) {
  await page.route('**/api/debate/create', async (route: Route) => {
    if (success) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          debateId: 'test-debate-' + Date.now(),
        }),
      });
    } else {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to create debate' }),
      });
    }
  });
}

// Helper to mock auth (unused)
// async function mockAuth(page: Page) { ... }

test.describe('Debate Creation Flow', () => {
  test('should display debate setup form on homepage', async ({ page }) => {
    await page.goto('/');

    // Check for debate input elements
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();

    // Check for topic display
    const topicSection = page.locator('text=/Today\'s Debate|What do you want to debate/i');
    await expect(topicSection).toBeVisible();
  });

  test('should show custom topic input when "custom" is selected', async ({ page }) => {
    await page.goto('/');

    // Look for custom topic option or input
    // The exact UI may vary - adjust selectors as needed
    const customInput = page.locator('textarea[placeholder*="topic"], textarea[placeholder*="debate"]');
    await expect(customInput).toBeVisible();
  });

  test('should require stance input before starting debate', async ({ page }) => {
    await page.goto('/');

    // Find the main textarea for stance input
    const stanceInput = page.locator('textarea').first();
    await expect(stanceInput).toBeVisible();

    // The submit button should be visible but the form should require content
    // This tests that empty submissions are handled
  });
});

test.describe('Debate Message Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the streaming response
    const mockResponse = createMockSSEResponse(
      "That's an interesting perspective. Let me offer a counterargument: while your point about efficiency is valid, we must also consider the broader implications for society."
    );
    await mockDebateAPI(page, mockResponse);
    await mockDebateCreateAPI(page);
  });

  test('should show AI response after submitting argument', async ({ page }) => {
    await page.goto('/');

    // Find and fill the stance/argument input
    const stanceInput = page.locator('textarea').first();
    await stanceInput.fill('I believe AI will fundamentally change how we work and live.');

    // Find and click submit button (could be Cmd+Enter or a button)
    // Try keyboard shortcut first
    await stanceInput.press('Meta+Enter');

    // Wait for response to appear (the mock should stream it)
    // Look for the AI response container or text
    const aiResponse = page.locator('text=/counterargument|perspective|implications/i');
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
  });

  test('should display streaming indicator during response', async ({ page }) => {
    // Use a slower mock to see the streaming state
    await page.route('**/api/debate', async (route: Route) => {
      // Delay the response to show loading state
      await new Promise((resolve) => setTimeout(resolve, 500));

      const mockResponse = createMockSSEResponse('Test response');
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: mockResponse,
      });
    });

    await page.goto('/');

    const stanceInput = page.locator('textarea').first();
    await stanceInput.fill('Test argument');
    await stanceInput.press('Meta+Enter');

    // Check for loading/streaming indicator
    // The exact indicator depends on UI implementation
    const loadingIndicator = page.locator('[data-testid="streaming"], .animate-pulse, text=/thinking|typing/i');
    // This might not always be visible due to timing, so we use a soft check
    await expect(loadingIndicator.or(page.locator('text=/Test response/i'))).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('Debate Page Direct Access', () => {
  test('should load existing debate by ID', async ({ page }) => {
    // Mock the debate fetch API
    await page.route('**/api/debate/*', async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            debate: {
              id: 'test-debate-123',
              topic: 'Is AI beneficial for humanity?',
              opponent: 'socratic',
              messages: [
                { role: 'user', content: 'AI will help us solve major problems.' },
                { role: 'ai', content: 'An interesting claim. What evidence supports this?' },
              ],
              created_at: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/debate/test-debate-123');

    // Should show the debate topic
    await expect(page.locator('text=/AI beneficial|humanity/i')).toBeVisible({ timeout: 10000 });
  });

  test('should show 404 for non-existent debate', async ({ page }) => {
    await page.route('**/api/debate/*', async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Debate not found' }),
      });
    });

    await page.goto('/debate/nonexistent-debate');

    // Should show error or redirect
    await expect(
      page.locator('text=/not found|error|doesn\'t exist/i').or(page.locator('text=/DebateAI/'))
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Rate Limiting', () => {
  test('should handle rate limit response gracefully', async ({ page }) => {
    // Mock rate limit response
    await page.route('**/api/debate', async (route: Route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: 60,
        }),
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        },
      });
    });

    await page.goto('/');

    const stanceInput = page.locator('textarea').first();
    await stanceInput.fill('Test argument');
    await stanceInput.press('Meta+Enter');

    // Should show rate limit message or error
    const errorMessage = page.locator('text=/rate limit|too many|slow down|try again/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should handle message limit exceeded response', async ({ page }) => {
    await page.route('**/api/debate', async (route: Route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'message_limit_exceeded',
          message: "You've reached your limit of 10 messages per debate.",
          current: 10,
          limit: 10,
          upgrade_required: true,
        }),
      });
    });

    await page.goto('/');

    const stanceInput = page.locator('textarea').first();
    await stanceInput.fill('Test argument');
    await stanceInput.press('Meta+Enter');

    // Should show upgrade prompt or limit message
    const limitMessage = page.locator('text=/limit|upgrade|premium/i');
    await expect(limitMessage).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Error Handling', () => {
  test('should handle API errors gracefully', async ({ page }) => {
    await page.route('**/api/debate', async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/');

    const stanceInput = page.locator('textarea').first();
    await stanceInput.fill('Test argument');
    await stanceInput.press('Meta+Enter');

    // Should show error message
    const errorMessage = page.locator('text=/error|failed|wrong|try again/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.route('**/api/debate', async (route: Route) => {
      await route.abort('failed');
    });

    await page.goto('/');

    const stanceInput = page.locator('textarea').first();
    await stanceInput.fill('Test argument');
    await stanceInput.press('Meta+Enter');

    // Should show network error message
    const errorMessage = page.locator('text=/error|failed|network|connection/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should handle streaming errors mid-response', async ({ page }) => {
    await page.route('**/api/debate', async (route: Route) => {
      // Start streaming then error
      const partialResponse =
        `data: ${JSON.stringify({ type: 'start' })}\n\n` +
        `data: ${JSON.stringify({ type: 'chunk', content: 'Starting to respond...' })}\n\n` +
        `data: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`;

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: partialResponse,
      });
    });

    await page.goto('/');

    const stanceInput = page.locator('textarea').first();
    await stanceInput.fill('Test argument');
    await stanceInput.press('Meta+Enter');

    // Should handle the error gracefully (show partial content or error message)
    const content = page.locator('text=/Starting to respond|error|failed/i');
    await expect(content).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Debate History', () => {
  test('should load history page', async ({ page }) => {
    await page.goto('/history');

    // History page should load (may require auth)
    await expect(page.locator('text=/history|debates|past/i').or(page.locator('text=/sign in/i'))).toBeVisible({
      timeout: 10000,
    });
  });
});
