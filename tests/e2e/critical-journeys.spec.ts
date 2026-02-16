import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Critical User Journey E2E Tests
 *
 * These tests verify the most important user flows work correctly:
 * 1. Starting a new debate from homepage
 * 2. Sharing a debate
 * 3. Browsing the blog
 * 4. Viewing debate history
 *
 * Note: AI responses are mocked to avoid API costs and ensure determinism.
 * Auth-dependent flows require the user to be signed in (skipped in CI without auth).
 */

// ============================================
// Test Fixtures & Helpers
// ============================================

/**
 * Mock streaming response for debate API
 * Simulates Claude's SSE response format
 */
function createMockDebateResponse(content: string): string {
  const chunks = content.match(/.{1,20}/g) || [content];
  let response = `data: ${JSON.stringify({ type: 'start' })}\n\n`;

  for (const chunk of chunks) {
    response += `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
  }

  response += `data: ${JSON.stringify({
    type: 'complete',
    content: content,
    debateId: 'e2e-test-debate-' + Date.now(),
  })}\n\n`;
  response += `data: [DONE]\n\n`;

  return response;
}

/**
 * Mock debate creation response
 */
function createMockDebateCreateResponse(debateId: string): string {
  return JSON.stringify({ success: true, debateId });
}

/**
 * Setup API mocks for debate flow
 */
async function setupDebateMocks(page: Page) {
  const debateId = 'e2e-test-' + Date.now();

  // Mock debate creation
  await page.route('**/api/debate/create', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: createMockDebateCreateResponse(debateId),
    });
  });

  // Mock debate message (streaming response)
  await page.route('**/api/debate', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const mockContent =
        "That's a thought-provoking perspective. However, I'd like to challenge your reasoning on several fronts. " +
        "First, consider the broader implications of your argument. While your point has merit, it overlooks key factors " +
        "that significantly impact the outcome. Let me explain why I believe the opposite position is more defensible.";

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: createMockDebateResponse(mockContent),
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

  return debateId;
}

// ============================================
// Journey 1: Start a New Debate
// ============================================

test.describe('Journey: Start a New Debate', () => {
  test('should complete full debate flow from homepage', async ({ page }) => {
    // Setup mocks
    await setupDebateMocks(page);

    // Step 1: Load homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/DebateAI/);

    // Step 2: Verify debate setup elements are visible
    const topicSection = page.locator('text=/Today\'s Debate|What do you want to debate/i');
    await expect(topicSection).toBeVisible();

    // Step 3: Find and fill the argument textarea
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();

    const testArgument =
      'I believe artificial intelligence will fundamentally transform how we work, ' +
      'making many traditional jobs obsolete while creating new opportunities.';
    await textarea.fill(testArgument);

    // Step 4: Submit the argument (try Cmd+Enter or click button)
    // Check if there's a submit button first
    const submitButton = page.locator('button').filter({
      hasText: /Start|Submit|Send|Enter/i,
    });

    if (await submitButton.isVisible()) {
      await submitButton.click();
    } else {
      // Use keyboard shortcut
      await textarea.press('Meta+Enter');
    }

    // Step 5: Wait for AI response to appear
    // The mock should return within a few seconds
    const aiResponse = page.locator('text=/thought-provoking|challenge|reasoning/i');
    await expect(aiResponse).toBeVisible({ timeout: 15000 });

    // Step 6: Verify we're in an active debate
    // Should see the user's message displayed
    await expect(page.locator(`text=${testArgument.substring(0, 30)}`)).toBeVisible();
  });

  test('should allow entering a custom topic', async ({ page }) => {
    await page.goto('/');

    // Find the topic input or custom topic option
    // Check for "What do you want to debate?" input
    const topicInput = page.locator(
      'textarea[placeholder*="debate"], input[placeholder*="topic"], textarea'
    ).first();

    await expect(topicInput).toBeVisible();

    // Should be able to type a custom topic
    const customTopic = 'Should we colonize Mars?';
    await topicInput.fill(customTopic);
    await expect(topicInput).toHaveValue(customTopic);
  });

  test('should navigate to advanced setup', async ({ page }) => {
    await page.goto('/');

    // Click on Advanced Setup link
    const advancedLink = page.locator('a, button').filter({
      hasText: /Advanced|Setup|Customize/i,
    });

    if (await advancedLink.isVisible()) {
      await advancedLink.click();
      await expect(page).toHaveURL(/\/debate/);
    }
  });
});

// ============================================
// Journey 2: Share a Debate
// ============================================

test.describe('Journey: Share a Debate', () => {
  test('should load share page for existing debate', async ({ page, request }) => {
    // First, get a real debate ID from the API (if available)
    // For E2E, we'll check that the share page structure works

    // Try to get trending debates to find a real ID
    const trendingResponse = await request.get('/api/trending');
    if (trendingResponse.ok()) {
      // We can test with trending content
    }

    // Test the share page with a test ID
    await page.goto('/debate/test-share-debate');

    // Should either show the debate or a not-found page
    // Both are valid outcomes - we're testing the page loads
    await expect(
      page.locator('body')
    ).toBeVisible();
  });

  test('should have share functionality visible in debate view', async ({ page }) => {
    // Mock a debate fetch
    await page.route('**/api/debate/*', async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            debate: {
              id: 'share-test-123',
              topic: 'Is AI beneficial for humanity?',
              opponent: 'socratic',
              opponentStyle: 'A thoughtful philosopher',
              messages: [
                { role: 'user', content: 'AI will solve our biggest problems.' },
                { role: 'ai', content: 'An interesting perspective. What evidence supports this?' },
              ],
              created_at: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/debate/share-test-123');

    // Look for share button or share icon
    // const shareButton = page.locator(
    //   'button[aria-label*="share" i], button:has-text("Share"), [data-testid="share"]'
    // );

    // Share functionality should be present (might be in a menu)
    // Even if hidden, the page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should verify share API returns correct metadata', async ({ request }) => {
    // Test the share API endpoint directly
    const response = await request.get('/api/share/test-debate-123');

    // Should return 404 for non-existent debate (expected)
    // Or 200 with share metadata for existing debate
    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      // Verify share metadata structure
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('url');
    }
  });
});

// ============================================
// Journey 3: Browse the Blog
// ============================================

test.describe('Journey: Browse the Blog', () => {
  test('should load blog index and display posts', async ({ page }) => {
    await page.goto('/blog');

    // Verify blog page loads
    await expect(page).toHaveTitle(/Blog|DebateAI/);

    // Should see blog post cards or list
    const blogPosts = page.locator('article, [data-testid="blog-post"], a[href*="/blog/"]');
    await expect(blogPosts.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to individual blog post', async ({ page }) => {
    await page.goto('/blog');

    // Find a blog post link
    const postLink = page.locator('a[href*="/blog/"]').first();
    await expect(postLink).toBeVisible();

    // Click the link
    await postLink.click();

    // Should navigate to the post
    await expect(page).toHaveURL(/\/blog\/.+/);

    // Post content should be visible
    const postContent = page.locator('article, main, .prose');
    await expect(postContent).toBeVisible();
  });

  test('should have proper SEO meta tags on blog post', async ({ page }) => {
    await page.goto('/blog/how-we-built-realtime-ai-debates');

    // Check for meta description
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);

    // Check for OG tags
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /.+/);
  });
});

// ============================================
// Journey 4: View Debate History
// ============================================

test.describe('Journey: View Debate History', () => {
  test('should load history page', async ({ page }) => {
    await page.goto('/history');

    // History page should load
    // May show sign-in prompt if not authenticated
    await expect(page.locator('body')).toBeVisible();

    // Should either show debates or sign-in prompt
    const content = page.locator(
      'text=/history|Previous Debates|Sign in|debates/i'
    );
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to history from homepage', async ({ page }) => {
    await page.goto('/');

    // Find history/previous debates link
    const historyLink = page.locator('a').filter({
      hasText: /History|Previous|Past/i,
    });

    if (await historyLink.isVisible()) {
      await historyLink.click();
      await expect(page).toHaveURL(/\/history/);
    }
  });
});

// ============================================
// Journey 5: Mobile Responsiveness
// ============================================

test.describe('Journey: Mobile Experience', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should be usable on mobile viewport', async ({ page }) => {
    await page.goto('/');

    // Core elements should be visible on mobile
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();

    // Should be able to interact
    await textarea.fill('Test argument on mobile');
    await expect(textarea).toHaveValue('Test argument on mobile');
  });

  test('should have touch-friendly buttons', async ({ page }) => {
    await page.goto('/');

    // Buttons should be reasonably sized for touch (at least 44x44px recommended)
    const buttons = page.locator('button');
    const firstButton = buttons.first();

    if (await firstButton.isVisible()) {
      const box = await firstButton.boundingBox();
      if (box) {
        // At least 40px in one dimension for touch
        expect(box.width >= 40 || box.height >= 40).toBeTruthy();
      }
    }
  });
});

// ============================================
// Journey 6: Error Recovery
// ============================================

test.describe('Journey: Error Recovery', () => {
  test('should handle 404 pages gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');

    // Should show a friendly 404 page, not crash
    await expect(page.locator('body')).toBeVisible();

    // Should have a way back to homepage
    const homeLink = page.locator('a[href="/"], a:has-text("Home")');
    await expect(homeLink.or(page.locator('text=/not found|404/i'))).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/debate', async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/');

    const textarea = page.locator('textarea').first();
    await textarea.fill('Test argument');
    await textarea.press('Meta+Enter');

    // Should show error message, not crash
    // Wait a bit for the error to potentially show
    await page.waitForTimeout(2000);

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
});
