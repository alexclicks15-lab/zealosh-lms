// Zealosh LMS — Tamper-Evident Ed25519 Certificates & Verification Tests
// Milestone: ZM-IMPL-08E — Assessment Intelligence & Credentials
// File: tests/tamper-evident-certificates.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  certificateService,
  inMemoryIssuedCertificates,
  inMemorySigningKeys,
} from '@/lib/credentials/certificate-service';
import { db } from '@/lib/store/db';
import { OrientationService } from '@/lib/orientation/orientation-service';
import { SignedCertificateManifest } from '@/types';

describe('Tamper-Evident Ed25519 Certificates & Verification (ZM-IMPL-08E)', () => {
  const TEST_STUDENT_ID = 'student-cert-test-01';
  const TEST_COURSE_ID = 'course-asp-prep';

  beforeEach(() => {
    inMemoryIssuedCertificates.clear();
    // Seed test enrollment
    db.enrollments.set(`enr-${TEST_STUDENT_ID}-${TEST_COURSE_ID}`, {
      id: `enr-${TEST_STUDENT_ID}-${TEST_COURSE_ID}`,
      userId: TEST_STUDENT_ID,
      courseId: TEST_COURSE_ID,
      batchId: 'batch-01',
      status: 'COMPLETED',
      enrolledAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    } as any);

    // Seed test exam attempt passing score (84%)
    db.examAttempts.set(`attempt-${TEST_STUDENT_ID}`, {
      id: `attempt-${TEST_STUDENT_ID}`,
      userId: TEST_STUDENT_ID,
      courseId: TEST_COURSE_ID,
      certificationType: 'ASP',
      blueprintId: 'bp-asp-01',
      status: 'COMPLETED',
      startTime: new Date().toISOString(),
      deadlineTime: new Date().toISOString(),
      assignedQuestionIds: [],
      answers: {},
      bookmarkedQuestionIds: [],
      score: 84,
      totalScore: 100,
      passingScorePercent: 70,
      passed: true,
    });
  });

  it('CERT-01: Correctly evaluates student eligibility across enrollment, orientation, and exam score', async () => {
    // 1. Fully eligible student
    const evalEligible = await certificateService.evaluateEligibility(TEST_STUDENT_ID, TEST_COURSE_ID);
    expect(evalEligible.eligible).toBe(true);
    expect(evalEligible.enrollmentCompleted).toBe(true);
    expect(evalEligible.orientationAttended).toBe(true);
    expect(evalEligible.examPassed).toBe(true);
    expect(evalEligible.examScorePercent).toBe(84.0);

    // 2. Ineligible student (no enrollment)
    const evalNoEnrollment = await certificateService.evaluateEligibility('stranger-user', TEST_COURSE_ID);
    expect(evalNoEnrollment.eligible).toBe(false);
    expect(evalNoEnrollment.enrollmentCompleted).toBe(false);
    expect(evalNoEnrollment.reasons.some((r) => r.includes('active or completed enrollment'))).toBe(true);

    // 3. Ineligible student (failing exam score < 70%)
    const FAILING_STUDENT = 'student-failing-01';
    db.enrollments.set(`enr-${FAILING_STUDENT}-${TEST_COURSE_ID}`, {
      id: `enr-${FAILING_STUDENT}-${TEST_COURSE_ID}`,
      userId: FAILING_STUDENT,
      courseId: TEST_COURSE_ID,
      batchId: 'batch-01',
      status: 'COMPLETED',
      enrolledAt: new Date().toISOString(),
    } as any);
    db.examAttempts.set(`attempt-${FAILING_STUDENT}`, {
      id: `attempt-${FAILING_STUDENT}`,
      userId: FAILING_STUDENT,
      courseId: TEST_COURSE_ID,
      certificationType: 'ASP',
      blueprintId: 'bp-asp-01',
      status: 'COMPLETED',
      startTime: new Date().toISOString(),
      deadlineTime: new Date().toISOString(),
      assignedQuestionIds: [],
      answers: {},
      bookmarkedQuestionIds: [],
      score: 55,
      totalScore: 100,
      passingScorePercent: 70,
      passed: false,
    });

    const evalFailedScore = await certificateService.evaluateEligibility(FAILING_STUDENT, TEST_COURSE_ID);
    expect(evalFailedScore.eligible).toBe(false);
    expect(evalFailedScore.examPassed).toBe(false);
    expect(evalFailedScore.examScorePercent).toBe(55.0);
    expect(evalFailedScore.reasons.some((r) => r.includes('minimum passing standard'))).toBe(true);
  });

  it('CERT-02: Issues authentic certificate with Ed25519 signature and binary PDF', async () => {
    const { manifest, pdfBuffer, verificationUrl } = await certificateService.issueCertificate({
      studentId: TEST_STUDENT_ID,
      studentName: 'Rahul Menon, B.Tech',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Associate Safety Professional Examination Prep',
      certificationType: 'ASP',
      scorePercent: 88.5,
      issuedBy: 'Director of Academic Affairs',
    });

    expect(manifest).toBeDefined();
    expect(manifest.certificateCode).toMatch(/^ZEI\/EXAM\/2026\/\d+/);
    expect(manifest.issuer).toBe('Zealosh Training & Consultants');
    expect(manifest.studentName).toBe('Rahul Menon, B.Tech');
    expect(manifest.scorePercent).toBe(88.5);
    expect(manifest.signature).toBeDefined();
    expect(manifest.signature.length).toBe(128); // 64 bytes in hex
    expect(manifest.canonicalHash).toBeDefined();

    expect(verificationUrl).toContain(encodeURIComponent(manifest.certificateCode));

    // Verify PDF binary structure
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    const pdfString = pdfBuffer.toString('utf8');
    expect(pdfString.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfString).toContain('ZEALOSH TRAINING & CONSULTANTS');
    expect(pdfString).toContain('OFFICIAL CERTIFICATE OF EXAMINATION & COMPETENCE');
    expect(pdfString).toContain('%ZEALOSH-CREDENTIAL-MANIFEST-START:');
    expect(pdfString).toContain('%%EOF');
  });

  it('CERT-03: Offline verifier validates authentic manifest against public key', async () => {
    const { manifest } = await certificateService.issueCertificate({
      studentId: TEST_STUDENT_ID,
      studentName: 'Ananya Pillai',
      courseId: TEST_COURSE_ID,
      courseTitle: 'CSP Certified Safety Professional Comprehensive',
      certificationType: 'CSP',
      scorePercent: 92.0,
    });

    const verificationResult = certificateService.verifyOffline(manifest);

    expect(verificationResult.valid).toBe(true);
    expect(verificationResult.status).toBe('VALID');
    expect(verificationResult.manifest?.studentName).toBe('Ananya Pillai');
    expect(verificationResult.manifest?.scorePercent).toBe(92.0);
  });

  it('CERT-04: Offline verifier extracts and validates embedded manifest directly from PDF binary buffer', async () => {
    const { pdfBuffer, manifest } = await certificateService.issueCertificate({
      studentId: TEST_STUDENT_ID,
      studentName: 'Vivek S. Nair',
      courseId: TEST_COURSE_ID,
      courseTitle: 'CRSP Canadian Examination Prep',
      certificationType: 'CRSP',
      scorePercent: 86.4,
    });

    // Verify using only raw binary PDF buffer (no manifest object passed)
    const verificationResult = certificateService.verifyOffline(pdfBuffer);

    expect(verificationResult.valid).toBe(true);
    expect(verificationResult.status).toBe('VALID');
    expect(verificationResult.manifest?.certificateCode).toBe(manifest.certificateCode);
    expect(verificationResult.manifest?.studentName).toBe('Vivek S. Nair');
  });

  it('CERT-05: Detects payload tampering (altered student name or score causes verification failure)', async () => {
    const { manifest } = await certificateService.issueCertificate({
      studentId: TEST_STUDENT_ID,
      studentName: 'Genuine Student',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Exam Prep',
      certificationType: 'ASP',
      scorePercent: 75.0,
    });

    // Attacker tampers with student name
    const tamperedNameManifest: SignedCertificateManifest = {
      ...manifest,
      studentName: 'Fraudulent Actor',
    };
    const resultTamperedName = certificateService.verifyOffline(tamperedNameManifest);
    expect(resultTamperedName.valid).toBe(false);
    expect(resultTamperedName.status).toBe('TAMPERED');
    expect(resultTamperedName.error).toContain('Canonical digest mismatch');

    // Attacker tampers with score
    const tamperedScoreManifest: SignedCertificateManifest = {
      ...manifest,
      scorePercent: 99.9,
    };
    const resultTamperedScore = certificateService.verifyOffline(tamperedScoreManifest);
    expect(resultTamperedScore.valid).toBe(false);
    expect(resultTamperedScore.status).toBe('TAMPERED');
  });

  it('CERT-06: Administrative revocation and reissuance with full audit preservation', async () => {
    const { manifest } = await certificateService.issueCertificate({
      studentId: TEST_STUDENT_ID,
      studentName: 'Karthik Raja',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Prep',
      certificationType: 'ASP',
      scorePercent: 78.0,
    });

    const code = manifest.certificateCode;

    // Verify initial online status is ISSUED
    const initialCheck = await certificateService.verifyOnline(code);
    expect(initialCheck.verified).toBe(true);
    expect(initialCheck.status).toBe('ISSUED');

    // Revoke certificate
    await certificateService.revokeCertificate({
      certificateCode: code,
      reason: 'Administrative correction due to re-scored exam rubric',
      revokedBy: 'controller-of-exams',
    });

    const revokedCheck = await certificateService.verifyOnline(code);
    expect(revokedCheck.verified).toBe(false);
    expect(revokedCheck.status).toBe('REVOKED');

    // Reissue certificate
    const reissued = await certificateService.reissueCertificate({
      oldCertificateCode: code,
      newScorePercent: 82.5,
      reissuedBy: 'controller-of-exams',
    });

    expect(reissued.manifest.certificateCode).not.toBe(code);
    expect(reissued.manifest.scorePercent).toBe(82.5);

    // Old certificate is now SUPERSEDED
    const oldCheckAfterReissue = await certificateService.verifyOnline(code);
    expect(oldCheckAfterReissue.status).toBe('SUPERSEDED');

    // New certificate is valid and ISSUED
    const newCheck = await certificateService.verifyOnline(reissued.manifest.certificateCode);
    expect(newCheck.verified).toBe(true);
    expect(newCheck.status).toBe('ISSUED');
  });

  it('CERT-07: Public online verification enforces ZERO PII leakage', async () => {
    const { manifest } = await certificateService.issueCertificate({
      studentId: 'private-internal-user-id-9988',
      studentName: 'Meera Nambiar',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Exam Prep',
      certificationType: 'ASP',
      scorePercent: 89.0,
    });

    const onlineRes = await certificateService.verifyOnline(manifest.certificateCode);

    expect(onlineRes.verified).toBe(true);
    expect(onlineRes.certificate).toBeDefined();

    // Verify allowed public fields
    expect(onlineRes.certificate?.studentName).toBe('Meera Nambiar');
    expect(onlineRes.certificate?.courseTitle).toBe('ASP Exam Prep');
    expect(onlineRes.certificate?.scorePercent).toBe(89.0);

    // ZERO PII LEAKAGE INVARIANTS:
    expect((onlineRes.certificate as any).studentId).toBeUndefined();
    expect((onlineRes.certificate as any).userEmail).toBeUndefined();
    expect((onlineRes.certificate as any).phone).toBeUndefined();
    expect((onlineRes.certificate as any).address).toBeUndefined();
  });
});

