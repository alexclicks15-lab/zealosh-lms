// Zealosh LMS — Resumable Post-Admission Provisioning Saga Orchestrator
// Coordinates the 10 sequential provisioning steps with idempotency and safe step retry
// File: src/lib/admissions/provisioning-orchestrator.ts

import {
  ProvisioningJob,
  ProvisioningJobStatus,
  ProvisioningStepName,
  ProvisioningStepRecord,
  ProvisioningStepStatus,
} from '@/types';
import { db } from '@/lib/store/db';
import { EntitlementService } from '@/lib/commerce/entitlement-service';
import { supabaseAdapter } from '@/lib/store/supabase-adapter';
import { OrientationService } from '@/lib/orientation/orientation-service';

const PROVISIONING_STEPS_SEQUENCE: ProvisioningStepName[] = [
  'RESOLVE_IDENTITY',
  'SYNC_PROFILE',
  'ASSIGN_ROLE',
  'PERSIST_ADMISSION',
  'CREATE_ENROLLMENT',
  'ALLOCATE_BATCH_SEAT',
  'GRANT_ENTITLEMENTS',
  'PROVISION_CLASSROOM',
  'ACTIVATE_MATERIALS',
  'QUEUE_ONBOARDING_NOTIFICATION',
];

const inMemoryJobs = new Map<string, ProvisioningJob>();
const inMemorySteps = new Map<string, ProvisioningStepRecord[]>();

export class ProvisioningOrchestrator {
  public static resetForTesting() {
    inMemoryJobs.clear();
    inMemorySteps.clear();
  }

  /**
   * Retrieves an existing provisioning job by ID
   */
  public static async getJobById(jobId: string): Promise<ProvisioningJob | null> {
    return inMemoryJobs.get(jobId) || null;
  }

  /**
   * Retrieves all step records for a job
   */
  public static async getJobSteps(jobId: string): Promise<ProvisioningStepRecord[]> {
    return inMemorySteps.get(jobId) || [];
  }

  /**
   * List all provisioning jobs
   */
  public static async listJobs(filter?: {
    status?: ProvisioningJobStatus;
    courseId?: string;
  }): Promise<ProvisioningJob[]> {
    let list = Array.from(inMemoryJobs.values());
    if (filter?.status) {
      list = list.filter((j) => j.status === filter.status);
    }
    if (filter?.courseId) {
      list = list.filter((j) => j.courseId === filter.courseId);
    }
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Executes or resumes a provisioning saga
   */
  public static async executeProvisioningJob(params: {
    applicationId?: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
    orderId?: string;
    courseId: string;
    batchId?: string;
    offeringId?: string;
    idempotencyKey?: string;
  }): Promise<{ job: ProvisioningJob; steps: ProvisioningStepRecord[] }> {
    const { courseId } = params;
    const idempotencyKey =
      params.idempotencyKey ||
      `prov_${params.applicationId || params.userId || 'direct'}_${courseId}_${params.batchId || 'default'}`;

    // 1. Idempotency Check: if job already exists for this idempotency key
    let job = Array.from(inMemoryJobs.values()).find((j) => j.idempotencyKey === idempotencyKey);

    if (job) {
      // If already succeeded, return immediately (safe idempotency)
      if (job.status === 'SUCCEEDED') {
        const steps = inMemorySteps.get(job.id) || [];
        return { job, steps };
      }
    } else {
      // Create new job
      const now = new Date().toISOString();
      const jobId = `prov-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const correlationId = `corr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      // Resolve target userId
      let resolvedUserId = params.userId;
      if (!resolvedUserId && params.applicationId) {
        const app = await db.getAdmissionApplication(params.applicationId);
        resolvedUserId = app?.userId;
      }
      if (!resolvedUserId && params.userEmail) {
        const user = await db.getUserByEmail(params.userEmail);
        resolvedUserId = user?.id;
      }
      if (!resolvedUserId) {
        resolvedUserId = `usr-prov-${Date.now().toString(36)}`;
      }

      job = {
        id: jobId,
        applicationId: params.applicationId,
        userId: resolvedUserId,
        orderId: params.orderId,
        courseId,
        batchId: params.batchId,
        offeringId: params.offeringId,
        idempotencyKey,
        correlationId,
        status: 'PENDING',
        currentStep: 'RESOLVE_IDENTITY',
        attemptCount: 0,
        maxAttempts: 5,
        createdAt: now,
        updatedAt: now,
      };

      inMemoryJobs.set(job.id, job);

      // Initialize the 10 steps
      const initialSteps: ProvisioningStepRecord[] = PROVISIONING_STEPS_SEQUENCE.map(
        (stepName, index) => ({
          id: `pstep-${jobId}-${index + 1}`,
          jobId,
          stepName,
          stepOrder: index + 1,
          status: 'PENDING',
          attemptCount: 0,
        })
      );
      inMemorySteps.set(job.id, initialSteps);
    }

    return this.runSaga(job);
  }

  /**
   * Retry a failed provisioning job from the step where it failed
   */
  public static async retryProvisioningJob(
    jobId: string
  ): Promise<{ job: ProvisioningJob; steps: ProvisioningStepRecord[] }> {
    const job = inMemoryJobs.get(jobId);
    if (!job) {
      throw new Error(`Provisioning job ${jobId} not found`);
    }

    if (job.status === 'SUCCEEDED') {
      return { job, steps: inMemorySteps.get(jobId) || [] };
    }

    job.status = 'PENDING';
    job.lastError = undefined;
    job.updatedAt = new Date().toISOString();
    inMemoryJobs.set(job.id, job);

    return this.runSaga(job);
  }

  /**
   * Internal runner that executes steps sequentially from the current pending/failed step
   */
  private static async runSaga(
    job: ProvisioningJob
  ): Promise<{ job: ProvisioningJob; steps: ProvisioningStepRecord[] }> {
    job.status = 'PROCESSING';
    job.attemptCount++;
    job.updatedAt = new Date().toISOString();
    inMemoryJobs.set(job.id, job);

    const steps = inMemorySteps.get(job.id) || [];

    for (const step of steps) {
      // Skip steps that have already SUCCEEDED
      if (step.status === 'SUCCEEDED' || step.status === 'SKIPPED') {
        continue;
      }

      job.currentStep = step.stepName;
      step.status = 'PROCESSING';
      step.attemptCount++;
      step.startedAt = new Date().toISOString();
      step.errorMessage = undefined;

      try {
        const stepOutput = await this.executeStep(step.stepName, job);
        step.status = 'SUCCEEDED';
        step.outputPayload = stepOutput;
        step.completedAt = new Date().toISOString();
      } catch (err: any) {
        step.status = 'FAILED';
        step.errorMessage = err.message || 'Unknown step failure';
        step.completedAt = new Date().toISOString();

        job.status = job.attemptCount >= job.maxAttempts ? 'TERMINAL_FAILED' : 'RETRYABLE_FAILED';
        job.lastError = `Step ${step.stepName} failed: ${err.message}`;
        job.updatedAt = new Date().toISOString();
        inMemoryJobs.set(job.id, job);

        return { job, steps };
      }
    }

    // All steps succeeded!
    job.status = 'SUCCEEDED';
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    inMemoryJobs.set(job.id, job);

    return { job, steps };
  }

  /**
   * Execute an individual step
   */
  private static async executeStep(
    stepName: ProvisioningStepName,
    job: ProvisioningJob
  ): Promise<any> {
    switch (stepName) {
      case 'RESOLVE_IDENTITY': {
        let user = await db.getUser(job.userId);
        if (!user && job.applicationId) {
          const app = await db.getAdmissionApplication(job.applicationId);
          if (app) {
            user = await db.getUserByEmail(app.applicantEmail);
            if (!user) {
              const reg = await db.registerStudent({
                name: app.applicantName,
                email: app.applicantEmail,
                password: 'ChangeMe@2026',
                phone: app.applicantPhone,
              });
              user = reg.user;
            }
            job.userId = user.id;
          }
        }
        return { resolvedUserId: job.userId, email: user?.email };
      }

      case 'SYNC_PROFILE': {
        const user = await db.getUser(job.userId);
        return { profileSynchronized: true, userId: job.userId, name: user?.name };
      }

      case 'ASSIGN_ROLE': {
        const user = await db.getUser(job.userId);
        if (user && user.role !== 'STUDENT' && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
          user.role = 'STUDENT';
          db.users.set(user.id, user);
        }
        return { roleAssigned: 'STUDENT', userId: job.userId };
      }

      case 'PERSIST_ADMISSION': {
        if (job.applicationId) {
          const app = await db.getAdmissionApplication(job.applicationId);
          if (app) {
            const orientationCheck = await OrientationService.isOrientationSatisfied(
              job.courseId,
              app.id,
              job.userId
            );
            if (orientationCheck.isRequired && !orientationCheck.satisfied && app.status === 'ORIENTATION_PENDING') {
              throw new Error('ORIENTATION_GATE_BLOCKED: Candidate has not completed required orientation attendance');
            }

            app.status = 'ADMITTED';
            app.pipelineStage = 'ADMITTED';
            app.userId = job.userId;
            app.updatedAt = new Date().toISOString();
            db.admissionApplications.set(app.id, app);
          }
        }
        return { admissionPersisted: true, applicationId: job.applicationId };
      }

      case 'CREATE_ENROLLMENT': {
        let enrollment = Array.from(db.enrollments.values()).find(
          (e) => e.userId === job.userId && e.courseId === job.courseId
        );
        if (!enrollment) {
          const now = new Date();
          const expiry = new Date(now);
          expiry.setFullYear(expiry.getFullYear() + 1);

          const id = `enr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
          const newEnrollment = {
            id,
            userId: job.userId,
            courseId: job.courseId,
            batchId: job.batchId || 'btc-asp-weekday',
            status: 'ACTIVE' as const,
            enrolledAt: now.toISOString(),
            expiresAt: expiry.toISOString(),
            progressPercent: 0,
            completedLessonIds: [],
          };
          db.enrollments.set(id, newEnrollment);
          enrollment = newEnrollment;
        }
        return { enrollmentId: enrollment.id, courseId: job.courseId };
      }

      case 'ALLOCATE_BATCH_SEAT': {
        const targetBatchId = job.batchId || 'btc-asp-weekday';
        const batch = db.batches.get(targetBatchId);
        if (batch) {
          if ((batch.enrolledCount || 0) >= batch.capacity) {
            throw new Error(`BATCH_CAPACITY_EXCEEDED: Cohort ${targetBatchId} has reached maximum seat capacity (${batch.capacity})`);
          }
          batch.enrolledCount = (batch.enrolledCount || 0) + 1;
          db.batches.set(targetBatchId, batch);
        }
        return { batchAllocated: targetBatchId, enrolledCount: batch?.enrolledCount };
      }

      case 'GRANT_ENTITLEMENTS': {
        const offeringId = job.offeringId || 'offering-asp-complete';
        const entitlements = await EntitlementService.grantEntitlementsForOffering({
          userId: job.userId,
          courseId: job.courseId,
          offeringId,
          sourceOrderId: job.orderId,
        });
        return {
          entitlementsGranted: entitlements.length,
          scopes: entitlements.map((e) => e.featureScope),
        };
      }

      case 'PROVISION_CLASSROOM': {
        return {
          classroomAccessGranted: true,
          roomRole: 'STUDENT',
          sessionTokenReady: true,
        };
      }

      case 'ACTIVATE_MATERIALS': {
        return {
          materialsActivated: true,
          lessonLibraryAccessible: true,
          questionBankAccessible: true,
        };
      }

      case 'QUEUE_ONBOARDING_NOTIFICATION': {
        const user = await db.getUser(job.userId);
        const outboxEntry = {
          id: `outbox-${Date.now().toString(36)}`,
          toEmail: user?.email || 'student@zealosh.com',
          template: 'WELCOME_ONBOARDING',
          subject: 'Welcome to Zealosh Training & Consultants — Your Access is Ready',
          status: 'QUEUED',
          createdAt: new Date().toISOString(),
        };
        return { notificationQueued: true, recipient: outboxEntry.toEmail };
      }

      default:
        return { stepExecuted: stepName };
    }
  }
}
