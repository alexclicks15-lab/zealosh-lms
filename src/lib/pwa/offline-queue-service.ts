// Zealosh LMS — PWA Offline Progress Synchronization & Device Readiness
// Path: src/lib/pwa/offline-queue-service.ts
// Enforces strict boundaries on offline capabilities: prohibits offline exams, payments,
// and admissions, while providing conflict-safe synchronization for non-sensitive learning progress.

import { db } from '@/lib/store/db';
import {
  PwaOfflineQueueItem,
  PwaSyncStatus,
  PwaPushSubscription,
} from '@/types';

export const PROHIBITED_OFFLINE_OPERATIONS = [
  'EXAM_SUBMISSION',
  'EXAM_ANSWER',
  'PAYMENT_ATTEMPT',
  'ORDER_CREATE',
  'ADMISSION_DECISION',
  'LIVE_JOIN',
  'CERTIFICATE_ISSUANCE',
  'SESSION_REVOCATION',
  'ADMIN_ACTION',
];

export const APPROVED_OFFLINE_OPERATIONS = [
  'LESSON_READING_PROGRESS',
  'BOOKMARK_CREATED',
  'USER_PREFERENCE_UPDATED',
];

export class OfflineQueueService {
  /**
   * Synchronizes a batch of queued client offline progress items upon network restoration.
   */
  public async syncOfflineProgress(
    studentId: string,
    items: PwaOfflineQueueItem[]
  ): Promise<{
    processedCount: number;
    syncedCount: number;
    conflictCount: number;
    rejectedCount: number;
    results: Array<{
      clientEventId: string;
      eventType: string;
      status: PwaSyncStatus;
      details?: string;
    }>;
  }> {
    const outcome = {
      processedCount: 0,
      syncedCount: 0,
      conflictCount: 0,
      rejectedCount: 0,
      results: [] as Array<{
        clientEventId: string;
        eventType: string;
        status: PwaSyncStatus;
        details?: string;
      }>,
    };

    if (!items || items.length === 0) {
      return outcome;
    }

    outcome.processedCount = items.length;

    for (const item of items) {
      // 1. Prohibited Offline Operation Guard
      if (PROHIBITED_OFFLINE_OPERATIONS.includes(item.eventType)) {
        outcome.rejectedCount++;
        outcome.results.push({
          clientEventId: item.clientEventId,
          eventType: item.eventType,
          status: 'REJECTED',
          details: `Operation '${item.eventType}' is strictly prohibited while offline. Real-time authoritative server connectivity required.`,
        });
        continue;
      }

      // 2. Validate Approved Event Types
      if (!APPROVED_OFFLINE_OPERATIONS.includes(item.eventType)) {
        outcome.rejectedCount++;
        outcome.results.push({
          clientEventId: item.clientEventId,
          eventType: item.eventType,
          status: 'REJECTED',
          details: `Unsupported offline event type '${item.eventType}'.`,
        });
        continue;
      }

      // 3. User Ownership & Identity Isolation
      if (item.studentId !== studentId) {
        outcome.rejectedCount++;
        outcome.results.push({
          clientEventId: item.clientEventId,
          eventType: item.eventType,
          status: 'REJECTED',
          details: 'Cross-user queue leakage detected. Client event studentId does not match authenticated session.',
        });
        continue;
      }

      // 4. Idempotency Check
      const existing = await db.getPwaOfflineEvent(item.clientEventId);
      if (existing && existing.syncStatus === 'SYNCED') {
        outcome.syncedCount++;
        outcome.results.push({
          clientEventId: item.clientEventId,
          eventType: item.eventType,
          status: 'SYNCED',
          details: 'Idempotent duplicate acknowledged.',
        });
        continue;
      }

      // 5. Server-Authoritative Conflict Resolution
      if (item.eventType === 'LESSON_READING_PROGRESS') {
        const { courseId, lessonId, progressPercent } = item.payload;
        const currentProgress = await db.getStudentLessonProgress(studentId, courseId, lessonId);

        // If server already has higher progress than client's offline progress, detect conflict
        if (currentProgress && currentProgress.progressPercent > (progressPercent || 0)) {
          outcome.conflictCount++;
          const conflictDetails = `Server has newer progress (${currentProgress.progressPercent}%) than offline queued progress (${progressPercent}%). Preserved server authoritative state.`;

          await db.savePwaOfflineEvent({
            ...item,
            syncStatus: 'CONFLICT',
            conflictDetails,
          });

          outcome.results.push({
            clientEventId: item.clientEventId,
            eventType: item.eventType,
            status: 'CONFLICT',
            details: conflictDetails,
          });
          continue;
        }

        // Apply progress update
        await db.updateStudentLessonProgress(studentId, courseId, lessonId, progressPercent || 100);
      }

      // Save synced event
      await db.savePwaOfflineEvent({
        ...item,
        syncStatus: 'SYNCED',
      });

      outcome.syncedCount++;
      outcome.results.push({
        clientEventId: item.clientEventId,
        eventType: item.eventType,
        status: 'SYNCED',
        details: 'Successfully synchronized to authoritative database.',
      });
    }

    return outcome;
  }

  /**
   * Retrieves honest push notification configuration status
   */
  public getPushReadinessStatus(): {
    configured: boolean;
    status: 'UNCONFIGURED' | 'READY';
    message: string;
    inAppFallbackActive: boolean;
  } {
    const vapidKey = process.env.VAPID_PUBLIC_KEY;
    const isConfigured = !!vapidKey && vapidKey.length > 20;

    return {
      configured: isConfigured,
      status: isConfigured ? 'READY' : 'UNCONFIGURED',
      message: isConfigured
        ? 'PWA Push Notification service is active and ready for subscription.'
        : 'PWA Web Push provider unconfigured (expected development gate). In-app notification center is active.',
      inAppFallbackActive: true,
    };
  }

  /**
   * Registers a browser push subscription for the authenticated user
   */
  public async registerPushSubscription(
    userId: string,
    subscription: { endpoint: string; p256dh: string; auth: string; userAgent?: string }
  ): Promise<PwaPushSubscription> {
    const sub: PwaPushSubscription = {
      id: `push-sub-${Date.now()}`,
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: subscription.userAgent,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    await db.savePwaPushSubscription(sub);
    return sub;
  }

  /**
   * Revokes a push subscription
   */
  public async revokePushSubscription(endpoint: string, userId: string): Promise<boolean> {
    return await db.revokePwaPushSubscription(endpoint, userId);
  }
}

export const offlineQueueService = new OfflineQueueService();

