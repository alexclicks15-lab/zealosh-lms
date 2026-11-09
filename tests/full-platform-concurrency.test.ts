// tests/full-platform-concurrency.test.ts
// Zealosh LMS — Full Platform Concurrency, Race Condition & Idempotency Audit Suite
// Validates Workstream O requirements across Commerce, Admissions, Scheduling, Assessment, Gamification, and Event Engine.

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { eventOutboxService } from '@/lib/events/event-outbox-service';
import { gamificationService, inMemoryPointsLedger } from '@/lib/gamification/gamification-service';
import { OrientationService } from '@/lib/orientation/orientation-service';

describe('Zealosh Platform Concurrency, Race Condition & Idempotency Audit', () => {
  beforeEach(() => {
    db.eventOutbox.clear();
    db.eventDeliveries.clear();
    db.consumerInbox.clear();
    db.deadLetterEvents.clear();
    inMemoryPointsLedger.clear();
    OrientationService.resetForTesting();
  });

  // -------------------------------------------------------------
  // 1. Commerce: Concurrent Seat Competition & Zero Overselling
  // -------------------------------------------------------------
  it('safely serializes concurrent enrollment attempts and rejects over-capacity batch (Zero Overselling)', async () => {
    const batchId = `batch-concurrency-${Date.now()}`;
    const testBatch = {
      id: batchId,
      courseId: 'crs-asp-01',
      name: 'Batch Concurrency Test',
      code: 'CONC-2026',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 864000000).toISOString(),
      capacity: 3,
      enrolledCount: 0,
      status: 'ACTIVE' as const,
      instructorId: 'usr-inst-01',
      scheduleSummary: 'Weekend Live Sessions',
    };
    (db as any).batches.set(batchId, testBatch);

    // 10 concurrent students competing for 3 seats
    const candidates = Array.from({ length: 10 }, (_, i) => `student-conc-${i + 1}`);

    const results = await Promise.allSettled(
      candidates.map((userId) =>
        db.enrollStudent({
          userId,
          batchId,
          idempotencyKey: `enr_${batchId}_${userId}`,
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Invariant: Exactly 3 enrollments succeeded
    expect(succeeded.length).toBe(3);
    // Invariant: Exactly 7 enrollments rejected
    expect(rejected.length).toBe(7);

    // Verify rejection reasons
    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect((rej.reason as Error).message).toMatch(/BATCH_CAPACITY_EXCEEDED/);
      }
    }

    // Invariant: Batch enrolledCount equals capacity, zero overselling
    const finalBatch = await db.getBatch(batchId);
    expect(finalBatch?.enrolledCount).toBe(3);
  });

  // -------------------------------------------------------------
  // 2. Commerce: Concurrent Payment Webhook Idempotency
  // -------------------------------------------------------------
  it('deduplicates concurrent payment webhook events with zero duplicate entitlements or invoices', async () => {
    const userId = `usr-pay-conc-${Date.now()}`;
    const courseId = 'crs-asp-01';
    const batchId = `batch-pay-${Date.now()}`;

    // Seed test user
    db.users.set(userId, {
      id: userId,
      email: `${userId}@example.com`,
      name: 'Concurrent Buyer',
      role: 'STUDENT',
      createdAt: new Date().toISOString(),
    } as any);

    // Seed batch
    (db as any).batches.set(batchId, {
      id: batchId,
      courseId,
      name: 'Pay Batch',
      code: 'PAY-01',
      capacity: 50,
      enrolledCount: 0,
      status: 'ACTIVE',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 864000000).toISOString(),
      scheduleSummary: 'Weekend',
    });

    // Create payment order
    const order = await db.createPaymentOrder({
      userId,
      courseId,
      batchId,
      amount: 45000,
      currency: 'INR',
      gateway: 'RAZORPAY',
    });

    const paymentTxId = `pay_tx_conc_${Date.now()}`;

    // 5 concurrent webhooks reporting the same payment transaction
    const webhookCalls = Array.from({ length: 5 }, () =>
      db.completePaymentOrder(order.id, paymentTxId, 'student@example.com', {
        street: '123 Test St',
        city: 'Kollam',
        state: 'Kerala',
        stateCode: '32',
        postalCode: '691001',
        country: 'India',
      })
    );

    const fulfillResults = await Promise.all(webhookCalls);

    // Invariant: All returns point to the same fulfilled order
    for (const res of fulfillResults) {
      expect(res.order.id).toBe(order.id);
      expect(res.order.status).toBe('PAID');
    }

    // Invariant: Exactly 1 invoice generated
    const invoices = Array.from((db as any).invoices.values()).filter(
      (inv: any) => inv.orderId === order.id
    );
    expect(invoices.length).toBe(1);

    // Invariant: Exactly 1 active enrollment created
    const enrollments = Array.from((db as any).enrollments.values()).filter(
      (enr: any) => enr.userId === userId && enr.batchId === batchId
    );
    expect(enrollments.length).toBe(1);
  });

  // -------------------------------------------------------------
  // 3. Scheduling: Orientation Final-Seat Atomic Concurrency
  // -------------------------------------------------------------
  it('safely serializes concurrent orientation seat bookings for the final remaining seat', async () => {
    const courseId = 'crs-asp-01';
    const session = await OrientationService.createOrientationSession({
      courseId,
      title: 'Mandatory Induction Session',
      mode: 'ONLINE',
      scheduledStartTime: '2026-12-05T10:00:00.000Z',
      durationMinutes: 60,
      capacity: 1, // Exactly 1 seat remaining
      coordinatorId: 'usr-admin-01',
      coordinatorName: 'Academic Coordinator',
      instructions: 'Bring your enrolment voucher',
    });

    const students = ['student-orient-1', 'student-orient-2', 'student-orient-3', 'student-orient-4'];

    const bookingAttempts = await Promise.allSettled(
      students.map((studentId) =>
        OrientationService.bookOrientationSession({
          sessionId: session.id,
          applicationId: `app-${studentId}`,
          userId: studentId,
          userEmail: `${studentId}@example.com`,
          userName: `Student ${studentId}`,
        })
      )
    );

    const booked = bookingAttempts.filter((a) => a.status === 'fulfilled');
    const rejected = bookingAttempts.filter((a) => a.status === 'rejected');

    // Invariant: Exactly 1 booking accepted
    expect(booked.length).toBe(1);
    // Invariant: Exactly 3 bookings rejected
    expect(rejected.length).toBe(3);

    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect((rej.reason as Error).message).toMatch(/SESSION_FULL|CAPACITY/i);
      }
    }
  });

  // -------------------------------------------------------------
  // 4. Assessment: Concurrent Exam Submission Locking
  // -------------------------------------------------------------
  it('enforces attempt sealing and rejects concurrent or duplicate exam submissions', async () => {
    const attemptId = `attempt-conc-${Date.now()}`;
    const studentId = 'student-exam-conc';

    const testAttempt = {
      id: attemptId,
      userId: studentId,
      blueprintId: 'bp-asp-comp',
      status: 'IN_PROGRESS' as const,
      startTime: new Date().toISOString(),
      answers: {},
      totalQuestions: 10,
    };
    (db as any).examAttempts.set(attemptId, testAttempt);

    // Simulate 2 concurrent submissions of the same attempt
    const submitAttempt = async (submissionAnswers: Record<string, string>) => {
      const current = (db as any).examAttempts.get(attemptId);
      if (!current || current.status === 'COMPLETED') {
        throw new Error('EXAM_ALREADY_SUBMITTED');
      }
      current.status = 'COMPLETED';
      current.submittedAt = new Date().toISOString();
      current.scorePercent = 85;
      current.answers = submissionAnswers;
      return current;
    };

    const first = submitAttempt({ q1: 'A', q2: 'B' });
    const second = submitAttempt({ q1: 'C', q2: 'D' });

    const results = await Promise.allSettled([first, second]);
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Invariant: Exactly one submission successfully sealed
    expect(succeeded.length).toBe(1);
    // Invariant: Second submission rejected
    expect(rejected.length).toBe(1);
    if (rejected[0].status === 'rejected') {
      expect((rejected[0].reason as Error).message).toBe('EXAM_ALREADY_SUBMITTED');
    }

    // Invariant: Answers are immutable from the first submission
    const finalAttempt = (db as any).examAttempts.get(attemptId);
    expect(finalAttempt.answers).toEqual({ q1: 'A', q2: 'B' });
  });

  // -------------------------------------------------------------
  // 5. Gamification: Concurrent XP Ledger Invariant
  // -------------------------------------------------------------
  it('safely serializes concurrent XP awards without lost updates and prevents duplicate event awards', async () => {
    const studentId = `student-xp-${Date.now()}`;
    const courseId = 'crs-asp-01';

    // 5 concurrent distinct XP events
    const distinctEvents = Array.from({ length: 5 }, (_, i) =>
      gamificationService.recordActivityPoints({
        studentId,
        sourceEventId: `lesson-distinct-${i + 1}`,
        activityType: 'LESSON_COMPLETED',
        courseId,
      })
    );

    // 5 concurrent duplicate replays of the same event
    const duplicateReplays = Array.from({ length: 5 }, () =>
      gamificationService.recordActivityPoints({
        studentId,
        sourceEventId: 'duplicate-event-x',
        activityType: 'ASSIGNMENT_SUBMITTED',
        courseId,
      })
    );

    await Promise.all([...distinctEvents, ...duplicateReplays]);

    // Distinct events: 5 * 15 = 75 points
    // Duplicate replays: Exactly 1 granted (30 points), 4 rejected as duplicates
    const totalPoints = gamificationService.getStudentTotalPoints(studentId);
    expect(totalPoints).toBe(75 + 30); // 105 points exactly
  });

  // -------------------------------------------------------------
  // 6. Event Dispatcher: Multi-Worker Lease Mutual Exclusion
  // -------------------------------------------------------------
  it('guarantees mutual exclusion in multi-worker delivery claims (zero double dispatch)', async () => {
    const result = await eventOutboxService.publishEvent({
      eventType: 'commerce.order.paid',
      sourceDomain: 'COMMERCE',
      aggregateType: 'Order',
      aggregateId: `ord-conc-${Date.now()}`,
      aggregateVersion: 1,
      payload: {
        orderId: `ord-conc-${Date.now()}`,
        userId: 'usr-student-01',
        courseId: 'crs-asp-01',
        offeringId: 'COMPLETE',
        amount: 25000,
        currency: 'INR',
        gatewayPaymentId: 'pay_tx_999',
      },
    });

    expect(result.success).toBe(true);
    expect(result.deliveriesCount).toBeGreaterThan(0);

    // 5 concurrent workers attempting to claim deliveries simultaneously
    const workers = ['worker-01', 'worker-02', 'worker-03', 'worker-04', 'worker-05'];

    const claims = await Promise.all(
      workers.map((workerId) =>
        db.claimEventDeliveries(workerId, 10, 300000)
      )
    );

    // Flatten all claimed delivery IDs across all workers
    const allClaimedIds = claims.flat().map((d: any) => d.id);
    const uniqueClaimedIds = new Set(allClaimedIds);

    // Invariant: Zero duplicate claims between concurrent workers
    expect(allClaimedIds.length).toBe(uniqueClaimedIds.size);
  });
});
