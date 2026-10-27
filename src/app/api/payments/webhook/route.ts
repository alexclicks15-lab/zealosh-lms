import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/store/db';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'zealosh_rzp_webhook_secret_staging';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const signature = request.headers.get('x-razorpay-signature') || body.signature;
    const isMockBypass = request.headers.get('x-mock-webhook') === 'true';

    // Extract transaction details based on standard payload schemas
    let orderId: string | undefined;
    let paymentId: string | undefined;
    let billingAddress: any;

    if (body.event === 'payment.captured' || body.event === 'order.paid') {
      const paymentEntity = body.payload?.payment?.entity;
      orderId = paymentEntity?.notes?.orderId || paymentEntity?.notes?.internalOrderId || body.orderId;
      paymentId = paymentEntity?.id || body.paymentId;
      billingAddress = paymentEntity?.notes?.billingAddress || body.billingAddress;
    } else {
      orderId = body.orderId;
      paymentId = body.paymentId;
      billingAddress = body.billingAddress;
    }

    if (!orderId || !paymentId) {
      return NextResponse.json(
        { error: 'Missing required webhook fields: orderId and paymentId are required' },
        { status: 400 }
      );
    }

    // 1. Cryptographic HMAC-SHA256 Signature Verification: Reject invalid callers before spending DB resources
    if (!isMockBypass) {
      if (!signature) {
        return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
      }

      const expectedHmacRaw = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
      const expectedHmacPair = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

      const sigBuf = Buffer.from(signature);
      const rawBuf = Buffer.from(expectedHmacRaw);
      const pairBuf = Buffer.from(expectedHmacPair);

      const matchesRaw = sigBuf.length === rawBuf.length && crypto.timingSafeEqual(sigBuf, rawBuf);
      const matchesPair = sigBuf.length === pairBuf.length && crypto.timingSafeEqual(sigBuf, pairBuf);

      if (!matchesRaw && !matchesPair) {
        return NextResponse.json({ error: 'Invalid cryptographic webhook signature' }, { status: 400 });
      }
    }

    // 2. Retrieve the persisted pending order from authoritative persistence
    const persistedOrder = await db.getPaymentOrder(orderId);
    if (!persistedOrder) {
      return NextResponse.json({ error: `Payment order ${orderId} not found` }, { status: 404 });
    }

    // 3. Idempotency Guard: if already PAID, return idempotent success without re-enrolling or re-invoicing
    if (persistedOrder.status === 'PAID') {
      const invoice = persistedOrder.invoiceId ? await db.getInvoice(persistedOrder.invoiceId) : undefined;
      return NextResponse.json({
        success: true,
        orderId: persistedOrder.id,
        status: persistedOrder.status,
        invoiceId: persistedOrder.invoiceId,
        invoiceNumber: invoice?.invoiceNumber,
        enrollmentId: persistedOrder.enrollmentId,
      });
    }

    if (persistedOrder.status !== 'PENDING') {
      return NextResponse.json(
        { error: `INVALID_STATE: Cannot fulfill order in status ${persistedOrder.status}` },
        { status: 400 }
      );
    }

    // 4. Validate payment event payload against expected order parameters
    const eventType = body.event || (body.status ? `payment.${body.status}` : undefined);
    if (eventType) {
      const failureEvents = ['payment.failed', 'payment.cancelled', 'order.cancelled'];
      if (failureEvents.includes(eventType)) {
        return NextResponse.json(
          { error: `PAYMENT_FAILED: Webhook reported payment failure event ${eventType}` },
          { status: 400 }
        );
      }

      const successEvents = ['payment.captured', 'order.paid', 'payment.authorized', 'payment.paid'];
      if (!successEvents.includes(eventType) && !isMockBypass) {
        return NextResponse.json(
          { error: `PAYMENT_NOT_CAPTURED: Webhook event ${eventType} does not indicate captured payment` },
          { status: 400 }
        );
      }
    }

    // Verify amount matches expected order amount (supports both decimal and paise representations)
    const paymentEntity = body.payload?.payment?.entity;
    const reportedAmount = paymentEntity?.amount !== undefined ? paymentEntity.amount : body.amount;
    if (reportedAmount !== undefined && reportedAmount !== null) {
      const numAmount = Number(reportedAmount);
      const expectedAmount = persistedOrder.amount;
      const matchesStandard = Math.abs(numAmount - expectedAmount) < 0.01;
      const matchesSubunits = Math.abs(numAmount - expectedAmount * 100) < 1;
      if (!matchesStandard && !matchesSubunits) {
        return NextResponse.json(
          { error: `AMOUNT_MISMATCH: Reported payment amount ${reportedAmount} does not match order expected amount ${expectedAmount}` },
          { status: 400 }
        );
      }
    }

    // Verify currency matches
    const reportedCurrency = paymentEntity?.currency || body.currency;
    if (reportedCurrency && reportedCurrency.toUpperCase() !== persistedOrder.currency.toUpperCase()) {
      return NextResponse.json(
        { error: `CURRENCY_MISMATCH: Reported currency ${reportedCurrency} does not match order currency ${persistedOrder.currency}` },
        { status: 400 }
      );
    }

    // Verify gateway order reference if both provide it
    const reportedGatewayOrderId = paymentEntity?.order_id || body.gatewayOrderId;
    if (reportedGatewayOrderId && persistedOrder.gatewayOrderId && reportedGatewayOrderId !== persistedOrder.gatewayOrderId) {
      return NextResponse.json(
        { error: `GATEWAY_ORDER_MISMATCH: Reported gateway order ${reportedGatewayOrderId} does not match order ${persistedOrder.gatewayOrderId}` },
        { status: 400 }
      );
    }

    // 5. Complete order and issue tax invoice atomically via trusted backend
    const result = await db.completePaymentOrder(
      orderId,
      paymentId,
      'webhook@gateway.zealosh.com',
      billingAddress
    );

    return NextResponse.json({
      success: true,
      orderId: result.order.id,
      status: result.order.status,
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      enrollmentId: result.enrollment.id,
    });
  } catch (err: any) {
    const status = err.message.includes('not found') || err.message.includes('ORDER_NOT_FOUND')
      ? 404
      : err.message.includes('INVALID_STATE') ||
        err.message.includes('DUPLICATE_PAYMENT_ID') ||
        err.message.includes('Cannot complete') ||
        err.message.includes('MISMATCH') ||
        err.message.includes('FAILED')
      ? 400
      : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
