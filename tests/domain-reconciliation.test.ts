// tests/domain-reconciliation.test.ts
// Vitest suite for Zealosh Domain Reconciliation & State Drift Detection Engine

import { describe, it, expect, beforeEach } from 'vitest';
import { reconciliationEngine } from '@/lib/events/reconciliation-engine';
import { db } from '@/lib/store/db';
import { PaymentOrder, ExamAttempt, CertificateRecord } from '@/types';

describe('Zealosh Domain Reconciliation & State Drift Engine', () => {
  beforeEach(() => {
    // Reset or clean maps where appropriate
  });

  it('detects mismatch when paid order lacks active entitlement, and safely repairs via SYNC_PROJECTION', async () => {
    const orderId = `ord-rec-test-${Date.now()}`;
    const userId = `usr-rec-${Date.now()}`;
    const courseId = 'course-rec-101';

    const testOrder: PaymentOrder = {
      id: orderId,
      userId,
      userEmail: 'rec-user@example.com',
      userName: 'Rec User',
      courseId,
      batchId: 'batch-rec-01',
      offeringId: 'OFFERING_FULL',
      amount: 4999,
      currency: 'INR',
      status: 'PAID',
      gateway: 'RAZORPAY',
      createdAt: new Date().toISOString(),
    };
    (db as any).paymentOrders.set(orderId, testOrder);

    // Initial check: no entitlement exists for this user and course
    const runs = await reconciliationEngine.runReconciliation({
      ruleName: 'RULE_ORDERS_ENTITLEMENTS',
    });

    expect(runs).toHaveLength(1);
    const run = runs[0];
    expect(run.ruleName).toBe('RULE_ORDERS_ENTITLEMENTS');
    expect(run.status).toBe('COMPLETED');
    expect(run.mismatchCount).toBeGreaterThanOrEqual(1);

    // Fetch the reconciliation results for this run
    const results = await db.getReconciliationResults(run.id);
    const orderResult = results.find((r) => r.sourceId === orderId);
    expect(orderResult).toBeDefined();
    expect(orderResult?.status).toBe('MISMATCH');
    expect(orderResult?.suggestedAction).toBe('SYNC_PROJECTION');

    // Repair projection using resolveResult
    const resolveRes = await reconciliationEngine.resolveResult(
      orderResult!.id,
      'admin-ops-user',
      'SYNC_PROJECTION',
      'Authorized automatic backfill of student entitlement'
    );
    expect(resolveRes.success).toBe(true);

    // Verify entitlement now exists in db
    const entitlement = await db.getUserEntitlement(userId, courseId);
    expect(entitlement).toBeDefined();
    expect(entitlement.status).toBe('ACTIVE');

    // Re-run reconciliation; this order should now match
    const secondRuns = await reconciliationEngine.runReconciliation({
      ruleName: 'RULE_ORDERS_ENTITLEMENTS',
    });
    const secondResults = await db.getReconciliationResults(secondRuns[0].id);
    const secondOrderResult = secondResults.find((r) => r.sourceId === orderId);
    expect(secondOrderResult?.status).toBe('MATCHED');
  });

  it('detects mismatch for admitted applications without active cohort enrollment', async () => {
    const appId = `app-rec-test-${Date.now()}`;
    const userId = `usr-adm-${Date.now()}`;
    const courseId = 'course-hse-lead';

    const testApp = {
      id: appId,
      userId,
      courseId,
      status: 'ADMITTED',
      stage: 'ADMITTED',
      createdAt: new Date().toISOString(),
    };
    (db as any).admissionApplications.set(appId, testApp);

    const runs = await reconciliationEngine.runReconciliation({
      ruleName: 'RULE_ADMISSIONS_ENROLLMENTS',
    });
    expect(runs).toHaveLength(1);
    const run = runs[0];
    expect(run.mismatchCount).toBeGreaterThanOrEqual(1);

    const results = await db.getReconciliationResults(run.id);
    const appResult = results.find((r) => r.sourceId === appId);
    expect(appResult).toBeDefined();
    expect(appResult?.status).toBe('MISMATCH');
    expect(appResult?.suggestedAction).toBe('REPLAY_OUTBOX');

    // Provide active enrollment
    const enrollmentId = `enr-rec-${Date.now()}`;
    (db as any).enrollments.set(enrollmentId, {
      id: enrollmentId,
      userId,
      courseId,
      status: 'ACTIVE',
      enrolledAt: new Date().toISOString(),
    });

    // Re-run reconciliation
    const rerun = await reconciliationEngine.runReconciliation({
      ruleName: 'RULE_ADMISSIONS_ENROLLMENTS',
    });
    const rerunResults = await db.getReconciliationResults(rerun[0].id);
    const resolvedAppResult = rerunResults.find((r) => r.sourceId === appId);
    expect(resolvedAppResult?.status).toBe('MATCHED');
  });

  it('detects mismatch for passed exam attempts lacking issued certificates', async () => {
    const attemptId = `att-rec-test-${Date.now()}`;
    const studentId = `usr-passed-${Date.now()}`;
    const examId = 'exam-osha-30';

    const passingAttempt: ExamAttempt = {
      id: attemptId,
      userId: studentId,
      examId,
      status: 'COMPLETED',
      score: 88,
      scorePercent: 88,
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      submittedAt: new Date().toISOString(),
    } as any;
    (db as any).examAttempts.set(attemptId, passingAttempt);

    const runs = await reconciliationEngine.runReconciliation({
      ruleName: 'RULE_EXAMS_CERTIFICATES',
    });
    expect(runs).toHaveLength(1);
    const run = runs[0];
    expect(run.mismatchCount).toBeGreaterThanOrEqual(1);

    const results = await db.getReconciliationResults(run.id);
    const examResult = results.find((r) => r.sourceId === attemptId);
    expect(examResult).toBeDefined();
    expect(examResult?.status).toBe('MISMATCH');

    // Add issued certificate for this attempt
    const certId = `cert-rec-${Date.now()}`;
    const cert: CertificateRecord = {
      id: certId,
      certificateCode: `ZEAL-REC-${Date.now()}`,
      examAttemptId: attemptId,
      studentId,
      courseId: examId,
      issueDate: new Date().toISOString(),
      status: 'ISSUED',
    } as any;
    (db as any).certificates.set(certId, cert);

    // Re-run reconciliation
    const rerun = await reconciliationEngine.runReconciliation({
      ruleName: 'RULE_EXAMS_CERTIFICATES',
    });
    const rerunResults = await db.getReconciliationResults(rerun[0].id);
    const resolvedExamResult = rerunResults.find((r) => r.sourceId === attemptId);
    expect(resolvedExamResult?.status).toBe('MATCHED');
  });

  it('executes a full multi-rule reconciliation sweep when no ruleName option is provided', async () => {
    const allRuns = await reconciliationEngine.runReconciliation();
    expect(allRuns).toHaveLength(3);
    const ruleNames = allRuns.map((r) => r.ruleName);
    expect(ruleNames).toContain('RULE_ORDERS_ENTITLEMENTS');
    expect(ruleNames).toContain('RULE_ADMISSIONS_ENROLLMENTS');
    expect(ruleNames).toContain('RULE_EXAMS_CERTIFICATES');
    expect(allRuns.every((r) => r.status === 'COMPLETED')).toBe(true);
  });
});
