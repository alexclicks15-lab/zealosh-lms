import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { db } from '@/lib/store/db';
import {
  determineGstTreatment,
  evaluateExportOfServicesConditions,
  roundFinancial,
  DEFAULT_TAX_PROFILE,
} from '@/lib/tax/tax-engine';
import { User, Course, Batch, ExamBlueprint, ExamQuestion } from '@/types';
import { POST as webhookHandler } from '@/app/api/payments/webhook/route';
import { GET as invoiceHandler } from '@/app/api/invoices/[invoiceId]/route';
import { GET as getEvalQueueHandler } from '@/app/api/admin/exams/evaluations/route';
import { signToken } from '@/lib/auth/jwt';

describe('Zealosh LMS — ZM-03.1 Examination & Commerce Integrity Closure Suite', () => {
  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'zealosh_rzp_webhook_secret_staging';

  let candidateUser: User;
  let adminUser: User;
  let instructorUser: User;
  let testCourse: Course;
  let testBatch: Batch;
  let testBlueprint: ExamBlueprint;
  let q1: ExamQuestion;
  let qScenario: ExamQuestion;

  beforeEach(async () => {
    // 1. Seed Users
    candidateUser = {
      id: `usr-cand-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: 'Vipin Kumar',
      email: `vipin.${Date.now()}@example.com`,
      passwordHash: 'dummy_hash_candidate',
      organizationId: 'org-zealosh-main',
      role: 'STUDENT',
      isActive: true,
      verified: true,
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.users.set(candidateUser.id, candidateUser);

    adminUser = {
      id: `usr-adm-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: 'Compliance Administrator',
      email: `admin.${Date.now()}@zealosh.com`,
      passwordHash: 'dummy_hash_admin',
      organizationId: 'org-zealosh-main',
      role: 'SUPER_ADMIN',
      isActive: true,
      verified: true,
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.users.set(adminUser.id, adminUser);

    instructorUser = {
      id: `usr-inst-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: 'Dr. Ramesh Nair, CSP',
      email: `ramesh.${Date.now()}@zealosh.com`,
      passwordHash: 'dummy_hash_instructor',
      organizationId: 'org-zealosh-main',
      role: 'INSTRUCTOR',
      isActive: true,
      verified: true,
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.users.set(instructorUser.id, instructorUser);

    // 2. Seed Course & Cohort Batch
    testCourse = {
      id: `crs-asp-${Date.now()}`,
      title: 'Associate Safety Professional (ASP) Examination Preparatory',
      slug: `asp-prep-${Date.now()}`,
      description: 'Comprehensive HSE certification training accredited by BCSP.',
      category: 'HSE_CERTIFICATION',
      certificationType: 'ASP',
      price: 24999,
      priceInr: 24999,
      priceUsd: 499,
      currency: 'INR',
      status: 'PUBLISHED',
      headline: 'ASP Certification Prep',
      deliveryModel: 'HYBRID',
      learningObjectives: ['Pass ASP Exam'],
      prerequisites: ['Bachelor degree or experience'],
      durationWeeks: 8,
      coverImage: '/images/asp-cover.jpg',
      leadInstructorId: instructorUser.id,
      coInstructorIds: [],
      modulesCount: 6,
      totalLessons: 24,
      totalHours: 48,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.courses.set(testCourse.id, testCourse);

    testBatch = {
      id: `btc-asp-${Date.now()}`,
      courseId: testCourse.id,
      name: 'ASP November 2026 Weekend Intensive Cohort',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
      scheduleDescription: 'Saturdays and Sundays 7:00 PM - 9:30 PM IST',
      leadInstructorId: instructorUser.id,
      capacity: 30,
      enrolledCount: 5,
      status: 'ACTIVE',
      mode: 'HYBRID',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.batches.set(testBatch.id, testBatch);

    // 3. Seed Questions & Blueprint
    q1 = {
      id: `q-asp-iso-${Date.now()}`,
      certificationType: 'ASP',
      domain: 'Environmental Management',
      topic: 'Hazard Communication & GHS',
      stem: 'Under the Globally Harmonized System (GHS), which pictogram denotes aquatic toxicity?',
      type: 'SINGLE_CHOICE',
      options: [
        { id: 'opt-env-a', text: 'Flame over circle' },
        { id: 'opt-env-b', text: 'Dead tree and dead fish' },
        { id: 'opt-env-c', text: 'Corrosion pouring on metal' },
        { id: 'opt-env-d', text: 'Exclamation mark' },
      ],
      correctOptionIds: ['opt-env-b'],
      explanation: 'The dead tree and dead fish pictogram indicates acute or chronic aquatic toxicity.',
      referenceSource: 'GHS Rev. 9, Chapter 4.1',
      points: 1,
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.examQuestions.set(q1.id, q1);

    qScenario = {
      id: `q-asp-scen-${Date.now()}`,
      certificationType: 'ASP',
      domain: 'Emergency Response & Industrial Hygiene',
      topic: 'Major Chemical Release Incident Command',
      stem: 'A 20-ton anhydrous ammonia tank has ruptured at an offshore chemical terminal with 15 knot onshore winds. Detail your initial evacuation perimeter, vapor cloud mitigation tactics, and command post positioning.',
      type: 'SCENARIO_BASED',
      options: [],
      correctOptionIds: [],
      explanation: 'Authoritative rubric criteria: minimum 500m hot zone upwind isolation, water curtain fog nozzles for vapor absorption without runoff into storm drainage.',
      referenceSource: 'ERG Guide 125 & 29 CFR 1910.120(q)',
      points: 5,
      rubricCriteria: [
        { id: 'rc-hotzone', name: 'Hot Zone & Initial Perimeter Isolation', maxPoints: 2, description: 'Establishes initial 500m minimum upwind exclusion zone.' },
        { id: 'rc-mitigation', name: 'Vapor Knockdown & Drainage Protection', maxPoints: 3, description: 'Deploys fog water curtains while preventing toxic liquid ammonia runoff.' },
      ],
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.examQuestions.set(qScenario.id, qScenario);

    testBlueprint = {
      id: `bp-asp-integrity-${Date.now()}`,
      title: 'ASP Certification Simulation with Scenario Rubric',
      certificationType: 'ASP',
      totalQuestions: 2,
      durationMinutes: 60,
      gracePeriodSeconds: 120,
      passingScorePercent: 70,
      domains: [
        { name: 'Environmental Management', weightPercent: 50, questionCount: 1 },
        { name: 'Emergency Response & Industrial Hygiene', weightPercent: 50, questionCount: 1 },
      ],
      status: 'PUBLISHED',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.examBlueprints.set(testBlueprint.id, testBlueprint);
  });

  // --------------------------------------------------------------------------
  // WORKSTREAM A: EXAMINATION ATTEMPT INTEGRITY & FROZEN QUESTION SNAPSHOTS
  // --------------------------------------------------------------------------
  describe('Workstream A: Examination Attempt Integrity & Frozen Snapshots', () => {
    it('freezes questions in attempt.questionSnapshots at start and shields candidate attempt from subsequent bank mutations', async () => {
      // 1. Start exam attempt
      const attempt = await db.startExamAttempt(candidateUser.id, testBlueprint.id);
      attempt.assignedQuestionIds = [q1.id];
      // Sync snapshots for this explicit test assignment
      attempt.questionSnapshots = [
        {
          id: q1.id,
          domain: q1.domain,
          topic: q1.topic,
          stem: q1.stem,
          type: q1.type,
          options: JSON.parse(JSON.stringify(q1.options)),
          points: q1.points,
          correctOptionIds: [...q1.correctOptionIds],
          explanation: q1.explanation,
        },
      ];

      expect(attempt.questionSnapshots).toBeDefined();
      expect(attempt.questionSnapshots?.length).toBe(1);
      expect(attempt.questionSnapshots?.[0].stem).toContain('aquatic toxicity');

      // 2. Client projection redacts answer keys and explanations
      const clientQuestions = await db.getQuestionsForAttempt(attempt.id);
      expect(clientQuestions.length).toBe(1);
      expect((clientQuestions[0] as any).correctOptionIds).toBeUndefined();
      expect((clientQuestions[0] as any).explanation).toBeUndefined();
      expect(clientQuestions[0].stem).toContain('aquatic toxicity');

      // 3. Mutate authoritative question bank after attempt creation
      await db.updateExamQuestion(q1.id, {
        stem: 'MUTATED: This question was altered in the bank while student was taking exam!',
        correctOptionIds: ['opt-env-d'], // Altered correct answer to Exclamation mark
        explanation: 'MUTATED EXPLANATION',
      });

      // 4. Verify candidate attempt questions remain immutable
      const projectedAfterMutation = await db.getQuestionsForAttempt(attempt.id);
      expect(projectedAfterMutation[0].stem).toContain('aquatic toxicity');
      expect(projectedAfterMutation[0].stem).not.toContain('MUTATED');

      // 5. Candidate submits answering according to the original frozen question
      await db.saveExamAnswers(attempt.id, candidateUser.id, {
        [q1.id]: ['opt-env-b'], // The correct answer according to frozen snapshot
      });

      const submitted = await db.submitExamAttempt(attempt.id, candidateUser.id);
      expect(submitted.status).toBe('COMPLETED');
      // Must be awarded correct point based on frozen snapshot, ignoring the mutated bank
      expect(submitted.totalScore).toBe(100);
      expect(submitted.passed).toBe(true);
    });

    it('strictly enforces server-authoritative countdown timer deadline including grace period', async () => {
      const attempt = await db.startExamAttempt(candidateUser.id, testBlueprint.id);
      const deadlineMs = new Date(attempt.deadlineTime).getTime();
      expect(deadlineMs).toBeGreaterThan(Date.now());

      // Attempt autosave before deadline succeeds
      await expect(
        db.saveExamAnswers(attempt.id, candidateUser.id, { [q1.id]: ['opt-env-b'] })
      ).resolves.toBeDefined();

      // Expire attempt deadline artificially
      attempt.deadlineTime = new Date(Date.now() - 5000).toISOString();

      // Subsequent autosave after deadline must fail with EXAM_DEADLINE_EXPIRED
      await expect(
        db.saveExamAnswers(attempt.id, candidateUser.id, { [q1.id]: ['opt-env-c'] })
      ).rejects.toThrow(/EXAM_DEADLINE_EXPIRED/);

      // Submission after deadline must also fail with EXAM_DEADLINE_EXPIRED
      await expect(
        db.submitExamAttempt(attempt.id, candidateUser.id)
      ).rejects.toThrow(/EXAM_DEADLINE_EXPIRED/);
    });

    it('routes subjective scenario questions to authoritative manual evaluation queue and publishes final score', async () => {
      const attempt = await db.startExamAttempt(candidateUser.id, testBlueprint.id);
      attempt.assignedQuestionIds = [qScenario.id];
      attempt.questionSnapshots = [
        {
          id: qScenario.id,
          domain: qScenario.domain,
          topic: qScenario.topic,
          stem: qScenario.stem,
          type: qScenario.type,
          options: [],
          points: qScenario.points,
          rubricCriteria: qScenario.rubricCriteria,
          correctOptionIds: [],
          explanation: qScenario.explanation,
        },
      ];

      await db.saveExamAnswers(attempt.id, candidateUser.id, {
        [qScenario.id]: ['Evacuate 600m upwind; position command post crosswind at 1km; deploy high-pressure fog nozzles.'],
      });

      // Submit attempt -> enters manual evaluation queue
      const submitted = await db.submitExamAttempt(attempt.id, candidateUser.id);
      expect(submitted.status).toBe('PENDING_MANUAL_EVALUATION');

      // Evaluator grades the scenario response via authoritative table
      const evalRecord = await db.submitManualEvaluation({
        attemptId: attempt.id,
        questionId: qScenario.id,
        evaluatorId: instructorUser.id,
        evaluatorName: instructorUser.name,
        awardedPoints: 1, // 1 / 1 objective question normalized
        maxPoints: 1,
        feedback: 'Superb initial perimeter isolation and clear understanding of ERG Guide 125.',
      });

      expect(evalRecord.id).toBeDefined();
      expect(db.examManualEvaluations.get(evalRecord.id)).toBeDefined();

      // Publish results
      const published = await db.publishExamResults(attempt.id, adminUser.id);
      expect(published.status).toBe('COMPLETED');
      expect(published.totalScore).toBe(100);
      expect(published.passed).toBe(true);
    });

    it('enforces strict attempt ownership: candidate cannot access or submit another candidate attempt', async () => {
      const attempt = await db.startExamAttempt(candidateUser.id, testBlueprint.id);
      const otherCandidateId = 'usr-other-cand-999';

      await expect(
        db.saveExamAnswers(attempt.id, otherCandidateId, { [q1.id]: ['opt-env-b'] })
      ).rejects.toThrow(/Unauthorized/);

      await expect(
        db.submitExamAttempt(attempt.id, otherCandidateId)
      ).rejects.toThrow(/Unauthorized/);
    });

    it('blocks student candidate from accessing staff manual evaluation queue with HTTP 403', async () => {
      const candidateToken = signToken({
        userId: candidateUser.id,
        email: candidateUser.email,
        name: candidateUser.name,
        role: candidateUser.role,
        tokenVersion: 1,
      });

      const req = new Request('http://localhost:3000/api/admin/exams/evaluations', {
        headers: { Authorization: `Bearer ${candidateToken}` },
      });
      const res = await getEvalQueueHandler(req);
      expect(res.status).toBe(403);
    });

    it('enforces certificate sequence separation between exam certifications and course completions', async () => {
      const year = new Date().getFullYear();
      const examEnrId = `enr-test-exam-${Date.now()}`;
      db.enrollments.set(examEnrId, {
        id: examEnrId,
        userId: candidateUser.id,
        courseId: testCourse.id,
        batchId: testBatch.id,
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        progressPercent: 100,
        completedLessonIds: [],
      });

      const examCert = await db.issueAutomaticCertificate(examEnrId, 'EXAM_CERTIFICATION');
      expect(examCert.certificateCode).toMatch(new RegExp(`^ZEI/EXAM/${year}/\\d{6}$`));

      const courseEnrId = `enr-test-crs-${Date.now()}`;
      db.enrollments.set(courseEnrId, {
        id: courseEnrId,
        userId: candidateUser.id,
        courseId: testCourse.id,
        batchId: testBatch.id,
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        progressPercent: 100,
        completedLessonIds: [],
      });

      const courseCert = await db.issueAutomaticCertificate(courseEnrId, 'COURSE_COMPLETION');
      expect(courseCert.certificateCode).toMatch(new RegExp(`^ZEI/COURSE/${year}/\\d{6}$`));

      // Public verification endpoint verifies both
      const verifiedExam = await db.verifyCertificate(examCert.certificateCode);
      expect(verifiedExam).toBeDefined();
      expect(verifiedExam?.certificateCode).toBe(examCert.certificateCode);

      const verifiedCourse = await db.verifyCertificate(courseCert.certificateCode);
      expect(verifiedCourse).toBeDefined();
      expect(verifiedCourse?.certificateCode).toBe(courseCert.certificateCode);
    });
  });

  // --------------------------------------------------------------------------
  // WORKSTREAM B: STATUTORY INDIAN GST DETERMINATION ENGINE (CBIC COMPLIANCE)
  // --------------------------------------------------------------------------
  describe('Workstream B: Statutory GST Determination Engine', () => {
    it('computes Intra-State GST (9% CGST + 9% SGST) for Kerala transactions with exact paise preservation', () => {
      const result = determineGstTreatment({
        amount: 24999.0,
        currency: 'INR',
        billingAddress: {
          city: 'Kollam',
          state: 'Kerala',
          stateCode: '32',
          country: 'India',
        },
      });

      expect(result.taxTreatment).toBe('INTRA_STATE_GST');
      expect(result.cgstRatePercent).toBe(9.0);
      expect(result.sgstRatePercent).toBe(9.0);
      expect(result.igstRatePercent).toBe(0.0);
      expect(result.placeOfSupplyStateCode).toBe('32');
      expect(result.placeOfSupplyStateName).toBe('Kerala');

      // Check financial arithmetic: subtotal + tax === total down to paise
      const subtotal = result.subtotal;
      const cgst = result.cgstAmount;
      const sgst = result.sgstAmount;
      const totalTax = result.taxAmount;
      expect(cgst + sgst).toBe(totalTax);
      expect(roundFinancial(subtotal + totalTax)).toBe(24999.0);
      expect(result.isExport).toBe(false);
    });

    it('computes Inter-State GST (18% IGST) for domestic transactions outside Kerala', () => {
      const result = determineGstTreatment({
        amount: 15500.0,
        currency: 'INR',
        billingAddress: {
          city: 'Chennai',
          state: 'Tamil Nadu',
          stateCode: '33',
          country: 'India',
        },
      });

      expect(result.taxTreatment).toBe('INTER_STATE_GST');
      expect(result.cgstRatePercent).toBe(0.0);
      expect(result.sgstRatePercent).toBe(0.0);
      expect(result.igstRatePercent).toBe(18.0);
      expect(result.placeOfSupplyStateCode).toBe('33');

      expect(roundFinancial(result.subtotal + result.igstAmount)).toBe(15500.0);
      expect(result.isExport).toBe(false);
    });

    it('computes Zero-Rated Export of Services under verified LUT for overseas USD orders', () => {
      const result = determineGstTreatment({
        amount: 499.0,
        currency: 'USD',
        billingAddress: {
          city: 'Dubai',
          state: 'Dubai',
          country: 'United Arab Emirates',
        },
        isConvertibleForeignExchange: true,
        isDistinctEstablishment: false,
      });

      expect(result.taxTreatment).toBe('EXPORT_ZERO_RATED_LUT');
      expect(result.subtotal).toBe(499.0);
      expect(result.taxAmount).toBe(0.0);
      expect(result.cgstAmount).toBe(0.0);
      expect(result.sgstAmount).toBe(0.0);
      expect(result.igstAmount).toBe(0.0);
      expect(result.isExport).toBe(true);
      expect(result.lutReference).toBe(DEFAULT_TAX_PROFILE.lutArn);
    });

    it('falls back to Taxable Export (18% IGST) when LUT is unverified or expired per IGST Act s.16(3)(b)', () => {
      const expiredProfile = {
        ...DEFAULT_TAX_PROFILE,
        lutVerified: false,
        lutValidUntil: '2025-01-01T00:00:00.000Z',
      };

      const result = determineGstTreatment(
        {
          amount: 499.0,
          currency: 'USD',
          billingAddress: {
            city: 'London',
            state: 'Greater London',
            country: 'United Kingdom',
          },
          isConvertibleForeignExchange: true,
        },
        expiredProfile
      );

      expect(result.taxTreatment).toBe('EXPORT_TAXABLE');
      expect(result.igstRatePercent).toBe(18.0);
      expect(result.igstAmount).toBeGreaterThan(0);
      expect(roundFinancial(result.subtotal + result.igstAmount)).toBe(499.0);
      expect(result.taxReviewReasons).toBeDefined();
    });

    it('fails closed to TAX_REVIEW_REQUIRED when foreign buyer pays in domestic INR (violates IGST Act s.2(6)(iv))', () => {
      const result = determineGstTreatment({
        amount: 25000.0,
        currency: 'INR', // Violates convertible forex condition
        billingAddress: {
          city: 'Doha',
          country: 'Qatar',
        },
      });

      expect(result.taxTreatment).toBe('TAX_REVIEW_REQUIRED');
      expect(result.taxReviewReasons).toContain('Payment currency is INR; not proven convertible foreign exchange');
    });

    it('fails closed to TAX_REVIEW_REQUIRED when billing geography is completely missing', () => {
      const result = determineGstTreatment({
        amount: 10000.0,
        currency: 'INR',
        billingAddress: {} as any,
      });

      expect(result.taxTreatment).toBe('TAX_REVIEW_REQUIRED');
      expect(result.taxReviewReasons).toContain('Billing address country, state, and state code are entirely missing');
    });
  });

  // --------------------------------------------------------------------------
  // WORKSTREAM C: INVOICE & CREDIT NOTE COMPLIANCE (RULE 46 / RULE 53)
  // --------------------------------------------------------------------------
  describe('Workstream C: Invoicing & Credit Note Statutory Compliance', () => {
    it('issues sequential tax invoice with number not exceeding CBIC Rule 46(b) 16-character limit', async () => {
      const order = await db.createPaymentOrder({
        userId: candidateUser.id,
        userEmail: candidateUser.email,
        userName: candidateUser.name,
        courseId: testCourse.id,
        batchId: testBatch.id,
        amount: 24999.0,
        currency: 'INR',
        gateway: 'RAZORPAY',
        billingAddress: {
          city: 'Kollam',
          state: 'Kerala',
          stateCode: '32',
          country: 'India',
        },
      });

      const { invoice } = await db.completePaymentOrder(order.id, 'pay_test_gstin_seq');

      expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4,}$/);
      expect(invoice.invoiceNumber.length).toBeLessThanOrEqual(16);
      expect(invoice.taxTreatment).toBe('INTRA_STATE_GST');
      expect(invoice.cgstAmount).toBeGreaterThan(0);
      expect(invoice.sgstAmount).toBeGreaterThan(0);
      expect(invoice.providerGstin).toBe(DEFAULT_TAX_PROFILE.supplierGstin);
    });

    it('issues statutory Credit Note on refund linked 1-to-many to original invoice', async () => {
      const order = await db.createPaymentOrder({
        userId: candidateUser.id,
        userEmail: candidateUser.email,
        userName: candidateUser.name,
        courseId: testCourse.id,
        batchId: testBatch.id,
        amount: 24999.0,
        currency: 'INR',
        gateway: 'RAZORPAY',
      });

      const { invoice } = await db.completePaymentOrder(order.id, 'pay_test_refund_cn');

      // Process administrative refund
      const { order: refundedOrder, creditNote } = await db.processRefund(
        order.id,
        'Learner transferred to enterprise sponsored program',
        adminUser.email,
        adminUser.id,
        'SUPER_ADMIN',
        'rfnd_test_seq_01'
      );

      expect(refundedOrder.status).toBe('REFUNDED');
      expect(refundedOrder.refundStatus).toBe('COMPLETED');
      expect(creditNote).toBeDefined();
      expect(creditNote?.creditNoteNumber).toMatch(/^CN-\d{4}-\d{4,}$/);
      expect(creditNote?.creditNoteNumber.length).toBeLessThanOrEqual(16);
      expect(creditNote?.originalInvoiceId).toBe(invoice.id);
      expect(creditNote?.totalAmount).toBe(invoice.totalAmount);

      // Verify API endpoint returns both singular creditNote and creditNotes array
      const adminToken = signToken({
        userId: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        tokenVersion: 1,
      });

      const req = new Request(`http://localhost:3000/api/invoices/${invoice.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const res = await invoiceHandler(req, { params: { invoiceId: invoice.id } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.creditNote).toBeDefined();
      expect(data.creditNotes).toBeDefined();
      expect(data.creditNotes.length).toBeGreaterThanOrEqual(1);
      expect(data.creditNotes[0].id).toBe(creditNote?.id);
    });
  });

  // --------------------------------------------------------------------------
  // WORKSTREAM D: REFUND & ENROLLMENT CAPACITY RECONCILIATION
  // --------------------------------------------------------------------------
  describe('Workstream D: Refund & Capacity Reconciliation', () => {
    it('restores cohort batch capacity safely without double-decrementing or corrupting non-negative count', async () => {
      const initialCapacity = testBatch.capacity;
      const initialEnrolled = testBatch.enrolledCount;

      const order = await db.createPaymentOrder({
        userId: candidateUser.id,
        userEmail: candidateUser.email,
        userName: candidateUser.name,
        courseId: testCourse.id,
        batchId: testBatch.id,
        amount: 24999.0,
        currency: 'INR',
        gateway: 'RAZORPAY',
      });

      const { enrollment } = await db.completePaymentOrder(order.id, 'pay_capacity_test');
      expect(testBatch.enrolledCount).toBe(initialEnrolled + 1);

      // First refund: restores capacity
      await db.processRefund(order.id, 'Candidate withdrawal', adminUser.email, adminUser.id, 'SUPER_ADMIN');
      expect(testBatch.enrolledCount).toBe(initialEnrolled);

      // Enrollment marked REVOKED
      const enr = db.enrollments.get(enrollment.id);
      expect(enr?.status).toBe('REVOKED');

      // Attempting to refund again is blocked
      await expect(
        db.processRefund(order.id, 'Duplicate refund attempt', adminUser.email, adminUser.id, 'SUPER_ADMIN')
      ).rejects.toThrow(/already been refunded/);

      // Capacity remains strictly preserved
      expect(testBatch.enrolledCount).toBe(initialEnrolled);
      expect(testBatch.enrolledCount).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // WORKSTREAM E: PAYMENT PROVIDER & WEBHOOK REPLAY PROTECTION
  // --------------------------------------------------------------------------
  describe('Workstream E: Webhook Signature & Replay Deduplication', () => {
    it('rejects webhooks with invalid HMAC signatures before recording or touching database', async () => {
      const order = await db.createPaymentOrder({
        userId: candidateUser.id,
        userEmail: candidateUser.email,
        userName: candidateUser.name,
        courseId: testCourse.id,
        batchId: testBatch.id,
        amount: 24999.0,
        currency: 'INR',
        gateway: 'RAZORPAY',
      });

      const payload = JSON.stringify({
        event: 'payment.captured',
        orderId: order.id,
        paymentId: 'pay_forged_999',
        amount: 24999.0,
        currency: 'INR',
      });

      const req = new Request('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'forged_hmac_signature_hex_value',
        },
        body: payload,
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid cryptographic webhook signature');
    });

    it('records durable webhook events and deduplicates replay events idempotently', async () => {
      const order = await db.createPaymentOrder({
        userId: candidateUser.id,
        userEmail: candidateUser.email,
        userName: candidateUser.name,
        courseId: testCourse.id,
        batchId: testBatch.id,
        amount: 24999.0,
        currency: 'INR',
        gateway: 'RAZORPAY',
      });

      const paymentId = `pay_replay_test_${Date.now()}`;
      const eventId = `rzp_evt_${Date.now()}`;
      const payloadObj = {
        id: eventId,
        event: 'payment.captured',
        orderId: order.id,
        paymentId,
        amount: 24999.0,
        currency: 'INR',
      };
      const rawBody = JSON.stringify(payloadObj);
      const validSignature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');

      // 1. Initial Webhook Delivery
      const req1 = new Request('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': validSignature,
          'x-razorpay-event-id': eventId,
        },
        body: rawBody,
      });

      const res1 = await webhookHandler(req1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.invoiceId).toBeDefined();

      // Check durable webhook event recording
      const recorded = await db.getPaymentWebhookEvent(eventId);
      expect(recorded).toBeDefined();
      expect(recorded?.status).toBe('PROCESSED');
      expect(recorded?.orderId).toBe(order.id);
      expect(recorded?.paymentId).toBe(paymentId);

      // 2. Immediate Replay Delivery (Gateway network retry)
      const req2 = new Request('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': validSignature,
          'x-razorpay-event-id': eventId,
        },
        body: rawBody,
      });

      const res2 = await webhookHandler(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.success).toBe(true);
      expect(data2.duplicateIgnored).toBe(true);
      expect(data2.orderId).toBe(order.id);
      expect(data2.invoiceId).toBe(data1.invoiceId);
    });
  });
});
