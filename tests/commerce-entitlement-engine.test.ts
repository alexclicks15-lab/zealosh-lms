import { describe, it, expect, beforeEach } from 'vitest';
import { EntitlementService } from '@/lib/commerce/entitlement-service';
import { ProductService } from '@/lib/commerce/product-service';

describe('ZM-IMPL-08C: Server-Authoritative Entitlement Engine & Access Separation', () => {
  beforeEach(() => {
    ProductService.resetForTesting();
    EntitlementService.resetForTesting();
  });

  it('grants and evaluates complete package entitlements granting access to all features', async () => {
    const userId = 'usr-student-complete-01';
    const courseId = 'crs-asp-001';

    const granted = await EntitlementService.grantEntitlementsForOffering({
      userId,
      courseId,
      offeringId: 'offering-asp-complete',
      sourceOrderId: 'ord_test_comp_101',
    });

    expect(granted.length).toBe(1);
    expect(granted[0].featureScope).toBe('ALL');
    expect(granted[0].status).toBe('ACTIVE');

    // Evaluate video lessons
    const videoEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'VIDEO_LESSONS');
    expect(videoEval.hasAccess).toBe(true);
    expect(videoEval.status).toBe('ACTIVE');

    // Evaluate documents
    const docEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'DOCUMENT_LIBRARY');
    expect(docEval.hasAccess).toBe(true);

    // Evaluate live classroom
    const liveEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'LIVE_CLASSROOM');
    expect(liveEval.hasAccess).toBe(true);

    // Evaluate question bank
    const qbankEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'QUESTION_BANK');
    expect(qbankEval.hasAccess).toBe(true);
  });

  it('enforces strict access separation: video-only offering denies document and question bank access', async () => {
    const userId = 'usr-student-video-only';
    const courseId = 'crs-asp-001';

    await EntitlementService.grantEntitlementsForOffering({
      userId,
      courseId,
      offeringId: 'offering-asp-video', // includes only VIDEO_LESSONS
    });

    // Video access is allowed
    const videoEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'VIDEO_LESSONS');
    expect(videoEval.hasAccess).toBe(true);

    // Document library is strictly denied
    const docEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'DOCUMENT_LIBRARY');
    expect(docEval.hasAccess).toBe(false);
    expect(docEval.reason).toContain('is not included in user\'s active entitlements');

    // Question bank is strictly denied
    const qbankEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'QUESTION_BANK');
    expect(qbankEval.hasAccess).toBe(false);

    // Live classroom is strictly denied
    const liveEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'LIVE_CLASSROOM');
    expect(liveEval.hasAccess).toBe(false);
  });

  it('enforces strict access separation: question-bank-only denies live classroom and video access', async () => {
    const userId = 'usr-student-qbank-only';
    const courseId = 'crs-asp-001';

    await EntitlementService.grantEntitlementsForOffering({
      userId,
      courseId,
      offeringId: 'offering-asp-qbank', // includes QUESTION_BANK and MOCK_EXAMS
    });

    // Question bank & Mock exams are allowed
    const qbankEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'QUESTION_BANK');
    expect(qbankEval.hasAccess).toBe(true);

    const mockEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'MOCK_EXAMS');
    expect(mockEval.hasAccess).toBe(true);

    // Video is denied
    const videoEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'VIDEO_LESSONS');
    expect(videoEval.hasAccess).toBe(false);

    // Live classroom is denied
    const liveEval = await EntitlementService.evaluateEntitlement(userId, courseId, 'LIVE_CLASSROOM');
    expect(liveEval.hasAccess).toBe(false);
  });

  it('accurately evaluates expired entitlements', async () => {
    const userId = 'usr-student-expired';
    const courseId = 'crs-asp-001';

    // Grant with a validFrom date 2 years ago
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 2);

    await EntitlementService.grantEntitlementsForOffering({
      userId,
      courseId,
      offeringId: 'offering-asp-video',
      validFrom: pastDate.toISOString(),
    });

    const evalResult = await EntitlementService.evaluateEntitlement(userId, courseId, 'VIDEO_LESSONS');
    expect(evalResult.hasAccess).toBe(false);
    expect(evalResult.status).toBe('EXPIRED');
    expect(evalResult.reason).toContain('expired on');
  });

  it('accurately enforces administrative revocation and suspension', async () => {
    const userId = 'usr-student-revoked';
    const courseId = 'crs-asp-001';

    const granted = await EntitlementService.grantEntitlementsForOffering({
      userId,
      courseId,
      offeringId: 'offering-asp-complete',
    });

    const entitlementId = granted[0].id;

    // Suspend
    await EntitlementService.suspendEntitlement(entitlementId, 'Payment chargeback inquiry');
    let evalResult = await EntitlementService.evaluateEntitlement(userId, courseId, 'VIDEO_LESSONS');
    expect(evalResult.hasAccess).toBe(false);
    expect(evalResult.status).toBe('SUSPENDED');

    // Reactivate
    await EntitlementService.reactivateEntitlement(entitlementId);
    evalResult = await EntitlementService.evaluateEntitlement(userId, courseId, 'VIDEO_LESSONS');
    expect(evalResult.hasAccess).toBe(true);

    // Revoke
    await EntitlementService.revokeEntitlement(entitlementId, 'Terms of service violation');
    evalResult = await EntitlementService.evaluateEntitlement(userId, courseId, 'VIDEO_LESSONS');
    expect(evalResult.hasAccess).toBe(false);
    expect(evalResult.status).toBe('REVOKED');
    expect(evalResult.reason).toContain('Terms of service violation');
  });
});

