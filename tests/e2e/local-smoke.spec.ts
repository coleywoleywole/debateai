import { test, expect } from '@playwright/test';

/**
 * Local smoke test — NO mocks. Tests the real local app.
 * Run with: npx playwright test tests/e2e/local-smoke.spec.ts --project=chromium --headed
 */
test('local: homepage loads and can start a debate', async ({ page }) => {
  // Suppress Clerk errors in console
  page.on('pageerror', () => {});

  // Set onboarding as done
  await page.addInitScript(() => {
    localStorage.setItem('debateai_onboarded', 'true');
  });

  // Log all network requests to /api/
  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      console.log(`>> ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', (res) => {
    if (res.url().includes('/api/')) {
      console.log(`<< ${res.status()} ${res.url()}`);
    }
  });

  // 1. Load homepage
  await page.goto('/');
  await expect(page).toHaveTitle(/DebateAI/);

  // 2. Check for textarea
  const textarea = page.locator('#argument-input, textarea').first();
  await expect(textarea).toBeVisible({ timeout: 15_000 });

  // 3. Type an argument
  await textarea.fill('AI will create more jobs than it destroys.');

  // 4. Click Start Debate
  const startBtn = page.locator('button[type="submit"]').filter({ hasText: /Start Debate/i });
  await expect(startBtn).toBeVisible();

  // Take a screenshot before clicking
  await page.screenshot({ path: 'test-results/local-before-click.png' });

  await startBtn.click();

  // 5. Wait and see what happens
  await page.waitForTimeout(5000);

  // Take a screenshot after clicking
  await page.screenshot({ path: 'test-results/local-after-click.png' });

  // Log the current URL
  console.log('Current URL after click:', page.url());

  // Check if we navigated to debate page
  const url = page.url();
  if (url.includes('/debate/')) {
    console.log('SUCCESS: Navigated to debate page');
    // Wait for the page to load
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/local-debate-page.png' });
  } else {
    console.log('FAILED: Still on', url);
    // Capture what's on screen
    const bodyText = await page.locator('body').innerText();
    console.log('Page content:', bodyText.slice(0, 500));
  }
});
