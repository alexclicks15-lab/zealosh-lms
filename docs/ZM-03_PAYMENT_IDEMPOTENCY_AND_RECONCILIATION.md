# Zealosh LMS — ZM-03 & ZM-03.1 Payment Idempotency, Durable Webhook Logging & Reconciliation Specification

**Milestones:** ZM-03 & ZM-03.1  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Cryptographic Webhook Validation, Durable Replay Deduplication, Idempotency Invariants & Gateway Reconciliation  
**Authoritative Implementation:** [`src/app/api/payments/webhook/route.ts`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/app/api/payments/webhook/route.ts) & [`src/lib/store/db.ts`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts)

---

## 1. Webhook Execution Pipeline & Verification Ordering

To guarantee zero database resource exhaustion from malicious or forged traffic while preventing duplicate order fulfillment, the webhook endpoint enforces a strict 5-stage pipeline:

```
Incoming Webhook HTTP Request
               |
               v
1. Cryptographic HMAC-SHA256 Signature Verification
   (Rejects unauthenticated callers immediately with 400 before DB access)
               |
               v
2. Durable Webhook Event Recording & Replay Check
   (Computes SHA-256 payloadHash; queries payment_webhook_events)
   - If event status == PROCESSED -> Return HTTP 200 { duplicateIgnored: true }
   - Otherwise -> Record event status = 'RECEIVED'
               |
               v
3. Order Status & Idempotency Inspection
   - If order.status == 'PAID' -> Return HTTP 200 { status: 'PAID' }
   - If order.status != 'PENDING' -> Return 400 { error: 'INVALID_STATE' }
               |
               v
4. Payload Integrity Verification
   (Validates eventType, currency match, amount match [decimal and paise])
               |
               v
5. Atomic Fulfill & Status Transition
   - completePaymentOrder (atomic enrollment + statutory GST tax invoice)
   - Transition webhook event status to 'PROCESSED'
   - Return HTTP 200 with orderId, invoiceId, invoiceNumber, enrollmentId
```

---

## 2. Durable `PaymentWebhookEvent` Schema (`payment_webhook_events`)

```sql
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id VARCHAR(64) PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    event_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    order_id VARCHAR(64) REFERENCES public.payment_orders(id) ON DELETE SET NULL,
    payment_id VARCHAR(128),
    payload_hash VARCHAR(128) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_event
    ON public.payment_webhook_events(provider, event_id);
```

---

## 3. Financial Reconciliation Invariants

1. **Zero Double-Enrollment:** Network retries from Razorpay or Stripe cannot create duplicate enrollment records or increment batch capacity counts.
2. **Zero Duplicate Invoices:** Each paid order maps to exactly one sequential tax invoice (`INV-YYYY-XXXX`). Replay deliveries return the existing invoice ID and invoice number.
3. **Payload Hash Integrity:** In-flight payload body is hashed with SHA-256 (`payloadHash`), preventing payload tampering during replay simulations.
4. **Audit Trail Completeness:** All webhook processing outcomes (success, replay ignore, signature failure) generate traceable audit log entries.
