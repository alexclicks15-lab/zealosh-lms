// Zealosh LMS — HSE Career Certification Roadmap Test Suite
// File: tests/career-certification-roadmap.test.ts
// Tests Workstream A: Certifications catalogue, multi-stage pathways, student career plans,
// prerequisite evaluation, external exam tracking, evidence verification, and tutor sharing.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  careerPathwayService,
  inMemoryCertifications,
  inMemoryCareerPathways,
  inMemoryStudentCareerPlans,
  inMemoryCredentialEvidence,
} from '@/lib/career/career-pathway-service';
import { db } from '@/lib/store/db';

describe('Zealosh LMS — Workstream A: HSE Career Certification Roadmap Suite', () => {
  const TEST_STUDENT = 'usr-student-roadmap-01';
  const TEST_TUTOR = 'usr-tutor-roadmap-01';
  const OTHER_TUTOR = 'usr-tutor-unauthorized';

  beforeEach(() => {
    inMemoryStudentCareerPlans.clear();
    inMemoryCredentialEvidence.clear();

    // Seed test enrollment
    db.enrollments.set(`enr-${TEST_STUDENT}-crs-asp-01`, {
      id: `enr-${TEST_STUDENT}-crs-asp-01`,
      userId: TEST_STUDENT,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      status: 'COMPLETED',
      enrolledAt: '2026-01-01T00:00:00Z',
    } as any);
  });

  it('ROADMAP-01: Certifications catalogue lists approved designations with verified prerequisites', () => {
    const certs = careerPathwayService.getCertifications();
    expect(certs.length).toBeGreaterThanOrEqual(4);

    const asp = careerPathwayService.getCertification('cert-asp');
    expect(asp).toBeDefined();
    expect(asp?.shortName).toBe('ASP');
    expect(asp?.category).toBe('BCSP');
    expect(asp?.prerequisites.length).toBeGreaterThan(0);
    expect(asp?.status).toBe('PUBLISHED');

    const csp = careerPathwayService.getCertification('cert-csp');
    expect(csp).toBeDefined();
    expect(csp?.prerequisites.some(p => p.prerequisiteCertificationId === 'cert-asp')).toBe(true);
  });

  it('ROADMAP-02: Career pathway progression engine configures multi-stage paths (ASP -> CSP -> CRSP)', () => {
    const pathways = careerPathwayService.getPathways('PUBLISHED');
    expect(pathways.length).toBeGreaterThanOrEqual(1);

    const masterPath = careerPathwayService.getPathway('asp-csp-crsp-progression');
    expect(masterPath).toBeDefined();
    expect(masterPath?.stages.length).toBe(3);

    // Verify stage order and certifications
    expect(masterPath?.stages[0].certificationId).toBe('cert-asp');
    expect(masterPath?.stages[0].stageOrder).toBe(1);
    expect(masterPath?.stages[1].certificationId).toBe('cert-csp');
    expect(masterPath?.stages[1].stageOrder).toBe(2);
    expect(masterPath?.stages[2].certificationId).toBe('cert-crsp');
    expect(masterPath?.stages[2].isOptional).toBe(true);
  });

  it('ROADMAP-03: Student can create and update personalized career plan with target dates and milestones', () => {
    const plan = careerPathwayService.createOrUpdatePlan({
      studentId: TEST_STUDENT,
      pathwayId: 'path-hse-master',
      targetCompletionDate: '2028-12-31',
      notes: 'Targeting Senior Health & Safety Officer promotion.',
    });

    expect(plan.id).toBeDefined();
    expect(plan.studentId).toBe(TEST_STUDENT);
    expect(plan.status).toBe('ACTIVE');
    expect(plan.milestones.length).toBe(3);

    // Update first milestone target date
    const milestoneId = plan.milestones[0].id;
    const updated = careerPathwayService.updateMilestone(TEST_STUDENT, milestoneId, {
      targetDate: '2027-06-30',
      status: 'IN_PROGRESS',
    });

    expect(updated.targetDate).toBe('2027-06-30');
    expect(updated.status).toBe('IN_PROGRESS');
  });

  it('ROADMAP-04: Prerequisite evaluation engine checks real Zealosh course completions and certificates', () => {
    // Stage 1 requires completed Zealosh ASP Prep course ('crs-asp-01')
    const results = careerPathwayService.evaluatePrerequisites(TEST_STUDENT, 'stage-asp-01');
    expect(results.length).toBeGreaterThan(0);

    const coursePrereq = results.find(r => r.type === 'ZEALOSH_COURSE');
    expect(coursePrereq).toBeDefined();
    expect(coursePrereq?.status).toBe('SATISFIED');
    expect(coursePrereq?.evidenceDetails).toContain('Verified course completion');

    // Stage 2 requires ASP external certification, which student has not yet verified
    const stage2Results = careerPathwayService.evaluatePrerequisites(TEST_STUDENT, 'stage-csp-02');
    const aspCertPrereq = stage2Results.find(r => r.type === 'EXTERNAL_CERTIFICATION');
    expect(aspCertPrereq?.status).toBe('EXTERNAL_CONFIRMATION_REQUIRED');
  });

  it('ROADMAP-05: External examination tracking records target dates, booked dates, and attempt status', () => {
    const plan = careerPathwayService.createOrUpdatePlan({
      studentId: TEST_STUDENT,
      pathwayId: 'path-hse-master',
      targetCompletionDate: '2028-12-31',
    });

    const milestoneId = plan.milestones[0].id;
    const examPlan = {
      id: `exam-${Date.now()}`,
      examBody: 'Pearson VUE / BCSP',
      certificationName: 'Associate Safety Professional',
      targetExamDate: '2027-04-15',
      bookedDate: '2027-04-15',
      bookingReference: 'BCSP-PV-98214',
      status: 'BOOKED' as const,
      attemptNumber: 1,
    };

    const updated = careerPathwayService.updateMilestone(TEST_STUDENT, milestoneId, {
      externalExamPlan: examPlan,
    });

    expect(updated.externalExamPlan).toBeDefined();
    expect(updated.externalExamPlan?.status).toBe('BOOKED');
    expect(updated.externalExamPlan?.bookingReference).toBe('BCSP-PV-98214');
  });

  it('ROADMAP-06: External credential evidence submission and reviewer verification queue with rejection reasons', () => {
    const plan = careerPathwayService.createOrUpdatePlan({
      studentId: TEST_STUDENT,
      pathwayId: 'path-hse-master',
      targetCompletionDate: '2028-12-31',
    });
    const milestoneId = plan.milestones[0].id;

    // 1. Submit evidence
    const submitted = careerPathwayService.submitEvidence({
      studentId: TEST_STUDENT,
      milestoneId,
      credentialName: 'BCSP Associate Safety Professional',
      issuingBody: 'Board of Certified Safety Professionals',
      issueDate: '2026-05-10',
      credentialNumber: 'ASP-102948',
    });

    expect(submitted.verificationStatus).toBe('UNDER_REVIEW');

    // 2. Reviewer approves evidence
    const verified = careerPathwayService.reviewEvidence({
      evidenceId: submitted.id,
      reviewerId: 'usr-admin-reviewer',
      decision: 'VERIFIED',
      auditNotes: 'Verified via BCSP Credential Directory registry.',
    });

    expect(verified.verificationStatus).toBe('VERIFIED');
    expect(verified.reviewedBy).toBe('usr-admin-reviewer');

    // Milestone should auto-advance to COMPLETED
    const reloadedPlan = careerPathwayService.getStudentPlan(TEST_STUDENT);
    const ms = reloadedPlan?.milestones.find(m => m.id === milestoneId);
    expect(ms?.status).toBe('COMPLETED');
  });

  it('ROADMAP-07: Tutor sharing: student explicitly shares plan with tutor, tutor provides guidance, unauthorized tutor blocked', () => {
    const plan = careerPathwayService.createOrUpdatePlan({
      studentId: TEST_STUDENT,
      pathwayId: 'path-hse-master',
      targetCompletionDate: '2028-12-31',
    });

    // 1. Student shares with assigned tutor
    const shared = careerPathwayService.sharePlanWithTutor(TEST_STUDENT, TEST_TUTOR);
    expect(shared.sharedWithTutorId).toBe(TEST_TUTOR);

    // 2. Assigned tutor adds guidance
    const guided = careerPathwayService.addTutorGuidance(
      TEST_TUTOR,
      plan.id,
      'Prioritize Chapter 4 Ergonomics formulas before your mock exam.'
    );
    expect(guided.tutorGuidanceNotes).toContain('Ergonomics formulas');

    // 3. Unauthorized tutor attempt is rejected with Error
    expect(() => {
      careerPathwayService.addTutorGuidance(OTHER_TUTOR, plan.id, 'Spam notes');
    }).toThrow(/Unauthorized/);

    // 4. Student revokes sharing
    const revoked = careerPathwayService.revokeTutorSharing(TEST_STUDENT);
    expect(revoked.sharedWithTutorId).toBeUndefined();
  });
});

