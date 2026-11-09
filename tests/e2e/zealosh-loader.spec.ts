// Zealosh LMS — Playwright Real-Browser End-to-End Test Suite
// Task: ZM-IMPL-03E — Official Branded Loader, Route Loading & Visual Quality Verification

import { test, expect } from '@playwright/test';
import { injectAuthCookie, studentToken } from './helpers/cms-fixtures';

test.describe('ZealoshLoader — Official Branded Loading Experience (QA-LDR-01 to QA-LDR-06)', () => {
  // --------------------------------------------------------------------------
  // QA-LDR-01: Emblem, Wordmark, and First Static Fallback Fact on Initial Load
  // --------------------------------------------------------------------------
  test('QA-LDR-01: should render official emblem, wordmark, and BCRSP static fact in real browser', async ({
    page,
    context,
  }) => {
    await injectAuthCookie(context, studentToken);

    // Delay the classroom API response by 1.5 seconds so we can inspect the loader in real Chrome
    await page.route('**/api/classroom**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');

    // 1. Loader container with role="status" and aria-live="polite"
    const loader = page.locator('[role="status"]');
    await expect(loader).toBeVisible({ timeout: 5000 });
    await expect(loader).toHaveAttribute('aria-live', 'polite');

    // 2. Official shield emblem SVG
    const emblem = page.locator('svg[aria-label="Zealosh official shield emblem"]');
    await expect(emblem).toBeVisible();

    // 3. Official wordmark SVG
    const wordmark = page.locator('svg[aria-label="Zealosh"]');
    await expect(wordmark).toBeVisible();

    // 4. First static fallback fact category and text
    const categoryBadge = page.locator('text=BCRSP® Listed Course Provider');
    await expect(categoryBadge).toBeVisible();

    const factText = page.locator(
      'text=Zealosh is an officially recognized preparatory course provider for the Canadian Registered Safety Professional (CRSP®) certification.'
    );
    await expect(factText).toBeVisible();

    // 5. Checkmark animation classes exist
    const tickAnim = page.locator('.zealosh-tick-anim').first();
    await expect(tickAnim).toBeVisible();

    // 6. After API resolves, transitions to main stream
    await expect(page.locator('text=Stream').first()).toBeVisible({ timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // QA-LDR-02: Responsive Sizing on Mobile Viewport (375x667)
  // --------------------------------------------------------------------------
  test('QA-LDR-02: should render loader responsively without horizontal overflow on mobile viewport', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await injectAuthCookie(context, studentToken);

    await page.route('**/api/classroom**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');

    const loader = page.locator('[role="status"]');
    await expect(loader).toBeVisible({ timeout: 5000 });

    // Verify zero horizontal scroll overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Verify emblem and wordmark fit inside viewport
    const emblemBox = await page.locator('svg[aria-label="Zealosh official shield emblem"]').boundingBox();
    expect(emblemBox).not.toBeNull();
    expect(emblemBox!.width).toBeLessThanOrEqual(375);

    const wordmarkBox = await page.locator('svg[aria-label="Zealosh"]').boundingBox();
    expect(wordmarkBox).not.toBeNull();
    expect(wordmarkBox!.width).toBeLessThanOrEqual(375);
  });

  // --------------------------------------------------------------------------
  // QA-LDR-03: Responsive Sizing on Tablet Viewport (768x1024)
  // --------------------------------------------------------------------------
  test('QA-LDR-03: should center loader cleanly on tablet viewport without layout distortion', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await injectAuthCookie(context, studentToken);

    await page.route('**/api/classroom**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');

    const loader = page.locator('[role="status"]');
    await expect(loader).toBeVisible({ timeout: 5000 });

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  // --------------------------------------------------------------------------
  // QA-LDR-04: Accessibility & Screen-Reader Verification
  // --------------------------------------------------------------------------
  test('QA-LDR-04: should include screen-reader announcement text and accessible image labels', async ({
    page,
    context,
  }) => {
    await injectAuthCookie(context, studentToken);

    await page.route('**/api/classroom**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');

    const srText = page.locator('.sr-only', { hasText: 'Loading Zealosh platform content...' });
    await expect(srText).toHaveCount(1);

    const emblem = page.locator('svg[aria-label="Zealosh official shield emblem"]');
    await expect(emblem).toHaveAttribute('role', 'img');

    const wordmark = page.locator('svg[aria-label="Zealosh"]');
    await expect(wordmark).toHaveAttribute('role', 'img');
  });

  // --------------------------------------------------------------------------
  // QA-LDR-05: Reduced Motion CSS Rule Verification
  // --------------------------------------------------------------------------
  test('QA-LDR-05: should contain @media (prefers-reduced-motion: reduce) rule in embedded style', async ({
    page,
    context,
  }) => {
    await injectAuthCookie(context, studentToken);

    await page.route('**/api/classroom**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');

    const styleContent = await page.locator('[role="status"] style').innerHTML();
    expect(styleContent).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styleContent).toContain('.zealosh-emblem-breathe');
    expect(styleContent).toContain('.zealosh-tick-anim');
  });

  // --------------------------------------------------------------------------
  // QA-LDR-06: Carousel Indicator Dots & Fact Count
  // --------------------------------------------------------------------------
  test('QA-LDR-06: should render 5 subtle indicator dots corresponding to the static facts', async ({
    page,
    context,
  }) => {
    await injectAuthCookie(context, studentToken);

    await page.route('**/api/classroom**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');

    const dotsContainer = page.locator('[aria-hidden="true"]').filter({ has: page.locator('span.rounded-full') });
    await expect(dotsContainer).toBeVisible();

    const dots = dotsContainer.locator('span.rounded-full');
    await expect(dots).toHaveCount(5);
  });
});
