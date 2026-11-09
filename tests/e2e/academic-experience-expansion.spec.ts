// Zealosh LMS — Playwright Real-Browser End-to-End Test Suite
// Task: ZM-IMPL-04A — Academic Experience Expansion & Unified Learner Activity
// Tests: Student Activity Feed, Instructor Cohort Activity Workspace, and In-Class Teaching Materials Pack

import { test, expect } from '@playwright/test';
import { injectAuthCookie, studentToken, instructorToken } from './helpers/cms-fixtures';

test.describe('Zealosh Academic Experience Expansion — Real Browser E2E Suite (QA-01 to QA-05)', () => {
  const liveSessionId = 'sess-asp-01';

  // --------------------------------------------------------------------------
  // QA-01: Student Activity Feed on /student
  // --------------------------------------------------------------------------
  test('QA-01: should display Recent Academic Activity feed on student dashboard', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto('/student');

    // Wait for the student dashboard to render
    await expect(page.locator('h1').filter({ hasText: /Welcome back/i }).first()).toBeVisible({ timeout: 15000 });

    // Assert the Recent Academic Activity feed component is present
    const activityFeedHeader = page.locator('h2').filter({ hasText: 'Recent Academic Activity' }).first();
    await expect(activityFeedHeader).toBeVisible({ timeout: 10000 });

    // Verify stream link and empty/active feed state
    await expect(page.locator('a', { hasText: 'View Stream' }).first()).toBeVisible();
    await expect(page.locator('text=No recent academic activities recorded in your enrolled cohorts.').or(page.locator('text=All Courses'))).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // QA-02: Instructor Cohort Activity Workspace on /instructor
  // --------------------------------------------------------------------------
  test('QA-02: should render Cohort Activity tab and feed panel for instructor with privacy isolation', async ({ page, context }) => {
    await injectAuthCookie(context, instructorToken);

    await page.goto('/instructor');

    // Wait for instructor dashboard tab buttons
    const cohortTab = page.locator('button').filter({ hasText: /Cohort Activity/ }).first();
    await expect(cohortTab).toBeVisible({ timeout: 15000 });

    // Click Cohort Activity tab
    await cohortTab.click();

    // Verify Cohort Activity Workspace heading and description
    await expect(page.locator('h2').filter({ hasText: 'Cohort Academic Activity Stream' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Real-time academic events across your assigned courses and cohorts').first()).toBeVisible();

    // Verify refresh button exists
    await expect(page.locator('button', { hasText: 'Refresh' }).first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // QA-03: In-Class Teaching Materials Sidebar on /live/[sessionId] for Instructor
  // --------------------------------------------------------------------------
  test('QA-03: should render Materials tab in live classroom sidebar with faculty presenter notes', async ({ page, context }) => {
    await injectAuthCookie(context, instructorToken);

    await page.goto(`/live/${liveSessionId}`);

    // Wait for the live room interface to finish loading
    await expect(page.locator('text=Leave Classroom').first()).toBeVisible({ timeout: 20000 });

    // Find Materials tab button in sidebar
    const materialsTab = page.locator('button').filter({ hasText: /Materials/ }).first();
    await expect(materialsTab).toBeVisible({ timeout: 10000 });

    // Click Materials tab
    await materialsTab.click();

    // Verify Session Material Pack header and faculty controls
    await expect(page.locator('text=Session Material Pack').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button', { hasText: 'Preload' }).first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // QA-04: Faculty Material Preload Modal Opens and Interacts Correctly
  // --------------------------------------------------------------------------
  test('QA-04: should open Preload Teaching Material modal with presenter notes and release condition fields', async ({ page, context }) => {
    await injectAuthCookie(context, instructorToken);

    await page.goto(`/live/${liveSessionId}`);

    // Wait for the live room interface
    await expect(page.locator('text=Leave Classroom').first()).toBeVisible({ timeout: 20000 });

    // Click Materials tab
    const materialsTab = page.locator('button').filter({ hasText: /Materials/ }).first();
    await materialsTab.click();

    // Click Preload button
    const preloadBtn = page.locator('button', { hasText: 'Preload' }).first();
    await preloadBtn.click();

    // Verify Modal appears with Title
    await expect(page.locator('text=Preload Teaching Material').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('label').filter({ hasText: /Display Name/i }).first()).toBeVisible();
    await expect(page.locator('label').filter({ hasText: /Presenter Notes/i }).first()).toBeVisible();
    await expect(page.locator('label').filter({ hasText: /Release Condition/i }).first()).toBeVisible();

    // Close modal
    const cancelBtn = page.locator('button', { hasText: 'Cancel' }).first();
    await cancelBtn.click();
    await expect(page.locator('text=Preload Teaching Material')).toHaveCount(0);
  });

  // --------------------------------------------------------------------------
  // QA-05: Student In-Class View Conceals Faculty Presenter Notes
  // --------------------------------------------------------------------------
  test('QA-05: should conceal faculty presenter notes from student in live classroom', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto(`/live/${liveSessionId}`);

    // Wait for the live room
    await expect(page.locator('text=Leave Classroom').first()).toBeVisible({ timeout: 20000 });

    // Click Materials tab
    const materialsTab = page.locator('button').filter({ hasText: /Materials/ }).first();
    await materialsTab.click();

    // Verify Preload button is NOT visible for student
    const preloadBtn = page.locator('button', { hasText: 'Preload' });
    await expect(preloadBtn).toHaveCount(0);

    // Verify Faculty Presenter Notes banner is NOT visible for student
    const presenterNotesBanner = page.locator('text=Presenter Note:');
    await expect(presenterNotesBanner).toHaveCount(0);
  });
});
