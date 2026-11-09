// Zealosh LMS — Phase 3: High-Stakes HSE Certification Examination Engine, Commerce & Statutory Invoicing Suite
// Tests versioned blueprints, question bank shielding, server-authoritative timer, in-flight autosave,
// reconnect recovery, manual evaluation queues, exam certificates (ZEI/EXAM/YYYY/XXXXXX),
// payment order lifecycle, HMAC webhook verification, GST breakdown (CGST/SGST/IGST/LUT), and credit notes.

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { POST as startExamHandler } from '@/app/api/exams/[examId]/start/route';
import { PUT as saveAnswersHandler } from '@/app/api/exams/[examId]/answers/route';
import { POST as submitExamHandler } from '@/app/api/exams/[examId]/submit/route';
import { GET as getExamHandler } from '@/app/api/exams/[examId]/route';
import { GET as getEvalQueueHandler, POST as submitEvalHandler, PUT as publishEvalHandler } from '@/app/api/admin/exams/evaluations/route';
import { POST as createOrderHandler } from '@/app/api/payments/order/route';
import { POST as webhookHandler } from '@/app/api/payments/webhook/route';
import { GET as getInvoiceHandler } from '@/app/api/invoices/[invoiceId]/route';

describe('Zealosh LMS — Phase 3: HSE Exam Engine, Commerce & Statutory Invoicing Suite', () => {
  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'zealosh_rzp_webhook_secret_staging';

  const testStudent = {
    id: 'usr-p3-student-01',
    name: 'Anand Nair',
    email: 'anand.nair@zealosh-test.com',
    role: 'STUDENT' as const,
    organizationId: 'org-zealosh-main',
  };

  const testInstructor = {
    id: 'usr-p3-instructor-01',
    name: 'Dr. Suresh Babu',
    email: 'suresh.babu@zealosh-test.com',
    role: 'INSTRUCTOR' as const,
    organizationId: 'org-zealosh-main',
  };

  const testAdmin = {
    id: 'usr-p3-admin-01',
    name: 'Principal Administrator',
    email: 'admin@zealosh-test.com',
    role: 'SUPER_ADMIN' as const,
    organizationId: 'org-zealosh-main',
  };

  let studentToken: string;
  let instructorToken: string;
  let adminToken: string;

  beforeEach(() => {
    // Register test actors in memory
    db.users.set(testStudent.id, {
      ...testStudent,
      passwordHash: 'hashed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.users.set(testInstructor.id, {
      ...testInstructor,
      passwordHash: 'hashed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.users.set(testAdmin.id, {
      ...testAdmin,
      passwordHash: 'hashed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    studentToken = signToken({
      userId: testStudent.id,
      email: testStudent.email,
      role: testStudent.role,
      name: testStudent.name,
      tokenVersion: 1,
    });

    instructorToken = signToken({
      userId: testInstructor.id,
      email: testInstructor.email,
      role: testInstructor.role,
      name: testInstructor.name,
      tokenVersion: 1,
    });

    adminToken = signToken({
      userId: testAdmin.id,
      email: testAdmin.email,
      role: testAdmin.role,
      name: testAdmin.name,
      tokenVersion: 1,
    });
  });

  // ==========================================================================
  // Workstream 1: HSE Blueprint Versioning & Question Bank Shielding
  // ==========================================================================
  describe('1. HSE Blueprint Governance & Question Bank Shielding', () => {
    it('should create and update versioned certification blueprints with formal lifecycle status', async () => {
      const blueprint = await db.createExamBlueprint({
        id: 'bp-bcrsp-crsp-v1',
        certificationType: 'CRSP',
        title: 'BCRSP Canadian Registered Safety Professional Simulation',
        version: 1,
        status: 'PUBLISHED',
        totalQuestions: 5,
        durationMinutes: 60,
        passingScorePercent: 70,
        gracePeriodSeconds: 60,
        domains: [
          { name: 'Hazard Identification', weightPercent: 50, questionCount: 3 },
          { name: 'Ergonomics & Health', weightPercent: 50, questionCount: 2 },
        ],
      });

      expect(blueprint.id).toBe('bp-bcrsp-crsp-v1');
      expect(blueprint.version).toBe(1);
      expect(blueprint.status).toBe('PUBLISHED');

      // Update to version 2
      const updated = await db.updateExamBlueprint('bp-bcrsp-crsp-v1', {
        version: 2,
        passingScorePercent: 75,
      });

      expect(updated).not.toBeNull();
      expect(updated?.version).toBe(2);
      expect(updated?.passingScorePercent).toBe(75);
    });

    it('should strictly redact correctOptionIds, explanation, and referenceSource on client question projection', async () => {
      await db.addExamQuestion({
        id: 'q-bcrsp-01',
        certificationType: 'CRSP',
        domain: 'Hazard Identification',
        topic: 'Industrial Toxicology',
        stem: 'Which occupational exposure limit represents the maximum airborne concentration?',
        type: 'MULTIPLE_CHOICE',
        difficulty: 'MODERATE',
        options: [
          { id: 'opt-a', text: 'TWA (Time Weighted Average)' },
          { id: 'opt-b', text: 'STEL (Short Term Exposure Limit)' },
          { id: 'opt-c', text: 'Ceiling (C)' },
          { id: 'opt-d', text: 'Action Level' },
        ],
        correctOptionIds: ['opt-c'],
        explanation: 'Ceiling values must not be exceeded at any instant during the work shift.',
        referenceSource: 'ACGIH TLVs & BEIs 2026 Edition',
      });

      const clientSafeQuestions = await db.getQuestionsForClient(['q-bcrsp-01']);
      expect(clientSafeQuestions).toHaveLength(1);
      const q = clientSafeQuestions[0] as any;

      expect(q.id).toBe('q-bcrsp-01');
      expect(q.stem).toBe('Which occupational exposure limit represents the maximum airborne concentration?');
      expect(q.options).toHaveLength(4);

      // Verify absolute answer key shielding
      expect(q.correctOptionIds).toBeUndefined();
      expect(q.explanation).toBeUndefined();
      expect(q.referenceSource).toBeUndefined();
    });
  });

  // ==========================================================================
  // Workstream 2: Candidate Eligibility, Sittings & Server Countdown Timer
  // ==========================================================================
  describe('2. Candidate Eligibility, Sittings & Server Countdown Timer', () => {
    it('should reject exam attempt when current time is outside the scheduled sitting window', async () => {
      await db.createExamBlueprint({
        id: 'bp-scheduled-closed',
        certificationType: 'ASP',
        title: 'Closed Cohort Examination Sitting',
        totalQuestions: 5,
        durationMinutes: 120,
        passingScorePercent: 70,
        scheduledStartTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        scheduledEndTime: new Date(Date.now() - 3600000).toISOString(),   // 1 hour ago (CLOSED)
      });

      await expect(
        db.startExamAttempt(testStudent.id, 'bp-scheduled-closed')
      ).rejects.toThrow(/EXAM_SITTING_WINDOW_CLOSED/);
    });

    it('should establish an immutable server-authoritative countdown timer deadline with grace period', async () => {
      const blueprint = await db.createExamBlueprint({
        id: 'bp-timer-test',
        certificationType: 'ASP',
        title: 'Authoritative Timer Benchmark',
        totalQuestions: 5,
        durationMinutes: 120,
        gracePeriodSeconds: 90,
        passingScorePercent: 70,
      });

      const beforeStart = Date.now();
      const attempt = await db.startExamAttempt(testStudent.id, 'bp-timer-test');
      const afterStart = Date.now();

      const startTimeMs = new Date(attempt.startTime).getTime();
      const deadlineTimeMs = new Date(attempt.deadlineTime).getTime();

      expect(startTimeMs).toBeGreaterThanOrEqual(beforeStart);
      expect(startTimeMs).toBeLessThanOrEqual(afterStart);

      // Duration: 120 mins * 60s + 90s grace = 7290 seconds = 7,290,000 ms
      const expectedDurationMs = (120 * 60 + 90) * 1000;
      expect(deadlineTimeMs - startTimeMs).toBe(expectedDurationMs);
      expect(attempt.status).toBe('IN_PROGRESS');
      expect(attempt.gracePeriodSeconds).toBe(90);
    });

    it('should autosave in-flight answers and reject post-deadline submissions with EXAM_DEADLINE_EXPIRED', async () => {
      const attempt = await db.startExamAttempt(testStudent.id, 'bp-asp-bcsp-v10');

      // 1. In-flight autosave while timer is active
      const saved = await db.saveExamAnswers(
        attempt.id,
        testStudent.id,
        { 'q-asp-01': ['opt-b'], 'q-asp-02': ['opt-c'] },
        ['q-asp-01']
      );

      expect(saved.answers['q-asp-01']).toEqual(['opt-b']);
      expect(saved.bookmarkedQuestionIds).toEqual(['q-asp-01']);
      expect(saved.autosavedAt).toBeDefined();

      // 2. Simulate clock advancement beyond deadline
      attempt.deadlineTime = new Date(Date.now() - 10000).toISOString(); // 10s expired

      await expect(
        db.saveExamAnswers(attempt.id, testStudent.id, { 'q-asp-03': ['opt-a'] })
      ).rejects.toThrow(/EXAM_DEADLINE_EXPIRED/);

      expect(attempt.status).toBe('EXPIRED');
    });

    it('should support candidate reconnect recovery via GET /api/exams/[id] without resetting timer or leaking keys', async () => {
      // Create fresh attempt
      const attempt = await db.startExamAttempt(testStudent.id, 'bp-asp-bcsp-v10');
      await db.saveExamAnswers(attempt.id, testStudent.id, { 'q-asp-01': ['opt-b'] }, ['q-asp-01']);

      // Candidate refreshes browser / reconnects
      const req = new Request(`http://localhost:3000/api/exams/bp-asp-bcsp-v10`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });

      const res = await getExamHandler(req, { params: { examId: 'bp-asp-bcsp-v10' } });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.attempt).not.toBeNull();
      expect(data.attempt.id).toBe(attempt.id);
      expect(data.attempt.answers['q-asp-01']).toEqual(['opt-b']);
      expect(data.attempt.bookmarks).toEqual(['q-asp-01']);
      expect(data.questions[0].correctOptionIds).toBeUndefined();
      expect(data.questions[0].explanation).toBeUndefined();
    });
  });

  // ==========================================================================
  // Workstream 3: Scoring Engine, Manual Evaluation Queue & Result Governance
  // ==========================================================================
  describe('3. Scoring Engine, Manual Evaluation Queue & Result Governance', () => {
    it('should score objective exam idempotently and provide domain diagnostic breakdown', async () => {
      const attempt = await db.startExamAttempt(testStudent.id, 'bp-asp-bcsp-v10');

      // Answer questions (5 questions in baseline: q-asp-01 to q-asp-05)
      // q-asp-01: opt-b (correct), q-asp-02: opt-a (incorrect - correct is opt-b),
      // q-asp-03: opt-c (correct), q-asp-04: opt-d (correct), q-asp-05: opt-a (correct)
      await db.saveExamAnswers(attempt.id, testStudent.id, {
        'q-asp-01': ['opt-b'],
        'q-asp-02': ['opt-a'], // incorrect -> 4/5 = 80%
        'q-asp-03': ['opt-c'],
        'q-asp-04': ['opt-d'],
        'q-asp-05': ['opt-a'],
      });

      // Submit attempt
      const completed = await db.submitExamAttempt(attempt.id, testStudent.id);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.totalScore).toBe(80); // 4/5 correct = 80%
      expect(completed.passed).toBe(true);
      expect(completed.domainBreakdown).toBeDefined();

      // Idempotency check: submitting second time returns identical completed attempt
      const reSubmitted = await db.submitExamAttempt(attempt.id, testStudent.id);
      expect(reSubmitted.id).toBe(completed.id);
      expect(reSubmitted.totalScore).toBe(80);
      expect(reSubmitted.completedTime).toBe(completed.completedTime);
    });

    it('should handle subjective scenario questions via manual rubric evaluation queue and publish results', async () => {
      // 1. Add scenario question with rubric criteria
      await db.addExamQuestion({
        id: 'q-scenario-hazmat-01',
        certificationType: 'ASP',
        domain: 'Emergency Response',
        topic: 'Chemical Spill Response',
        stem: 'Evaluate the emergency response protocol for a 500L anhydrous ammonia release.',
        type: 'SCENARIO_BASED',
        difficulty: 'HARD',
        options: [],
        correctOptionIds: [],
        explanation: 'Must include immediate evacuation, isolation perimeter, water curtain deployment.',
        referenceSource: 'ERG Guide 125',
        rubricCriteria: [
          { id: 'crit-perimeter', title: 'Isolation Perimeter', maxPoints: 1 },
        ],
      });

      const bp = await db.createExamBlueprint({
        id: 'bp-scenario-exam',
        certificationType: 'ASP',
        title: 'Hazmat Incident Commander Simulation',
        totalQuestions: 1,
        durationMinutes: 45,
        passingScorePercent: 70,
      });

      // Manually assign scenario question to blueprint attempt
      const attempt = await db.startExamAttempt(testStudent.id, 'bp-scenario-exam');
      attempt.assignedQuestionIds = ['q-scenario-hazmat-01'];
      await db.saveExamAnswers(attempt.id, testStudent.id, {
        'q-scenario-hazmat-01': ['Candidate detailed response: Immediate 500m hot zone isolation and vapor knockdown.'],
      });

      // 2. Submit attempt -> transitions to PENDING_MANUAL_EVALUATION
      const submitted = await db.submitExamAttempt(attempt.id, testStudent.id);
      expect(submitted.status).toBe('PENDING_MANUAL_EVALUATION');

      // 3. Faculty queries evaluation queue via API
      const queueReq = new Request('http://localhost:3000/api/admin/exams/evaluations', {
        headers: { Authorization: `Bearer ${instructorToken}` },
      });
      const queueRes = await getEvalQueueHandler(queueReq);
      expect(queueRes.status).toBe(200);
      const queueData = await queueRes.json();
      expect(queueData.count).toBeGreaterThanOrEqual(1);

      // 4. Faculty submits rubric evaluation
      const evalReq = new Request('http://localhost:3000/api/admin/exams/evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          attemptId: attempt.id,
          questionId: 'q-scenario-hazmat-01',
          awardedPoints: 1,
          maxPoints: 1,
          feedback: 'Exemplary incident command procedure and perimeter establishment.',
        }),
      });

      const evalRes = await submitEvalHandler(evalReq);
      expect(evalRes.status).toBe(200);

      // 5. Faculty publishes final exam results
      const pubReq = new Request('http://localhost:3000/api/admin/exams/evaluations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          attemptId: attempt.id,
          publish: true,
        }),
      });

      const pubRes = await publishEvalHandler(pubReq);
      expect(pubRes.status).toBe(200);
      const pubData = await pubRes.json();
      expect(pubData.result.status).toBe('COMPLETED');
      expect(pubData.result.totalScore).toBe(100);
      expect(pubData.result.passed).toBe(true);
    });

    it('should generate formal examination certificates (ZEI/EXAM/YYYY/XXXXXX) strictly separated from course completion', async () => {
      // Create mock enrollment for testStudent
      const enrollmentId = `enr-exam-cert-${Date.now()}`;
      db.enrollments.set(enrollmentId, {
        id: enrollmentId,
        userId: testStudent.id,
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-weekday',
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        progressPercent: 100,
        completedLessonIds: [],
      });

      // Issue Exam Certificate
      const examCert = await db.issueAutomaticCertificate(enrollmentId, 'EXAM_CERTIFICATION');
      expect(examCert.certificateCode).toMatch(/^ZEI\/EXAM\/\d{4}\/\d{6}$/);
      expect(examCert.certificateType).toBe('EXAM_CERTIFICATION');
      expect(examCert.status).toBe('ISSUED');

      // Issue Course Completion Certificate for comparison
      const courseEnrollmentId = `enr-course-cert-${Date.now()}`;
      db.enrollments.set(courseEnrollmentId, {
        id: courseEnrollmentId,
        userId: testStudent.id,
        courseId: 'crs-csp-01',
        batchId: 'btc-csp-weekday',
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        progressPercent: 100,
        completedLessonIds: [],
      });

      const courseCert = await db.issueAutomaticCertificate(courseEnrollmentId, 'COURSE_COMPLETION');
      expect(courseCert.certificateCode).toMatch(/^ZEI\/COURSE\/\d{4}\/\d{6}$/);
      expect(courseCert.certificateType).toBe('COURSE_COMPLETION');

      // Verify certificate can be retrieved publicly
      const verified = await db.verifyCertificate(examCert.certificateCode);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe(examCert.id);
    });
  });

  // ==========================================================================
  // Workstream 4: Course Commerce, Orders & Payment Lifecycle
  // ==========================================================================
  describe('4. Course Commerce, Orders & Payment Lifecycle', () => {
    it('should create multi-currency payment orders with capacity and prerequisite guards', async () => {
      const orderReq = new Request('http://localhost:3000/api/payments/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          courseId: 'crs-asp-01',
          batchId: 'btc-asp-weekday',
          currency: 'INR',
          gateway: 'RAZORPAY',
          billingAddress: {
            city: 'Kollam',
            state: 'Kerala',
            stateCode: '32',
            country: 'India',
          },
        }),
      });

      const orderRes = await createOrderHandler(orderReq);
      expect(orderRes.status).toBe(201);
      const orderData = await orderRes.json();
      expect(orderData.success).toBe(true);
      expect(orderData.order.status).toBe('PENDING');
      expect(orderData.order.amount).toBe(34999);
      expect(orderData.order.currency).toBe('INR');
      expect(orderData.gatewayConfig.keyId).toBeDefined();
    });

    it('should reject payment order creation when cohort batch is at maximum capacity', async () => {
      // Find or create full batch
      db.batches.set('btc-full-capacity', {
        id: 'btc-full-capacity',
        courseId: 'crs-asp-01',
        name: 'Full Capacity Batch',
        startDate: '2026-11-01',
        endDate: '2026-12-01',
        scheduleDescription: 'Full',
        capacity: 10,
        enrolledCount: 10,
        leadInstructorId: 'usr-inst-01',
        status: 'UPCOMING',
      });

      const req = new Request('http://localhost:3000/api/payments/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          courseId: 'crs-asp-01',
          batchId: 'btc-full-capacity',
        }),
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('capacity');
    });

    it('should verify cryptographic HMAC-SHA256 signature and reject forged webhooks', async () => {
      const order = await db.createPaymentOrder({
        userId: testStudent.id,
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-weekday',
        currency: 'INR',
      });

      const paymentId = 'pay_forged_sig_test';
      const payloadString = JSON.stringify({
        event: 'payment.captured',
        orderId: order.id,
        paymentId,
      });

      // 1. Send with invalid signature
      const badReq = new Request('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'invalid_forged_hex_signature',
        },
        body: payloadString,
      });

      const badRes = await webhookHandler(badReq);
      expect(badRes.status).toBe(400);
      const badBody = await badRes.json();
      expect(badBody.error).toContain('cryptographic webhook signature');

      // 2. Send with valid cryptographic signature
      const validSig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payloadString).digest('hex');
      const goodReq = new Request('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': validSig,
        },
        body: payloadString,
      });

      const goodRes = await webhookHandler(goodReq);
      expect(goodRes.status).toBe(200);
      const goodBody = await goodRes.json();
      expect(goodBody.success).toBe(true);
      expect(goodBody.status).toBe('PAID');
    });

    it('should enforce webhook replay protection and idempotency without duplicate enrollment', async () => {
      const freshStudent1 = {
        id: `usr-fresh-replay-${Date.now()}`,
        name: 'Fresh Replay Student',
        email: `fresh.replay.${Date.now()}@zealosh-test.com`,
        role: 'STUDENT' as const,
        organizationId: 'org-zealosh-main',
        passwordHash: 'hashed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.users.set(freshStudent1.id, freshStudent1);

      const batch = db.batches.get('btc-asp-weekday')!;
      const initialEnrolledCount = batch.enrolledCount;

      const order = await db.createPaymentOrder({
        userId: freshStudent1.id,
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-weekday',
        currency: 'INR',
      });

      const paymentId = `pay_replay_${Date.now()}`;
      const payloadString = JSON.stringify({
        event: 'payment.captured',
        orderId: order.id,
        paymentId,
      });
      const validSig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payloadString).digest('hex');

      // First webhook delivery
      const firstReq = new Request('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': validSig },
        body: payloadString,
      });
      const firstRes = await webhookHandler(firstReq);
      expect(firstRes.status).toBe(200);
      expect(batch.enrolledCount).toBe(initialEnrolledCount + 1);

      // Replay identical webhook
      const replayReq = new Request('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': validSig },
        body: payloadString,
      });
      const replayRes = await webhookHandler(replayReq);
      expect(replayRes.status).toBe(200);
      const replayBody = await replayRes.json();
      expect(replayBody.success).toBe(true);

      // Seat count must NOT be incremented twice
      expect(batch.enrolledCount).toBe(initialEnrolledCount + 1);
    });
  });

  // ==========================================================================
  // Workstream 5: Statutory Invoicing & Indian GST Tax Engine
  // ==========================================================================
  describe('5. Statutory Invoicing & Indian GST Tax Engine', () => {
    it('should compute Intra-State GST (9% CGST + 9% SGST) for Kerala candidates with sequential invoice numbering', async () => {
      const order = await db.createPaymentOrder({
        userId: testStudent.id,
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-weekday',
        currency: 'INR',
        billingAddress: {
          city: 'Kollam',
          state: 'Kerala',
          stateCode: '32',
          country: 'India',
        },
      });

      const result = await db.completePaymentOrder(order.id, 'pay_kerala_gst_test');
      const invoice = result.invoice;

      expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
      expect(invoice.currency).toBe('INR');
      expect(invoice.totalAmount).toBe(34999);

      // Total GST is 18% inclusive
      expect(invoice.taxRatePercent).toBe(18);
      expect(invoice.cgstRatePercent).toBe(9);
      expect(invoice.sgstRatePercent).toBe(9);
      expect(invoice.igstRatePercent).toBe(0);

      // CGST + SGST must sum to taxAmount
      expect(invoice.cgstAmount! + invoice.sgstAmount!).toBeCloseTo(invoice.taxAmount, 1);
      expect(invoice.subtotal + invoice.taxAmount).toBe(invoice.totalAmount);
      expect(invoice.placeOfSupplyStateCode).toBe('32');
    });

    it('should compute Inter-State GST (18% IGST) for candidates outside Kerala', async () => {
      const order = await db.createPaymentOrder({
        userId: testStudent.id,
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-weekday',
        currency: 'INR',
        billingAddress: {
          city: 'Mumbai',
          state: 'Maharashtra',
          stateCode: '27',
          country: 'India',
        },
      });

      const result = await db.completePaymentOrder(order.id, 'pay_interstate_gst_test');
      const invoice = result.invoice;

      expect(invoice.taxRatePercent).toBe(18);
      expect(invoice.cgstRatePercent).toBe(0);
      expect(invoice.sgstRatePercent).toBe(0);
      expect(invoice.igstRatePercent).toBe(18);
      expect(invoice.igstAmount).toBe(invoice.taxAmount);
      expect(invoice.placeOfSupplyStateCode).toBe('27');
    });

    it('should compute Zero-Rated Export of Services under LUT for overseas USD transactions', async () => {
      const order = await db.createPaymentOrder({
        userId: testStudent.id,
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-weekday',
        currency: 'USD',
        billingAddress: {
          city: 'Dubai',
          state: 'Dubai',
          country: 'United Arab Emirates',
        },
      });

      const result = await db.completePaymentOrder(order.id, 'pay_export_lut_test');
      const invoice = result.invoice;

      expect(invoice.currency).toBe('USD');
      expect(invoice.isExport).toBe(true);
      expect(invoice.taxRatePercent).toBe(0);
      expect(invoice.taxAmount).toBe(0);
      expect(invoice.subtotal).toBe(invoice.totalAmount);
      expect(invoice.lutReference).toBe('AD320326000142L');
    });

    it('should process administrative refunds, restore batch capacity, revoke enrollment, and issue Credit Notes', async () => {
      const freshStudent2 = {
        id: `usr-fresh-refund-${Date.now()}`,
        name: 'Fresh Refund Student',
        email: `fresh.refund.${Date.now()}@zealosh-test.com`,
        role: 'STUDENT' as const,
        organizationId: 'org-zealosh-main',
        passwordHash: 'hashed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.users.set(freshStudent2.id, freshStudent2);

      const batch = db.batches.get('btc-asp-weekday')!;
      const countBefore = batch.enrolledCount;

      const order = await db.createPaymentOrder({
        userId: freshStudent2.id,
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-weekday',
        currency: 'INR',
      });

      const fulfilled = await db.completePaymentOrder(order.id, 'pay_refund_cycle_test');
      expect(batch.enrolledCount).toBe(countBefore + 1);

      // Process refund
      const refundResult = await db.processRefund(
        order.id,
        'Learner transferred to corporate onsite training',
        testAdmin.email,
        testAdmin.id,
        'SUPER_ADMIN',
        'ref_rzp_99214'
      );

      expect(refundResult.order.status).toBe('REFUNDED');
      expect(refundResult.invoice.status).toBe('REFUNDED');

      // Enrollment must be revoked
      const enr = db.enrollments.get(fulfilled.enrollment.id);
      expect(enr?.status).toBe('REVOKED');

      // Batch seat capacity must be atomically restored
      expect(batch.enrolledCount).toBe(countBefore);

      // Statutory Credit Note must be generated
      expect(refundResult.creditNote).toBeDefined();
      expect(refundResult.creditNote?.creditNoteNumber).toMatch(/^CN-\d{4}-\d{4}$/);
      expect(refundResult.creditNote?.originalInvoiceId).toBe(fulfilled.invoice.id);
      expect(refundResult.creditNote?.totalAmount).toBe(fulfilled.invoice.totalAmount);

      // Invoice endpoint returns invoice with attached credit note
      const invReq = new Request(`http://localhost:3000/api/invoices/${fulfilled.invoice.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const invRes = await getInvoiceHandler(invReq, { params: { invoiceId: fulfilled.invoice.id } });
      expect(invRes.status).toBe(200);
      const invData = await invRes.json();
      expect(invData.invoice.status).toBe('REFUNDED');
      expect(invData.creditNote).not.toBeNull();
      expect(invData.creditNote.creditNoteNumber).toBe(refundResult.creditNote?.creditNoteNumber);
    });
  });
});
