// Zealosh LMS — Playwright Real-Browser End-to-End Test Suite
// Task: ZM-IMPL-08F — Track 5: Career Certification Roadmap, Reviews, Gamification & Growth
// File: tests/e2e/career-testimonials-gamification-growth.spec.ts

import { test, expect } from '@playwright/test';
import { injectAuthCookie, adminToken } from './helpers/cms-fixtures';
import { signToken } from '@/lib/auth/jwt';

test.describe('Zealosh ZM-IMPL-08F: Career Roadmap, Testimonials, Gamification & Growth', () => {
  // --------------------------------------------------------------------------
  // TEST 1: Student Career Certification Roadmap Hub (/student/career)
  // --------------------------------------------------------------------------
  test('CTG-01: should render HSE Career Certification Roadmap with milestones and tutor sharing', async ({
    page,
    context,
  }) => {
    // 1. Authenticate as Enrolled Student
    const studentToken = signToken({
      userId: 'usr-student-01',
      email: 'alex.chen@example.com',
      role: 'STUDENT',
      name: 'Alex Chen',
    });
    await injectAuthCookie(context, studentToken);

    // 2. Navigate to /student/career
    await page.goto('/student/career', { waitUntil: 'domcontentloaded' });

    // 3. Verify Page Title and Roadmap Headers
    await expect(page.locator('h1')).toContainText('HSE Career Certification Roadmap');
    await expect(page.getByText('Global HSE Leadership Progression (ASP → CSP → CRSP)')).toBeVisible();

    // 4. Verify Gamification Streak and Points in Header
    await expect(page.getByText('Kolkata Streak')).toBeVisible();
    await expect(page.getByText('Learning XP')).toBeVisible();

    // 5. Verify Progression Stages
    await expect(page.getByText('Stage 1: Associate Safety Professional (ASP)')).toBeVisible();
    await expect(page.getByText('Stage 2: Certified Safety Professional (CSP)')).toBeVisible();
    await expect(page.getByText('Stage 3: Canadian Registered Safety Professional (CRSP)')).toBeVisible();

    // 6. Verify Tutor Sharing Button
    const tutorButton = page.getByRole('button', { name: /Tutor/i });
    await expect(tutorButton).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 2: Admin Testimonials & Reviews Moderation Queue (/admin/testimonials)
  // --------------------------------------------------------------------------
  test('CTG-02: should render Admin Testimonials Moderation Queue with granular consent badges', async ({
    page,
    context,
  }) => {
    // 1. Authenticate as Superadmin
    await injectAuthCookie(context, adminToken);

    // 2. Navigate to /admin/testimonials
    await page.goto('/admin/testimonials', { waitUntil: 'domcontentloaded' });

    // 3. Verify Page Header
    await expect(page.locator('h1')).toContainText('Student Reviews & Testimonials Moderation Queue');
    await expect(
      page.getByText('Enforce granular publication consent, verify enrolled student eligibility')
    ).toBeVisible();

    // 4. Verify Filter Buttons
    await expect(page.getByRole('button', { name: 'ALL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PUBLISHED' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'APPROVED' })).toBeVisible();

    // 5. Verify Granular Student Consent Matrix Indicators
    await expect(page.getByText('Granular Student Consent').first()).toBeVisible();
    await expect(page.getByText('Public Testimonial:').first()).toBeVisible();
    await expect(page.getByText('Display Name:').first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 3: Student Portal Career Roadmap Link & Public Testimonials API
  // --------------------------------------------------------------------------
  test('CTG-03: should link to career roadmap from student dashboard and serve sanitized public testimonials', async ({
    page,
    context,
    request,
  }) => {
    // 1. Test Public Testimonials API (Zero PII leakage)
    const apiRes = await request.get('/api/testimonials/public');
    expect(apiRes.ok()).toBe(true);
    const apiData = await apiRes.json();
    expect(apiData.success).toBe(true);
    expect(apiData.testimonials.length).toBeGreaterThan(0);

    // Ensure no private emails or student user IDs are leaked in public testimonial DTOs
    const firstTestimonial = apiData.testimonials[0];
    expect(firstTestimonial.studentEmail).toBeUndefined();
    expect(firstTestimonial.studentId).toBeUndefined();

    // 2. Authenticate and navigate to student dashboard
    const studentToken = signToken({
      userId: 'usr-student-01',
      email: 'alex.chen@example.com',
      role: 'STUDENT',
      name: 'Alex Chen',
    });
    await injectAuthCookie(context, studentToken);
    await page.goto('/student', { waitUntil: 'domcontentloaded' });

    // 3. Verify Career Roadmap Link exists in Student Dashboard
    const careerLink = page.getByRole('link', { name: /HSE Career Roadmap & Progression/i });
    await expect(careerLink).toBeVisible();
    await careerLink.click();

    // Should navigate cleanly to /student/career
    await page.waitForURL('**/student/career');
    await expect(page.locator('h1')).toContainText('HSE Career Certification Roadmap');
  });
});

