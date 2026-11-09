// Zealosh LMS — Playwright Real-Browser End-to-End Test Suite
// Task: ZM-IMPL-08C — Commerce Decoupling, Entitlements & 14-Stage Admissions Pipeline
// Real-browser verification of Course Landing Offerings, Lead Inquiry, and Admissions Command Center

import { test, expect } from '@playwright/test';
import { injectAuthCookie, adminToken, studentToken } from './helpers/cms-fixtures';

test.describe('Zealosh ZM-IMPL-08C: Commerce Decoupling & 14-Stage Admissions Pipeline', () => {
  // --------------------------------------------------------------------------
  // TEST 1: Course Detail Page — Decoupled Offerings & Pricing Selection
  // --------------------------------------------------------------------------
  test('ADM-01: should render course detail page with decoupled learning packages and offering selection', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto('/courses/asp-examination-prep');

    // Wait for main title
    await expect(
      page.locator('h1').filter({ hasText: /Associate Safety Professional/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Verify Available Learning Packages & Offerings section
    await expect(
      page.locator('h3').filter({ hasText: /Available Learning Packages & Offerings/i }).first()
    ).toBeVisible();

    // Verify offering package titles
    await expect(page.locator('text=ASP Complete Certification Package').first()).toBeVisible();
    await expect(page.locator('text=ASP Recorded Theory & Lessons Only').first()).toBeVisible();
    await expect(page.locator('text=ASP High-Stakes Question Bank & Mocks Only').first()).toBeVisible();

    // Verify "Talk to Admissions Advisor" CTA button
    const advisorBtn = page.locator('button', { hasText: /Talk to Admissions Advisor/i }).first();
    await expect(advisorBtn).toBeVisible();

    // Click advisor button and verify inquiry modal opens
    await advisorBtn.click();
    await expect(
      page.locator('h3', { hasText: /Connect with an Admissions Advisor/i }).first()
    ).toBeVisible();

    // Close modal
    await page.locator('button', { hasText: '✕' }).first().click();
  });

  // --------------------------------------------------------------------------
  // TEST 2: Admissions & Commerce Command Center (/admin/admissions)
  // --------------------------------------------------------------------------
  test('ADM-02: should render Admissions Command Center with 14-stage Kanban, tabs, and provisioning monitor', async ({ page, context }) => {
    await injectAuthCookie(context, adminToken);

    await page.goto('/admin/admissions');

    // Verify Command Center header
    await expect(
      page.locator('h1').filter({ hasText: /14-Stage Admissions Pipeline & Entitlement Provisioning/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Verify top metrics
    await expect(page.locator('text=Leads Inquiry').first()).toBeVisible();
    await expect(page.locator('text=Pipeline Apps').first()).toBeVisible();
    await expect(page.locator('text=Admitted').first()).toBeVisible();
    await expect(page.locator('text=Offerings').first()).toBeVisible();

    // Verify navigation tabs
    await expect(page.locator('button', { hasText: /14-Stage Kanban Pipeline/i }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: /Document Review Queue/i }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: /10-Step Provisioning Sagas/i }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: /Product Offerings & Entitlements/i }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: /Admissions CRM Leads/i }).first()).toBeVisible();

    // Verify Kanban columns for initial stages
    await expect(page.locator('h4', { hasText: /^NEW$/i }).first()).toBeVisible();
    await expect(page.locator('h4', { hasText: /^SUBMITTED$/i }).first()).toBeVisible();
    await expect(page.locator('h4', { hasText: /DOCUMENT REVIEW/i }).first()).toBeVisible();
    await expect(page.locator('h4', { hasText: /^ADMITTED$/i }).first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 3: Product Offerings & Entitlements Tab
  // --------------------------------------------------------------------------
  test('ADM-03: should render decoupled offerings tab with feature scopes and validity days', async ({ page, context }) => {
    await injectAuthCookie(context, adminToken);

    await page.goto('/admin/admissions');

    // Click Offerings tab
    await page.locator('button', { hasText: /Product Offerings & Entitlements/i }).first().click();

    // Verify header
    await expect(
      page.locator('h3').filter({ hasText: /Decoupled Commercial Product Offerings/i }).first()
    ).toBeVisible();

    // Verify offering packages
    await expect(page.locator('h4', { hasText: /ASP Complete Certification Package/i }).first()).toBeVisible();
    await expect(page.locator('h4', { hasText: /ASP Recorded Theory/i }).first()).toBeVisible();
    await expect(page.locator('h4', { hasText: /ASP High-Stakes Question Bank/i }).first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 4: Document Review Queue Tab
  // --------------------------------------------------------------------------
  test('ADM-04: should render document verification queue with review actions', async ({ page, context }) => {
    await injectAuthCookie(context, adminToken);

    await page.goto('/admin/admissions');

    // Click Document Review Queue tab
    await page.locator('button', { hasText: /Document Review Queue/i }).first().click();

    // Verify table heading
    await expect(
      page.locator('h3').filter({ hasText: /Applicant Credentials & Verification Queue/i }).first()
    ).toBeVisible();

    await expect(page.locator('th', { hasText: /Document Type/i }).first()).toBeVisible();
    await expect(page.locator('th', { hasText: /Filename & Version/i }).first()).toBeVisible();
  });
});
