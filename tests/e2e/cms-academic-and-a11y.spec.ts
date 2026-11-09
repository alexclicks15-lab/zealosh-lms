// Zealosh LMS — Playwright E2E: Academic Data Bindings, SEO Metadata, Fallbacks & Accessibility
// Standards: Authoritative course resolution, Schema.org JSON-LD, WCAG 2.1 AA ARIA semantics, Draft Privacy Guard

import { test, expect } from '@playwright/test';
import {
  adminToken,
  reviewerToken,
  studentToken,
  injectAuthCookie,
  createTestPage,
  deleteTestPage,
} from './helpers/cms-fixtures';

test.describe('Zealosh Visual PageBuilder — Academic Bindings, SEO & Accessibility Suite', () => {
  let testPageIds: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const pageId of testPageIds) {
      await deleteTestPage(request, pageId);
    }
    testPageIds = [];
  });

  test('AC-01: Course Landing Page resolves authoritative PostgreSQL course data', async ({
    page,
    request,
  }) => {
    const courseSlug = 'csp-examination-masterclass';

    // Cleanup lingering page if present
    const listRes = await request.get('/api/cms/pages', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (listRes.ok()) {
      const data = await listRes.json();
      const existing = (data.pages || []).find((p: any) => p.slug === courseSlug);
      if (existing) await deleteTestPage(request, existing.id);
    }

    const created = await createTestPage(request, {
      title: 'CSP Masterclass Dynamic Landing',
      slug: courseSlug,
      pageType: 'COURSE_LANDING',
    });
    testPageIds.push(created.page.id);

    // Submit for peer review
    const subRes = await request.post(`/api/cms/pages/${created.page.id}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'submit', versionId: created.version.id, changeSummary: 'Ready to publish' },
    });
    expect(subRes.status()).toBe(200);

    // Independent reviewer approves
    const appRes = await request.post(`/api/cms/pages/${created.page.id}/workflow`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { action: 'approve', versionId: created.version.id },
    });
    expect(appRes.status()).toBe(200);

    // Publish
    const pubRes = await request.post(`/api/cms/pages/${created.page.id}/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { versionId: created.version.id },
    });
    expect(pubRes.status()).toBe(200);

    // Visit public route /p/csp-examination-masterclass
    await page.goto(`/p/${courseSlug}`);
    await expect(page).toHaveURL(new RegExp(`/p/${courseSlug}`));

    // Verify course content rendered
    await expect(page.locator('text=CSP Masterclass Dynamic Landing')).toBeVisible();
  });

  test('AC-02: Public SEO Metadata & Schema.org JSON-LD (Breadcrumbs & Course)', async ({
    page,
    request,
  }) => {
    const courseSlug = 'crsp-examination-fast-track';

    // Cleanup lingering page if present
    const listRes = await request.get('/api/cms/pages', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (listRes.ok()) {
      const data = await listRes.json();
      const existing = (data.pages || []).find((p: any) => p.slug === courseSlug);
      if (existing) await deleteTestPage(request, existing.id);
    }

    const created = await createTestPage(request, {
      title: 'CRSP Fast Track Certification',
      slug: courseSlug,
      pageType: 'COURSE_LANDING',
    });
    testPageIds.push(created.page.id);

    // Submit & Approve & Publish
    await request.post(`/api/cms/pages/${created.page.id}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'submit', versionId: created.version.id },
    });
    await request.post(`/api/cms/pages/${created.page.id}/workflow`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { action: 'approve', versionId: created.version.id },
    });
    await request.post(`/api/cms/pages/${created.page.id}/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { versionId: created.version.id },
    });

    // Navigate to public page
    await page.goto(`/p/${courseSlug}`);

    // Verify Schema.org JSON-LD scripts are embedded
    const ldJsonScripts = await page.locator('script[type="application/ld+json"]').all();
    expect(ldJsonScripts.length).toBeGreaterThanOrEqual(1);

    const scriptContents = await Promise.all(ldJsonScripts.map((s) => s.textContent()));
    const parsedSchemas = scriptContents.filter(Boolean).map((c) => JSON.parse(c!));

    // Verify BreadcrumbList schema
    const breadcrumbSchema = parsedSchemas.find((s) => s['@type'] === 'BreadcrumbList');
    expect(breadcrumbSchema).toBeDefined();
    expect(breadcrumbSchema['@context']).toBe('https://schema.org');
    expect(breadcrumbSchema.itemListElement.length).toBeGreaterThanOrEqual(2);

    // Verify Course schema (dynamically resolved from PostgreSQL course store)
    const courseSchema = parsedSchemas.find((s) => s['@type'] === 'Course');
    expect(courseSchema).toBeDefined();
    expect(courseSchema.provider.name).toBe('Zealosh Training & Consultants');
    expect(courseSchema.offers.priceCurrency).toBe('INR');
  });

  test('AC-03: Dynamic Homepage rendering & default fallback verification', async ({
    page,
    request,
  }) => {
    // 1. Visit root '/' and verify Zealosh Green & White homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/Zealosh/i);

    // 2. Query canonical 'home' page via API
    const homeRes = await request.get('/api/cms/pages/home', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(homeRes.status()).toBe(200);
    const homeData = await homeRes.json();
    expect(homeData.page.slug).toBe('home');
    expect(homeData.page.pageType).toBe('HOMEPAGE');

    // 3. Verify homepage elements
    await expect(page.locator('text=Official Zealosh HSE Certification Academy').or(page.locator('text=OFFICIAL ZEALOSH HSE CERTIFICATION ACADEMY'))).toBeVisible();
  });

  test('AC-04: Keyboard accessibility & ARIA semantics for Tabs and Accordions', async ({
    page,
    request,
  }) => {
    const slug = `e2e-a11y-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'Accessible Widgets Test Page',
      slug,
      pageType: 'STANDARD',
    });
    testPageIds.push(created.page.id);

    // Add interactive Tabs & Accordion nodes
    const putRes = await request.put(`/api/cms/pages/${created.page.id}/versions/${created.version.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        changeSummary: 'Add Tabs and Accordion for A11y verification',
        nodes: [
          {
            id: 'sec-widgets',
            pageVersionId: created.version.id,
            nodeType: 'SECTION',
            componentType: 'section',
            parentId: null,
            position: 0,
            props: {},
            styles: {},
            responsiveStyles: {},
            enabled: true,
          },
          {
            id: 'cnt-widgets',
            pageVersionId: created.version.id,
            nodeType: 'CONTAINER',
            componentType: 'container',
            parentId: 'sec-widgets',
            position: 0,
            props: {},
            styles: {},
            responsiveStyles: {},
            enabled: true,
          },
          {
            id: 'tabs-widget-node',
            pageVersionId: created.version.id,
            nodeType: 'COMPONENT',
            componentType: 'tabs',
            parentId: 'cnt-widgets',
            position: 0,
            props: {
              tabs: [
                { id: 'tab-1', title: 'ASP Blueprint', content: 'Detailed ASP Domain breakdowns and formulas.' },
                { id: 'tab-2', title: 'CSP Blueprint', content: 'Advanced CSP Risk Assessment and Ergonomics.' },
              ],
            },
            styles: {},
            responsiveStyles: {},
            enabled: true,
          },
          {
            id: 'accordion-widget-node',
            pageVersionId: created.version.id,
            nodeType: 'COMPONENT',
            componentType: 'accordion',
            parentId: 'cnt-widgets',
            position: 1,
            props: {
              items: [
                {
                  id: 'faq-item-prereq',
                  title: 'What are the prerequisites for ASP?',
                  content: 'A bachelor’s degree in any field or an associate’s degree in safety, health, or environmental practices plus one year of professional safety experience.',
                },
                {
                  id: 'faq-item-recorded',
                  title: 'Are calculation workshops recorded?',
                  content: 'Yes, all live BigBlueButton classroom sessions are recorded and made available in the portal.',
                },
              ],
            },
            styles: {},
            responsiveStyles: {},
            enabled: true,
          },
        ],
      },
    });
    expect(putRes.status()).toBe(200);

    // Submit & Approve & Publish
    await request.post(`/api/cms/pages/${created.page.id}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'submit', versionId: created.version.id },
    });
    await request.post(`/api/cms/pages/${created.page.id}/workflow`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { action: 'approve', versionId: created.version.id },
    });
    await request.post(`/api/cms/pages/${created.page.id}/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { versionId: created.version.id },
    });

    // Visit public route
    await page.goto(`/p/${slug}`);

    // Verify Tabs ARIA semantics
    const tabList = page.locator('div[role="tablist"]');
    await expect(tabList).toBeVisible();

    const tab1 = page.locator('button[role="tab"]:has-text("ASP Blueprint")');
    const tab2 = page.locator('button[role="tab"]:has-text("CSP Blueprint")');
    await expect(tab1).toHaveAttribute('aria-selected', 'true');
    await expect(tab2).toHaveAttribute('aria-selected', 'false');

    // Click Tab 2
    await tab2.click();
    await expect(tab2).toHaveAttribute('aria-selected', 'true');
    await expect(tab1).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('text=Advanced CSP Risk Assessment and Ergonomics.')).toBeVisible();

    // Verify Accordion ARIA semantics
    const faqButton1 = page.locator('button:has-text("What are the prerequisites for ASP?")');
    await expect(faqButton1).toHaveAttribute('aria-expanded', 'false');

    // Expand accordion item 1
    await faqButton1.click();
    await expect(faqButton1).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('text=A bachelor’s degree in any field')).toBeVisible();

    // Collapse accordion item 1
    await faqButton1.click();
    await expect(faqButton1).toHaveAttribute('aria-expanded', 'false');
  });

  test('AC-05: Draft Privacy Guard (Draft pages return 404 to unauthenticated requests)', async ({
    page,
    request,
  }) => {
    const draftSlug = `e2e-draft-priv-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'Confidential Internal Safety Syllabus',
      slug: draftSlug,
      pageType: 'STANDARD',
    });
    testPageIds.push(created.page.id);

    // Visit public route /p/draftSlug without publishing
    const response = await page.goto(`/p/${draftSlug}`);
    expect(response?.status()).toBe(404);
  });
});
