// Zealosh LMS — Domain Reconciliation & State Drift Detection Engine
// Path: src/lib/events/reconciliation-engine.ts
// Detects state drift between authoritative records and downstream projections,
// reporting mismatches and providing safe projection repair actions.

import crypto from 'crypto';
import { db } from '@/lib/store/db';
import {
  ReconciliationRun,
  ReconciliationResult,
  ReconciliationStatus,
} from '@/types';

export interface RunReconciliationOptions {
  ruleName?: string;
}

export class ReconciliationEngine {
  /**
   * Executes domain reconciliation sweeps across authoritative domains and consumer projections
   */
  public async runReconciliation(
    options?: RunReconciliationOptions
  ): Promise<ReconciliationRun[]> {
    const runs: ReconciliationRun[] = [];

    if (!options?.ruleName || options.ruleName === 'RULE_ORDERS_ENTITLEMENTS') {
      runs.push(await this.reconcileOrdersAndEntitlements());
    }

    if (!options?.ruleName || options.ruleName === 'RULE_ADMISSIONS_ENROLLMENTS') {
      runs.push(await this.reconcileAdmissionsAndEnrollments());
    }

    if (!options?.ruleName || options.ruleName === 'RULE_EXAMS_CERTIFICATES') {
      runs.push(await this.reconcileExamsAndCertificates());
    }

    return runs;
  }

  /**
   * Rule 1: Verifies that every PAID payment order has corresponding active user entitlements
   */
  private async reconcileOrdersAndEntitlements(): Promise<ReconciliationRun> {
    const runId = `rec-run-orders-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const startTime = new Date().toISOString();

    const run: ReconciliationRun = {
      id: runId,
      ruleName: 'RULE_ORDERS_ENTITLEMENTS',
      sourceDomain: 'COMMERCE',
      targetDomain: 'ENTITLEMENTS',
      checkedCount: 0,
      mismatchCount: 0,
      status: 'RUNNING',
      startedAt: startTime,
    };
    await db.saveReconciliationRun(run);

    const paidOrders = await db.getPaidPaymentOrders();
    const results: ReconciliationResult[] = [];
    let mismatches = 0;

    for (const order of paidOrders) {
      run.checkedCount++;
      const entitlement = await db.getUserEntitlement(order.userId, order.courseId);

      if (!entitlement || entitlement.status !== 'ACTIVE') {
        mismatches++;
        results.push({
          id: `res-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          runId,
          ruleName: 'RULE_ORDERS_ENTITLEMENTS',
          sourceId: order.id,
          targetId: entitlement?.id,
          status: 'MISMATCH',
          details: `Paid order '${order.id}' by user '${order.userId}' missing active entitlement for course '${order.courseId}'.`,
          suggestedAction: 'SYNC_PROJECTION',
        });
      } else {
        results.push({
          id: `res-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          runId,
          ruleName: 'RULE_ORDERS_ENTITLEMENTS',
          sourceId: order.id,
          targetId: entitlement.id,
          status: 'MATCHED',
          details: `Order '${order.id}' has verified active entitlement '${entitlement.id}'.`,
          suggestedAction: 'EXEMPT',
        });
      }
    }

    run.mismatchCount = mismatches;
    run.status = 'COMPLETED';
    run.completedAt = new Date().toISOString();

    await db.saveReconciliationResults(results);
    await db.updateReconciliationRun(run.id, run);

    return run;
  }

  /**
   * Rule 2: Verifies that every ADMITTED applicant has an active cohort enrollment record
   */
  private async reconcileAdmissionsAndEnrollments(): Promise<ReconciliationRun> {
    const runId = `rec-run-admissions-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const startTime = new Date().toISOString();

    const run: ReconciliationRun = {
      id: runId,
      ruleName: 'RULE_ADMISSIONS_ENROLLMENTS',
      sourceDomain: 'ADMISSIONS',
      targetDomain: 'ACADEMIC',
      checkedCount: 0,
      mismatchCount: 0,
      status: 'RUNNING',
      startedAt: startTime,
    };
    await db.saveReconciliationRun(run);

    const admittedApps = await db.getAdmittedApplications();
    const results: ReconciliationResult[] = [];
    let mismatches = 0;

    for (const app of admittedApps) {
      run.checkedCount++;
      const enrollment = await db.getEnrollmentByUserAndCourse(app.userId, app.courseId);

      if (!enrollment || enrollment.status !== 'ACTIVE') {
        mismatches++;
        results.push({
          id: `res-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          runId,
          ruleName: 'RULE_ADMISSIONS_ENROLLMENTS',
          sourceId: app.id,
          targetId: enrollment?.id,
          status: 'MISMATCH',
          details: `Admitted application '${app.id}' for student '${app.userId}' has no active enrollment in course '${app.courseId}'.`,
          suggestedAction: 'REPLAY_OUTBOX',
        });
      } else {
        results.push({
          id: `res-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          runId,
          ruleName: 'RULE_ADMISSIONS_ENROLLMENTS',
          sourceId: app.id,
          targetId: enrollment.id,
          status: 'MATCHED',
          details: `Admitted application '${app.id}' correctly backed by enrollment '${enrollment.id}'.`,
          suggestedAction: 'EXEMPT',
        });
      }
    }

    run.mismatchCount = mismatches;
    run.status = 'COMPLETED';
    run.completedAt = new Date().toISOString();

    await db.saveReconciliationResults(results);
    await db.updateReconciliationRun(run.id, run);

    return run;
  }

  /**
   * Rule 3: Verifies that passing exam attempts have corresponding certificate records
   */
  private async reconcileExamsAndCertificates(): Promise<ReconciliationRun> {
    const runId = `rec-run-exams-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const startTime = new Date().toISOString();

    const run: ReconciliationRun = {
      id: runId,
      ruleName: 'RULE_EXAMS_CERTIFICATES',
      sourceDomain: 'ASSESSMENT',
      targetDomain: 'CREDENTIALS',
      checkedCount: 0,
      mismatchCount: 0,
      status: 'RUNNING',
      startedAt: startTime,
    };
    await db.saveReconciliationRun(run);

    const passedAttempts = await db.getPassingExamAttempts();
    const results: ReconciliationResult[] = [];
    let mismatches = 0;

    for (const attempt of passedAttempts) {
      run.checkedCount++;
      const cert = await db.getCertificateByExamAttempt(attempt.id);

      if (!cert) {
        mismatches++;
        results.push({
          id: `res-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          runId,
          ruleName: 'RULE_EXAMS_CERTIFICATES',
          sourceId: attempt.id,
          status: 'MISMATCH',
          details: `Passed attempt '${attempt.id}' (score: ${(attempt as any).scorePercent || (attempt as any).score || 0}%) by student '${attempt.userId}' missing certificate record.`,
          suggestedAction: 'SYNC_PROJECTION',
        });
      } else {
        results.push({
          id: `res-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          runId,
          ruleName: 'RULE_EXAMS_CERTIFICATES',
          sourceId: attempt.id,
          targetId: cert.id,
          status: 'MATCHED',
          details: `Passed attempt '${attempt.id}' has issued certificate '${cert.certificateCode}'.`,
          suggestedAction: 'EXEMPT',
        });
      }
    }

    run.mismatchCount = mismatches;
    run.status = 'COMPLETED';
    run.completedAt = new Date().toISOString();

    await db.saveReconciliationResults(results);
    await db.updateReconciliationRun(run.id, run);

    return run;
  }

  /**
   * Resolves a reconciliation mismatch with an approved repair action
   */
  public async resolveResult(
    resultId: string,
    actorUserId: string,
    action: 'SYNC_PROJECTION' | 'REPLAY_OUTBOX' | 'MANUAL_REVIEW' | 'EXEMPT',
    notes: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await db.getReconciliationResultById(resultId);
      if (!result) return { success: false, error: 'Reconciliation result not found.' };

      if (action === 'SYNC_PROJECTION') {
        if (result.ruleName === 'RULE_ORDERS_ENTITLEMENTS') {
          const order = await db.getPaymentOrder(result.sourceId);
          if (order) {
            await db.grantEntitlementAtomic(order.userId, order.courseId, order.offeringId || 'COMPLETE');
          }
        }
      }

      await db.updateReconciliationResult(resultId, {
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        resolvedBy: actorUserId,
        resolutionNotes: notes,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const reconciliationEngine = new ReconciliationEngine();
