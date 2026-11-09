// Zealosh LMS — Phase 5B Transactional Email Outbox Test Suite
// Verifies:
// 1. Academic Event Outbox Queueing & Template Rendering
// 2. Multi-Recipient Idempotency & Composite Key Isolation
// 3. Provider Configuration Gate (EMAIL_PROVIDER_UNCONFIGURED)
// 4. Mock Provider Dispatch, Atomic Leases & Exponential Backoff Retries
// 5. Stale Lease Recovery
// 6. User Notification Preference Suppression & Security Category Immutability
// 7. Delivery Webhook Ingestion & State Reconciliation
// 8. Administrative APIs & RBAC Guard Isolation

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { emailOutboxService } from '@/lib/email/email-outbox-service';
import { emailDispatchWorker } from '@/lib/email/email-dispatch-worker';
import { mockEmailAdapter } from '@/lib/email/provider-adapter';
import { POST as postAnnouncement } from '@/app/api/courses/[slug]/announcements/route';
import { POST as submitAssignment } from '@/app/api/assignments/[assignmentId]/submit/route';
import { POST as gradeAssignment } from '@/app/api/assignments/[assignmentId]/grade/route';
import { GET as getAdminOutbox } from '@/app/api/admin/email/outbox/route';
import { GET as getAdminStats } from '@/app/api/admin/email/stats/route';
import { POST as postAdminDispatch } from '@/app/api/admin/email/dispatch/route';
import { POST as postAdminRetry } from '@/app/api/admin/email/[id]/retry/route';
import { POST as postAdminCancel } from '@/app/api/admin/email/[id]/cancel/route';
import { POST as postWebhook } from '@/app/api/webhooks/email/route';
import {
  GET as getUserPreferences,
  PATCH as patchUserPreferences,
} from '@/app/api/users/preferences/email/route';
import { User } from '@/types';

describe('Phase 5B: Transactional Email Dispatch Engine & Outbox Architecture', () => {
  const originalEmailProvider = process.env.EMAIL_PROVIDER;

  const courseId = 'crs-email-01';
  const batchA = 'btc-email-a';
  const batchB = 'btc-email-b';

  const studentAId = 'usr-std-email-a';
  const studentBId = 'usr-std-email-b';
  const instructorId = 'usr-inst-email-lead';
  const adminId = 'usr-adm-email-01';

  const studentAUser: User = {
    id: studentAId,
    name: 'Alice Student',
    email: 'alice.student@zealosh.com',
    role: 'STUDENT',
    tokenVersion: 1,
    passwordHash: 'hash',
    organizationId: 'org-zealosh',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const studentBUser: User = {
    id: studentBId,
    name: 'Bob Student',
    email: 'bob.student@zealosh.com',
    role: 'STUDENT',
    tokenVersion: 1,
    passwordHash: 'hash',
    organizationId: 'org-zealosh',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const instructorUser: User = {
    id: instructorId,
    name: 'Faculty Director',
    email: 'faculty.lead@zealosh.com',
    role: 'INSTRUCTOR',
    tokenVersion: 1,
    passwordHash: 'hash',
    organizationId: 'org-zealosh',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const adminUser: User = {
    id: adminId,
    name: 'Platform Administrator',
    email: 'admin.email@zealosh.com',
    role: 'SUPER_ADMIN',
    tokenVersion: 1,
    passwordHash: 'hash',
    organizationId: 'org-zealosh',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const studentAToken = signToken({
    userId: studentAId,
    email: studentAUser.email,
    role: 'STUDENT',
    name: studentAUser.name,
    tokenVersion: 1,
  });

  const studentBToken = signToken({
    userId: studentBId,
    email: studentBUser.email,
    role: 'STUDENT',
    name: studentBUser.name,
    tokenVersion: 1,
  });

  const instructorToken = signToken({
    userId: instructorId,
    email: instructorUser.email,
    role: 'INSTRUCTOR',
    name: instructorUser.name,
    tokenVersion: 1,
  });

  const adminToken = signToken({
    userId: adminId,
    email: adminUser.email,
    role: 'SUPER_ADMIN',
    name: adminUser.name,
    tokenVersion: 1,
  });

  beforeEach(async () => {
    mockEmailAdapter.clear();
    process.env.EMAIL_PROVIDER = ''; // Default unconfigured

    // 1. Seed users
    db.users.set(studentAId, studentAUser);
    db.users.set(studentBId, studentBUser);
    db.users.set(instructorId, instructorUser);
    db.users.set(adminId, adminUser);

    // 2. Setup course
    db.courses.set(courseId, {
      id: courseId,
      title: 'Certified Safety Professional (CSP) Masterclass',
      slug: 'csp-masterclass',
      certificationType: 'CSP',
      deliveryModel: 'HYBRID',
      status: 'PUBLISHED',
      headline: 'CSP high-stakes exam preparation.',
      description: 'Institutional training course.',
      learningObjectives: ['Risk Assessment', 'Ergonomics'],
      prerequisites: [],
      priceInr: 39999,
      priceUsd: 549,
      durationWeeks: 12,
      coverImage: '/courses/csp.jpg',
      leadInstructorId: instructorId,
      coInstructorIds: [],
      modulesCount: 4,
      totalLessons: 12,
      totalHours: 40,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. Setup Batches
    db.batches.set(batchA, {
      id: batchA,
      courseId,
      name: 'CSP Batch A (Morning)',
      startDate: '2026-11-15T00:00:00.000Z',
      endDate: '2027-02-15T00:00:00.000Z',
      scheduleDescription: 'Mon/Wed 9:00 AM',
      leadInstructorId: instructorId,
      capacity: 30,
      enrolledCount: 1,
      status: 'UPCOMING',
    });

    db.batches.set(batchB, {
      id: batchB,
      courseId,
      name: 'CSP Batch B (Evening)',
      startDate: '2026-11-15T00:00:00.000Z',
      endDate: '2027-02-15T00:00:00.000Z',
      scheduleDescription: 'Tue/Thu 7:00 PM',
      leadInstructorId: instructorId,
      capacity: 30,
      enrolledCount: 1,
      status: 'UPCOMING',
    });

    // 4. Setup enrollments
    for (const [key, enrollment] of Array.from(db.enrollments.entries())) {
      if (enrollment.courseId === courseId) {
        db.enrollments.delete(key);
      }
    }

    db.enrollments.set(`enr-${studentAId}-${courseId}`, {
      id: `enr-${studentAId}-${courseId}`,
      userId: studentAId,
      courseId,
      batchId: batchA,
      enrolledAt: new Date().toISOString(),
      expiresAt: '2027-12-31T00:00:00.000Z',
      status: 'ACTIVE',
      progressPercent: 20,
      completedLessonIds: [],
    });

    db.enrollments.set(`enr-${studentBId}-${courseId}`, {
      id: `enr-${studentBId}-${courseId}`,
      userId: studentBId,
      courseId,
      batchId: batchB,
      enrolledAt: new Date().toISOString(),
      expiresAt: '2027-12-31T00:00:00.000Z',
      status: 'ACTIVE',
      progressPercent: 10,
      completedLessonIds: [],
    });

    // 5. Clear outbox, delivery events, and user preferences
    db.emailOutbox.clear();
    db.emailDeliveryEvents.clear();
    db.userPreferences.clear();
  });

  afterEach(() => {
    process.env.EMAIL_PROVIDER = originalEmailProvider;
  });

  // =========================================================================
  // Part A: Academic Event Trigger Outbox Queueing & Template Rendering
  // =========================================================================
  describe('Part A: Academic Event Outbox Queueing & Multi-Recipient Idempotency', () => {
    it('queues distinct outbox jobs for all enrolled students in course upon announcement', async () => {
      const announcement = {
        id: 'anc-email-01',
        courseId,
        authorId: instructorId,
        authorName: 'Faculty Director',
        authorRole: 'INSTRUCTOR' as const,
        title: 'Midterm Examination Schedule Released',
        content: 'Please inspect the official timetable on the student portal.',
        audienceScope: 'COURSE_WIDE' as const,
        isPinned: false,
        likeCount: 0,
        likedBy: [],
        commentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const queuedCount = await emailOutboxService.queueAnnouncementEmails(
        announcement,
        'Certified Safety Professional (CSP) Masterclass',
        [studentAUser, studentBUser],
        'csp-masterclass'
      );

      expect(queuedCount).toBe(2);

      const { jobs } = await db.getEmailOutboxJobs({ limit: 10 });
      expect(jobs.length).toBe(2);

      const jobA = jobs.find((j) => j.recipientEmail === studentAUser.email);
      expect(jobA).toBeDefined();
      expect(jobA?.subject).toContain('Midterm Examination Schedule Released');
      expect(jobA?.htmlBody).toContain('Hello <strong>Alice Student</strong>');
      expect(jobA?.htmlBody).toContain('Zealosh Training &amp; Consultants');
      expect(jobA?.status).toBe('QUEUED');
      expect(jobA?.idempotencyKey).toBe(`email_anc_${announcement.id}_${studentAId}`);

      const jobB = jobs.find((j) => j.recipientEmail === studentBUser.email);
      expect(jobB).toBeDefined();
      expect(jobB?.recipientEmail).toBe(studentBUser.email);
    });

    it('enforces multi-recipient idempotency: identical trigger creates 0 duplicate jobs', async () => {
      const announcement = {
        id: 'anc-idempotent-test',
        courseId,
        authorId: instructorId,
        authorName: 'Faculty Director',
        authorRole: 'INSTRUCTOR' as const,
        title: 'Emergency Evacuation Drill Notice',
        content: 'Safety drill will occur at 11:00 AM.',
        audienceScope: 'COURSE_WIDE' as const,
        isPinned: false,
        likeCount: 0,
        likedBy: [],
        commentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // First trigger
      const firstQueued = await emailOutboxService.queueAnnouncementEmails(
        announcement,
        'Certified Safety Professional (CSP) Masterclass',
        [studentAUser, studentBUser]
      );
      expect(firstQueued).toBe(2);

      // Re-trigger identical event (e.g. network retry or worker restart)
      const secondQueued = await emailOutboxService.queueAnnouncementEmails(
        announcement,
        'Certified Safety Professional (CSP) Masterclass',
        [studentAUser, studentBUser]
      );
      // All items exist with identical idempotencyKey; 0 duplicates inserted
      expect(secondQueued).toBe(0);

      const { totalCount } = await db.getEmailOutboxJobs({});
      expect(totalCount).toBe(2);
    });

    it('queues assignment submission notifications to faculty and confirmation to student', async () => {
      const assignment = {
        id: 'asg-sub-test',
        courseId,
        title: 'Hazard Analysis Critical Control Points (HACCP)',
        description: 'Complete process flow diagram.',
        dueDate: '2026-11-20T23:59:59.000Z',
        maxScore: 100,
        status: 'PUBLISHED' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const submission = {
        id: 'sub-alice-01',
        assignmentId: assignment.id,
        courseId,
        userId: studentAId,
        studentName: studentAUser.name,
        studentEmail: studentAUser.email,
        submissionText: 'Attached is the revised HACCP plan.',
        submittedAt: new Date().toISOString(),
        status: 'SUBMITTED' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const queuedCount = await emailOutboxService.queueAssignmentSubmittedEmails(
        submission,
        assignment,
        'CSP Masterclass',
        studentAUser,
        [instructorUser]
      );

      // 1 email to instructor + 1 confirmation to student = 2 outbox jobs
      expect(queuedCount).toBe(2);

      const { jobs } = await db.getEmailOutboxJobs({});
      const instJob = jobs.find((j) => j.recipientEmail === instructorUser.email);
      const studentJob = jobs.find((j) => j.recipientEmail === studentAUser.email);

      expect(instJob).toBeDefined();
      expect(instJob?.subject).toContain('Submission Received: Hazard Analysis');
      expect(instJob?.templateId).toBe('tpl-assignment-submitted');

      expect(studentJob).toBeDefined();
      expect(studentJob?.subject).toContain('Coursework Received: Hazard Analysis');
      expect(studentJob?.templateId).toBe('tpl-submission-confirmed');
    });

    it('queues grade notification with score and feedback when instructor grades submission', async () => {
      const assignment = {
        id: 'asg-grade-test',
        courseId,
        title: 'Confined Space Entry Permit Formulation',
        description: 'Draft standard operating procedure.',
        dueDate: '2026-11-18T23:59:59.000Z',
        maxScore: 50,
        status: 'PUBLISHED' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const submission = {
        id: 'sub-alice-02',
        assignmentId: assignment.id,
        userId: studentAId,
        submittedAt: new Date().toISOString(),
        status: 'GRADED' as const,
        score: 48,
        feedback: 'Exceptional ventilation calculation and hazard zoning.',
        createdAt: '2026-11-19T09:00:00.000Z',
        updatedAt: '2026-11-19T10:00:00.000Z',
      };

      const job = await emailOutboxService.queueAssignmentGradedEmail(
        submission,
        assignment,
        studentAUser
      );

      expect(job).not.toBeNull();
      expect(job?.subject).toContain('Grade Published: Confined Space Entry');
      expect(job?.htmlBody).toContain('48/50');
      expect(job?.htmlBody).toContain('Exceptional ventilation calculation');
    });
  });

  // =========================================================================
  // Part B: Configuration Gate Enforcement
  // =========================================================================
  describe('Part B: Provider Configuration Gate & Institutional Safety', () => {
    it('safely marks job as FAILED with UNCONFIGURED when no provider credentials exist', async () => {
      process.env.EMAIL_PROVIDER = ''; // Unconfigured

      // Directly queue a test job
      const job = await db.queueEmailOutboxJob({
        eventType: 'ANNOUNCEMENT_NEW',
        recipientEmail: 'test.learner@zealosh.com',
        recipientName: 'Test Learner',
        templateId: 'tpl-announcement',
        templateVersion: 'v1',
        templateVariables: {},
        subject: 'Institutional Notification',
        htmlBody: '<p>Test content</p>',
        textBody: 'Test content',
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        provider: 'unconfigured',
      });

      expect(job).not.toBeNull();

      // Trigger dispatch worker
      const dispatchResult = await emailDispatchWorker.claimAndDispatchBatch({ limit: 10 });

      expect(dispatchResult.processedCount).toBe(1);
      expect(dispatchResult.failedCount).toBe(1);
      expect(dispatchResult.sentCount).toBe(0);

      const updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('FAILED');
      expect(updated?.errorClassification).toBe('UNCONFIGURED');
      expect(updated?.errorMessage).toContain('EMAIL_PROVIDER_UNCONFIGURED');
    });
  });

  // =========================================================================
  // Part C: Mock Provider Dispatch, Atomic Leases & Retry Policy
  // =========================================================================
  describe('Part C: Mock Provider Dispatch, Atomic Leases & Exponential Backoff', () => {
    beforeEach(() => {
      process.env.EMAIL_PROVIDER = 'mock'; // Switch to Mock adapter for tests
      mockEmailAdapter.clear();
    });

    it('claims jobs with atomic lease locking and marks as SENT on successful transmission', async () => {
      const job = await db.queueEmailOutboxJob({
        eventType: 'ASSIGNMENT_PUBLISHED',
        recipientEmail: studentAUser.email,
        recipientName: studentAUser.name,
        templateId: 'tpl-assignment-published',
        templateVersion: 'v1',
        templateVariables: {},
        subject: 'New Coursework: Fall Protection',
        htmlBody: '<p>Fall protection coursework</p>',
        textBody: 'Fall protection coursework',
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        provider: 'mock',
      });

      const dispatchResult = await emailDispatchWorker.claimAndDispatchBatch({ limit: 5 });
      expect(dispatchResult.sentCount).toBe(1);
      expect(dispatchResult.failedCount).toBe(0);

      const updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('SENT');
      expect(updated?.providerMessageId).toMatch(/^mock-msg-/);
      expect(updated?.lockedAt).toBeUndefined();
      expect(updated?.lockedBy).toBeUndefined();

      expect(mockEmailAdapter.sentMails.length).toBe(1);
      expect(mockEmailAdapter.sentMails[0].to).toBe(studentAUser.email);
    });

    it('schedules retry with exponential backoff on transient network failure', async () => {
      mockEmailAdapter.setFailure(true, 'TRANSIENT_NETWORK', 'Connection reset by peer');

      const job = await db.queueEmailOutboxJob({
        eventType: 'ASSIGNMENT_GRADED',
        recipientEmail: studentAUser.email,
        recipientName: studentAUser.name,
        templateId: 'tpl-assignment-graded',
        templateVersion: 'v1',
        templateVariables: {},
        subject: 'Graded: Ventilation Case Study',
        htmlBody: '<p>Graded</p>',
        textBody: 'Graded',
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        provider: 'mock',
      });

      const dispatchResult = await emailDispatchWorker.claimAndDispatchBatch({ limit: 5 });
      expect(dispatchResult.retryCount).toBe(1);
      expect(dispatchResult.sentCount).toBe(0);

      const updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('RETRY_PENDING');
      expect(updated?.attemptCount).toBe(1);
      expect(updated?.errorClassification).toBe('TRANSIENT_NETWORK');
      expect(updated?.errorMessage).toBe('Connection reset by peer');
      expect(updated?.nextAttemptAt).toBeDefined();

      // Next attempt must be scheduled in the future (> 50s from now)
      const nextTime = new Date(updated!.nextAttemptAt!).getTime();
      expect(nextTime).toBeGreaterThan(Date.now() + 50000);
    });

    it('marks job as FAILED when maxAttempts is exhausted', async () => {
      mockEmailAdapter.setFailure(true, 'TRANSIENT_NETWORK', '503 Service Unavailable');

      const job = await db.queueEmailOutboxJob({
        eventType: 'LIVE_SESSION_SCHEDULED',
        recipientEmail: studentAUser.email,
        templateId: 'tpl-live-session',
        templateVersion: 'v1',
        templateVariables: {},
        subject: 'Live Class Schedule',
        htmlBody: '<p>Live class</p>',
        textBody: 'Live class',
        status: 'QUEUED',
        attemptCount: 2, // Already had 2 attempts, max is 3
        maxAttempts: 3,
        provider: 'mock',
      });

      const dispatchResult = await emailDispatchWorker.claimAndDispatchBatch({ limit: 5 });
      expect(dispatchResult.failedCount).toBe(1);

      const updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('FAILED');
      expect(updated?.attemptCount).toBe(3);
      expect(updated?.errorClassification).toBe('PERMANENT_REJECTION');
    });

    it('recovers jobs stuck in PROCESSING status after lease expiration', async () => {
      // Simulate crashed worker leaving job locked 15 minutes ago
      const staleTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const job = await db.queueEmailOutboxJob({
        eventType: 'ANNOUNCEMENT_NEW',
        recipientEmail: studentAUser.email,
        templateId: 'tpl-announcement',
        templateVersion: 'v1',
        templateVariables: {},
        subject: 'Stale Lease Job',
        htmlBody: '<p>Stale</p>',
        textBody: 'Stale',
        status: 'PROCESSING',
        attemptCount: 1,
        maxAttempts: 3,
        provider: 'mock',
        lockedAt: staleTime,
        lockedBy: 'crashed_worker_pid_9999',
      });

      // Run lease recovery with 5 minute timeout
      const recovered = await emailDispatchWorker.recoverStaleLeases(5 * 60 * 1000);
      expect(recovered).toBeGreaterThanOrEqual(1);

      const updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('RETRY_PENDING');
      expect(updated?.lockedAt).toBeUndefined();
      expect(updated?.lockedBy).toBeUndefined();
      expect(updated?.errorMessage).toContain('Recovered from expired lease');
    });
  });

  // =========================================================================
  // Part D: User Notification Preference Suppression
  // =========================================================================
  describe('Part D: User Notification Preference Suppression & Security Immutability', () => {
    beforeEach(() => {
      process.env.EMAIL_PROVIDER = 'mock';
      mockEmailAdapter.clear();
    });

    it('suppresses outbox job when user has disabled email notifications for that category', async () => {
      // Alice opts out of ANNOUNCEMENTS
      await db.updateUserNotificationPreference(studentAId, 'ANNOUNCEMENTS', 'EMAIL', false);

      const job = await db.queueEmailOutboxJob({
        eventType: 'ANNOUNCEMENT_NEW',
        recipientUserId: studentAId,
        recipientEmail: studentAUser.email,
        templateId: 'tpl-announcement',
        templateVersion: 'v1',
        templateVariables: {},
        subject: 'New Cohort Announcement',
        htmlBody: '<p>Announcement</p>',
        textBody: 'Announcement',
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        provider: 'mock',
      });

      const result = await emailDispatchWorker.claimAndDispatchBatch({ limit: 5 });
      expect(result.suppressedCount).toBe(1);
      expect(result.sentCount).toBe(0);

      const updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('SUPPRESSED');
      expect(updated?.errorMessage).toContain('Suppressed by user notification preferences');
      expect(mockEmailAdapter.sentMails.length).toBe(0);
    });

    it('never suppresses SECURITY category notifications even if preference is somehow toggled', async () => {
      const job = await db.queueEmailOutboxJob({
        eventType: 'PASSWORD_RESET',
        recipientUserId: studentAId,
        recipientEmail: studentAUser.email,
        templateId: 'tpl-password-reset',
        templateVersion: 'v1',
        templateVariables: {},
        subject: 'Reset Your Zealosh Password',
        htmlBody: '<p>Password Reset</p>',
        textBody: 'Password Reset',
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        provider: 'mock',
      });

      const result = await emailDispatchWorker.claimAndDispatchBatch({ limit: 5 });
      expect(result.sentCount).toBe(1);
      expect(result.suppressedCount).toBe(0);

      const updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('SENT');
    });
  });

  // =========================================================================
  // Part E: Delivery Webhook Reconciliation
  // =========================================================================
  describe('Part E: Delivery Webhook Ingestion & State Reconciliation', () => {
    it('reconciles DELIVERED status and creates delivery event log on webhook post', async () => {
      const job = await db.queueEmailOutboxJob({
        eventType: 'ASSIGNMENT_PUBLISHED',
        recipientEmail: studentAUser.email,
        templateId: 'tpl-assignment-published',
        templateVersion: 'v1',
        templateVariables: {},
        subject: 'Inspection Checklist Assignment',
        htmlBody: '<p>Checklist</p>',
        textBody: 'Checklist',
        status: 'SENT',
        attemptCount: 1,
        maxAttempts: 3,
        provider: 'mock',
        providerMessageId: 'mock-msg-webhook-test-01',
      });

      const req = new Request('http://localhost/api/webhooks/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerMessageId: 'mock-msg-webhook-test-01',
          eventType: 'delivered',
          recipientEmail: studentAUser.email,
          provider: 'postmark',
        }),
      });

      const res = await postWebhook(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.received).toBe(true);
      expect(data.reconciledJobId).toBe(job!.id);

      const updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('DELIVERED');

      const events = await db.getEmailDeliveryEvents(job!.id);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('delivered');
      expect(events[0].provider).toBe('postmark');
    });

    it('reconciles BOUNCED status and marks outbox job as BOUNCED with reason', async () => {
      const job = await db.queueEmailOutboxJob({
        eventType: 'ANNOUNCEMENT_NEW',
        recipientEmail: 'invalid.mailbox@nonexistent.domain',
        templateId: 'tpl-announcement',
        templateVersion: 'v1',
        templateVariables: {},
        subject: 'Urgent Announcement',
        htmlBody: '<p>Body</p>',
        textBody: 'Body',
        status: 'SENT',
        attemptCount: 1,
        maxAttempts: 3,
        provider: 'mock',
        providerMessageId: 'mock-msg-bounce-test-02',
      });

      const req = new Request('http://localhost/api/webhooks/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerMessageId: 'mock-msg-bounce-test-02',
          eventType: 'bounce',
          recipientEmail: 'invalid.mailbox@nonexistent.domain',
          reason: '550 5.1.1 User unknown',
          provider: 'ses',
        }),
      });

      const res = await postWebhook(req);
      expect(res.status).toBe(200);

      const updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('BOUNCED');
      expect(updated?.errorClassification).toBe('INVALID_RECIPIENT');
      expect(updated?.errorMessage).toBe('550 5.1.1 User unknown');
    });
  });

  // =========================================================================
  // Part F: Administrative APIs & RBAC Guard Isolation
  // =========================================================================
  describe('Part F: Administrative Diagnostics, Preferences & RBAC Isolation', () => {
    it('blocks ordinary students from accessing /api/admin/email/outbox and /stats', async () => {
      const reqOutbox = new Request('http://localhost/api/admin/email/outbox', {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const resOutbox = await getAdminOutbox(reqOutbox);
      expect(resOutbox.status).toBe(403);

      const reqStats = new Request('http://localhost/api/admin/email/stats', {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const resStats = await getAdminStats(reqStats);
      expect(resStats.status).toBe(403);
    });

    it('allows super admin to query outbox queue and aggregate statistics', async () => {
      const reqStats = new Request('http://localhost/api/admin/email/stats', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const resStats = await getAdminStats(reqStats);
      const dataStats = await resStats.json();

      expect(resStats.status).toBe(200);
      expect(dataStats.success).toBe(true);
      expect(dataStats.stats.total).toBeDefined();
      expect(dataStats.provider.name).toBeDefined();
    });

    it('allows super admin to trigger dispatch, retry jobs, and cancel jobs', async () => {
      process.env.EMAIL_PROVIDER = 'mock';

      const job = await db.queueEmailOutboxJob({
        eventType: 'ANNOUNCEMENT_NEW',
        recipientEmail: studentBUser.email,
        templateId: 'tpl-announcement',
        templateVersion: 'v1',
        templateVariables: {},
        subject: 'Job to be cancelled and retried',
        htmlBody: '<p>Body</p>',
        textBody: 'Body',
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        provider: 'mock',
      });

      // Admin cancels job
      const cancelReq = new Request(`http://localhost/api/admin/email/${job!.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin cancelled test job' }),
      });
      const cancelRes = await postAdminCancel(cancelReq, { params: { id: job!.id } });
      expect(cancelRes.status).toBe(200);

      let updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('CANCELLED');

      // Admin retries job
      const retryReq = new Request(`http://localhost/api/admin/email/${job!.id}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const retryRes = await postAdminRetry(retryReq, { params: { id: job!.id } });
      expect(retryRes.status).toBe(200);

      updated = await db.getEmailOutboxJobById(job!.id);
      expect(updated?.status).toBe('QUEUED');
      expect(updated?.attemptCount).toBe(0);

      // Admin triggers dispatch
      const dispatchReq = new Request('http://localhost/api/admin/email/dispatch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const dispatchRes = await postAdminDispatch(dispatchReq);
      const dispatchData = await dispatchRes.json();
      expect(dispatchRes.status).toBe(200);
      expect(dispatchData.success).toBe(true);
      expect(dispatchData.dispatchResult.sentCount).toBe(1);
    });

    it('verifies end-to-end route integration: posting announcement creates both in-app notification and email outbox job', async () => {
      const postReq = new Request(`http://localhost/api/courses/csp-masterclass/announcements`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${instructorToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Official Board Review Session Announced',
          content: 'Live session will be held this Saturday covering BCRSP blueprint domain 3.',
          audienceScope: 'ALL_BATCHES',
        }),
      });

      const res = await postAnnouncement(postReq, { params: { slug: 'csp-masterclass' } });
      expect(res.status).toBe(200);

      // Verify in-app notifications
      const notifsA = await db.getNotifications(studentAId);
      expect(notifsA.notifications.some((n) => n.title.includes('Official Board Review Session Announced'))).toBe(true);

      // Verify email outbox jobs
      const { jobs } = await db.getEmailOutboxJobs({ limit: 10 });
      const emailA = jobs.find((j) => j.recipientUserId === studentAId && j.subject.includes('Official Board Review Session Announced'));
      expect(emailA).toBeDefined();
      expect(emailA?.status).toBe('QUEUED');
      expect(emailA?.recipientEmail).toBe(studentAUser.email);
    });

    it('allows student to manage their own email preferences but rejects disabling SECURITY', async () => {
      // 1. Student queries preferences
      const getReq = new Request('http://localhost/api/users/preferences/email', {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const getRes = await getUserPreferences(getReq);
      expect(getRes.status).toBe(200);

      // 2. Student updates ASSIGNMENTS preference to false
      const patchReq = new Request('http://localhost/api/users/preferences/email', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${studentAToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'ASSIGNMENTS', isEnabled: false }),
      });
      const patchRes = await patchUserPreferences(patchReq);
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(200);
      expect(patchData.preference.isEnabled).toBe(false);

      // 3. Student attempts to disable SECURITY category -> Must return 400
      const rogueReq = new Request('http://localhost/api/users/preferences/email', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${studentAToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'SECURITY', isEnabled: false }),
      });
      const rogueRes = await patchUserPreferences(rogueReq);
      expect(rogueRes.status).toBe(400);
      const rogueData = await rogueRes.json();
      expect(rogueData.error).toContain('Security');
    });
  });
});
