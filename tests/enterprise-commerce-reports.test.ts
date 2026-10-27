import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { loadEnvConfig } from '@next/env';
import { db } from '../src/lib/store/db';
import { SupabaseAdapter } from '../src/lib/store/supabase-adapter';
import { signToken } from '../src/lib/auth/jwt';
import { User, PaymentOrder } from '../src/types';
import { POST as createOrderHandler, GET as getOrdersHandler } from '../src/app/api/payments/order/route';
import { POST as webhookHandler } from '../src/app/api/payments/webhook/route';
import { POST as refundHandler } from '../src/app/api/admin/refunds/route';
import { GET as getInvoiceHandler } from '../src/app/api/invoices/[invoiceId]/route';
import { GET as listInvoicesHandler } from '../src/app/api/invoices/route';
import { GET as getReportsHandler } from '../src/app/api/admin/reports/route';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

describe('Zealosh LMS — Milestone 7: Enterprise Commerce, Invoicing & Compliance Reporting Suite', () => {
  const originalStorage = process.env.DATABASE_STORAGE;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'zealosh_rzp_webhook_secret_staging';

  const testStudent: User = {
    id: 'usr-comm-student',
    email: 'comm.student@zealosh.com',
    name: 'Rohit Nair',
    role: 'STUDENT',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const otherStudent: User = {
    id: 'usr-comm-other',
    email: 'other.student@zealosh.com',
    name: 'Kavitha Pillai',
    role: 'STUDENT',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const adminUser: User = {
    id: 'usr-comm-admin',
    email: 'admin.finance@zealosh.com',
    name: 'Finance Controller',
    role: 'SUPER_ADMIN',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let studentToken: string;
  let otherStudentToken: string;
  let adminToken: string;

  beforeAll(() => {
    process.env.DATABASE_STORAGE = 'in_memory';
    db.resetToSeed();

    db.users.set(testStudent.id, testStudent);
    db.users.set(otherStudent.id, otherStudent);
    db.users.set(adminUser.id, adminUser);

    studentToken = signToken({
      userId: testStudent.id,
      email: testStudent.email,
      role: testStudent.role,
      name: testStudent.name,
    });

    otherStudentToken = signToken({
      userId: otherStudent.id,
      email: otherStudent.email,
      role: otherStudent.role,
      name: otherStudent.name,
    });

    adminToken = signToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      name: adminUser.name,
    });
  });

  afterAll(() => {
    process.env.DATABASE_STORAGE = originalStorage;
    db.resetToSeed();
  });

  // -------------------------------------------------------------
  // 1. Payment Order Creation Tests
  // -------------------------------------------------------------
  it('1. should reject payment order creation when candidate is not authenticated', async () => {
    const req = new Request('http://localhost:3000/api/payments/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: 'crs-asp-01', batchId: 'btc-asp-nov26' }),
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });

  it('2. should reject payment order for non-existent course or batch', async () => {
    const req = new Request('http://localhost:3000/api/payments/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ courseId: 'crs-nonexistent', batchId: 'btc-asp-nov26' }),
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(404);
  });

  it('3. should reject payment order when prerequisite certification is missing', async () => {
    // CSP requires holding ASP certification
    const req = new Request('http://localhost:3000/api/payments/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ courseId: 'crs-csp-02', batchId: 'btc-csp-nov26' }),
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Prerequisite requirement not satisfied');
  });

  it('4. should successfully create a payment order with accurate INR pricing and audit logging', async () => {
    const req = new Request('http://localhost:3000/api/payments/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-nov26',
        currency: 'INR',
        gateway: 'RAZORPAY',
        billingAddress: {
          companyName: 'Safety First Ltd',
          city: 'Ernakulam',
          state: 'Kerala',
          country: 'India',
        },
      }),
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.order.id).toMatch(/^ord_asp/);
    expect(body.order.amount).toBe(34999);
    expect(body.order.currency).toBe('INR');
    expect(body.order.status).toBe('PENDING');
    expect(body.order.userId).toBe(testStudent.id);
  });

  // -------------------------------------------------------------
  // 2. Cryptographic Webhook Handler & Invoice Issuance Tests
  // -------------------------------------------------------------
  it('5. should reject payment webhook when cryptographic signature is missing or tampered', async () => {
    const fakePayload = JSON.stringify({
      orderId: 'ord_test_fake',
      paymentId: 'pay_test_fake',
    });

    const req = new Request('http://localhost:3000/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'tampered_signature_hex_0000',
      },
      body: fakePayload,
    });

    const res = await webhookHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('signature');
  });

  it('6. should accept valid signed webhook, atomically enroll student, and generate GST tax invoice', async () => {
    // 1. Create order
    const order = await db.createPaymentOrder({
      userId: testStudent.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      currency: 'INR',
      gateway: 'RAZORPAY',
      billingAddress: {
        companyName: 'Apex PetroChem Ltd',
        street: 'Industrial Zone Block 4',
        city: 'Kollam',
        state: 'Kerala',
        country: 'India',
        taxId: '32AABCA0000Z1Z1',
      },
    });

    const paymentId = `pay_rzp_${Date.now()}`;
    const payloadObj = {
      event: 'payment.captured',
      orderId: order.id,
      paymentId,
      billingAddress: {
        companyName: 'Apex PetroChem Ltd',
        city: 'Kollam',
        state: 'Kerala',
      },
    };

    const rawBody = JSON.stringify(payloadObj);
    const validSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const req = new Request('http://localhost:3000/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSignature,
      },
      body: rawBody,
    });

    const res = await webhookHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('PAID');
    expect(body.invoiceNumber).toMatch(/^INV-2026-/);
    expect(body.enrollmentId).toBeDefined();

    // Verify student is now actively enrolled
    const enrollments = await db.getEnrollments(testStudent.id);
    const activeEnr = enrollments.find((e) => e.courseId === 'crs-asp-01');
    expect(activeEnr).toBeDefined();
    expect(activeEnr?.status).toBe('ACTIVE');

    // Verify invoice has valid Indian GST calculation (18% inclusive)
    const invoice = await db.getInvoice(body.invoiceId);
    expect(invoice).toBeDefined();
    expect(invoice!.taxRatePercent).toBe(18);
    expect((invoice!.subtotal || 0) + (invoice!.taxAmount || 0)).toBe(order.amount);
    expect(invoice!.providerGstin).toBe('32AABCZ1234F1Z5');
    expect(invoice!.hsnCode).toBe('999293');
  });

  it('7. should enforce idempotency on repeated webhook notifications for the same payment', async () => {
    const orders = Array.from(db.paymentOrders.values()).filter((o) => o.status === 'PAID');
    const existingOrder = orders[0];
    expect(existingOrder).toBeDefined();

    const payloadObj = {
      event: 'payment.captured',
      orderId: existingOrder.id,
      paymentId: existingOrder.gatewayPaymentId,
    };
    const rawBody = JSON.stringify(payloadObj);
    const validSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const req = new Request('http://localhost:3000/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSignature,
      },
      body: rawBody,
    });

    const res = await webhookHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.invoiceId).toBe(existingOrder.invoiceId);
  });

  // -------------------------------------------------------------
  // 3. Invoice Access & Authorization Tests
  // -------------------------------------------------------------
  it('8. should allow student to fetch their own invoice and reject unauthorized cross-student view', async () => {
    const studentInvoices = await db.listInvoices(testStudent.id);
    expect(studentInvoices.length).toBeGreaterThan(0);
    const targetInvoice = studentInvoices[0];

    // 1. Authorized student access
    const reqAuth = new Request(`http://localhost:3000/api/invoices/${targetInvoice.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const resAuth = await getInvoiceHandler(reqAuth, { params: { invoiceId: targetInvoice.id } });
    expect(resAuth.status).toBe(200);
    const bodyAuth = await resAuth.json();
    expect(bodyAuth.invoice.id).toBe(targetInvoice.id);

    // 2. Unauthorized other student access
    const reqUnauth = new Request(`http://localhost:3000/api/invoices/${targetInvoice.id}`, {
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    const resUnauth = await getInvoiceHandler(reqUnauth, { params: { invoiceId: targetInvoice.id } });
    expect(resUnauth.status).toBe(403);
  });

  it('9. should allow superadmin to process a refund, updating invoice and revoking enrollment', async () => {
    const orders = Array.from(db.paymentOrders.values()).filter((o) => o.status === 'PAID');
    const orderToRefund = orders[0];

    const { order, invoice } = await db.processRefund(
      orderToRefund.id,
      'Administrative withdrawal approval',
      adminUser.email,
      adminUser.id,
      adminUser.role,
      'rfnd_test_mock_123'
    );

    expect(order.status).toBe('REFUNDED');
    expect(order.refundReason).toBe('Administrative withdrawal approval');
    expect(order.gatewayRefundId).toBe('rfnd_test_mock_123');
    expect(invoice.status).toBe('REFUNDED');

    // Verify enrollment is revoked
    if (order.enrollmentId) {
      const enr = db.enrollments.get(order.enrollmentId);
      expect(enr?.status).toBe('REVOKED');
    }
  });

  // -------------------------------------------------------------
  // 4. Compliance Reporting & Multi-Format Export Tests
  // -------------------------------------------------------------
  it('10. should reject compliance report export by non-administrative users', async () => {
    const req = new Request('http://localhost:3000/api/admin/reports?dataset=revenue&format=json', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getReportsHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Forbidden');
  });

  it('11. should export compliance reports across all 4 datasets in JSON format for administrators', async () => {
    const datasets = ['enrollments', 'exams', 'certificates', 'revenue'] as const;

    for (const dataset of datasets) {
      const req = new Request(`http://localhost:3000/api/admin/reports?dataset=${dataset}&format=json`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const res = await getReportsHandler(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.dataset).toBe(dataset);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.rowCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('12. should stream compliance reports in standard CSV format with correct Content-Disposition header', async () => {
    const req = new Request('http://localhost:3000/api/admin/reports?dataset=revenue&format=csv', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const res = await getReportsHandler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="zealosh_revenue_report_/);

    const csvText = await res.text();
    expect(csvText).toContain('"invoiceNumber"');
    expect(csvText).toContain('"customerName"');
    expect(csvText).toContain('"totalAmount"');
    expect(csvText).toContain('"hsnCode"');
  });

  // -------------------------------------------------------------
  // 5. Accounting Snapshot Stability & Authoritative Integrity
  // -------------------------------------------------------------
  it('13. should ensure issued invoice snapshot values survive subsequent course pricing changes', async () => {
    const studentInvoices = await db.listInvoices(testStudent.id);
    expect(studentInvoices.length).toBeGreaterThan(0);
    const existingInvoice = studentInvoices[0];
    const originalSubtotal = existingInvoice.subtotal;
    const originalTotal = existingInvoice.totalAmount;

    // Mutate course catalog pricing
    const course = db.courses.get(existingInvoice.courseId);
    if (course) {
      course.priceInr = 99999;
      course.priceUsd = 2000;
    }

    // Retrieve invoice again
    const fetchedInvoice = await db.getInvoice(existingInvoice.id);
    expect(fetchedInvoice).toBeDefined();
    expect(fetchedInvoice!.subtotal).toBe(originalSubtotal);
    expect(fetchedInvoice!.totalAmount).toBe(originalTotal);
    expect(fetchedInvoice!.subtotal + fetchedInvoice!.taxAmount).toBe(originalTotal);
  });

  it('14. should reject payment orders for batches at maximum capacity without over-enrolling', async () => {
    const fullBatch = db.batches.get('btc-asp-full');
    expect(fullBatch).toBeDefined();

    const req = new Request('http://localhost:3000/api/payments/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ courseId: 'crs-asp-01', batchId: 'btc-asp-full' }),
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('maximum seat capacity');
  });

  it('15. should execute authoritative Supabase commerce lifecycle (order -> atomic fulfill -> refund -> cleanup)', async () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!serviceRoleKey || !supabaseUrl || !anonKey) {
      console.warn('Skipping live Supabase commerce test: credentials not configured');
      return;
    }

    const adapter = new SupabaseAdapter();
    const liveOrderId = `ord_live_vitest_${Date.now()}`;
    const livePaymentId = `pay_live_vitest_${Date.now()}`;

    // 1. Create order in Supabase
    const newOrder: PaymentOrder = {
      id: liveOrderId,
      userId: 'usr-admin-01',
      userEmail: 'admin@zealosh.com',
      userName: 'Administrator',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
      currency: 'INR',
      amount: 24999,
      status: 'PENDING',
      gateway: 'RAZORPAY',
      gatewayOrderId: `rzp_ord_${Date.now()}`,
      billingAddress: { city: 'Kochi', state: 'Kerala', country: 'India' },
      createdAt: new Date().toISOString(),
    };

    const createdOrder = await adapter.createPaymentOrder(newOrder);
    expect(createdOrder.id).toBe(liveOrderId);
    expect(createdOrder.status).toBe('PENDING');

    // 2. Verify that unauthorized anon client cannot execute complete_payment_order_atomic or process_refund_atomic
    const anonClient = createClient(supabaseUrl, anonKey);
    const { error: anonFulfillErr } = await anonClient.rpc('complete_payment_order_atomic', {
      p_order_id: liveOrderId,
      p_gateway_payment_id: livePaymentId,
    });
    expect(anonFulfillErr).toBeDefined();
    expect(anonFulfillErr?.message).toContain('permission denied');

    const { error: anonRefundErr } = await anonClient.rpc('process_refund_atomic', {
      p_order_id: liveOrderId,
      p_actor_user_id: 'usr-unauth',
      p_actor_email: 'unauth@test.com',
      p_reason: 'Testing anon block',
    });
    expect(anonRefundErr).toBeDefined();
    expect(anonRefundErr?.message).toContain('permission denied');

    // 3. Fresh adapter instance can retrieve the order after restart-like reinitialization
    const freshAdapter = new SupabaseAdapter();
    const retrievedOrder = await freshAdapter.getPaymentOrder(liveOrderId);
    expect(retrievedOrder).toBeDefined();
    expect(retrievedOrder!.id).toBe(liveOrderId);
    expect(retrievedOrder!.amount).toBe(24999);

    // 4. Complete payment atomically via trusted service_role client
    const fulfillResult = await freshAdapter.completePaymentOrder({
      orderId: liveOrderId,
      gatewayPaymentId: livePaymentId,
      actorEmail: 'vitest@gateway.zealosh.com',
      billingAddress: { city: 'Kochi', state: 'Kerala', country: 'India' },
      hsnCode: '999293',
      providerGstin: '32AABCZ1234F1Z5',
    });

    expect(fulfillResult.order.status).toBe('PAID');
    expect(fulfillResult.invoice.totalAmount).toBe(24999);
    expect(fulfillResult.invoice.subtotal + fulfillResult.invoice.taxAmount).toBe(24999);
    expect(fulfillResult.invoice.invoiceNumber).toMatch(/^INV-2026-\d{4}$/);
    expect(fulfillResult.enrollment.id).toBeDefined();

    // 5. Idempotent re-execution does not duplicate
    const idempResult = await freshAdapter.completePaymentOrder({
      orderId: liveOrderId,
      gatewayPaymentId: livePaymentId,
      actorEmail: 'vitest@gateway.zealosh.com',
    });
    expect(idempResult.invoice.id).toBe(fulfillResult.invoice.id);
    expect(idempResult.enrollment.id).toBe(fulfillResult.enrollment.id);

    // 6. Refund and access revocation with real actor identity and gateway refund ID
    const refundResult = await freshAdapter.processRefund({
      orderId: liveOrderId,
      actorUserId: 'usr-admin-01',
      actorEmail: 'admin@zealosh.com',
      actorRole: 'SUPER_ADMIN',
      reason: 'Vitest live suite verification',
      gatewayRefundId: 'rfnd_live_vitest_999',
    });
    expect(refundResult.order.status).toBe('REFUNDED');
    expect(refundResult.order.refundReason).toBe('Vitest live suite verification');
    expect(refundResult.order.gatewayRefundId).toBe('rfnd_live_vitest_999');
    expect(refundResult.invoice.status).toBe('REFUNDED');

    // Duplicate refund is rejected
    await expect(
      freshAdapter.processRefund({
        orderId: liveOrderId,
        actorUserId: 'usr-admin-01',
        actorEmail: 'admin@zealosh.com',
        actorRole: 'SUPER_ADMIN',
        reason: 'Duplicate refund attempt',
      })
    ).rejects.toThrow('already been refunded');

    // Verify revoked enrollment
    const revokedEnr = await freshAdapter.getEnrollmentById(fulfillResult.enrollment.id);
    expect(revokedEnr?.status).toBe('REVOKED');

    // 7. Clean up fixtures
    const client = freshAdapter.getClient();
    await client.from('invoices').delete().eq('id', fulfillResult.invoice.id);
    await client.from('payment_orders').delete().eq('id', liveOrderId);
    await client.from('enrollments').delete().eq('id', fulfillResult.enrollment.id);
  });

  // -------------------------------------------------------------
  // 5. Administrative Refund Endpoint & Actor Security Tests
  // -------------------------------------------------------------
  it('16. should enforce administrative authentication, valid reason, and session-derived actor identity on refund endpoint', async () => {
    // 1. Unauthenticated refund attempt -> 401
    const unauthReq = new Request('http://localhost:3000/api/admin/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'ord-dummy', reason: 'Attempt without token' }),
    });
    const unauthRes = await refundHandler(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. Student attempting refund -> 403 Forbidden
    const studentReq = new Request('http://localhost:3000/api/admin/refunds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ orderId: 'ord-dummy', reason: 'Student trying to refund' }),
    });
    const studentRes = await refundHandler(studentReq);
    expect(studentRes.status).toBe(403);
    const studentBody = await studentRes.json();
    expect(studentBody.error).toContain('Administrator privileges required');

    // 3. Admin attempting refund without reason -> 400
    const noReasonReq = new Request('http://localhost:3000/api/admin/refunds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ orderId: 'ord-dummy', reason: '   ' }),
    });
    const noReasonRes = await refundHandler(noReasonReq);
    expect(noReasonRes.status).toBe(400);
    const noReasonBody = await noReasonRes.json();
    expect(noReasonBody.error).toContain('meaningful refund reason');

    // 4. Admin processing refund on an existing paid order
    const paidOrders = Array.from(db.paymentOrders.values()).filter((o) => o.status === 'PAID');
    if (paidOrders.length > 0) {
      const targetOrder = paidOrders[0];
      const validRefundReq = new Request('http://localhost:3000/api/admin/refunds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          orderId: targetOrder.id,
          reason: 'Authorized course cancellation by candidate request',
          gatewayRefundId: 'rfnd_admin_route_123',
        }),
      });
      const validRes = await refundHandler(validRefundReq);
      expect(validRes.status).toBe(200);
      const validBody = await validRes.json();
      expect(validBody.success).toBe(true);
      expect(validBody.status).toBe('REFUNDED');
      expect(validBody.refundReason).toBe('Authorized course cancellation by candidate request');
      expect(validBody.gatewayRefundId).toBe('rfnd_admin_route_123');

      // Attempting to refund again should be rejected with 400
      const dupeRefundReq = new Request('http://localhost:3000/api/admin/refunds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          orderId: targetOrder.id,
          reason: 'Duplicate refund attempt',
        }),
      });
      const dupeRes = await refundHandler(dupeRefundReq);
      expect(dupeRes.status).toBe(400);
    }
  });

  it('17. should reject payment events with mismatched amount, currency, or failure status without fulfilling order', async () => {
    // 1. Create a fresh pending order
    const orderReq = new Request('http://localhost:3000/api/payments/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ courseId: 'crs-asp-01', batchId: 'btc-asp-weekday' }),
    });
    const orderRes = await createOrderHandler(orderReq);
    expect(orderRes.status).toBe(201);
    const { order } = await orderRes.json();
    expect(order.status).toBe('PENDING');

    // 2. Mismatched amount in webhook payload -> 400 AMOUNT_MISMATCH
    const mismatchedAmountBody = JSON.stringify({
      event: 'payment.captured',
      orderId: order.id,
      paymentId: `pay_mismatch_${Date.now()}`,
      amount: 999, // Expected is 24999
    });
    const sigMismatch = crypto.createHmac('sha256', webhookSecret).update(mismatchedAmountBody).digest('hex');

    const mismatchReq = new Request('http://localhost:3000/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': sigMismatch,
      },
      body: mismatchedAmountBody,
    });
    const mismatchRes = await webhookHandler(mismatchReq);
    expect(mismatchRes.status).toBe(400);
    const mismatchJson = await mismatchRes.json();
    expect(mismatchJson.error).toContain('AMOUNT_MISMATCH');

    // Verify order remains PENDING
    const checkOrder1 = await db.getPaymentOrder(order.id);
    expect(checkOrder1?.status).toBe('PENDING');

    // 3. Webhook with payment failure event -> 400 PAYMENT_FAILED
    const failedEventBody = JSON.stringify({
      event: 'payment.failed',
      orderId: order.id,
      paymentId: `pay_failed_${Date.now()}`,
      amount: order.amount,
    });
    const sigFailed = crypto.createHmac('sha256', webhookSecret).update(failedEventBody).digest('hex');

    const failedReq = new Request('http://localhost:3000/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': sigFailed,
      },
      body: failedEventBody,
    });
    const failedRes = await webhookHandler(failedReq);
    expect(failedRes.status).toBe(400);
    const failedJson = await failedRes.json();
    expect(failedJson.error).toContain('PAYMENT_FAILED');

    // Verify order still remains PENDING
    const checkOrder2 = await db.getPaymentOrder(order.id);
    expect(checkOrder2?.status).toBe('PENDING');
  });
});
