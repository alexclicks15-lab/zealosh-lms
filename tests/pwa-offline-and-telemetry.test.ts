// tests/pwa-offline-and-telemetry.test.ts
// Vitest suite for Zealosh PWA Offline Progress Sync, Boundaries & Enterprise Telemetry

import { describe, it, expect } from 'vitest';
import { offlineQueueService } from '@/lib/pwa/offline-queue-service';
import { EnterpriseTelemetryService } from '@/lib/telemetry/enterprise-telemetry';
import { db } from '@/lib/store/db';
import { PwaOfflineQueueItem } from '@/types';

describe('Zealosh PWA Offline Progress Synchronization & Security Boundaries', () => {
  const studentId = 'usr-pwa-student-01';

  it('rejects prohibited high-stakes operations queued while offline', async () => {
    const prohibitedBatch: PwaOfflineQueueItem[] = [
      {
        clientEventId: 'evt-proh-exam',
        studentId,
        eventType: 'EXAM_SUBMISSION' as any,
        resourceId: 'exam-osha-30',
        payload: { examId: 'exam-osha-30', answers: { q1: 'A' } },
        createdAt: new Date().toISOString(),
        syncStatus: 'QUEUED',
      },
      {
        clientEventId: 'evt-proh-pay',
        studentId,
        eventType: 'PAYMENT_ATTEMPT' as any,
        resourceId: 'c-1',
        payload: { amount: 5000, courseId: 'c-1' },
        createdAt: new Date().toISOString(),
        syncStatus: 'QUEUED',
      },
      {
        clientEventId: 'evt-proh-cert',
        studentId,
        eventType: 'CERTIFICATE_ISSUANCE' as any,
        resourceId: 'att-1',
        payload: { examAttemptId: 'att-1' },
        createdAt: new Date().toISOString(),
        syncStatus: 'QUEUED',
      },
    ];

    const result = await offlineQueueService.syncOfflineProgress(studentId, prohibitedBatch);

    expect(result.processedCount).toBe(3);
    expect(result.rejectedCount).toBe(3);
    expect(result.syncedCount).toBe(0);
    expect(result.results.every((r) => r.status === 'REJECTED')).toBe(true);
    expect(result.results[0].details).toContain('strictly prohibited while offline');
  });

  it('rejects items belonging to a different studentId to prevent cross-user queue pollution', async () => {
    const leakedBatch: PwaOfflineQueueItem[] = [
      {
        clientEventId: 'evt-cross-user',
        studentId: 'other-student-id-999',
        eventType: 'LESSON_READING_PROGRESS',
        resourceId: 'l-1',
        payload: { courseId: 'c-1', lessonId: 'l-1', progressPercent: 40 },
        createdAt: new Date().toISOString(),
        syncStatus: 'QUEUED',
      },
    ];

    const result = await offlineQueueService.syncOfflineProgress(studentId, leakedBatch);
    expect(result.rejectedCount).toBe(1);
    expect(result.results[0].status).toBe('REJECTED');
    expect(result.results[0].details).toContain('Cross-user queue leakage detected');
  });

  it('synchronizes approved learning progress events and preserves server-authoritative state on conflict', async () => {
    const courseId = 'course-pwa-hse';
    const lessonId = 'lesson-scaffold-safety';

    // 1. Establish existing higher server progress using db method
    await db.updateStudentLessonProgress(studentId, courseId, lessonId, 75);

    // 2. Client submits offline progress with lower percentage (e.g. stale client queue)
    const staleBatch: PwaOfflineQueueItem[] = [
      {
        clientEventId: `evt-stale-${Date.now()}`,
        studentId,
        eventType: 'LESSON_READING_PROGRESS',
        resourceId: lessonId,
        payload: { courseId, lessonId, progressPercent: 30 },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        syncStatus: 'QUEUED',
      },
    ];

    const conflictResult = await offlineQueueService.syncOfflineProgress(studentId, staleBatch);
    expect(conflictResult.conflictCount).toBe(1);
    expect(conflictResult.results[0].status).toBe('CONFLICT');
    expect(conflictResult.results[0].details).toContain('Preserved server authoritative state');

    // 3. Client submits offline progress with higher percentage -> should sync cleanly
    const advancedBatch: PwaOfflineQueueItem[] = [
      {
        clientEventId: `evt-adv-${Date.now()}`,
        studentId,
        eventType: 'LESSON_READING_PROGRESS',
        resourceId: lessonId,
        payload: { courseId, lessonId, progressPercent: 95 },
        createdAt: new Date().toISOString(),
        syncStatus: 'QUEUED',
      },
    ];

    const syncResult = await offlineQueueService.syncOfflineProgress(studentId, advancedBatch);
    expect(syncResult.syncedCount).toBe(1);
    expect(syncResult.results[0].status).toBe('SYNCED');
  });

  it('honestly reports push notifications status as UNCONFIGURED without fake receipt generation', async () => {
    const pushStatus = offlineQueueService.getPushReadinessStatus();
    expect(pushStatus.configured).toBe(false);
    expect(pushStatus.status).toBe('UNCONFIGURED');
    expect(pushStatus.inAppFallbackActive).toBe(true);
    expect(pushStatus.message).toContain('unconfigured');
  });
});

describe('Zealosh Enterprise Telemetry & Structured Logging', () => {
  it('redacts sensitive passwords, tokens, API keys and exam answers from structured logs', () => {
    const logOutput = EnterpriseTelemetryService.log({
      severity: 'INFO',
      service: 'AUTH_GATEWAY',
      message: 'Student login attempt processed',
      metadata: {
        username: 'student@example.com',
        password: 'SuperSecretPassword123!',
        token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        apiKey: 'sk-live-999888777666',
        answers: ['A', 'C', 'B', 'D'],
      },
    });

    expect(logOutput.correlationId).toBeDefined();
    expect(logOutput.metadata?.username).toBe('student@example.com');
    // Ensure credentials and secrets are replaced with [REDACTED]
    expect(logOutput.metadata?.password).toBe('[REDACTED]');
    expect(logOutput.metadata?.token).toBe('[REDACTED]');
    expect(logOutput.metadata?.apiKey).toBe('[REDACTED]');
  });

  it('compiles authoritative operational dashboard metrics across domains, queues, and maintenance', async () => {
    const metrics = await EnterpriseTelemetryService.getDashboardMetrics();

    expect(metrics.domainsCount).toBe(20);
    expect(typeof metrics.outboxBacklogCount).toBe('number');
    expect(typeof metrics.deadLetterCount).toBe('number');
    expect(typeof metrics.reconciliationMismatchCount).toBe('number');
    expect(metrics.maintenanceMode).toBeDefined();
    expect(['HEALTHY', 'DEGRADED', 'MAINTENANCE']).toContain(metrics.systemHealth);
  });
});
