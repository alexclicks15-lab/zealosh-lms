# Zealosh LMS — ZM-03 Payment Provider Integration Specification

**Milestone:** ZM-03  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Payment Gateway Adapters, Razorpay / Cashfree Contracts, HMAC Signatures  
**Authoritative Reference:** [route.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/app/api/payments/webhook/route.ts), [db.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts)

---

## 1. Gateway Provider Architecture

Zealosh LMS supports primary Indian and international payment gateways via standardized adapter interfaces:
- **Primary Indian Gateway:** Razorpay / Cashfree (INR Netbanking, UPI, Credit/Debit Cards, Corporate Cards).
- **International Gateway:** Stripe / PayPal (USD, EUR, GBP for overseas HSE candidates).

---

## 2. Webhook Signature Verification Contract

All incoming payment webhook events must pass cryptographic authentication before processing.

### HMAC-SHA256 Verification Algorithm
```typescript
import crypto from 'crypto';

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8')
  );
}
```

- **Rejection Policy:** If the signature header is missing or does not match the computed digest using `crypto.timingSafeEqual`, the webhook handler immediately terminates with HTTP 400/401 and logs a security alert. No database mutations occur.

---

## 3. Supported Webhook Event Types

- `payment.captured` / `order.paid`: Signals that funds have been settled. Triggers order completion, enrollment creation, and invoice generation.
- `payment.failed`: Records payment failure details and notifies the candidate.
- `refund.processed`: Confirms external gateway refund; issues internal credit note.

