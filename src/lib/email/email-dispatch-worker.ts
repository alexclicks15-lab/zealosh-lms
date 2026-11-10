// Zealosh LMS — Phase 5B Email Dispatch Worker
// Executes reliable background outbox processing, atomic lease acquisition, bounded exponential backoff retries, and preference suppression
// Architecture: ADR-004 compliant PostgreSQL outbox with explicit provider safety gate

import { db } from '@/lib/store/db';
import { getEmailProviderAdapter } from '@/lib/email/provider-adapter';
import {
  EmailOutboxJob,
  EmailOutboxStatus,
  EmailErrorClassification,
} from '@/types';

export interface DispatchBatchResult {
  processedCount: number;
  sentCount: number;
  failedCount: number;
  retryCount: number;
  suppressedCount: number;
  details: Array<{
    jobId: string;
    status: EmailOutboxStatus;
    recipientEmail: string;
    error?: string;
  }>;
}

export type NotificationPrefCategory =
  | 'ANNOUNCEMENTS'
  | 'ASSIGNMENTS'
  | 'GRADES'
  | 'LIVE_SESSIONS'
  | 'DOUBTS'
  | 'SECURITY';

/**
 * Maps outbox event types to user notification preference categories
 */
function mapEventTypeToCategory(eventType: string): NotificationPrefCategory {
  switch (eventType) {
    case 'ANNOUNCEMENT_NEW':
      return 'ANNOUNCEMENTS';
    case 'ASSIGNMENT_PUBLISHED':
    case 'ASSIGNMENT_SUBMITTED':
      return 'ASSIGNMENTS';
    case 'ASSIGNMENT_GRADED':
    case 'RESUBMISSION_REQUESTED':
      return 'GRADES';
    case 'LIVE_SESSION_SCHEDULED':
      return 'LIVE_SESSIONS';
    case 'DOUBT_REPLIED':
      return 'DOUBTS';
    case 'ACCOUNT_VERIFICATION':
    case 'PASSWORD_RESET':
      return 'SECURITY';
    default:
      return 'ASSIGNMENTS';
  }
}

export class EmailDispatchWorker {
  /**
   * Claims a batch of pending/due outbox jobs with atomic lease locking and dispatches them
   */
  public async claimAndDispatchBatch(options?: {
    workerId?: string;
    limit?: number;
    leaseTimeoutMs?: number;
  }): Promise<DispatchBatchResult> {
    const workerId =
      options?.workerId || `worker_${process.pid || 'local'}_${Date.now()}`;
    const limit = options?.limit || 10;
    const leaseTimeoutMs = options?.leaseTimeoutMs || 300000; // 5 minutes default lease

    const result: DispatchBatchResult = {
      processedCount: 0,
      sentCount: 0,
      failedCount: 0,
      retryCount: 0,
      suppressedCount: 0,
      details: [],
    };

    // 0. Automatically recover any stale leases from previous ungraceful worker terminations
    try {
      await this.recoverStaleLeases(leaseTimeoutMs);
    } catch (err: any) {
      console.warn(`[EmailDispatchWorker] Stale lease recovery warning: ${err?.message}`);
    }

    // 1. Claim eligible jobs atomically
    const claimedJobs = await db.claimEmailOutboxJobs(workerId, limit, leaseTimeoutMs);
    if (!claimedJobs || claimedJobs.length === 0) {
      return result;
    }

    result.processedCount = claimedJobs.length;
    const adapter = getEmailProviderAdapter();

    // 2. Process each claimed job
    for (const job of claimedJobs) {
      try {
        // A. Verify User Notification Preferences (unless category is SECURITY)
        const category = mapEventTypeToCategory(job.eventType);
        if (job.recipientUserId && category !== 'SECURITY') {
          const isEnabled = await db.isEmailNotificationEnabled(job.recipientUserId, category);
          if (!isEnabled) {
            await db.updateEmailOutboxJob(job.id, {
              status: 'SUPPRESSED',
              errorMessage: `Suppressed by user notification preferences (${category})`,
              lockedAt: undefined,
              lockedBy: undefined,
            });
            result.suppressedCount++;
            result.details.push({
              jobId: job.id,
              status: 'SUPPRESSED',
              recipientEmail: job.recipientEmail,
              error: `Suppressed by user notification preference for ${category}`,
            });
            continue;
          }
        }

        // B. Dispatch via configured Provider Adapter
        const sendResult = await adapter.sendEmail({
          to: job.recipientEmail,
          toName: job.recipientName,
          subject: job.subject,
          html: job.htmlBody,
          text: job.textBody,
          idempotencyKey: job.idempotencyKey,
          metadata: job.metadata,
        });

        // C. Handle Success
        if (sendResult.success) {
          await db.updateEmailOutboxJob(job.id, {
            status: 'SENT',
            provider: sendResult.provider,
            providerMessageId: sendResult.providerMessageId,
            lastAttemptAt: new Date().toISOString(),
            errorMessage: undefined,
            errorClassification: undefined,
            lockedAt: undefined,
            lockedBy: undefined,
          });
          result.sentCount++;
          result.details.push({
            jobId: job.id,
            status: 'SENT',
            recipientEmail: job.recipientEmail,
          });
          continue;
        }

        // D. Handle Dispatch Failure / Configuration Gate
        const nextAttemptCount = (job.attemptCount || 0) + 1;
        const nowIso = new Date().toISOString();

        if (sendResult.status === 'UNCONFIGURED') {
          // Provider unconfigured — gate prevents live sending without crashing worker
          await db.updateEmailOutboxJob(job.id, {
            status: 'FAILED',
            attemptCount: nextAttemptCount,
            lastAttemptAt: nowIso,
            errorMessage: sendResult.error || 'Email provider is not configured (EMAIL_PROVIDER_UNCONFIGURED)',
            errorClassification: 'UNCONFIGURED',
            lockedAt: undefined,
            lockedBy: undefined,
          });
          result.failedCount++;
          result.details.push({
            jobId: job.id,
            status: 'FAILED',
            recipientEmail: job.recipientEmail,
            error: sendResult.error,
          });
          continue;
        }

        // E. Handle Retryable Transient vs Permanent Failures
        const isRetryable =
          sendResult.isRetryable !== false &&
          sendResult.errorClassification !== 'PERMANENT_REJECTION' &&
          sendResult.errorClassification !== 'INVALID_RECIPIENT';

        if (isRetryable && nextAttemptCount < job.maxAttempts) {
          // Bounded exponential backoff: base 60s * 2^(attempt-1) + jitter
          const delayMs = Math.pow(2, nextAttemptCount - 1) * 60 * 1000 + Math.floor(Math.random() * 5000);
          const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();

          let classification: EmailErrorClassification = 'TRANSIENT_NETWORK';
          if (sendResult.errorClassification === 'RATE_LIMIT') {
            classification = 'RATE_LIMIT';
          }

          await db.updateEmailOutboxJob(job.id, {
            status: 'RETRY_PENDING',
            attemptCount: nextAttemptCount,
            nextAttemptAt,
            lastAttemptAt: nowIso,
            errorMessage: sendResult.error || 'Temporary dispatch failure; scheduled for retry',
            errorClassification: classification,
            lockedAt: undefined,
            lockedBy: undefined,
          });
          result.retryCount++;
          result.details.push({
            jobId: job.id,
            status: 'RETRY_PENDING',
            recipientEmail: job.recipientEmail,
            error: sendResult.error,
          });
        } else {
          // Max attempts exhausted or permanent failure
          let classification: EmailErrorClassification = 'PERMANENT_REJECTION';
          if (sendResult.errorClassification === 'INVALID_RECIPIENT') {
            classification = 'INVALID_RECIPIENT';
          } else if (sendResult.errorClassification === 'AUTH_FAILURE') {
            classification = 'AUTH_FAILURE';
          }

          await db.updateEmailOutboxJob(job.id, {
            status: 'FAILED',
            attemptCount: nextAttemptCount,
            lastAttemptAt: nowIso,
            errorMessage: sendResult.error || `Dispatch failed after ${nextAttemptCount} attempts`,
            errorClassification: classification,
            lockedAt: undefined,
            lockedBy: undefined,
          });
          result.failedCount++;
          result.details.push({
            jobId: job.id,
            status: 'FAILED',
            recipientEmail: job.recipientEmail,
            error: sendResult.error,
          });
        }
      } catch (err: any) {
        console.error(`[EmailDispatchWorker] Unexpected error processing job ${job.id}:`, err);
        const nextAttempt = (job.attemptCount || 0) + 1;
        await db.updateEmailOutboxJob(job.id, {
          status: nextAttempt < job.maxAttempts ? 'RETRY_PENDING' : 'FAILED',
          attemptCount: nextAttempt,
          lastAttemptAt: new Date().toISOString(),
          errorMessage: err?.message || 'Unexpected dispatch worker exception',
          errorClassification: 'TRANSIENT_NETWORK',
          lockedAt: undefined,
          lockedBy: undefined,
        });
        result.failedCount++;
      }
    }

    return result;
  }

  /**
   * Recovers stale jobs stuck in PROCESSING status due to ungraceful worker termination
   */
  public async recoverStaleLeases(leaseTimeoutMs: number = 300000): Promise<number> {
    const cutoff = Date.now() - leaseTimeoutMs;
    const { jobs: allJobs } = await db.getEmailOutboxJobs({ status: 'PROCESSING', limit: 100 });
    let recoveredCount = 0;

    for (const job of allJobs) {
      if (job.lockedAt && new Date(job.lockedAt).getTime() < cutoff) {
        await db.updateEmailOutboxJob(job.id, {
          status: 'RETRY_PENDING',
          lockedAt: undefined,
          lockedBy: undefined,
          errorMessage: 'Recovered from expired lease timeout',
          errorClassification: 'TRANSIENT_NETWORK',
        });
        recoveredCount++;
      }
    }

    return recoveredCount;
  }

  /**
   * Administrative action to manually retry a failed or cancelled outbox job
   */
  public async retryJob(id: string): Promise<boolean> {
    const job = await db.getEmailOutboxJobById(id);
    if (!job) return false;

    return await db.updateEmailOutboxJob(id, {
      status: 'QUEUED',
      attemptCount: 0,
      nextAttemptAt: new Date().toISOString(),
      lockedAt: undefined,
      lockedBy: undefined,
      errorMessage: undefined,
      errorClassification: undefined,
    });
  }

  /**
   * Administrative action to cancel a queued or retry-pending job
   */
  public async cancelJob(id: string, reason?: string): Promise<boolean> {
    const job = await db.getEmailOutboxJobById(id);
    if (!job) return false;

    return await db.updateEmailOutboxJob(id, {
      status: 'CANCELLED',
      lockedAt: undefined,
      lockedBy: undefined,
      errorMessage: reason || 'Cancelled by administrator',
    });
  }
}

export const emailDispatchWorker = new EmailDispatchWorker();
