// Zealosh LMS — ZM-04.1 Classroom Security & Data-Lifecycle Closure Test Suite
// Validates:
// 1. Batch-level announcement isolation (Student A in Batch A denied Batch B announcements).
// 2. Strict batch query authorization (explicit ?batchId= parameter validated against student enrollments).
// 3. Course-wide announcement visibility across cohorts without cross-batch pollution.
// 4. Instructor role & batch scoping (course lead vs batch-specific instructor vs unassigned instructor).
// 5. Announcement PATCH update, soft-archival (status: ARCHIVED), and DELETE lifecycle.
// 6. Non-student / non-staff unauthorized access rejection.

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { GET as getAnnouncements, POST as postAnnouncement } from '@/app/api/courses/[slug]/announcements/route';
import { PATCH as patchAnnouncement, DELETE as deleteAnnouncement } from '@/app/api/courses/[slug]/announcements/[id]/route';

describe('ZM-04.1 Digital Classroom Security Closure', () => {
  const courseId = 'crs-sec-closure-01';
  const batchA = 'btc-sec-cohort-a';
  const batchB = 'btc-sec-cohort-b';

  const studentAId = 'usr-std-sec-a';
  const studentBId = 'usr-std-sec-b';
  const unenrolledStudentId = 'usr-std-sec-none';

  const courseLeadInstructorId = 'usr-inst-sec-lead';
  const batchAInstructorId = 'usr-inst-sec-batch-a';
  const unassignedInstructorId = 'usr-inst-sec-unassigned';
  const adminId = 'usr-admin-sec-master';

  const studentAToken = signToken({
    userId: studentAId,
    email: 'student.a@zealosh.com',
    role: 'STUDENT',
    name: 'Arjun Menon (Batch A)',
  });

  const studentBToken = signToken({
    userId: studentBId,
    email: 'student.b@zealosh.com',
    role: 'STUDENT',
    name: 'Kavita Nair (Batch B)',
  });

  const unenrolledStudentToken = signToken({
    userId: unenrolledStudentId,
    email: 'unenrolled@zealosh.com',
    role: 'STUDENT',
    name: 'Unenrolled User',
  });

  const courseLeadToken = signToken({
    userId: courseLeadInstructorId,
    email: 'course.lead@zealosh.com',
    role: 'INSTRUCTOR',
    name: 'Dr. Ramesh Kumar (Course Lead)',
  });

  const batchAInstructorToken = signToken({
    userId: batchAInstructorId,
    email: 'batch.a.inst@zealosh.com',
    role: 'INSTRUCTOR',
    name: 'Prof. Ananya (Batch A Faculty)',
  });

  const unassignedInstructorToken = signToken({
    userId: unassignedInstructorId,
    email: 'rogue.inst@zealosh.com',
    role: 'INSTRUCTOR',
    name: 'Unassigned Instructor',
  });

  const adminToken = signToken({
    userId: adminId,
    email: 'admin@zealosh.com',
    role: 'SUPER_ADMIN',
    name: 'Master Admin',
  });

  beforeEach(async () => {
    // 1. Setup course with courseLeadInstructorId
    db.courses.set(courseId, {
      id: courseId,
      title: 'HSE Process Safety Engineering & Risk Assessment',
      slug: 'hse-process-safety',
      certificationType: 'ASP',
      deliveryModel: 'HYBRID',
      status: 'PUBLISHED',
      headline: 'Process safety and industrial hygiene certification.',
      description: 'Full course syllabus.',
      learningObjectives: ['Risk Assessment', 'Hazard Mitigation'],
      prerequisites: [],
      priceInr: 35000,
      priceUsd: 499,
      durationWeeks: 10,
      coverImage: '/courses/hse.jpg',
      leadInstructorId: courseLeadInstructorId,
      coInstructorIds: [],
      modulesCount: 5,
      totalLessons: 20,
      totalHours: 40,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Setup Batch A (batchAInstructorId as lead) and Batch B (courseLeadInstructorId as lead)
    db.batches.set(batchA, {
      id: batchA,
      courseId,
      name: 'Cohort A (Weekend Intensive)',
      startDate: '2026-11-10T00:00:00.000Z',
      endDate: '2027-01-20T00:00:00.000Z',
      scheduleDescription: 'Saturdays & Sundays 10:00 AM IST',
      leadInstructorId: batchAInstructorId,
      capacity: 30,
      enrolledCount: 1,
      status: 'UPCOMING',
    });

    db.batches.set(batchB, {
      id: batchB,
      courseId,
      name: 'Cohort B (Weekday Evening)',
      startDate: '2026-11-12T00:00:00.000Z',
      endDate: '2027-01-22T00:00:00.000Z',
      scheduleDescription: 'Tuesdays & Thursdays 7:00 PM IST',
      leadInstructorId: courseLeadInstructorId,
      capacity: 30,
      enrolledCount: 1,
      status: 'UPCOMING',
    });

    // 3. Clear existing test enrollments and add isolated enrollments
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
      progressPercent: 10,
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
      progressPercent: 15,
      completedLessonIds: [],
    });

    // 4. Clear test announcements
    db.announcements.clear();
  });

  describe('Part A: Batch-Level Announcement Isolation & Leak Prevention', () => {
    it('isolates Batch A announcements from Batch B students and vice versa', async () => {
      // 1. Post Course-Wide Announcement
      const postCourseWideReq = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courseLeadToken}` },
        body: JSON.stringify({
          title: 'Course-Wide: Syllabus Overview & Welcome Webinar',
          content: 'Welcome all cohorts. Review safety manual Chapter 1.',
        }),
      });
      const resCw = await postAnnouncement(postCourseWideReq, { params: { slug: courseId } });
      expect(resCw.status).toBe(200);

      // 2. Post Batch A Announcement
      const postBatchAReq = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courseLeadToken}` },
        body: JSON.stringify({
          title: 'Batch A Private: Special Saturday Workshop Room Link',
          content: 'Confidential link for Cohort A only.',
          batchId: batchA,
        }),
      });
      const resA = await postAnnouncement(postBatchAReq, { params: { slug: courseId } });
      expect(resA.status).toBe(200);

      // 3. Post Batch B Announcement
      const postBatchBReq = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courseLeadToken}` },
        body: JSON.stringify({
          title: 'Batch B Private: Thursday Night Session Rescheduled',
          content: 'Cohort B students please note timing adjustment.',
          batchId: batchB,
        }),
      });
      const resB = await postAnnouncement(postBatchBReq, { params: { slug: courseId } });
      expect(resB.status).toBe(200);

      // 4. Student A queries announcements (default query without explicit batchId)
      const studentAGetReq = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const resStdA = await getAnnouncements(studentAGetReq, { params: { slug: courseId } });
      const dataStdA = await resStdA.json();

      expect(resStdA.status).toBe(200);
      expect(dataStdA.announcements).toHaveLength(2);
      const stdATitles = dataStdA.announcements.map((a: any) => a.title);
      expect(stdATitles).toContain('Course-Wide: Syllabus Overview & Welcome Webinar');
      expect(stdATitles).toContain('Batch A Private: Special Saturday Workshop Room Link');
      expect(stdATitles).not.toContain('Batch B Private: Thursday Night Session Rescheduled');

      // 5. Student B queries announcements (default query without explicit batchId)
      const studentBGetReq = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      const resStdB = await getAnnouncements(studentBGetReq, { params: { slug: courseId } });
      const dataStdB = await resStdB.json();

      expect(resStdB.status).toBe(200);
      expect(dataStdB.announcements).toHaveLength(2);
      const stdBTitles = dataStdB.announcements.map((a: any) => a.title);
      expect(stdBTitles).toContain('Course-Wide: Syllabus Overview & Welcome Webinar');
      expect(stdBTitles).toContain('Batch B Private: Thursday Night Session Rescheduled');
      expect(stdBTitles).not.toContain('Batch A Private: Special Saturday Workshop Room Link');
    });

    it('rejects student attempting to probe another cohort with ?batchId parameter (HTTP 403)', async () => {
      // Student A attempts to query Batch B explicitly
      const probeReq = new Request(`http://localhost/api/courses/${courseId}/announcements?batchId=${batchB}`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const probeRes = await getAnnouncements(probeReq, { params: { slug: courseId } });
      const probeData = await probeRes.json();

      expect(probeRes.status).toBe(403);
      expect(probeData.error).toContain('Cannot access announcements for an unenrolled cohort batch');
    });

    it('rejects an unenrolled student from viewing any announcements (HTTP 403)', async () => {
      const unenrolledReq = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        headers: { Authorization: `Bearer ${unenrolledStudentToken}` },
      });
      const unenrolledRes = await getAnnouncements(unenrolledReq, { params: { slug: courseId } });
      const data = await unenrolledRes.json();

      expect(unenrolledRes.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });
  });

  describe('Part B: Instructor Scoping & Role Boundaries', () => {
    it('permits batch-only instructor to post to their assigned batch', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${batchAInstructorToken}` },
        body: JSON.stringify({
          title: 'Batch A Specific Notice from Assigned Faculty',
          content: 'Please submit your calculations before Friday.',
          batchId: batchA,
        }),
      });
      const res = await postAnnouncement(req, { params: { slug: courseId } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.announcement.audienceScope).toBe('BATCH_SPECIFIC');
      expect(data.announcement.batchId).toBe(batchA);
    });

    it('rejects batch-only instructor attempting to post course-wide (HTTP 403)', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${batchAInstructorToken}` },
        body: JSON.stringify({
          title: 'Unauthorized Course-Wide Broadcast',
          content: 'Batch faculty trying to post to entire course.',
          // No batchId -> course-wide attempt
        }),
      });
      const res = await postAnnouncement(req, { params: { slug: courseId } });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain('Batch-level instructors cannot post course-wide announcements');
    });

    it('rejects batch-only instructor attempting to post to an unassigned batch (HTTP 403)', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${batchAInstructorToken}` },
        body: JSON.stringify({
          title: 'Cross-Batch Intrusion Attempt',
          content: 'Batch A instructor trying to post to Batch B.',
          batchId: batchB,
        }),
      });
      const res = await postAnnouncement(req, { params: { slug: courseId } });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('rejects completely unassigned instructor from posting announcements (HTTP 403)', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${unassignedInstructorToken}` },
        body: JSON.stringify({
          title: 'Rogue Instructor Post',
          content: 'I have no assignment to this course or batch.',
          batchId: batchA,
        }),
      });
      const res = await postAnnouncement(req, { params: { slug: courseId } });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain('Forbidden: You are not assigned to instruct this');
    });

    it('rejects students from posting announcements (HTTP 403)', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentAToken}` },
        body: JSON.stringify({
          title: 'Student Attempting Faculty Broadcast',
          content: 'Students cannot publish announcements.',
        }),
      });
      const res = await postAnnouncement(req, { params: { slug: courseId } });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain('Forbidden: Instructor or Admin privileges required to post announcements');
    });
  });

  describe('Part C: Announcement Deletion, Archival & Update Lifecycle', () => {
    it('allows author to update announcement content and soft-archive via PATCH', async () => {
      // 1. Create announcement
      const postReq = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courseLeadToken}` },
        body: JSON.stringify({
          title: 'Initial Announcement Title',
          content: 'Initial text content.',
          batchId: batchA,
        }),
      });
      const postRes = await postAnnouncement(postReq, { params: { slug: courseId } });
      const postData = await postRes.json();
      const announcementId = postData.announcement.id;

      // 2. Patch content and pin status
      const patchReq = new Request(`http://localhost/api/courses/${courseId}/announcements/${announcementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courseLeadToken}` },
        body: JSON.stringify({
          title: 'Updated Announcement Title',
          content: 'Revised text content with additional references.',
          isPinned: true,
        }),
      });
      const patchRes = await patchAnnouncement(patchReq, { params: { slug: courseId, id: announcementId } });
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(200);
      expect(patchData.announcement.title).toBe('Updated Announcement Title');
      expect(patchData.announcement.isPinned).toBe(true);

      // 3. Soft-archive the announcement
      const archiveReq = new Request(`http://localhost/api/courses/${courseId}/announcements/${announcementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courseLeadToken}` },
        body: JSON.stringify({
          status: 'ARCHIVED',
        }),
      });
      const archiveRes = await patchAnnouncement(archiveReq, { params: { slug: courseId, id: announcementId } });
      expect(archiveRes.status).toBe(200);

      // 4. Verify Student A does NOT receive archived announcement
      const stdReq = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const stdRes = await getAnnouncements(stdReq, { params: { slug: courseId } });
      const stdData = await stdRes.json();

      const ids = stdData.announcements.map((a: any) => a.id);
      expect(ids).not.toContain(announcementId);
    });

    it('rejects student or unassigned instructor from deleting announcements (HTTP 403)', async () => {
      // 1. Create announcement
      const postReq = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courseLeadToken}` },
        body: JSON.stringify({
          title: 'Faculty Announcement to Protect',
          content: 'Cannot be deleted by unassigned staff or students.',
        }),
      });
      const postRes = await postAnnouncement(postReq, { params: { slug: courseId } });
      const postData = await postRes.json();
      const announcementId = postData.announcement.id;

      // 2. Student attempt to delete
      const stdDelReq = new Request(`http://localhost/api/courses/${courseId}/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${studentAToken}` },
      });
      const stdDelRes = await deleteAnnouncement(stdDelReq, { params: { slug: courseId, id: announcementId } });
      expect(stdDelRes.status).toBe(403);

      // 3. Unassigned instructor attempt to delete
      const unassignedDelReq = new Request(`http://localhost/api/courses/${courseId}/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${unassignedInstructorToken}` },
      });
      const unassignedDelRes = await deleteAnnouncement(unassignedDelReq, { params: { slug: courseId, id: announcementId } });
      expect(unassignedDelRes.status).toBe(403);

      // 4. Authorized course lead deletion succeeds
      const authorizedDelReq = new Request(`http://localhost/api/courses/${courseId}/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${courseLeadToken}` },
      });
      const authorizedDelRes = await deleteAnnouncement(authorizedDelReq, { params: { slug: courseId, id: announcementId } });
      expect(authorizedDelRes.status).toBe(200);

      // Verify deletion from db
      const check = db.announcements.get(announcementId);
      expect(check).toBeUndefined();
    });
  });
});
