# WORKSTREAM H — PAYMENT WEBHOOK PRESERVATION REPORT

### 1. Webhook Security Invariants
In `src/app/api/payments/webhook/route.ts`:
1. **HMAC-SHA256 Signature Verification:** Request signature is verified using `RAZORPAY_WEBHOOK_SECRET` before processing payload.
2. **Durable Replay Deduplication:** Inbound events are recorded in `payment_webhook_events`. Duplicate event deliveries (`eventId` already processed) return HTTP 200 with `{ duplicateIgnored: true }`, preventing duplicate enrollments.
3. **Financial Isolation:** All real payment processing is inactive during ZM-03.1.1. Tests execute exclusively against synthetic mock fixtures.
