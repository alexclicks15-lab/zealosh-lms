// Zealosh LMS — Scheduled Publishing Background Worker Engine
// Architecture: ADR-004 (PostgreSQL Sole Source of Truth), Durable Outbox, Atomic Lease Locking
// Periodically polls for due publication jobs, claims them safely, and executes atomic publishing

import { db } from '@/lib/store/db';
import { cmsService } from '@/lib/cms/cms-service';

export interface WorkerTickResult {
  processed: number;
  succeeded: number;
  failed: number;
  details: Array<{
    jobId: string;
    pageId: string;
    versionId: string;
    status: 'COMPLETED' | 'FAILED';
    error?: string;
  }>;
}

export class CmsScheduledPublisherWorker {
  private workerId: string;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(workerId?: string) {
    this.workerId =
      workerId ||
      `cms-worker-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  }

  public getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Starts periodic polling worker
   */
  public start(pollIntervalMs: number = 30000): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.executeTick().catch((err) => {
        console.error('[CmsScheduledPublisherWorker] Uncaught error during tick:', err);
      });
    }, pollIntervalMs);
    // Unref timer so Node process is not prevented from exiting cleanly
    if (this.intervalTimer && typeof this.intervalTimer.unref === 'function') {
      this.intervalTimer.unref();
    }
  }

  /**
   * Stops periodic polling
   */
  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /**
   * Executes a single processing tick: claims due jobs and publishes atomically
   */
  public async executeTick(limit: number = 10): Promise<WorkerTickResult> {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0, details: [] };
    }

    this.isProcessing = true;
    const result: WorkerTickResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      details: [],
    };

    try {
      const dueJobs = await db.claimDueCmsScheduledPublications(this.workerId, limit);
      result.processed = dueJobs.length;

      for (const job of dueJobs) {
        try {
          await cmsService.publishVersion(
            job.pageId,
            job.versionId,
            job.scheduledBy,
            'SUPER_ADMIN'
          );

          await db.updateCmsScheduledPublication(job.id, {
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
            lockedAt: null,
            lockedBy: null,
          });

          result.succeeded++;
          result.details.push({
            jobId: job.id,
            pageId: job.pageId,
            versionId: job.versionId,
            status: 'COMPLETED',
          });
        } catch (jobErr: any) {
          result.failed++;
          const errorMessage = jobErr?.message || String(jobErr);
          const hasExceededAttempts = (job.attemptCount || 1) >= (job.maxAttempts || 3);

          await db.updateCmsScheduledPublication(job.id, {
            status: hasExceededAttempts ? 'FAILED' : 'QUEUED',
            errorMessage,
            lockedAt: null,
            lockedBy: null,
          });

          result.details.push({
            jobId: job.id,
            pageId: job.pageId,
            versionId: job.versionId,
            status: 'FAILED',
            error: errorMessage,
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return result;
  }
}

// Global singleton worker instance
export const cmsScheduledPublisherWorker = new CmsScheduledPublisherWorker();

