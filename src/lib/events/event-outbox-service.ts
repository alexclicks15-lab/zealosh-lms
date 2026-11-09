// Zealosh LMS — Central Transactional Event Outbox Service
// Path: src/lib/events/event-outbox-service.ts
// Atomically enqueues domain events with envelope metadata, schema validation, and consumer delivery fan-out.

import crypto from 'crypto';
import { db } from '@/lib/store/db';
import {
  DomainEventEnvelope,
  DomainIdentifier,
  EventOutboxRecord,
  EventDeliveryRecord,
  EventActorType,
  EventDataClassification,
} from '@/types';
import { DomainRegistryService } from './domain-registry';
import { EventContractRegistry } from './event-contract-registry';
import { generateCorrelationId } from '@/lib/diagnostics/correlation';

export interface PublishEventOptions<T extends Record<string, any> = Record<string, any>> {
  eventType: string;
  sourceDomain: DomainIdentifier;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion?: number;
  payload: T;
  idempotencyKey?: string;
  correlationId?: string;
  causationId?: string;
  actorType?: EventActorType;
  actorId?: string;
  dataClassification?: EventDataClassification;
}

export class EventOutboxService {
  /**
   * Publishes a domain event transactionally into the outbox and generates per-consumer delivery records.
   */
  public async publishEvent<T extends Record<string, any> = Record<string, any>>(
    options: PublishEventOptions<T>
  ): Promise<{
    success: boolean;
    envelope?: DomainEventEnvelope<T>;
    deliveriesCount: number;
    error?: string;
  }> {
    try {
      const {
        eventType,
        sourceDomain,
        aggregateType,
        aggregateId,
        aggregateVersion = 1,
        payload,
        actorType = 'SYSTEM',
        actorId,
        dataClassification = 'INTERNAL',
      } = options;

      // 1. Publisher Permission Verification
      if (!DomainRegistryService.isPublisherPermitted(sourceDomain, eventType)) {
        return {
          success: false,
          deliveriesCount: 0,
          error: `Domain '${sourceDomain}' is not permitted to publish event type '${eventType}'.`,
        };
      }

      // 2. Schema Contract & Data Minimization Validation
      const validation = EventContractRegistry.validatePayload(eventType, payload);
      if (!validation.valid) {
        return {
          success: false,
          deliveriesCount: 0,
          error: `Payload validation failed: ${validation.errors.join('; ')}`,
        };
      }

      const eventId = crypto.randomUUID();
      const correlationId = options.correlationId || generateCorrelationId();
      const idempotencyKey =
        options.idempotencyKey || `${sourceDomain}:${eventType}:${aggregateId}:${aggregateVersion}`;
      const now = new Date().toISOString();

      // 3. Check for Duplicate Outbox Event (Idempotency Guard)
      const existingOutbox = await db.getEventOutboxByIdempotencyKey(idempotencyKey);
      if (existingOutbox) {
        const existingDeliveries = await db.getDeliveriesByEventId(existingOutbox.envelope.eventId);
        return {
          success: true,
          envelope: existingOutbox.envelope as DomainEventEnvelope<T>,
          deliveriesCount: existingDeliveries.length,
        };
      }

      // 4. Build Canonical Domain Event Envelope
      const contract = EventContractRegistry.getContract(eventType);
      const envelope: DomainEventEnvelope<T> = {
        eventId,
        eventType,
        schemaVersion: contract?.schemaVersion || 'v1.0.0',
        sourceDomain,
        aggregateType,
        aggregateId,
        aggregateVersion,
        occurredAt: now,
        recordedAt: now,
        correlationId,
        causationId: options.causationId,
        idempotencyKey,
        actorType,
        actorId,
        payload,
        dataClassification: contract?.dataClassification || dataClassification,
      };

      // 5. Persist Outbox Event
      const outboxRecord: EventOutboxRecord = {
        id: `outbox-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        envelope,
        status: 'PENDING',
        createdAt: now,
      };
      await db.saveEventOutbox(outboxRecord);

      // 6. Fan-Out Delivery Records to Authorized Consumers
      const permittedConsumers = DomainRegistryService.getPermittedConsumersForEvent(eventType);
      const deliveryRecords: EventDeliveryRecord[] = [];

      for (const consumerDomain of permittedConsumers) {
        deliveryRecords.push({
          id: `deliv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          eventId: envelope.eventId,
          consumerDomain,
          status: 'PENDING',
          attemptCount: 0,
          maxAttempts: 3,
          created_at: now,
          updated_at: now,
        } as any);
      }

      if (deliveryRecords.length > 0) {
        await db.saveEventDeliveries(deliveryRecords);
      }

      return {
        success: true,
        envelope,
        deliveriesCount: deliveryRecords.length,
      };
    } catch (err: any) {
      console.error('[EventOutboxService] Failed to publish domain event:', err);
      return {
        success: false,
        deliveriesCount: 0,
        error: err.message || 'Internal Outbox Error',
      };
    }
  }
}

export const eventOutboxService = new EventOutboxService();
