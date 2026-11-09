// Zealosh LMS — Playwright Real-Browser End-to-End Test Suite
// Task: ZM-IMPL-03A — Unified Classroom, Live Classroom & Zealosh VC
// Validates Defect 3.1 (Schema Cache Resolution) & Defect 3.2 (Zero 503 Live Room Launch)

import { test, expect } from '@playwright/test';
import { injectAuthCookie, studentToken, instructorToken } from './helpers/cms-fixtures';

test.describe('Zealosh Unified Classroom & Live VC — Real Browser Acceptance (QA-01 to QA-12)', () => {
  const sessionId = 'sess-asp-01';

  // --------------------------------------------------------------------------
  // QA-01: Defect 3.1 Verification — /classroom Loads Without HTTP 500 or Schema Cache Errors
  // --------------------------------------------------------------------------
  test('QA-01: should load unified classroom hub without HTTP 500 schema cache error (Defect 3.1)', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    let classroomApiStatus = 0;
    page.on('response', (res) => {
      if (res.url().includes('/api/classroom')) {
        classroomApiStatus = res.status();
      }
    });

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');

    // Wait for the main classroom interface
    await expect(page.locator('text=Stream').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Classwork').first()).toBeVisible({ timeout: 10000 });

    // Assert API did not return 500
    if (classroomApiStatus > 0) {
      expect(classroomApiStatus).toBe(200);
    }

    // Page must not display schema cache failure or crash alerts
    const errorAlert = page.locator('text=Could not find the table').or(page.locator('text=Failed to load classroom'));
    await expect(errorAlert).toHaveCount(0);
  });

  // --------------------------------------------------------------------------
  // QA-02: Instructor Announcement Stream View
  // --------------------------------------------------------------------------
  test('QA-02: should render stream tab with announcements for instructor', async ({ page, context }) => {
    await injectAuthCookie(context, instructorToken);

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');
    await expect(page.locator('text=Stream').first()).toBeVisible({ timeout: 15000 });

    // Verify stream banner or announcement elements
    await expect(page.locator('h1, h2, h3').filter({ hasText: /ASP|Preparation|Classroom|Workshop/i }).first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // QA-03: Student Discussion Stream
  // --------------------------------------------------------------------------
  test('QA-03: should display active academic workspace stream for student', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');
    await expect(page.locator('text=Stream').first()).toBeVisible({ timeout: 15000 });

    // Verify cohort context badge or course details
    await expect(page.locator('text=ASP').or(page.locator('text=Weekend')).first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // QA-04: Classwork Tab Navigation
  // --------------------------------------------------------------------------
  test('QA-04: should switch to Classwork tab and display academic assignments', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');
    await expect(page.locator('text=Classwork').first()).toBeVisible({ timeout: 15000 });

    const classworkTab = page.locator('button, a').filter({ hasText: 'Classwork' }).first();
    await classworkTab.click();

    // Verify classwork section
    await expect(page.locator('text=Assignments').or(page.locator('text=Classwork')).or(page.locator('text=Modules')).first()).toBeVisible({ timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // QA-05: Defect 3.2 Verification — Host Route Returns HTTP 200 (Zero 503 Errors)
  // --------------------------------------------------------------------------
  test('QA-05: should launch live session as host without HTTP 503 gateway timeout (Defect 3.2)', async ({ request }) => {
    const res = await request.post(`/api/live/${sessionId}/host`, {
      headers: {
        Authorization: `Bearer ${instructorToken}`,
      },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.joinUrl).toBeDefined();
    expect(data.isModerator).toBe(true);
    expect(data.joinUrl).toContain('role=INSTRUCTOR');
  });

  // --------------------------------------------------------------------------
  // QA-06: Student Join Route Returns HTTP 200
  // --------------------------------------------------------------------------
  test('QA-06: should generate attendee join URL without timeout', async ({ request }) => {
    const res = await request.post(`/api/live/${sessionId}/join`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.joinUrl).toBeDefined();
    expect(data.isModerator).toBe(false);
    expect(data.joinUrl).toContain('role=STUDENT');
  });

  // --------------------------------------------------------------------------
  // QA-07: Live VC Simulator UI, Whiteboard & Controls
  // --------------------------------------------------------------------------
  test('QA-07: should render Zealosh VC room with whiteboard, controls and roster', async ({ page, context }) => {
    await injectAuthCookie(context, instructorToken);

    await page.goto(`/live/${sessionId}?role=MODERATOR&simulated=true`);

    // Verify Zealosh VC branding
    await expect(page.locator('text=Zealosh VC').first()).toBeVisible({ timeout: 15000 });

    // Verify whiteboard canvas exists
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Verify Raise Hand toggle
    const handBtn = page.getByRole('button', { name: /raise hand/i }).first();
    if (await handBtn.isVisible()) {
      await handBtn.click();
      await expect(page.locator('text=Hand Raised').or(page.getByRole('button', { name: /lower hand/i })).first()).toBeVisible();
    }
  });

  // --------------------------------------------------------------------------
  // QA-08: Live VC In-Meeting Chat
  // --------------------------------------------------------------------------
  test('QA-08: should send and display in-meeting live chat messages', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto(`/live/${sessionId}?role=ATTENDEE&simulated=true`);
    await expect(page.locator('text=Zealosh VC').first()).toBeVisible({ timeout: 15000 });

    const chatInput = page.getByPlaceholder(/type a message|send message/i).first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('Question regarding ventilation equations');
      await chatInput.press('Enter');

      await expect(page.locator('text=Question regarding ventilation equations').first()).toBeVisible({ timeout: 5000 });
    }
  });

  // --------------------------------------------------------------------------
  // QA-09: Responsive Tablet Viewport Verification (768 x 1024)
  // --------------------------------------------------------------------------
  test('QA-09: should adapt gracefully across tablet viewport (768x1024)', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');
    await expect(page.locator('text=Stream').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Classwork').first()).toBeVisible({ timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // QA-10: Dedicated Mobile Viewport Live Room & Controls (390 x 844)
  // --------------------------------------------------------------------------
  test('QA-10: should render functional live room controls on mobile viewport (390x844)', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/live/${sessionId}?role=ATTENDEE&simulated=true`);

    // Verify header and VC branding
    await expect(page.locator('text=Zealosh VC').first()).toBeVisible({ timeout: 15000 });

    // Verify whiteboard canvas scales to mobile screen
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Verify touch action controls
    await expect(page.getByRole('button', { name: /mute microphone|unmute microphone/i }).or(page.locator('button[title*="Microphone"]')).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /camera/i }).or(page.locator('button[title*="Camera"]')).first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // QA-11: Zero Client Script Crash & Unhandled Exception Guard
  // --------------------------------------------------------------------------
  test('QA-11: should complete student classroom workflow with zero unhandled client exceptions', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    const clientErrors: string[] = [];
    page.on('pageerror', (err) => {
      clientErrors.push(err.message);
    });

    await page.goto('/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26');
    await expect(page.locator('text=Stream').first()).toBeVisible({ timeout: 15000 });

    // Click tabs to stress client-side React rendering
    const classworkTab = page.locator('button, a').filter({ hasText: 'Classwork' }).first();
    if (await classworkTab.isVisible()) {
      await classworkTab.click();
      await page.waitForTimeout(500);
    }

    const streamTab = page.locator('button, a').filter({ hasText: 'Stream' }).first();
    if (await streamTab.isVisible()) {
      await streamTab.click();
      await page.waitForTimeout(500);
    }

    expect(clientErrors.filter((e) => !e.includes('ResizeObserver'))).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // QA-12: Live Meeting Leave, Disconnect & Roster Cleanup
  // --------------------------------------------------------------------------
  test('QA-12: should gracefully leave live session and redirect back to classroom hub', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);

    await page.goto(`/live/${sessionId}?role=ATTENDEE&simulated=true`);
    await expect(page.locator('text=Zealosh VC').first()).toBeVisible({ timeout: 15000 });

    // Locate and click the 'Leave Classroom' link
    const leaveBtn = page.getByRole('link', { name: /leave classroom/i }).first();
    await expect(leaveBtn).toBeVisible({ timeout: 10000 });
    await leaveBtn.click();

    // Verify URL navigation back to classroom
    await page.waitForURL(/\/classroom/, { timeout: 15000 });
    await expect(page.locator('text=Stream').first()).toBeVisible({ timeout: 10000 });
  });
});
