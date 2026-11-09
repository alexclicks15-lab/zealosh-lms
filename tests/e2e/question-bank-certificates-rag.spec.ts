// Zealosh LMS — Playwright Real-Browser End-to-End Test Suite
// Task: ZM-IMPL-08E — Central Question Bank, Tamper-Evident Certificates & Vector RAG Ingestion
// File: tests/e2e/question-bank-certificates-rag.spec.ts

import { test, expect } from '@playwright/test';
import { injectAuthCookie, adminToken } from './helpers/cms-fixtures';
import { signToken } from '@/lib/auth/jwt';

test.describe('Zealosh ZM-IMPL-08E: Question Bank, Certificates & Vector RAG', () => {
  // --------------------------------------------------------------------------
  // TEST 1: Admin Question Bank & Psychometrics Inspector (/admin/questions)
  // --------------------------------------------------------------------------
  test('QCR-01: should render Question Bank Workspace with Item Analytics and authoring modal', async ({
    page,
    context,
  }) => {
    // 1. Authenticate as Superadmin
    await injectAuthCookie(context, adminToken);

    // 2. Navigate to /admin/questions
    await page.goto('/admin/questions', { waitUntil: 'domcontentloaded' });

    // 3. Verify Page Title & Subtitle
    await expect(page.locator('h1')).toContainText('Central Question Bank & Item Analytics');
    await expect(
      page.getByText('Authoritative, version-controlled repository of institutional examination questions')
    ).toBeVisible();

    // 4. Verify Metric Cards
    await expect(page.getByText('Total Question Items')).toBeVisible();
    await expect(page.getByText('Published & Live')).toBeVisible();
    await expect(page.getByText('In Review / Draft')).toBeVisible();
    await expect(page.getByText('Psychometric Integrity')).toBeVisible();

    // 5. Verify Authoring Modal trigger
    const authorButton = page.getByRole('button', { name: 'Author New Question' });
    await expect(authorButton).toBeVisible();
    await authorButton.click();

    // Verify modal appears
    await expect(page.getByText('Author New Question Bank Item')).toBeVisible();
    await expect(page.getByText('Certification Programme')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Draft Question' })).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Author New Question Bank Item')).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 2: Public Certificate Verification Portal (/verify/[code])
  // --------------------------------------------------------------------------
  test('QCR-02: should verify authentic certificate with Ed25519 badge and zero PII leakage', async ({
    page,
  }) => {
    // 1. Visit public verification page for seeded certificate BCSP-ASP-2026-08912
    await page.goto('/verify/BCSP-ASP-2026-08912', { waitUntil: 'domcontentloaded' });

    // 2. Verify status banner
    await expect(page.locator('h1')).toContainText('Valid & Verified Certificate');
    await expect(page.getByText('Code: BCSP-ASP-2026-08912')).toBeVisible();

    // 3. Verify Cryptographic Signature Badge
    await expect(page.getByText('Cryptographically Signed via Ed25519')).toBeVisible();

    // 4. Verify Student Name & Score
    await expect(page.getByText('Arjun Menon')).toBeVisible();
    await expect(page.getByText('92% Score on Comprehensive Examination')).toBeVisible();
    await expect(page.getByText('Associate Safety Professional (ASP) Comprehensive Prep')).toBeVisible();

    // 5. STRICT ZERO PII LEAKAGE CHECK
    // Ensure email is NEVER displayed in the document
    await expect(page.locator('text=arjun.menon@example.com')).toHaveCount(0);
    await expect(page.locator('text=usr-student-01')).toHaveCount(0);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Student Portal Certificate Card & PDF Download (/student)
  // --------------------------------------------------------------------------
  test('QCR-03: should display verified certificates with PDF download and verification link', async ({
    page,
    context,
  }) => {
    // 1. Authenticate as Seeded Certified Student (Arjun Menon, usr-student-01)
    const seededStudentToken = signToken({
      userId: 'usr-student-01',
      email: 'arjun.menon@example.com',
      role: 'STUDENT',
      name: 'Arjun Menon',
    });
    await injectAuthCookie(context, seededStudentToken);

    // 2. Navigate to student portal
    await page.goto('/student', { waitUntil: 'domcontentloaded' });

    // 3. Verify student certificate section exists
    await expect(page.getByText('Earned Accreditations & Verified Certificates')).toBeVisible();

    // 4. Verify Certificate card actions
    const verifyLink = page.getByRole('link', { name: 'Verify' }).first();
    await expect(verifyLink).toBeVisible();

    const pdfButton = page.getByRole('link', { name: 'PDF' }).first();
    await expect(pdfButton).toBeVisible();
  });
});
