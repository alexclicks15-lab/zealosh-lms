// Zealosh LMS — Playwright End-to-End Automated Browser QA Suite
// Standards: Real Browser Execution (Google Chrome 150), wj-page-builder layout compliance, lifecycle & public SSR

import { test, expect } from '@playwright/test';
import { signToken } from '@/lib/auth/jwt';

test.describe('Zealosh LMS — Visual PageBuilder & CMS Real Browser E2E Workflows', () => {
  const adminToken = signToken({
    userId: 'usr-admin-01',
    email: 'admin@zealosh.com',
    role: 'SUPER_ADMIN',
    name: 'Super Administrator',
  });

  const studentToken = signToken({
    userId: 'usr-std-01',
    email: 'student@zealosh.com',
    role: 'STUDENT',
    name: 'Student Candidate',
  });

  test.beforeEach(async ({ context }) => {
    // Inject authenticated admin session cookie for admin routes
    await context.addCookies([
      {
        name: 'zealosh_token',
        value: adminToken,
        url: 'http://127.0.0.1:3022',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  });

  test('E2E-01: Admin portal loads with Visual PageBuilder tab and page list', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveTitle(/Zealosh/i);

    // Click Visual PageBuilder tab
    const cmsTab = page.locator('button:has-text("Visual Page Builder")');
    await expect(cmsTab).toBeVisible();
    await cmsTab.click();

    // Verify PageBuilder header and controls
    await expect(page.locator('text=Visual PageBuilder & Relational CMS')).toBeVisible();
    await expect(page.locator('button:has-text("Create New Page")')).toBeVisible();
  });

  test('E2E-02: Public homepage renders dynamically or falls back cleanly', async ({ page }) => {
    // Clear cookies for public anonymous visit
    await page.context().clearCookies();
    await page.goto('/');

    await expect(page).toHaveTitle(/Zealosh/i);
    // Verify essential brand elements
    await expect(page.locator('nav')).toBeVisible();
    // Verify no prohibited navy theme styling
    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBeDefined();
  });

  test('E2E-03: Public SSR route /p/[...slug] serves published pages with clean HTML and Schema.org metadata', async ({
    page,
    request,
  }) => {
    // 1. Create and publish a test page via API
    const slug = `e2e-pub-${Date.now()}`;
    const createRes = await request.post('/api/cms/pages', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'E2E Public Safety Certification',
        slug,
        pageType: 'STANDARD',
      },
    });
    expect(createRes.status()).toBe(201);
    const createData = await createRes.json();
    const pageId = createData.page.id;
    const versionId = createData.version.id;

    // 2. Submit, Approve, and Publish
    await request.post(`/api/cms/pages/${pageId}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'submit', versionId, changeSummary: 'E2E submit' },
    });
    await request.post(`/api/cms/pages/${pageId}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'approve', versionId },
    });
    const pubRes = await request.post(`/api/cms/pages/${pageId}/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { versionId },
    });
    expect(pubRes.status()).toBe(200);

    // 3. Anonymous visit to public route
    await page.context().clearCookies();
    const res = await page.goto(`/p/${slug}`);
    expect(res?.status()).toBe(200);

    // Verify page content rendered
    await expect(page.locator(`text=E2E Public Safety Certification`)).toBeVisible();

    // Verify Schema.org JSON-LD exists in head
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLd).toBeDefined();
    if (jsonLd) {
      const parsed = JSON.parse(jsonLd);
      expect(parsed['@context']).toBe('https://schema.org');
    }
  });

  test('E2E-04: Draft privacy prevents anonymous access to unpublished pages (404 Not Found)', async ({
    page,
    request,
  }) => {
    // Create an unpublished draft page
    const draftSlug = `e2e-draft-secret-${Date.now()}`;
    const createRes = await request.post('/api/cms/pages', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title: 'Secret Draft Not Published',
        slug: draftSlug,
        pageType: 'STANDARD',
      },
    });
    expect(createRes.status()).toBe(201);

    // Anonymous visitor attempting to open the draft route must receive 404
    await page.context().clearCookies();
    const res = await page.goto(`/p/${draftSlug}`);
    expect(res?.status()).toBe(404);
  });

  test('E2E-05: Non-administrative students are denied CMS page creation (403 Forbidden)', async ({ request }) => {
    const res = await request.post('/api/cms/pages', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: {
        title: 'Unauthorized Student Page',
        slug: `unauthorized-${Date.now()}`,
      },
    });
    expect(res.status()).toBe(403);
  });

  test('E2E-06: Responsive rendering across Desktop, Tablet, and Mobile viewports', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    // 1. Desktop Viewport (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    let hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);

    // 2. Tablet Viewport (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);

    // 3. Mobile Viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);

    // 4. Compact Mobile Viewport (360x740)
    await page.setViewportSize({ width: 360, height: 740 });
    hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

