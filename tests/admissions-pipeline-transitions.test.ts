import { describe, it, expect, beforeEach } from 'vitest';
import { AdmissionsPipelineService } from '@/lib/admissions/admissions-pipeline';
import { db } from '@/lib/store/db';

describe('ZM-IMPL-08C: 14-Stage Admissions Pipeline & Document Management', () => {
  beforeEach(async () => {
    AdmissionsPipelineService.resetForTesting();
    db.admissionApplications.clear();
    db.applicationDocuments.clear();
  });

  it('progresses an application through valid lifecycle stages', async () => {
    const app = await db.createAdmissionApplication({
      applicantName: 'Fahad Al-Mansoori',
      applicantEmail: 'fahad@adnoc.ae',
      courseId: 'crs-asp-01',
      statementOfPurpose: 'Seeking BCSP ASP designation for offshore refinery lead safety role.',
    });

    expect(app.id).toBeDefined();

    // 1. Transition to DOCUMENT_REVIEW
    const stage1 = await AdmissionsPipelineService.transitionStage({
      applicationId: app.id,
      targetStage: 'DOCUMENT_REVIEW',
      actorUserId: 'usr-admin-01',
      reason: 'Applicant submitted initial documentation package',
    });
    expect(stage1.status).toBe('DOCUMENT_REVIEW');
    expect(stage1.stageHistory?.length).toBe(1);

    // 2. Transition to ELIGIBILITY_REVIEW
    const stage2 = await AdmissionsPipelineService.transitionStage({
      applicationId: app.id,
      targetStage: 'ELIGIBILITY_REVIEW',
      actorUserId: 'usr-admin-01',
    });
    expect(stage2.status).toBe('ELIGIBILITY_REVIEW');

    // 3. Transition to APPROVED
    const stage3 = await AdmissionsPipelineService.transitionStage({
      applicationId: app.id,
      targetStage: 'APPROVED',
      actorUserId: 'usr-admin-01',
      reason: 'Qualifications and experience verified',
    });
    expect(stage3.status).toBe('APPROVED');
  });

  it('strictly rejects invalid stage transitions under standard state machine rules', async () => {
    const app = await db.createAdmissionApplication({
      applicantName: 'Invalid Jump Applicant',
      applicantEmail: 'jump@test.com',
      courseId: 'crs-asp-01',
    });

    // Attempt illegal jump directly from SUBMITTED to ADMITTED without review/offer
    await expect(
      AdmissionsPipelineService.transitionStage({
        applicationId: app.id,
        targetStage: 'ADMITTED',
        actorUserId: 'usr-admin-01',
      })
    ).rejects.toThrow(/INVALID_STAGE_TRANSITION/);
  });

  it('allows manual administrative overrides only with a mandatory detailed audit reason', async () => {
    const app = await db.createAdmissionApplication({
      applicantName: 'Executive Candidate',
      applicantEmail: 'exec@petroleum.com',
      courseId: 'crs-asp-01',
    });

    // Attempt override without explanation -> rejects
    await expect(
      AdmissionsPipelineService.transitionStage({
        applicationId: app.id,
        targetStage: 'ADMITTED',
        actorUserId: 'usr-superadmin',
        isOverride: true,
        reason: 'short', // less than 10 characters
      })
    ).rejects.toThrow(/OVERRIDE_REASON_MANDATORY/);

    // Override with valid explanation -> succeeds
    const overridden = await AdmissionsPipelineService.transitionStage({
      applicationId: app.id,
      targetStage: 'ADMITTED',
      actorUserId: 'usr-superadmin',
      isOverride: true,
      reason: 'Authorized institutional executive sponsorship with external verification',
    });

    expect(overridden.status).toBe('ADMITTED');
    expect(overridden.stageHistory?.[0].reason).toContain('[ADMIN_OVERRIDE]');
  });

  it('verifies applicant documents and preserves historical audit trail on document replacement', async () => {
    const app = await db.createAdmissionApplication({
      applicantName: 'Document Test Candidate',
      applicantEmail: 'docs@test.com',
      courseId: 'crs-asp-01',
    });

    const initialDoc = await db.addApplicationDocument({
      applicationId: app.id,
      documentType: 'QUALIFICATION_CERTIFICATE',
      filename: 'degree_btech_safety.pdf',
      storagePath: 'applicants/docs/degree_v1.pdf',
    });

    expect(initialDoc.version).toBeUndefined(); // default v1

    // Verify document
    const verified = await AdmissionsPipelineService.verifyDocument(initialDoc.id, 'usr-staff-reviewer');
    expect(verified.status).toBe('VERIFIED');
    expect(verified.isVerified).toBe(true);
    expect(verified.reviewerUserId).toBe('usr-staff-reviewer');

    // Replace document with higher quality scan
    const replaced = await AdmissionsPipelineService.replaceDocument({
      oldDocumentId: initialDoc.id,
      filename: 'degree_btech_safety_highres.pdf',
      storagePath: 'applicants/docs/degree_v2.pdf',
    });

    expect(replaced.version).toBe(2);
    expect(replaced.status).toBe('UPLOADED');

    // Previous document is marked SUPERSEDED and retained
    const oldDoc = db.applicationDocuments.get(initialDoc.id);
    expect(oldDoc?.status).toBe('SUPERSEDED');
  });

  it('issues admission offers with price snapshot and validity window', async () => {
    const app = await db.createAdmissionApplication({
      applicantName: 'Offer Applicant',
      applicantEmail: 'offer@test.com',
      courseId: 'crs-asp-01',
    });

    // Advance to APPROVED
    await AdmissionsPipelineService.transitionStage({
      applicationId: app.id,
      targetStage: 'DOCUMENT_REVIEW',
      actorUserId: 'usr-admin',
    });
    await AdmissionsPipelineService.transitionStage({
      applicationId: app.id,
      targetStage: 'ELIGIBILITY_REVIEW',
      actorUserId: 'usr-admin',
    });
    await AdmissionsPipelineService.transitionStage({
      applicationId: app.id,
      targetStage: 'APPROVED',
      actorUserId: 'usr-admin',
    });

    const offer = await AdmissionsPipelineService.issueAdmissionOffer({
      applicationId: app.id,
      courseId: 'crs-asp-01',
      offeringId: 'offering-asp-complete',
      offeredPriceInr: 25000,
      validityDays: 10,
      issuedBy: 'usr-admissions-director',
    });

    expect(offer.id).toMatch(/^offer-/);
    expect(offer.offeredPriceInr).toBe(25000);
    expect(offer.status).toBe('ISSUED');

    // Application is automatically moved to OFFER_PAYMENT_PENDING
    const updatedApp = await db.getAdmissionApplication(app.id);
    expect(updatedApp?.status).toBe('OFFER_PAYMENT_PENDING');
  });
});
