// ==============================================================================
// Zealosh LMS — Outbox Worker Concurrency & Lease Locking Test Suite
// Path: tests/worker-concurrency.test.ts
// Milestone: ZM-IMPL-09 (Stage B-Prep.1)
// ==============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { db } from '@/lib/store/db';
import { EmailDispatchWorker } from '@/lib/email/email-dispatch-worker';
import {
  acquireWorkerProcessLock,
  releaseWorkerProcessLock,
  runWorkerOnce,
} from '../deploy/worker-runner.mjs';

describe('Zealosh LMS — Background Worker Concurrency & Lease Guarantees', () => {
  let tempLockDir: string;
  let tempLockFile: string;

  beforeEach(async () => {
    tempLockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zealosh-worker-test-'));
    tempLockFile = path.join(tempLockDir, 'worker.pid');

    // Clear outbox for clean test state
    if (db.emailOutbox) {
      db.emailOutbox.clear();
    }
  });

  afterEach(() => {
    try {
      fs.rmSync(tempLockDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. should atomically lease outbox jobs to one worker preventing duplicate dispatch', async () => {
    const job = await db.queueEmailOutboxJob({
      recipientEmail: 'student-test@zealosh.com',
      recipientName: 'Test Student',
      subject: 'Class Schedule Notice',
      htmlBody: '<p>Your class begins at 10:00 AM.</p>',
      textBody: 'Your class begins at 10:00 AM.',
      eventType: 'LIVE_SESSION_SCHEDULED',
      idempotencyKey: 'idemp_session_101_student_1',
    });

    expect(job).toBeDefined();
    expect(job).not.toBeNull();
    expect(job!.status).toBe('QUEUED');

    // Worker 1 claims job
    const worker1 = new EmailDispatchWorker();
    const claimedByWorker1 = await db.claimEmailOutboxJobs('worker_alpha', 10, 60000);

    expect(claimedByWorker1.length).toBe(1);
    expect(claimedByWorker1[0].id).toBe(job!.id);
    expect(claimedByWorker1[0].lockedBy).toBe('worker_alpha');

    // Worker 2 attempts to claim concurrently
    const worker2 = new EmailDispatchWorker();
    const claimedByWorker2 = await db.claimEmailOutboxJobs('worker_beta', 10, 60000);

    // Worker 2 must receive zero jobs because job is currently locked by Worker 1
    expect(claimedByWorker2.length).toBe(0);
  });

  it('2. should allow lease recovery after leaseTimeoutMs expires', async () => {
    const staleTime = new Date(Date.now() - 60000).toISOString();
    const job = await db.queueEmailOutboxJob({
      recipientEmail: 'student-timeout@zealosh.com',
      recipientName: 'Timeout Student',
      subject: 'Exam Notice',
      htmlBody: '<p>Exam schedule.</p>',
      eventType: 'ANNOUNCEMENT_NEW',
      status: 'PROCESSING',
      lockedAt: staleTime,
      lockedBy: 'crashed_worker',
      idempotencyKey: 'idemp_exam_202',
    });

    // Run stale lease recovery
    const worker = new EmailDispatchWorker();
    const recovered = await worker.recoverStaleLeases(30000); // 30 second threshold
    expect(recovered).toBeGreaterThanOrEqual(1);

    // Worker 2 attempts to claim
    const claimedByWorker2 = await db.claimEmailOutboxJobs('recovery_worker', 10, 60000);

    expect(claimedByWorker2.length).toBe(1);
    expect(claimedByWorker2[0].id).toBe(job!.id);
    expect(claimedByWorker2[0].lockedBy).toBe('recovery_worker');
  });

  it('3. should enforce idempotency key uniqueness in outbox job creation', async () => {
    const key = `idemp_unique_${Date.now()}`;

    const job1 = await db.queueEmailOutboxJob({
      recipientEmail: 'student-dup@zealosh.com',
      recipientName: 'Dup Student',
      subject: 'Duplicate Test',
      htmlBody: '<p>Test.</p>',
      eventType: 'ANNOUNCEMENT_NEW',
      idempotencyKey: key,
    });

    expect(job1).toBeDefined();

    // Second insertion with identical idempotencyKey should return existing job
    const job2 = await db.queueEmailOutboxJob({
      recipientEmail: 'student-dup@zealosh.com',
      recipientName: 'Dup Student',
      subject: 'Duplicate Test',
      htmlBody: '<p>Test.</p>',
      eventType: 'ANNOUNCEMENT_NEW',
      idempotencyKey: key,
    });

    expect(job2!.id).toBe(job1!.id);
    expect(db.emailOutbox.size).toBe(1);
  });

  it('4. should acquire and release worker process lock preventing duplicate runner startup', () => {
    const lock1 = acquireWorkerProcessLock(tempLockFile, 'systemd');
    expect(lock1.acquired).toBe(true);
    expect(fs.existsSync(tempLockFile)).toBe(true);

    // Second worker instance (e.g. from PM2 or cron) must fail acquisition
    const lock2 = acquireWorkerProcessLock(tempLockFile, 'pm2');
    expect(lock2.acquired).toBe(false);
    expect(lock2.reason).toContain('Active worker already running');

    // Release lock
    const released = releaseWorkerProcessLock(tempLockFile);
    expect(released).toBe(true);
    expect(fs.existsSync(tempLockFile)).toBe(false);

    // Subsequent acquire succeeds
    const lock3 = acquireWorkerProcessLock(tempLockFile, 'pm2');
    expect(lock3.acquired).toBe(true);
    releaseWorkerProcessLock(tempLockFile);
  });

  it('5. should safely recover from stale worker lockfile left by non-existent PID', () => {
    // Write stale lockfile with dead PID (e.g. 999999)
    const stalePayload = {
      pid: 999999,
      supervisor: 'systemd',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
    };
    fs.writeFileSync(tempLockFile, JSON.stringify(stalePayload, null, 2), 'utf8');

    // Acquire lock should detect stale PID and take over cleanly
    const lock = acquireWorkerProcessLock(tempLockFile, 'systemd');
    expect(lock.acquired).toBe(true);
    expect(lock.pid).toBe(process.pid);

    releaseWorkerProcessLock(tempLockFile);
  });

  it('6. should skip dispatch execution when another worker holds process lock', async () => {
    // Hold lock under current process
    acquireWorkerProcessLock(tempLockFile, 'systemd');

    // Run runner cycle
    const result = await runWorkerOnce({ lockFilePath: tempLockFile, supervisor: 'pm2' });
    expect(result.success).toBe(false);
    expect(result.skippedDueToConflict).toBe(true);
    expect(result.reason).toContain('Active worker already running');

    releaseWorkerProcessLock(tempLockFile);
  });

  it('7. should auto-recover crashed worker jobs at the start of batch dispatch', async () => {
    // Seed a job stuck in PROCESSING with expired lease
    const staleTime = new Date(Date.now() - 300000).toISOString();
    const job = await db.queueEmailOutboxJob({
      recipientEmail: 'crashed-auto@zealosh.com',
      recipientName: 'Crash Student',
      subject: 'Self Healing Notice',
      htmlBody: '<p>Recovered automatically.</p>',
      eventType: 'ANNOUNCEMENT_NEW',
      status: 'PROCESSING',
      lockedAt: staleTime,
      lockedBy: 'dead_process_888',
      idempotencyKey: 'idemp_crash_888',
    });

    // Run dispatch batch
    const worker = new EmailDispatchWorker();
    const result = await worker.claimAndDispatchBatch({
      workerId: 'healing_worker',
      limit: 10,
      leaseTimeoutMs: 60000,
    });

    // The job was auto-recovered from stale lease and claimed/processed
    expect(result.processedCount).toBeGreaterThanOrEqual(1);
    const updated = await db.getEmailOutboxJobById(job!.id);
    expect(updated).not.toBeNull();
    // In test environment, unconfigured provider moves to FAILED with error classification UNCONFIGURED
    expect(['SENT', 'FAILED', 'RETRY_PENDING', 'SUPPRESSED']).toContain(updated!.status);
    expect(updated!.lockedBy).toBeUndefined(); // Lease released
  });

  it('8. should transition job to FAILED (Dead Letter) when max attempts is exhausted', async () => {
    // Seed job that has reached attempt 4 of 5
    const job = await db.queueEmailOutboxJob({
      recipientEmail: 'exhaust-attempts@zealosh.com',
      recipientName: 'Exhausted Student',
      subject: 'Final Attempt Notice',
      htmlBody: '<p>Dead letter queue test.</p>',
      eventType: 'ANNOUNCEMENT_NEW',
      attemptCount: 4,
      maxAttempts: 5,
      idempotencyKey: 'idemp_exhaust_attempts',
    });

    const worker = new EmailDispatchWorker();
    const result = await worker.claimAndDispatchBatch({
      workerId: 'exhaust_worker',
      limit: 10,
      leaseTimeoutMs: 60000,
    });

    expect(result.processedCount).toBeGreaterThanOrEqual(1);
    const updated = await db.getEmailOutboxJobById(job!.id);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('FAILED');
    expect(updated!.attemptCount).toBe(5);
  });
});
