// Zealosh LMS — Central Event Consumer Engine & Idempotency Inbox
// Path: src/lib/events/event-consumer-engine.ts
// Processes domain event deliveries with consumer inbox deduplication, aggregate version ordering,
// and cross-domain business side-effects without event loops.

import { db } from '@/lib/store/db';
import {
  DomainEventEnvelope,
  DomainIdentifier,
  ConsumerInboxEntry,
} from '@/types';
import { EventContractRegistry } from './event-contract-registry';

export type ConsumerHandler = (
  envelope: DomainEventEnvelope
) => Promise<{ success: boolean; summary?: string; error?: string }>;

export class EventConsumerEngine {
  private handlers: Map<string, ConsumerHandler> = new Map();

  constructor() {
    this.registerBuiltInConsumers();
  }

  /**
   * Helper to format consumer registration key
   */
  private getKey(consumerDomain: DomainIdentifier, eventType: string): string {
    return `${consumerDomain}:${eventType}`;
  }

  public registerHandler(
    consumerDomain: DomainIdentifier,
    eventType: string,
    handler: ConsumerHandler
  ): void {
    this.handlers.set(this.getKey(consumerDomain, eventType), handler);
  }

  /**
   * Processes a single delivery with inbox deduplication and aggregate ordering safeguards
   */
  public async processDelivery(
    consumerDomain: DomainIdentifier,
    envelope: DomainEventEnvelope
  ): Promise<{
    status: 'PROCESSED' | 'SKIPPED_DUPLICATE' | 'SKIPPED_STALE' | 'FAILED';
    summary?: string;
    error?: string;
  }> {
    const { eventId, eventType, aggregateId, aggregateVersion } = envelope;

    // 1. Authorization check
    if (!EventContractRegistry.isConsumerAuthorized(eventType, consumerDomain)) {
      return {
        status: 'FAILED',
        error: `Consumer '${consumerDomain}' is not authorized to consume event '${eventType}'.`,
      };
    }

    // 2. Inbox Deduplication (Idempotency Guard)
    const existingInbox = await db.getConsumerInbox(consumerDomain, eventId);
    if (existingInbox && existingInbox.status === 'PROCESSED') {
      return {
        status: 'SKIPPED_DUPLICATE',
        summary: `Event '${eventId}' previously processed by consumer '${consumerDomain}'.`,
      };
    }

    // 3. Stale Event Guard (Aggregate Version Ordering)
    const latestAggregateVersion = await db.getLatestProcessedAggregateVersion(
      consumerDomain,
      envelope.aggregateType,
      aggregateId
    );
    if (latestAggregateVersion !== null && aggregateVersion < latestAggregateVersion) {
      const inboxEntry: ConsumerInboxEntry = {
        id: `inbox-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        consumerDomain,
        eventId,
        aggregateId,
        aggregateVersion,
        processedAt: new Date().toISOString(),
        status: 'SKIPPED_STALE',
        resultSummary: `Skipped stale event v${aggregateVersion} (already processed v${latestAggregateVersion})`,
      };
      await db.saveConsumerInbox(inboxEntry);
      return {
        status: 'SKIPPED_STALE',
        summary: inboxEntry.resultSummary,
      };
    }

    // 4. Resolve Handler
    const handlerKey = this.getKey(consumerDomain, eventType);
    const handler = this.handlers.get(handlerKey);

    if (!handler) {
      // No custom action required, acknowledge consumption
      const inboxEntry: ConsumerInboxEntry = {
        id: `inbox-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        consumerDomain,
        eventId,
        aggregateId,
        aggregateVersion,
        processedAt: new Date().toISOString(),
        status: 'PROCESSED',
        resultSummary: `Acknowledged by ${consumerDomain} (No custom action required)`,
      };
      await db.saveConsumerInbox(inboxEntry);
      return {
        status: 'PROCESSED',
        summary: inboxEntry.resultSummary,
      };
    }

    // 5. Execute Handler Side-Effect
    try {
      const result = await handler(envelope);
      if (!result.success) {
        return {
          status: 'FAILED',
          error: result.error || 'Handler execution failed',
        };
      }

      // 6. Record Successful Inbox Completion
      const inboxEntry: ConsumerInboxEntry = {
        id: `inbox-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        consumerDomain,
        eventId,
        aggregateId,
        aggregateVersion,
        processedAt: new Date().toISOString(),
        status: 'PROCESSED',
        resultSummary: result.summary || 'Processed successfully',
      };
      await db.saveConsumerInbox(inboxEntry);

      return {
        status: 'PROCESSED',
        summary: inboxEntry.resultSummary,
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        error: err.message || 'Unhandled consumer exception',
      };
    }
  }

  /**
   * Registers built-in domain subscribers
   */
  private registerBuiltInConsumers(): void {
    // A. ENTITLEMENTS consumer for 'commerce.order.paid'
    this.registerHandler('ENTITLEMENTS', 'commerce.order.paid', async (env) => {
      const { userId, courseId, offeringId } = env.payload;
      if (!userId || !courseId) return { success: false, error: 'Missing required payload keys' };

      // Ensure user has active entitlement for this course offering
      await db.grantEntitlementAtomic(userId, courseId, offeringId || 'COMPLETE');
      return { success: true, summary: `Granted entitlement to user '${userId}' for course '${courseId}'` };
    });

    // B. GAMIFICATION consumer for 'academic.lesson.completed'
    this.registerHandler('GAMIFICATION', 'academic.lesson.completed', async (env) => {
      const { studentId, lessonId, courseId } = env.payload;
      if (!studentId || !lessonId) return { success: false, error: 'Missing student or lesson ID' };

      // Record 10 XP idempotently
      await db.awardGamificationPoints({
        studentId,
        sourceEventId: lessonId,
        activityType: 'LESSON_COMPLETED',
        pointsAwarded: 10,
        awardReason: 'Completed academic lesson',
        courseId,
        idempotencyKey: `xp:lesson:${studentId}:${lessonId}`,
      });
      return { success: true, summary: `Awarded 10 XP to student '${studentId}' for lesson '${lessonId}'` };
    });

    // C. GAMIFICATION consumer for 'assessment.exam.passed'
    this.registerHandler('GAMIFICATION', 'assessment.exam.passed', async (env) => {
      const { studentId, examId, courseId } = env.payload;
      if (!studentId || !examId) return { success: false, error: 'Missing student or exam ID' };

      // Record 100 XP idempotently
      await db.awardGamificationPoints({
        studentId,
        sourceEventId: examId,
        activityType: 'EXAM_PASSED',
        pointsAwarded: 100,
        awardReason: 'Passed certification exam',
        courseId,
        idempotencyKey: `xp:exam:${studentId}:${examId}`,
      });
      return { success: true, summary: `Awarded 100 XP to student '${studentId}' for exam '${examId}'` };
    });

    // D. CAREER consumer for 'credentials.certificate.issued'
    this.registerHandler('CAREER', 'credentials.certificate.issued', async (env) => {
      const { studentId, courseId } = env.payload;
      if (!studentId || !courseId) return { success: false, error: 'Missing student or course' };

      // Update student career milestone if active
      await db.syncCareerMilestoneOnCertificate(studentId, courseId);
      return { success: true, summary: `Synchronized career plan for student '${studentId}'` };
    });

    // E. GROWTH consumer for 'admissions.student.admitted'
    this.registerHandler('GROWTH', 'admissions.student.admitted', async (env) => {
      const { studentId, courseId } = env.payload;
      if (!studentId) return { success: false, error: 'Missing studentId' };

      // Mark referral conversion if attributed
      await db.syncReferralConversion(studentId, courseId, 'ADMISSION_APPROVED');
      return { success: true, summary: `Checked referral conversion for student '${studentId}'` };
    });

    // F. NOTIFICATIONS consumer for 'credentials.certificate.issued'
    this.registerHandler('NOTIFICATIONS', 'credentials.certificate.issued', async (env) => {
      const { studentId, certificateCode, courseId } = env.payload;
      if (!studentId) return { success: false, error: 'Missing studentId' };

      await db.createNotification({
        recipientUserId: studentId,
        title: 'Accreditation Certificate Issued',
        description: `Your verified certificate (${certificateCode}) has been officially issued.`,
        type: 'SYSTEM_ALERT',
        actionUrl: `/verify/${certificateCode}`,
        idempotencyKey: `notif:cert:${certificateCode}`,
      });
      return { success: true, summary: `Queued notification for certificate '${certificateCode}'` };
    });
  }
}

export const eventConsumerEngine = new EventConsumerEngine();
