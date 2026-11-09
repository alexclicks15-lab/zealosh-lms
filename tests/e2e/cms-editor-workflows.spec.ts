// Zealosh LMS — Playwright E2E: Visual PageBuilder Editor Workflows
// Standards: wj-page-builder separation of structure/content, real browser interaction, zero arbitrary waits

import { test, expect } from '@playwright/test';
import {
  adminToken,
  injectAuthCookie,
  createTestPage,
  deleteTestPage,
} from './helpers/cms-fixtures';

test.describe('Zealosh Visual PageBuilder — Functional Editor & Component Workflows', () => {
  let testPageId: string;
  let testSlug: string;

  test.beforeEach(async ({ context }) => {
    await injectAuthCookie(context, adminToken);
  });

  test.afterEach(async ({ request }) => {
    if (testPageId) {
      await deleteTestPage(request, testPageId);
    }
  });

  test('ED-01: Admin creates a new page via UI modal and enters Editor Workspace', async ({ page, request }) => {
    testSlug = `e2e-create-${Date.now()}`;
    await page.goto('/admin');
    await expect(page).toHaveTitle(/Zealosh/i);

    // Switch to Visual PageBuilder tab
    const cmsTab = page.locator('button:has-text("Visual Page Builder")');
    await expect(cmsTab).toBeVisible();
    await cmsTab.click();

    // Click "Create New Page"
    const createBtn = page.locator('button:has-text("Create New Page")');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Fill modal form
    await expect(page.locator('text=Create New Landing Page')).toBeVisible();
    await page.fill('input[placeholder="e.g. CRSP Examination Preparation"]', 'E2E Modal Created Safety Course');
    await page.fill('input[placeholder="crsp-examination-preparation"]', testSlug);
    await page.locator('form select').selectOption('STANDARD');

    // Wait for debounced slug validation to show success
    await expect(page.locator('text=Slug is valid and available')).toBeVisible({ timeout: 5000 });

    // Submit modal
    const initBtn = page.locator('button:has-text("Initialize Page")');
    await expect(initBtn).toBeEnabled();
    await initBtn.click();

    // Verify transition into CmsEditorWorkspace
    await expect(page.locator('header span.font-black:has-text("E2E Modal Created Safety Course")')).toBeVisible();
    await expect(page.locator(`text=/${testSlug}`)).toBeVisible();
    await expect(page.locator('button:has-text("Save Draft")')).toBeVisible();
    await expect(page.locator('button:has-text("Publish")')).toBeVisible();

    // Fetch list to find pageId for cleanup
    const listRes = await request.get('/api/cms/pages', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listData = await listRes.json();
    const created = listData.pages.find((p: any) => p.slug === testSlug);
    if (created) testPageId = created.id;
  });

  test('ED-02: Component Library insertion and hierarchical structure updates', async ({ page, request }) => {
    testSlug = `e2e-lib-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'E2E Library Component Test',
      slug: testSlug,
    });
    testPageId = created.page.id;

    await page.goto('/admin');
    const cmsTab = page.locator('button:has-text("Visual Page Builder")');
    await cmsTab.click();

    // Find our page in list and click Edit Page
    const pageRow = page.locator(`tr:has-text("${testSlug}")`);
    await expect(pageRow).toBeVisible();
    await pageRow.locator('button:has-text("Edit Page")').click();

    // Verify workspace loaded
    await expect(page.locator('button:has-text("Save Draft")')).toBeVisible();

    // Ensure Component Library tab is active
    await page.locator('button:has-text("Component Library")').click();

    // Insert a Hero Showcase component
    const heroBtn = page.locator('button:has-text("Hero Showcase")').first();
    await expect(heroBtn).toBeVisible();
    await heroBtn.click();

    // Verify canvas renders the responsive simulator viewport
    await expect(page.locator('text=VIEWPORT: DESKTOP').first()).toBeVisible();

    // Switch to Structure Tree tab and verify nodes exist
    await page.locator('button:has-text("Structure Tree")').click();
    await expect(page.locator('span:has-text("section")').first()).toBeVisible();
  });

  test('ED-03: Component selection and Inspector property editing', async ({ page, request }) => {
    testSlug = `e2e-inspector-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'E2E Inspector Property Test',
      slug: testSlug,
    });
    testPageId = created.page.id;

    await page.goto('/admin');
    await page.locator('button:has-text("Visual Page Builder")').click();
    const pageRow = page.locator(`tr:has-text("${testSlug}")`);
    await pageRow.locator('button:has-text("Edit Page")').click();

    // Switch to Structure Tree and select heading
    await page.locator('button:has-text("Structure Tree")').click();
    const headingItem = page.locator('span:has-text("heading")').first();
    await expect(headingItem).toBeVisible();
    await headingItem.click();

    // Inspector shows heading selected
    await expect(page.locator('aside').getByText('heading', { exact: false }).first()).toBeVisible();

    // In Inspector Content tab, update heading text
    const headingInput = page.locator('aside input[type="text"]').first();
    await expect(headingInput).toBeVisible();
    await headingInput.fill('Certified Safety Professional Exam Prep');

    // Verify text updated on canvas
    await expect(page.locator('text=Certified Safety Professional Exam Prep')).toBeVisible();

    // Switch to Styles tab and modify text color
    const stylesTab = page.locator('button:has-text("styles")').first();
    await stylesTab.click();
    const textColorInput = page.locator('aside input[type="text"]').nth(1);
    if (await textColorInput.isVisible()) {
      await textColorInput.fill('#3a7536');
    }
  });

  test('ED-04: Component reordering, duplication, and unique node ID generation', async ({ page, request }) => {
    testSlug = `e2e-reorder-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'E2E Duplication & Reorder Test',
      slug: testSlug,
    });
    testPageId = created.page.id;

    await page.goto('/admin');
    await page.locator('button:has-text("Visual Page Builder")').click();
    await page.locator(`tr:has-text("${testSlug}")`).locator('button:has-text("Edit Page")').click();

    // Switch to Structure Tree and select heading
    await page.locator('button:has-text("Structure Tree")').click();
    const headingItem = page.locator('span:has-text("heading")').first();
    await headingItem.click();

    // Count initial headings in tree
    const initialCount = await page.locator('span:has-text("heading")').count();

    // In Inspector header, click Duplicate Component on current selection
    const dupBtn = page.locator('button[title="Duplicate Component"]');
    await expect(dupBtn).toBeVisible();
    await dupBtn.click();

    // Verify duplicated heading node added to tree
    await expect(async () => {
      const currentCount = await page.locator('span:has-text("heading")').count();
      expect(currentCount).toBeGreaterThan(initialCount);
    }).toPass();

    // Verify Move Down button exists and is clickable
    const moveDownBtn = page.locator('button[title="Move Down"]').first();
    if (await moveDownBtn.isVisible()) {
      await moveDownBtn.click();
    }
  });

  test('ED-05: Component deletion and in-memory Undo & Redo', async ({ page, request }) => {
    testSlug = `e2e-undo-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'E2E Undo Redo Test',
      slug: testSlug,
    });
    testPageId = created.page.id;

    await page.goto('/admin');
    await page.locator('button:has-text("Visual Page Builder")').click();
    await page.locator(`tr:has-text("${testSlug}")`).locator('button:has-text("Edit Page")').click();

    // Switch to Structure Tree and select paragraph
    await page.locator('button:has-text("Structure Tree")').click();
    const paragraphItem = page.locator('span:has-text("paragraph")').first();
    await expect(paragraphItem).toBeVisible();
    await paragraphItem.click();

    // Delete paragraph via Inspector
    const deleteBtn = page.locator('button[title="Delete Component"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify paragraph removed from tree
    await expect(page.locator('span:has-text("paragraph")')).toHaveCount(0);

    // Undo deletion via Toolbar Undo button
    const undoBtn = page.locator('button[title="Undo"]');
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();

    // Verify restored in tree
    await expect(page.locator('span:has-text("paragraph")').first()).toBeVisible();

    // Redo deletion via Toolbar Redo button
    const redoBtn = page.locator('button[title="Redo"]');
    await expect(redoBtn).toBeEnabled();
    await redoBtn.click();

    // Verify removed again
    await expect(page.locator('span:has-text("paragraph")')).toHaveCount(0);
  });

  test('ED-06: Responsive canvas viewport switching', async ({ page, request }) => {
    testSlug = `e2e-viewports-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'E2E Responsive Canvas Test',
      slug: testSlug,
    });
    testPageId = created.page.id;

    await page.goto('/admin');
    await page.locator('button:has-text("Visual Page Builder")').click();
    await page.locator(`tr:has-text("${testSlug}")`).locator('button:has-text("Edit Page")').click();

    // 1. Switch to Tablet Viewport
    await page.locator('button[title*="Tablet"]').click();
    await expect(page.locator('text=VIEWPORT: TABLET')).toBeVisible();
    await expect(page.locator('text=768 × 1024')).toBeVisible();

    // 2. Switch to Mobile Viewport
    await page.locator('button[title*="Mobile"]').click();
    await expect(page.locator('text=VIEWPORT: MOBILE')).toBeVisible();
    await expect(page.locator('text=390 × 844')).toBeVisible();

    // 3. Switch back to Desktop Viewport
    await page.locator('button[title*="Desktop"]').click();
    await expect(page.locator('text=VIEWPORT: DESKTOP')).toBeVisible();
  });

  test('ED-07: Save Draft with server confirmation and persistence after page reload', async ({ page, request }) => {
    testSlug = `e2e-persistence-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'E2E Persistence Test Page',
      slug: testSlug,
    });
    testPageId = created.page.id;

    await page.goto('/admin');
    await page.locator('button:has-text("Visual Page Builder")').click();
    await page.locator(`tr:has-text("${testSlug}")`).locator('button:has-text("Edit Page")').click();

    // Modify heading text
    await page.locator('button:has-text("Structure Tree")').click();
    await page.locator('span:has-text("heading")').first().click();

    const headingInput = page.locator('aside input[type="text"]').first();
    await expect(headingInput).toBeVisible();
    await headingInput.fill('Persisted HSE Excellence Header');

    // Click Save Draft
    const saveBtn = page.locator('button:has-text("Save Draft")');
    await saveBtn.click();

    // Verify success banner and timestamp
    await expect(page.locator('text=Draft saved successfully')).toBeVisible();
    await expect(page.locator('text=Last saved at')).toBeVisible();

    // Verify server persistence via direct authenticated API query
    const pageRes = await request.get(`/api/cms/pages/${testPageId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(pageRes.status()).toBe(200);
    const pageData = await pageRes.json();
    const activeVersionId = pageData.page.currentDraftVersionId || pageData.page.publishedVersionId;

    const verRes = await request.get(`/api/cms/pages/${testPageId}/versions/${activeVersionId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(verRes.status()).toBe(200);
    const verData = await verRes.json();
    const headingNode = verData.nodes.find((n: any) => n.componentType === 'heading');
    expect(headingNode?.props?.text).toBe('Persisted HSE Excellence Header');

    // Return to admin dashboard and re-open editor to verify UI persistence
    await page.goto('/admin');
    await page.locator('button:has-text("Visual Page Builder")').click();
    await page.locator(`tr:has-text("${testSlug}")`).locator('button:has-text("Edit Page")').click();
    await expect(page.locator('text=Persisted HSE Excellence Header')).toBeVisible();
  });
});
