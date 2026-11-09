// Zealosh LMS — Playwright Real-Browser End-to-End Test Suite
// Task: ZM-IMPL-04B — Phase 5 Operations & Pre-Launch Validation
// Real-browser verification of Notifications Hub, Student Helpdesk, Diagnostics Console & Health API

import { test, expect } from '@playwright/test';
import { injectAuthCookie, studentToken, adminToken } from './helpers/cms-fixtures';

test.describe('Zealosh Phase 5 Operations — Real Browser E2E Suite (OPS-01 to OPS-04)', () => {
  // --------------------------------------------------------------------------
  // OPS-01: In-App Notification Center (/notifications)
  // --------------------------------------------------------------------------
  test('OPS-01: should render student in-app notifications hub with filter tabs and actions', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto('/notifications');

    // Wait for header to render
    await expect(
      page.locator('h1').filter({ hasText: /Academic Notification Center/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Verify Zealosh branding subtitle
    await expect(
      page.locator('text=Zealosh Training & Consultants — Live Academic Feed').first()
    ).toBeVisible();

    // Verify filter tabs (All, Unread, Read)
    await expect(page.locator('button', { hasText: /All/ }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: /Unread/ }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: /Read/ }).first()).toBeVisible();

    // Verify notifications heading or empty state
    await expect(
      page.locator('h2', { hasText: /Your Notifications/i }).or(page.locator('text=No notifications found')).first()
    ).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // OPS-02: Student Helpdesk & Service Operations (/support)
  // --------------------------------------------------------------------------
  test('OPS-02: should render student helpdesk portal and support ticket creation workflow', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto('/support');

    // Verify Helpdesk page title
    await expect(
      page.locator('h1').filter({ hasText: /Zealosh Student Helpdesk/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Verify Create Support Ticket button is present
    const createBtn = page.locator('button', { hasText: /Create Support Ticket/i }).first();
    await expect(createBtn).toBeVisible();

    // Click Create Support Ticket to trigger modal
    await createBtn.click();

    // Verify ticket modal opens with Submit Support Inquiry header
    await expect(page.locator('h2', { hasText: /Submit Support Inquiry/i }).first()).toBeVisible({ timeout: 5000 });

    // Verify form input fields
    await expect(page.locator('input[placeholder*="Briefly state your question"]').first()).toBeVisible();
    await expect(page.locator('textarea[placeholder*="Provide details"]').first()).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();

    // Cancel / Close modal by clicking Cancel button
    const cancelBtn = page.locator('button', { hasText: /Cancel/i }).first();
    await cancelBtn.click();

    // Verify modal is closed
    await expect(page.locator('h2', { hasText: /Submit Support Inquiry/i })).toHaveCount(0);
  });

  // --------------------------------------------------------------------------
  // OPS-03: Centralized Diagnostics & Telemetry (/admin/diagnostics)
  // --------------------------------------------------------------------------
  test('OPS-03: should render administrator diagnostics console with dependency health overview', async ({ page, context }) => {
    await injectAuthCookie(context, adminToken);

    await page.goto('/admin/diagnostics');

    // Verify Admin Diagnostics Header
    await expect(
      page.locator('h1').filter({ hasText: /Live Bug Monitoring & Diagnostics/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Verify System Dependency Health section and cards
    await expect(
      page.locator('text=System Dependency Health').first()
    ).toBeVisible({ timeout: 10000 });

    // Verify monitored dependencies are listed (Zealosh Core Database, Zealosh Learning, Zealosh VC)
    await expect(
      page.locator('text=Zealosh Core Database').first()
    ).toBeVisible();

    // Verify Refresh Telemetry action button exists
    await expect(
      page.locator('button', { hasText: /Refresh Telemetry/i }).first()
    ).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // OPS-04: Public Health Check Endpoint (/api/health)
  // --------------------------------------------------------------------------
  test('OPS-04: should return HTTP 200 and scrubbed operational telemetry without secret leakage', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('HEALTHY');
    expect(body.timestamp).toBeDefined();
    expect(body.services).toBeDefined();
    expect(body.services.application).toBe('HEALTHY');
    expect(body.services.database).toBe('HEALTHY');

    // Assert that no sensitive connection strings or tokens are exposed
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('postgres://');
    expect(bodyStr).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(bodyStr).not.toContain('BIGBLUEBUTTON_SECRET');
  });
});
