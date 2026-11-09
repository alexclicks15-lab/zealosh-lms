import { describe, it, expect, beforeEach } from 'vitest';
import { ProvisioningOrchestrator } from '@/lib/admissions/provisioning-orchestrator';
import { db } from '@/lib/store/db';

describe('ZM-IMPL-08C: Resumable Post-Admission Provisioning Saga Orchestrator', () => {
  beforeEach(async () => {
    ProvisioningOrchestrator.resetForTesting();
  });

  it('executes all 10 sequential provisioning steps to completion for an admitted student', async () => {
    const student = await db.getUser('usr-student-01');
    expect(student).toBeDefined();

    const result = await ProvisioningOrchestrator.executeProvisioningJob({
      userId: student!.id,
      userEmail: student!.email,
      courseId: 'crs-asp-001',
      batchId: 'btc-asp-weekday',
      offeringId: 'offering-asp-complete',
      idempotencyKey: 'idemp_test_full_saga_001',
    });

    expect(result.job.status).toBe('SUCCEEDED');
    expect(result.job.attemptCount).toBe(1);
    expect(result.steps.length).toBe(10);

    // Verify all 10 steps are SUCCEEDED
    for (const step of result.steps) {
      expect(step.status).toBe('SUCCEEDED');
      expect(step.completedAt).toBeDefined();
    }

    // Verify individual step outputs
    const identityStep = result.steps.find((s) => s.stepName === 'RESOLVE_IDENTITY');
    expect(identityStep?.outputPayload.resolvedUserId).toBe(student!.id);

    const enrollmentStep = result.steps.find((s) => s.stepName === 'CREATE_ENROLLMENT');
    expect(enrollmentStep?.outputPayload.enrollmentId).toBeDefined();

    const entitlementStep = result.steps.find((s) => s.stepName === 'GRANT_ENTITLEMENTS');
    expect(entitlementStep?.outputPayload.entitlementsGranted).toBeGreaterThanOrEqual(1);
  });

  it('guarantees idempotency: re-running with the same idempotencyKey returns existing job without re-executing', async () => {
    const student = await db.getUser('usr-student-01');
    const key = 'idemp_duplicate_prevention_99';

    const run1 = await ProvisioningOrchestrator.executeProvisioningJob({
      userId: student!.id,
      courseId: 'crs-asp-001',
      idempotencyKey: key,
    });

    const run2 = await ProvisioningOrchestrator.executeProvisioningJob({
      userId: student!.id,
      courseId: 'crs-asp-001',
      idempotencyKey: key,
    });

    expect(run2.job.id).toBe(run1.job.id);
    expect(run2.job.status).toBe('SUCCEEDED');
    expect(run2.job.attemptCount).toBe(1); // Not executed a second time
  });

  it('handles partial step failure and safely resumes from the failed step on retry', async () => {
    const student = await db.getUser('usr-student-01');
    const batch = db.batches.get('btc-asp-weekday');
    expect(batch).toBeDefined();

    // Artificially saturate batch capacity to force failure at Step 6 (ALLOCATE_BATCH_SEAT)
    const originalEnrolled = batch!.enrolledCount;
    batch!.enrolledCount = batch!.capacity;

    const initialRun = await ProvisioningOrchestrator.executeProvisioningJob({
      userId: student!.id,
      courseId: 'crs-asp-001',
      batchId: 'btc-asp-weekday',
      idempotencyKey: 'idemp_partial_failure_test',
    });

    expect(initialRun.job.status).toBe('RETRYABLE_FAILED');
    expect(initialRun.job.currentStep).toBe('ALLOCATE_BATCH_SEAT');
    expect(initialRun.job.lastError).toContain('BATCH_CAPACITY_EXCEEDED');

    // Steps 1-5 must have SUCCEEDED
    const steps = initialRun.steps;
    expect(steps[0].status).toBe('SUCCEEDED'); // RESOLVE_IDENTITY
    expect(steps[1].status).toBe('SUCCEEDED'); // SYNC_PROFILE
    expect(steps[2].status).toBe('SUCCEEDED'); // ASSIGN_ROLE
    expect(steps[3].status).toBe('SUCCEEDED'); // PERSIST_ADMISSION
    expect(steps[4].status).toBe('SUCCEEDED'); // CREATE_ENROLLMENT
    expect(steps[5].status).toBe('FAILED');    // ALLOCATE_BATCH_SEAT

    // Steps 7-10 must remain PENDING
    expect(steps[6].status).toBe('PENDING');   // GRANT_ENTITLEMENTS

    // Now resolve the capacity issue by expanding batch capacity
    batch!.capacity += 10;

    // Retry job
    const retryResult = await ProvisioningOrchestrator.retryProvisioningJob(initialRun.job.id);
    expect(retryResult.job.status).toBe('SUCCEEDED');
    expect(retryResult.job.attemptCount).toBe(2);

    // Verify all steps are now SUCCEEDED
    for (const step of retryResult.steps) {
      expect(step.status).toBe('SUCCEEDED');
    }

    // Restore batch capacity
    batch!.capacity -= 10;
    batch!.enrolledCount = originalEnrolled;
  });
});

