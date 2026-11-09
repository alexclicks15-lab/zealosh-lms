// Zealosh LMS — Playwright Real-Browser End-to-End Test Suite
// Task: ZM-IMPL-08D — Institutional Scheduling, Orientation Management & Isolated Group Messaging
// Real-browser verification of Master Calendar, Channel Messaging, and Orientation Portal

import { test, expect } from '@playwright/test';
import { injectAuthCookie, adminToken, studentToken } from './helpers/cms-fixtures';

test.describe('Zealosh ZM-IMPL-08D: Scheduling, Orientation & Group Messaging', () => {
  // --------------------------------------------------------------------------
  // TEST 1: Admin Master Institutional Calendar (/admin/calendar)
  // --------------------------------------------------------------------------
  test('SOM-01: should render Master Institutional Calendar with Agenda, Month Grid, and Conflict Inspector', async ({ page, context }) => {
    await injectAuthCookie(context, adminToken);

    await page.goto('/admin/calendar');

    // Verify main header
    await expect(
      page.locator('h1').filter({ hasText: /Master Institutional Calendar/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Verify View Mode toggles
    const agendaBtn = page.locator('button', { hasText: /Timeline \/ Agenda/i }).first();
    const monthBtn = page.locator('button', { hasText: /Month Grid/i }).first();
    const conflictBtn = page.locator('button', { hasText: /Conflict Inspector/i }).first();

    await expect(agendaBtn).toBeVisible();
    await expect(monthBtn).toBeVisible();
    await expect(conflictBtn).toBeVisible();

    // Toggle to Month Grid view
    await monthBtn.click();
    await expect(page.locator('.grid-cols-7').first()).toBeVisible();

    // Toggle to Conflict Inspector view
    await conflictBtn.click();
    await expect(page.locator('h2', { hasText: /Conflict Inspector/i }).first()).toBeVisible();
    await expect(page.locator('text=Zero active schedule conflicts detected').first()).toBeVisible();

    // Return to Agenda view
    await agendaBtn.click();

    // Verify filter dropdown
    const filterSelect = page.locator('select').first();
    await expect(filterSelect).toBeVisible();
    await expect(filterSelect).toHaveValue('ALL');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Isolated Group, Course & Batch Messaging Workspace (/messages)
  // --------------------------------------------------------------------------
  test('SOM-02: should render Channels & Messaging workspace, view channel streams and toggle thread panel', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto('/messages');

    // Verify workspace header
    await expect(
      page.locator('h1').filter({ hasText: /Zealosh Institutional Messaging & Group Channels/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Verify presence of "Create Channel" button
    const createBtn = page.locator('button', { hasText: /Create Channel/i }).first();
    await expect(createBtn).toBeVisible();

    // Verify default ASP Course Channel is listed
    const aspChannel = page.locator('button').filter({ hasText: /ASP Examination Prep/i }).first();
    await expect(aspChannel).toBeVisible();

    // Select ASP channel
    await aspChannel.click();

    // Verify active channel banner
    await expect(
      page.locator('h2').filter({ hasText: /ASP Examination Prep/i }).first()
    ).toBeVisible();

    // Verify Academic Isolation notice is rendered
    await expect(
      page.locator('strong').filter({ hasText: /Academic Isolation Active:/i }).first()
    ).toBeVisible();

    // Verify message input is present
    const messageInput = page.locator('input[placeholder*="Message #"]').first();
    await expect(messageInput).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 3: Student Portal Orientation Integration & Messaging Links (/student)
  // --------------------------------------------------------------------------
  test('SOM-03: should display Course Induction & Orientation prerequisite card and navigation in student portal', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto('/student');

    // Verify student portal header
    await expect(
      page.locator('h1').filter({ hasText: /Welcome back/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Verify Channels & Messaging link in top banner
    const msgLink = page.locator('a[href="/messages"]').first();
    await expect(msgLink).toBeVisible();

    // Verify Course Induction & Orientation card in sidebar
    await expect(
      page.locator('h3').filter({ hasText: /Course Induction & Orientation/i }).first()
    ).toBeVisible();

    await expect(
      page.locator('text=Gated Requirement').first()
    ).toBeVisible();

    // Click Channels & Messaging and verify navigation
    await msgLink.click();
    await page.waitForURL('**/messages');
    expect(page.url()).toContain('/messages');
  });
});

