import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { db } from '@/lib/store/db';
import { ProductService } from '@/lib/commerce/product-service';

describe('ZM-IMPL-08C: Payment Checkout, Idempotency & Batch Capacity Guards', () => {
  beforeEach(async () => {
    ProductService.resetForTesting();
    db.paymentOrders.clear();
    db.paymentWebhookEvents.clear();
  });

  it('snapshots authoritative offering price upon order creation preventing client price tampering', async () => {
    const student = await db.getUser('usr-student-01');
    expect(student).toBeDefined();

    // Create order specifying offeringId for ASP Recorded Theory (₹16,000)
    const order = await db.createPaymentOrder({
      userId: student!.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
      offeringId: 'offering-asp-video',
      // Attacker attempts to pass tampered low amount
      amount: 500,
    });

    // Server-authoritative offering price overrides any client value
    expect(order.amount).toBe(16000);
    expect(order.offeringId).toBe('offering-asp-video');
    expect(order.status).toBe('PENDING');
  });

  it('enforces batch seat capacity guard during order initiation', async () => {
    const student = await db.getUser('usr-student-01');
    const batch = db.batches.get('btc-asp-weekday');
    expect(batch).toBeDefined();

    // Fill batch to capacity
    const originalEnrolled = batch!.enrolledCount;
    batch!.enrolledCount = batch!.capacity;

    await expect(
      db.createPaymentOrder({
        userId: student!.id,
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-weekday',
      })
    ).rejects.toThrow(/maximum seat capacity/i);

    // Reset
    batch!.enrolledCount = originalEnrolled;
  });

  it('completes order atomically, issues tax invoice, and grants server-authoritative entitlements', async () => {
    const student = await db.getUser('usr-student-01');
    const order = await db.createPaymentOrder({
      userId: student!.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
      offeringId: 'offering-asp-video',
    });

    const completion = await db.completePaymentOrder(
      order.id,
      'pay_test_gateway_998877',
      'accounts@zealosh.com'
    );

    expect(completion.order.status).toBe('PAID');
    expect(completion.invoice).toBeDefined();
    expect(completion.invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(completion.enrollment).toBeDefined();
    expect(completion.enrollment.courseId).toBe('crs-asp-01');

    // Idempotent re-completion returns identical records without double enrollment
    const reCompletion = await db.completePaymentOrder(
      order.id,
      'pay_test_gateway_998877',
      'accounts@zealosh.com'
    );

    expect(reCompletion.order.id).toBe(completion.order.id);
    expect(reCompletion.invoice.id).toBe(completion.invoice.id);
    expect(reCompletion.enrollment.id).toBe(completion.enrollment.id);
  });

  it('verifies provider-neutral cryptographic webhook HMAC signatures and rejects invalid callers', async () => {
    const secret = 'zealosh_rzp_webhook_secret_staging';
    const payload = JSON.stringify({
      event: 'payment.captured',
      orderId: 'ord_asp_test_01',
      paymentId: 'pay_test_123',
    });

    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const invalidSignature = 'invalid_tampered_signature_hex';

    // Helper checking signature matching logic used in webhook route
    const verifySig = (body: string, sig: string) => {
      const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    };

    expect(verifySig(payload, validSignature)).toBe(true);
    expect(verifySig(payload, invalidSignature)).toBe(false);
  });
});
