// Zealosh LMS — Phase 5A In-App Notification Center Test Suite
// Validates:
// 1. Server-side audience resolution for academic events (announcements, assignments, submissions, grading, doubts).
// 2. Strict event idempotency (zero duplicate notifications on identical trigger).
// 3. Cross-user isolation (Student A cannot view or manipulate Student B's notifications).
// 4. In-App Notification REST APIs (/api/notifications, /read, /mark-all-read, /unread-count).
// 5. Unread count decrement and state transitions.

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { notificationService } from '@/lib/notifications/notification-service';
import { GET as getNotifications } from '@/app/api/notifications/route';
import { PATCH as markSingleRead } from '@/app/api/notifications/[id]/read/route';
import { POST as markAllRead } from '@/app/api/notifications/mark-all-read/route';
import { GET as getUnreadCount } from '@/app/api/notifications/unread-count/route';
import { POST as postAnnouncement } from '@/app/api/courses/[slug]/announcements/route';
import { POST as submitAssignment } from '@/app/api/assignments/[assignmentId]/submit/route';
import { POST as gradeSubmission } from '@/app/api/assignments/[assignmentId]/grade/route';

describe('Phase 5A: In-App Notification Center & Academic Triggers', () => {
  const courseId = 'crs-notif-01';
  const batchA = 'btc-notif-a';
  const batchB = 'btc-notif-b';

  const studentAId = 'usr-std-notif-a';
  const studentBId = 'usr-std-notif-b';
  const instructorId = 'usr-inst-notif-lead';

  const studentAToken = signToken({
    userId: studentAId,
    email: 'student.a@zealosh.com',
    role: 'STUDENT',
    name: 'Student A',
  });

  const studentBToken = signToken({
    userId: studentBId,
    email: 'student.b@zealosh.com',
    role: 'STUDENT',
    name: 'Student B',
  });

  const instructorToken = signToken({
    userId: instructorId,
    email: 'lead.inst@zealosh.com',
    role: 'INSTRUCTOR',
    name: 'Lead Instructor',
  });

  beforeEach(async () => {
    // 1. Setup course
    db.courses.set(courseId, {
      id: courseId,
      title: 'Certified Safety Professional (CSP) Comprehensive',
      slug: 'csp-comprehensive',
      certificationType: 'CSP',
      deliveryModel: 'HYBRID',
      status: 'PUBLISHED',
      headline: 'CSP examination preparation cohort.',
      description: 'Comprehensive course.',
      learningObjectives: ['Risk Assessment'],
      prerequisites: [],
      priceInr: 39999,
      priceUsd: 549,
      durationWeeks: 12,
      coverImage: '/courses/csp.jpg',
      leadInstructorId: instructorId,
      coInstructorIds: [],
      modulesCount: 6,
      totalLessons: 24,
      totalHours: 48,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Setup Batches
    db.batches.set(batchA, {
      id: batchA,
      courseId,
      name: 'CSP Batch A (Morning)',
      startDate: '2026-11-15T00:00:00.000Z',
      endDate: '2027-02-15T00:00:00.000Z',
      scheduleDescription: 'Mon/Wed 9:00 AM',
      leadInstructorId: instructorId,
      capacity: 25,
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
      capacity: 25,
      enrolledCount: 1,
      status: 'UPCOMING',
    });

    // 3. Setup enrollments
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

    // 4. Clear notifications
    db.notifications.clear();
    db.announcements.clear();
  });

  describe('Part A: Academic Event Dispatchers & Scoping', () => {
    it('dispatches course-wide announcement notifications to all enrolled students', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructorToken}` },
        body: JSON.stringify({
          title: 'All-Cohort Orientation Meeting',
          content: 'Mandatory orientation for all enrolled CSP candidates.',
        }),
      });

      const res = await postAnnouncement(req, { params: { slug: courseId } });
      expect(res.status).toBe(200);

      // Verify Student A received notification
      const notifsA = await db.getNotifications(studentAId);
      expect(notifsA.notifications.length).toBeGreaterThanOrEqual(1);
      expect(notifsA.notifications.some((n) => n.title.includes('All-Cohort Orientation Meeting'))).toBe(true);

      // Verify Student B received notification
      const notifsB = await db.getNotifications(studentBId);
      expect(notifsB.notifications.length).toBeGreaterThanOrEqual(1);
      expect(notifsB.notifications.some((n) => n.title.includes('All-Cohort Orientation Meeting'))).toBe(true);
    });

    it('dispatches batch-specific announcement notifications ONLY to target batch students', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructorToken}` },
        body: JSON.stringify({
          title: 'Batch A Laboratory Schedule',
          content: 'Special laboratory briefing for Batch A only.',
          batchId: batchA,
        }),
      });

      const res = await postAnnouncement(req, { params: { slug: courseId } });
      expect(res.status).toBe(200);

      // Student A (Batch A) must have received it
      const notifsA = await db.getNotifications(studentAId);
      expect(notifsA.notifications.some((n) => n.title.includes('Batch A Laboratory Schedule'))).toBe(true);

      // Student B (Batch B) must NOT have received it
      const notifsB = await db.getNotifications(studentBId);
      expect(notifsB.notifications.some((n) => n.title.includes('Batch A Laboratory Schedule'))).toBe(false);
    });

    it('dispatches notifications upon assignment submission to instructor and student confirmation', async () => {
      const assignmentId = 'asg-notif-01';
      db.assignments.set(assignmentId, {
        id: assignmentId,
        courseId,
        batchId: batchA,
        title: 'Ventilation Design Case Study',
        description: 'Submit airflow calculations.',
        instructionsHtml: '<p>Show full formulas.</p>',
        maxScore: 50,
        dueDate: '2026-11-20T23:59:59.000Z',
        status: 'PUBLISHED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const submitReq = new Request(`http://localhost/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentAToken}` },
        body: JSON.stringify({
          submissionText: 'Attached are the duct size calculations in CFM.',
          attachmentUrl: 'https://zealosh.com/docs/airflow.pdf',
        }),
      });

      const res = await submitAssignment(submitReq, { params: { assignmentId } });
      expect(res.status).toBe(200);

      // Verify instructor received notification
      const instNotifs = await db.getNotifications(instructorId);
      expect(instNotifs.notifications.some((n) => n.type === 'ASSIGNMENT_SUBMITTED')).toBe(true);

      // Verify student received confirmation notification
      const studentNotifs = await db.getNotifications(studentAId);
      expect(studentNotifs.notifications.some((n) => n.title.includes('Submission Received'))).toBe(true);
    });

    it('dispatches notification upon assignment grading with score to student', async () => {
      const assignmentId = 'asg-notif-02';
      const submissionId = `sub-${studentAId}-${assignmentId}`;

      db.assignments.set(assignmentId, {
        id: assignmentId,
        courseId,
        batchId: batchA,
        title: 'Chemical Hazard Assessment Report',
        description: 'Identify SDS hazards.',
        instructionsHtml: '<p>Use GHS symbols.</p>',
        maxScore: 100,
        dueDate: '2026-11-25T23:59:59.000Z',
        status: 'PUBLISHED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.submissions.set(submissionId, {
        id: submissionId,
        assignmentId,
        userId: studentAId,
        studentName: 'Student A',
        submissionText: 'SDS evaluation completed according to OSHA guidelines.',
        submittedAt: new Date().toISOString(),
        status: 'SUBMITTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const gradeReq = new Request(`http://localhost/api/assignments/${assignmentId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructorToken}` },
        body: JSON.stringify({
          submissionId,
          score: 94,
          feedback: 'Outstanding risk matrix analysis. Excellent GHS classification.',
          criterionScores: {},
        }),
      });

      const res = await gradeSubmission(gradeReq, { params: { assignmentId } });
      expect(res.status).toBe(200);

      // Verify student received ASSIGNMENT_GRADED notification
      const studentNotifs = await db.getNotifications(studentAId);
      const gradedNotif = studentNotifs.notifications.find((n) => n.type === 'ASSIGNMENT_GRADED');
      expect(gradedNotif).toBeDefined();
      expect(gradedNotif?.description).toContain('94/100');
    });
  });

  describe('Part B: Event Idempotency & Deduplication', () => {
    it('creates zero duplicate notifications on identical idempotencyKey', async () => {
      const idempotencyKey = `test_idempotent_event_${Date.now()}`;

      const n1 = await db.createNotification({
        recipientUserId: studentAId,
        type: 'SYSTEM_ALERT',
        title: 'System Scheduled Maintenance',
        description: 'Server will undergo scheduled maintenance tonight at 2 AM.',
        actionUrl: '/maintenance',
        idempotencyKey,
      });
      expect(n1).toBeDefined();

      // Attempt second insertion with same idempotencyKey
      const n2 = await db.createNotification({
        recipientUserId: studentAId,
        type: 'SYSTEM_ALERT',
        title: 'System Scheduled Maintenance (Duplicate Trigger)',
        description: 'Duplicate trigger attempt.',
        actionUrl: '/maintenance',
        idempotencyKey,
      });

      // Returns the existing notification or null, but does not duplicate
      const allNotifs = await db.getNotifications(studentAId);
      const matching = allNotifs.notifications.filter((n) => n.idempotencyKey === idempotencyKey);
      expect(matching.length).toBe(1);
    });
  });

  describe('Part C: Cross-User Isolation & Notification Management APIs', () => {
    let notifAId: string;
    let notifBId: string;

    beforeEach(async () => {
      const notifA = await db.createNotification({
        recipientUserId: studentAId,
        type: 'ASSIGNMENT_PUBLISHED',
        title: 'Student A Private Notice',
        description: 'Confidential message for Student A',
        actionUrl: '/student/classwork',
      });
      notifAId = notifA!.id;

      const notifB = await db.createNotification({
        recipientUserId: studentBId,
        type: 'ASSIGNMENT_PUBLISHED',
        title: 'Student B Private Notice',
        description: 'Confidential message for Student B',
        actionUrl: '/student/classwork',
      });
      notifBId = notifB!.id;
    });

    it('enforces cross-user isolation when querying /api/notifications', async () => {
      const reqA = new Request('http://localhost/api/notifications', {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const resA = await getNotifications(reqA);
      const dataA = await resA.json();

      expect(resA.status).toBe(200);
      const idsA = dataA.notifications.map((n: any) => n.id);
      expect(idsA).toContain(notifAId);
      expect(idsA).not.toContain(notifBId);
    });

    it('calculates unread count accurately via /api/notifications/unread-count', async () => {
      const req = new Request('http://localhost/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const res = await getUnreadCount(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('marks a single notification read and decrements unread count', async () => {
      const readReq = new Request(`http://localhost/api/notifications/${notifAId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const readRes = await markSingleRead(readReq, { params: { id: notifAId } });
      const readData = await readRes.json();

      expect(readRes.status).toBe(200);
      expect(readData.success).toBe(true);

      // Verify unread count is now 0 for Student A
      const countReq = new Request('http://localhost/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const countRes = await getUnreadCount(countReq);
      const countData = await countRes.json();
      expect(countData.unreadCount).toBe(0);
    });

    it('rejects user attempting to mark another user notification as read', async () => {
      // Student A tries to mark Student B's notification read
      const rogueReq = new Request(`http://localhost/api/notifications/${notifBId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const rogueRes = await markSingleRead(rogueReq, { params: { id: notifBId } });
      expect(rogueRes.status).toBe(404); // Returns 404 Not Found to prevent ID enumeration
    });

    it('marks all notifications read via /api/notifications/mark-all-read', async () => {
      // Add another unread notification for Student A
      await db.createNotification({
        recipientUserId: studentAId,
        type: 'SYSTEM_ALERT',
        title: 'Another unread alert',
        description: 'Test body',
        actionUrl: '/dashboard',
      });

      const markAllReq = new Request('http://localhost/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const markAllRes = await markAllRead(markAllReq);
      const markAllData = await markAllRes.json();

      expect(markAllRes.status).toBe(200);
      expect(markAllData.markedCount).toBeGreaterThanOrEqual(1);

      const countReq = new Request('http://localhost/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const countRes = await getUnreadCount(countReq);
      const countData = await countRes.json();
      expect(countData.unreadCount).toBe(0);
    });
  });
});
