// Zealosh LMS — Track 6 Test Suite: Central Event Outbox & Synchronization Engine
// Path: tests/event-outbox-synchronization.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { eventOutboxService } from '@/lib/events/event-outbox-service';
import { eventDispatcherWorker } from '@/lib/events/event-dispatcher-worker';
import { eventConsumerEngine } from '@/lib/events/event-consumer-engine';
import { DomainRegistryService } from '@/lib/events/domain-registry';

describe('Zealosh ZM-IMPL-08G: Central Event Outbox & Synchronization Engine', () => {
  beforeEach(() => {
    db.eventOutbox.clear();
    db.eventDeliveries.clear();
    db.consumerInbox.clear();
    db.deadLetterEvents.clear();
  });

  it('OUTBOX-01: should publish domain event with canonical envelope and fan-out deliveries to permitted consumers', async () => {
    const result = await eventOutboxService.publishEvent({
      eventType: 'commerce.order.paid',
      sourceDomain: 'COMMERCE',
      aggregateType: 'Order',
      aggregateId: 'ord-test-01',
      aggregateVersion: 1,
      payload: {
        orderId: 'ord-test-01',
        userId: 'usr-student-01',
        courseId: 'crs-asp-01',
        offeringId: 'COMPLETE',
        amount: 25000,
        currency: 'INR',
        gatewayPaymentId: 'pay_gateway_123',
      },
    });

    expect(result.success).toBe(true);
    expect(result.envelope).toBeDefined();
    expect(result.envelope?.sourceDomain).toBe('COMMERCE');
    expect(result.envelope?.correlationId).toMatch(/^corr-\d{8}-[a-f0-9]{12}$/);
    expect(result.deliveriesCount).toBeGreaterThan(0);

    const outbox = await db.getEventOutboxByEventId(result.envelope!.eventId);
    expect(outbox).not.toBeNull();
    expect(outbox?.envelope.idempotencyKey).toBe('COMMERCE:commerce.order.paid:ord-test-01:1');
  });

  it('OUTBOX-02: should reject publication if domain is not an authorized publisher for the event type', async () => {
    const result = await eventOutboxService.publishEvent({
      eventType: 'commerce.order.paid',
      sourceDomain: 'GAMIFICATION', // Unrelated domain attempting to publish financial event
      aggregateType: 'Order',
      aggregateId: 'ord-rogue-01',
      payload: {
        orderId: 'ord-rogue-01',
        userId: 'usr-01',
        courseId: 'crs-01',
        offeringId: 'COMPLETE',
        amount: 100,
        currency: 'INR',
        gatewayPaymentId: 'pay_rogue',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("is not permitted to publish event type");
  });

  it('OUTBOX-03: should reject publication if payload violates data minimization or leaks forbidden secrets', async () => {
    const result = await eventOutboxService.publishEvent({
      eventType: 'identity.user.created',
      sourceDomain: 'IDENTITY',
      aggregateType: 'User',
      aggregateId: 'usr-leak-01',
      payload: {
        userId: 'usr-leak-01',
        email: 'test@zealosh.com',
        name: 'Test Student',
        role: 'STUDENT',
        password: 'PlaintextPassword123!', // Forbidden secret in event payload
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Data minimization violation');
  });

  it('OUTBOX-04: should execute consumer inbox deduplication and prevent duplicate business side effects', async () => {
    // 1. Publish event
    const pub = await eventOutboxService.publishEvent({
      eventType: 'commerce.order.paid',
      sourceDomain: 'COMMERCE',
      aggregateType: 'Order',
      aggregateId: 'ord-idemp-01',
      aggregateVersion: 1,
      payload: {
        orderId: 'ord-idemp-01',
        userId: 'usr-idemp-student',
        courseId: 'crs-asp-01',
        offeringId: 'COMPLETE',
        amount: 25000,
        currency: 'INR',
        gatewayPaymentId: 'pay_idemp_123',
      },
    });

    expect(pub.success).toBe(true);

    // 2. Dispatch batch
    const dispatch1 = await eventDispatcherWorker.claimAndDispatchBatch({ limit: 10 });
    expect(dispatch1.deliveredCount).toBeGreaterThan(0);

    // Verify entitlement granted
    const ent = await db.getUserEntitlement('usr-idemp-student', 'crs-asp-01');
    expect(ent).not.toBeNull();
    expect(ent.status).toBe('ACTIVE');

    // 3. Process delivery again directly to test consumer inbox idempotency
    const envelope = pub.envelope!;
    const duplicateOutcome = await eventConsumerEngine.processDelivery('ENTITLEMENTS', envelope);
    expect(duplicateOutcome.status).toBe('SKIPPED_DUPLICATE');
    expect(duplicateOutcome.summary).toContain('previously processed');
  });

  it('OUTBOX-05: should enforce aggregate version ordering and reject stale older events', async () => {
    // Newer event aggregate v2
    const eventV2 = {
      eventId: 'evt-v2',
      eventType: 'identity.user.updated',
      schemaVersion: 'v1.0.0',
      sourceDomain: 'IDENTITY' as const,
      aggregateType: 'User',
      aggregateId: 'usr-aggregate-test',
      aggregateVersion: 2,
      occurredAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      correlationId: 'corr-test',
      idempotencyKey: 'idemp-v2',
      actorType: 'USER' as const,
      payload: { userId: 'usr-aggregate-test', updatedFields: ['phone'] },
      dataClassification: 'INTERNAL' as const,
    };

    // Process v2 first
    const resV2 = await eventConsumerEngine.processDelivery('ACADEMIC', eventV2);
    expect(resV2.status).toBe('PROCESSED');

    // Stale older event aggregate v1 arrives out of order
    const eventV1 = {
      ...eventV2,
      eventId: 'evt-v1',
      aggregateVersion: 1,
      idempotencyKey: 'idemp-v1',
    };

    const resV1 = await eventConsumerEngine.processDelivery('ACADEMIC', eventV1);
    expect(resV1.status).toBe('SKIPPED_STALE');
    expect(resV1.summary).toContain('Skipped stale event');
  });

  it('OUTBOX-06: should route deliveries exceeding max retries to Dead-Letter Queue (DLQ)', async () => {
    // Manually register a failing handler to simulate persistent consumer crash
    eventConsumerEngine.registerHandler('NOTIFICATIONS', 'identity.user.updated', async () => {
      return { success: false, error: 'External Notification Provider Down' };
    });

    const pub = await eventOutboxService.publishEvent({
      eventType: 'identity.user.updated',
      sourceDomain: 'IDENTITY',
      aggregateType: 'User',
      aggregateId: 'usr-dlq-test',
      aggregateVersion: 1,
      payload: { userId: 'usr-dlq-test', updatedFields: ['name'] },
    });

    expect(pub.success).toBe(true);

    // Attempt 1 -> RETRY_SCHEDULED
    const run1 = await eventDispatcherWorker.claimAndDispatchBatch({ limit: 10 });
    expect(run1.retriedCount).toBeGreaterThan(0);

    // Reset attempt delivery nextAttemptAt to now to force retry
    for (const d of db.eventDeliveries.values()) {
      if (d.consumerDomain === 'NOTIFICATIONS') {
        d.nextAttemptAt = new Date(Date.now() - 1000).toISOString();
      }
    }

    // Attempt 2 -> RETRY_SCHEDULED
    await eventDispatcherWorker.claimAndDispatchBatch({ limit: 10 });

    for (const d of db.eventDeliveries.values()) {
      if (d.consumerDomain === 'NOTIFICATIONS') {
        d.nextAttemptAt = new Date(Date.now() - 1000).toISOString();
      }
    }

    // Attempt 3 (maxAttempts: 3) -> DEAD_LETTERED
    const run3 = await eventDispatcherWorker.claimAndDispatchBatch({ limit: 10 });
    expect(run3.deadLetteredCount).toBeGreaterThan(0);

    const dlq = await db.getDeadLetterEvents({ consumerDomain: 'NOTIFICATIONS' });
    expect(dlq.length).toBeGreaterThan(0);
    expect(dlq[0].failureClassification).toBe('MAX_RETRIES_EXCEEDED');
  });

  it('OUTBOX-07: should allow authorized operator to replay dead-lettered events with mandatory audit reason', async () => {
    // Setup dead letter event
    const dlqId = 'dlq-manual-01';
    const deliveryId = 'deliv-dlq-01';
    const eventId = '00000000-0000-0000-0000-000000000001';

    await db.saveEventOutbox({
      id: 'outbox-dlq-01',
      envelope: {
        eventId,
        eventType: 'identity.user.updated',
        schemaVersion: 'v1.0.0',
        sourceDomain: 'IDENTITY',
        aggregateType: 'User',
        aggregateId: 'usr-01',
        aggregateVersion: 1,
        occurredAt: new Date().toISOString(),
        recordedAt: new Date().toISOString(),
        correlationId: 'corr-dlq-01',
        idempotencyKey: 'idemp-dlq-01',
        actorType: 'USER',
        payload: { userId: 'usr-01', updatedFields: ['email'] },
        dataClassification: 'INTERNAL',
      },
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    await db.saveEventDeliveries([
      {
        id: deliveryId,
        eventId,
        consumerDomain: 'NOTIFICATIONS',
        status: 'DEAD_LETTERED',
        attemptCount: 3,
        maxAttempts: 3,
      } as any,
    ]);

    await db.saveDeadLetterEvent({
      id: dlqId,
      deliveryId,
      eventId,
      consumerDomain: 'NOTIFICATIONS',
      failureClassification: 'MAX_RETRIES_EXCEEDED',
      errorMessage: 'Simulated connection timeout',
      attemptCount: 3,
      firstFailedAt: new Date().toISOString(),
      lastFailedAt: new Date().toISOString(),
      correlationId: 'corr-dlq-01',
      resolutionStatus: 'PENDING_REVIEW',
      replayCount: 0,
    });

    // 1. Replay attempt without justification reason must be rejected
    const failedReplay = await eventDispatcherWorker.replayDeadLetter(dlqId, 'admin-user', '');
    expect(failedReplay.success).toBe(false);
    expect(failedReplay.error).toContain('Mandatory audit reason');

    // 2. Replay with valid justification
    const validReplay = await eventDispatcherWorker.replayDeadLetter(
      dlqId,
      'admin-user',
      'Operator confirmed network restoration and authorized replay'
    );
    expect(validReplay.success).toBe(true);

    const updatedDelivery = await db.getEventDeliveryById(deliveryId);
    expect(updatedDelivery?.status).toBe('PENDING');

    const updatedDlq = await db.getDeadLetterEventById(dlqId);
    expect(updatedDlq?.resolutionStatus).toBe('REPLAY_QUEUED');
    expect(updatedDlq?.replayCount).toBe(1);
  });
});

