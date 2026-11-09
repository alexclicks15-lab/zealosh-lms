// Zealosh LMS — Phase 5B Email Delivery Webhook Receiver
// Ingests provider delivery receipts, bounces, complaints, opens and clicks
// Persists events to email_delivery_events and reconciles authoritative email_outbox state

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/store/db';

export async function POST(request: Request) {
  try {
    // 1. Optional Webhook Authentication Gate
    const expectedSecret = process.env.EMAIL_WEBHOOK_SECRET;
    if (expectedSecret) {
      const authHeader = request.headers.get('x-webhook-token') || request.headers.get('authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
      if (token !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized webhook token' }, { status: 401 });
      }
    }

    // 2. Parse Incoming Event Payload
    const body = await request.json();
    const eventTypeRaw = String(body.eventType || body.event || body.type || 'UNKNOWN').toUpperCase();
    const providerMessageId = body.providerMessageId || body.messageId || body.id;
    const recipientEmail = body.recipientEmail || body.email || body.recipient;
    const reason = body.reason || body.description || body.diagnosticCode;

    let normalizedEventType: 'accepted' | 'delivered' | 'bounced' | 'complained' | 'rejected' | 'opened' | 'clicked' = 'accepted';
    if (eventTypeRaw === 'DELIVERY' || eventTypeRaw === 'DELIVERED') {
      normalizedEventType = 'delivered';
    } else if (eventTypeRaw === 'BOUNCE' || eventTypeRaw === 'BOUNCED' || eventTypeRaw === 'DROPPED') {
      normalizedEventType = 'bounced';
    } else if (eventTypeRaw === 'OPEN' || eventTypeRaw === 'OPENED') {
      normalizedEventType = 'opened';
    } else if (eventTypeRaw === 'CLICK' || eventTypeRaw === 'CLICKED') {
      normalizedEventType = 'clicked';
    } else if (eventTypeRaw === 'SPAMREPORT' || eventTypeRaw === 'COMPLAINT') {
      normalizedEventType = 'complained';
    } else if (eventTypeRaw === 'REJECTED' || eventTypeRaw === 'FAILED') {
      normalizedEventType = 'rejected';
    }

    // 3. Locate Matching Outbox Job
    let outboxJobId = body.outboxJobId || body.outboxId;
    if (!outboxJobId && providerMessageId) {
      const candidates = await db.getEmailOutboxJobs({ limit: 10 });
      const found = candidates.jobs.find((j) => j.providerMessageId === providerMessageId);
      if (found) outboxJobId = found.id;
    }

    // 4. Record Delivery Audit Event
    const deliveryEvent = await db.recordEmailDeliveryEvent({
      outboxId: outboxJobId,
      provider: body.provider || 'webhook',
      providerMessageId,
      recipientEmail: recipientEmail || 'unknown@zealosh.com',
      eventType: normalizedEventType,
      rawPayload: body,
      occurredAt: new Date().toISOString(),
    });

    // 5. Reconcile Outbox Job Lifecycle State
    if (outboxJobId) {
      if (normalizedEventType === 'delivered') {
        await db.updateEmailOutboxJob(outboxJobId, {
          status: 'DELIVERED',
        });
      } else if (normalizedEventType === 'bounced') {
        await db.updateEmailOutboxJob(outboxJobId, {
          status: 'BOUNCED',
          errorClassification: 'INVALID_RECIPIENT',
          errorMessage: reason || 'Bounced by recipient mail exchange server',
        });
      } else if (normalizedEventType === 'complained') {
        await db.updateEmailOutboxJob(outboxJobId, {
          status: 'SUPPRESSED',
          errorMessage: 'Delivery suppressed due to spam complaint report',
        });
      }
    }

    return NextResponse.json({
      success: true,
      received: true,
      eventId: deliveryEvent?.id || 'evt_recorded',
      reconciledJobId: outboxJobId,
    });
  } catch (err: any) {
    console.error('[EmailWebhook] Ingestion failed:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal webhook error' }, { status: 500 });
  }
}
