// Zealosh LMS — Phase 6 Advanced Academic Workflows Real Browser E2E Test Suite
// Task: ZM-IMPL-05A — Verification of Progression, Interventions & AI Seams
// Uses real headless Chrome via Playwright with authenticated instructor & student sessions.

import { test, expect } from '@playwright/test';
import { injectAuthCookie, studentToken, instructorToken } from './helpers/cms-fixtures';

test.describe('Zealosh Phase 6: Advanced Academic Workflows & Enterprise Scale (P6-01 to P6-04)', () => {
  // --------------------------------------------------------------------------
  // P6-E2E-01: Instructor Cohort Interventions & At-Risk Diagnostics (/instructor)
  // --------------------------------------------------------------------------
  test('P6-E2E-01: should render instructor cohort interventions tab and at-risk candidate roster', async ({ page, context }) => {
    await injectAuthCookie(context, instructorToken);
    await page.goto('/instructor');

    // Wait for instructor dashboard header
    await expect(
      page.locator('text=Zealosh Faculty Workspace').or(page.locator('h1')).first()
    ).toBeVisible({ timeout: 15000 });

    // Navigate to Cohort Interventions tab
    const interventionsTab = page.locator('button').filter({ hasText: /Cohort Interventions/i }).first();
    await expect(interventionsTab).toBeVisible();
    await interventionsTab.click();

    // Verify Interventions header
    await expect(
      page.locator('h2').filter({ hasText: /Cohort Academic Interventions/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // Verify 4 metric cards are displayed
    await expect(page.locator('text=Enrolled Candidates').first()).toBeVisible();
    await expect(page.locator('text=At-Risk Candidates').first()).toBeVisible();
    await expect(page.locator('text=Active Interventions').first()).toBeVisible();
    await expect(page.locator('text=Resolved Cases').first()).toBeVisible();

    // Verify At-Risk roster section
    await expect(
      page.locator('h3').filter({ hasText: /At-Risk Candidates Requiring Attention/i }).first()
    ).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // P6-E2E-02: Instructor Grading Queue & AI Formative Review Seam
  // --------------------------------------------------------------------------
  test('P6-E2E-02: should render AI formative review trigger with human faculty sign-off enforcement', async ({ page, context }) => {
    await injectAuthCookie(context, instructorToken);
    await page.goto('/instructor');

    // Navigate to Grading tab
    const gradingTab = page.locator('button').filter({ hasText: /Submitted Coursework|Grading/i }).first();
    await expect(gradingTab).toBeVisible({ timeout: 15000 });
    await gradingTab.click();

    // Verify AI Formative Review panel
    await expect(
      page.locator('text=Zealosh AI Formative Rubric Review').first()
    ).toBeVisible({ timeout: 5000 });

    // Verify faculty sign-off badge
    await expect(
      page.locator('text=Faculty Sign-Off Enforced').first()
    ).toBeVisible();

    // Verify trigger button exists
    const aiReviewBtn = page.locator('button').filter({ hasText: /Generate Formative Suggestion/i }).first();
    await expect(aiReviewBtn).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // P6-E2E-03: Learner Classroom — Course Progression & Exam Eligibility
  // --------------------------------------------------------------------------
  test('P6-E2E-03: should render candidate syllabus progression breakdown and exam eligibility gate', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);
    await page.goto('/learn/asp-examination-prep');

    // Wait for classroom player or title
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });

    // Click Course Progression tab
    const progressionTab = page.locator('button').filter({ hasText: /Course Progression/i }).first();
    await expect(progressionTab).toBeVisible({ timeout: 10000 });
    await progressionTab.click();

    // Verify Curriculum Progression header
    await expect(
      page.locator('h3').filter({ hasText: /Curriculum Progression & Exam Eligibility/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // Verify Exam Eligibility badge (either locked or eligible)
    const examBadge = page.locator('text=Exam Locked: Requires 80%+ Syllabus Completion')
      .or(page.locator('text=Certification Exam Eligible'))
      .first();
    await expect(examBadge).toBeVisible();

    // Verify Overall Completion progress bar label
    await expect(page.locator('text=Overall Syllabus Completion').first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // P6-E2E-04: Learner Classroom — Course-Grounded AI Tutor Assistant (ADR-003)
  // --------------------------------------------------------------------------
  test('P6-E2E-04: should render course-grounded AI tutor drawer with syllabus citations and ADR-003 firewall', async ({ page, context }) => {
    await injectAuthCookie(context, studentToken);
    await page.goto('/learn/asp-examination-prep');

    // Click AI Tutor Assistant tab
    const tutorTab = page.locator('button').filter({ hasText: /AI Tutor Assistant/i }).first();
    await expect(tutorTab).toBeVisible({ timeout: 10000 });
    await tutorTab.click();

    // Verify AI Tutor header
    await expect(
      page.locator('h3').filter({ hasText: /Zealosh AI Curriculum Assistant/i }).first()
    ).toBeVisible({ timeout: 5000 });

    // Verify ADR-003 compliance notice
    await expect(
      page.locator('text=Course-Grounded Context & Integrity Firewall:').first()
    ).toBeVisible();

    // Verify input field and Ask AI button
    const input = page.locator('input[placeholder*="Ask a question about this course"]');
    await expect(input).toBeVisible();

    const askBtn = page.locator('button').filter({ hasText: /Ask AI/i }).first();
    await expect(askBtn).toBeVisible();

    // Submit a query
    await input.fill('What are the minimum ventilation velocity requirements?');
    await askBtn.click();

    // Verify that a response bubble appears
    await expect(
      page.locator('text=Candidate Query').first()
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('text=Zealosh AI Assistant').first()
    ).toBeVisible({ timeout: 15000 });
  });
});
