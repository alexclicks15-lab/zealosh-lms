// Zealosh LMS — Central Event Dispatcher & Multi-Worker Lease Engine
// Path: src/lib/events/event-dispatcher-worker.ts
// Handles atomic batch lease claims, bounded retries with exponential backoff and jitter,
// dead-letter routing, and authorized operator replays.

import crypto from 'crypto';
import { db } from '@/lib/store/db';
import {
  EventDeliveryRecord,
  DeadLetterEventRecord,
  DeadLetterFailureClassification,
} from '@/types';
import { eventConsumerEngine } from './event-consumer-engine';

export interface DispatchBatchResult {
  claimedCount: number;
  deliveredCount: number;
  retriedCount: number;
  deadLetteredCount: number;
  skippedCount: number;
  details: Array<{
    deliveryId: string;
    eventId: string;
    consumerDomain: string;
    status: string;
    error?: string;
  }>;
}

export class EventDispatcherWorker {
  /**
   * Atomically claims eligible deliveries and dispatches them to registered consumer handlers
   */
  public async claimAndDispatchBatch(options?: {
    workerId?: string;
    limit?: number;
    leaseTimeoutMs?: number;
  }): Promise<DispatchBatchResult> {
    const workerId = options?.workerId || `worker-${process.pid || 'local'}-${Date.now()}`;
    const limit = options?.limit || 20;
    const leaseTimeoutMs = options?.leaseTimeoutMs || 300000; // 5 minute lease

    const result: DispatchBatchResult = {
      claimedCount: 0,
      deliveredCount: 0,
      retriedCount: 0,
      deadLetteredCount: 0,
      skippedCount: 0,
      details: [],
    };

    // 1. Claim batch atomically with lease locking
    const claimedDeliveries = await db.claimEventDeliveries(workerId, limit, leaseTimeoutMs);
    if (!claimedDeliveries || claimedDeliveries.length === 0) {
      return result;
    }

    result.claimedCount = claimedDeliveries.length;
    const now = new Date();

    // 2. Dispatch each claimed delivery
    for (const delivery of claimedDeliveries) {
      try {
        const outboxRecord = await db.getEventOutboxByEventId(delivery.eventId);
        if (!outboxRecord) {
          // Orphaned delivery, mark failed
          await db.updateEventDelivery(delivery.id, {
            status: 'FAILED',
            lastError: `Underlying outbox event '${delivery.eventId}' not found.`,
            lockedAt: undefined,
            lockedBy: undefined,
          });
          result.deadLetteredCount++;
          result.details.push({
            deliveryId: delivery.id,
            eventId: delivery.eventId,
            consumerDomain: delivery.consumerDomain,
            status: 'FAILED',
            error: 'Orphaned outbox record',
          });
          continue;
        }

        // Process through consumer engine
        const outcome = await eventConsumerEngine.processDelivery(
          delivery.consumerDomain,
          outboxRecord.envelope
        );

        if (outcome.status === 'PROCESSED' || outcome.status === 'SKIPPED_DUPLICATE' || outcome.status === 'SKIPPED_STALE') {
          // Success or safe idempotency skip
          await db.updateEventDelivery(delivery.id, {
            status: 'DELIVERED',
            deliveredAt: now.toISOString(),
            lastError: undefined,
            lockedAt: undefined,
            lockedBy: undefined,
          });

          if (outcome.status === 'PROCESSED') {
            result.deliveredCount++;
          } else {
            result.skippedCount++;
          }

          result.details.push({
            deliveryId: delivery.id,
            eventId: delivery.eventId,
            consumerDomain: delivery.consumerDomain,
            status: 'DELIVERED',
          });
        } else {
          // Processing failed: handle retry or route to dead-letter queue
          const newAttemptCount = (delivery.attemptCount || 0) + 1;
          const maxAttempts = delivery.maxAttempts || 3;

          if (newAttemptCount < maxAttempts) {
            // Exponential backoff with jitter: 2^attempt * 1000ms + [0-500ms jitter]
            const jitterMs = Math.floor(Math.random() * 500);
            const backoffMs = Math.pow(2, newAttemptCount) * 1000 + jitterMs;
            const nextAttemptAt = new Date(Date.now() + backoffMs).toISOString();

            await db.updateEventDelivery(delivery.id, {
              status: 'RETRY_SCHEDULED',
              attemptCount: newAttemptCount,
              nextAttemptAt,
              lastAttemptAt: now.toISOString(),
              lastError: outcome.error || 'Handler execution error',
              lockedAt: undefined,
              lockedBy: undefined,
            });

            result.retriedCount++;
            result.details.push({
              deliveryId: delivery.id,
              eventId: delivery.eventId,
              consumerDomain: delivery.consumerDomain,
              status: 'RETRY_SCHEDULED',
              error: outcome.error,
            });
          } else {
            // Max attempts exceeded: route to Dead-Letter Queue
            const deadLetterId = `dlq-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
            const deadLetterRecord: DeadLetterEventRecord = {
              id: deadLetterId,
              deliveryId: delivery.id,
              eventId: delivery.eventId,
              consumerDomain: delivery.consumerDomain,
              failureClassification: 'MAX_RETRIES_EXCEEDED',
              errorMessage: outcome.error || 'Max retry attempts exceeded',
              attemptCount: newAttemptCount,
              firstFailedAt: delivery.lastAttemptAt || now.toISOString(),
              lastFailedAt: now.toISOString(),
              correlationId: outboxRecord.envelope.correlationId,
              resolutionStatus: 'PENDING_REVIEW',
              replayCount: 0,
            };

            await db.saveDeadLetterEvent(deadLetterRecord);

            await db.updateEventDelivery(delivery.id, {
              status: 'DEAD_LETTERED',
              attemptCount: newAttemptCount,
              lastAttemptAt: now.toISOString(),
              lastError: outcome.error || 'Routed to Dead-Letter Queue',
              deadLetterId,
              lockedAt: undefined,
              lockedBy: undefined,
            });

            result.deadLetteredCount++;
            result.details.push({
              deliveryId: delivery.id,
              eventId: delivery.eventId,
              consumerDomain: delivery.consumerDomain,
              status: 'DEAD_LETTERED',
              error: outcome.error,
            });
          }
        }
      } catch (err: any) {
        console.error(`[EventDispatcherWorker] Error dispatching delivery ${delivery.id}:`, err);
        await db.updateEventDelivery(delivery.id, {
          status: 'RETRY_SCHEDULED',
          attemptCount: (delivery.attemptCount || 0) + 1,
          lastError: err.message || 'Worker unexpected error',
          lockedAt: undefined,
          lockedBy: undefined,
        });
        result.retriedCount++;
      }
    }

    return result;
  }

  /**
   * Replays an event from the Dead-Letter Queue with operator authorization
   */
  public async replayDeadLetter(
    deadLetterId: string,
    actorUserId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!reason || reason.trim().length < 5) {
        return { success: false, error: 'Mandatory audit reason (at least 5 characters) required for replay.' };
      }

      const dlq = await db.getDeadLetterEventById(deadLetterId);
      if (!dlq) {
        return { success: false, error: `Dead-letter event '${deadLetterId}' not found.` };
      }

      const delivery = await db.getEventDeliveryById(dlq.deliveryId);
      if (!delivery) {
        return { success: false, error: `Original delivery record '${dlq.deliveryId}' not found.` };
      }

      // Reset delivery to PENDING
      await db.updateEventDelivery(delivery.id, {
        status: 'PENDING',
        attemptCount: 0,
        nextAttemptAt: new Date().toISOString(),
        lastError: undefined,
        lockedAt: undefined,
        lockedBy: undefined,
      });

      // Update DLQ record
      await db.updateDeadLetterEvent(deadLetterId, {
        resolutionStatus: 'REPLAY_QUEUED',
        resolvedBy: actorUserId,
        resolutionReason: reason.trim(),
        replayCount: (dlq.replayCount || 0) + 1,
      });

      // Record audit log
      await db.createAuditLog({
        userId: actorUserId,
        action: 'EVENT_REPLAY_AUTHORIZED',
        resource: 'dead_letter_events',
        resourceId: deadLetterId,
        details: {
          eventId: dlq.eventId,
          consumerDomain: dlq.consumerDomain,
          reason: reason.trim(),
        },
      });

      return { success: true };
    } catch (err: any) {
      console.error('[EventDispatcherWorker] Replay error:', err);
      return { success: false, error: err.message || 'Failed to replay dead letter event' };
    }
  }
}

export const eventDispatcherWorker = new EventDispatcherWorker();

