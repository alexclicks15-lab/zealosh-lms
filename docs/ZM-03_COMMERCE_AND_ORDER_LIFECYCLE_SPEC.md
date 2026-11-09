# Zealosh LMS — ZM-03 Commerce & Order Lifecycle Specification

**Milestone:** ZM-03  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Order Creation, Gateway Handshake, Atomic Fulfillment & Batch Seat Capacity  
**Authoritative Reference:** [db.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts), [route.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/app/api/payments/order/route.ts)

---

## 1. Commerce Order Lifecycle

Zealosh LMS executes an atomic, transaction-safe commerce lifecycle connecting course selection, billing details, payment gateway order generation, and fulfillment.

```
Candidate Selects Course & Batch
              |
              v
    Pre-Order Capacity Check
              |
              v
       Create Order Record
    (status: PENDING_PAYMENT)
              |
              v
     Gateway Handshake (PG)
              |
              v
       Webhook Received
    (HMAC Signature Validated)
              |
              v
     Atomic Fulfillment
  - Order status -> PAID
  - Batch capacity allocated (+1)
  - Enrollment created (ACTIVE)
  - GST Invoice generated (INV-YYYY-XXXX)
```

---

## 2. Order States

1. **PENDING_PAYMENT:** Order initialized, gateway transaction ID generated, waiting for candidate payment.
2. **PAID:** Payment verified, enrollment provisioned, invoice generated.
3. **FAILED:** Payment rejected by gateway or candidate aborted checkout.
4. **REFUNDED:** Payment refunded via admin action; enrollment revoked; credit note issued (`CN-YYYY-XXXX`).

---

## 3. Atomic Seat Allocation & Anti-Overselling Guard

- **Batch Capacity Gate:** Before creating a payment order, the system checks:
  `batch.enrolledCount < batch.maxStudents`
- If the batch is full, order initialization is rejected with `BATCH_FULL` (HTTP 409).
- Upon successful payment webhook verification:
  - The batch capacity is checked once more to guard against race conditions.
  - If seats remain, `batch.enrolledCount += 1` is committed atomically in the same database transaction as enrollment creation.
  - If a concurrent transaction filled the last seat, the order is flagged for administrative resolution or automated refund, guaranteeing zero batch overselling.

