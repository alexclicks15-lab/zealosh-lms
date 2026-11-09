// Zealosh LMS — Digital Classroom & Academic Workspace Test Suite
// Validates:
// 1. Cohort announcement creation, batch filtering, role guards, and deletion lifecycle.
// 2. Unified classwork aggregation across assignments, quizzes, materials, and live classes.
// 3. Student coursework submission, draft notes, submission timestamps, and resubmission lifecycle.
// 4. Instructor rubric evaluation, criterion marks, resubmission request, and official grade publishing.
// 5. AI review suggestion seam (ADR-003 gate, structured suggestion generation, human approval boundary).
// 6. Cross-student and cross-batch isolation.

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { GET as getAnnouncements, POST as postAnnouncement } from '@/app/api/courses/[slug]/announcements/route';
import { DELETE as deleteAnnouncement } from '@/app/api/courses/[slug]/announcements/[id]/route';
import { GET as getClasswork } from '@/app/api/courses/[slug]/classwork/route';
import { POST as submitAssignment } from '@/app/api/assignments/[assignmentId]/submit/route';
import { POST as gradeSubmission } from '@/app/api/assignments/[assignmentId]/grade/route';
import { POST as requestAiReview } from '@/app/api/assignments/[assignmentId]/ai-review/route';

describe('Digital Classroom & Academic Workspace (Google Classroom Style)', () => {
  const courseId = 'crs-asp-01';
  const batchId = 'btc-asp-nov26';
  const studentId = 'usr-std-01';
  const otherStudentId = 'usr-std-02';
  const instructorId = 'usr-inst-01';
  const otherInstructorId = 'usr-inst-99';
  const adminId = 'usr-admin-01';

  const studentToken = signToken({
    userId: studentId,
    email: 'student@zealosh.com',
    role: 'STUDENT',
    name: 'Arjun Menon',
  });

  const otherStudentToken = signToken({
    userId: otherStudentId,
    email: 'other.student@zealosh.com',
    role: 'STUDENT',
    name: 'Kavita Nair',
  });

  const instructorToken = signToken({
    userId: instructorId,
    email: 'instructor@zealosh.com',
    role: 'INSTRUCTOR',
    name: 'Dr. Ramesh Kumar',
  });

  const otherInstructorToken = signToken({
    userId: otherInstructorId,
    email: 'other.inst@zealosh.com',
    role: 'INSTRUCTOR',
    name: 'Unassigned Instructor',
  });

  const adminToken = signToken({
    userId: adminId,
    email: 'admin@zealosh.com',
    role: 'SUPER_ADMIN',
    name: 'Administrator',
  });

  beforeEach(async () => {
    // Ensure course and batch exist
    const existingCourse = await db.getCourseById(courseId);
    if (!existingCourse) {
      await db.addCourse({
        id: courseId,
        title: 'Associate Safety Professional (ASP) Examination Preparation',
        slug: 'asp-examination-prep',
        certificationType: 'ASP',
        deliveryModel: 'HYBRID',
        status: 'PUBLISHED',
        headline: 'Comprehensive preparation for the BCSP ASP examination.',
        description: 'Complete syllabus coverage.',
        learningObjectives: ['Master ventilation', 'Radiation protection'],
        prerequisites: [],
        priceInr: 34999,
        priceUsd: 499,
        durationWeeks: 12,
        coverImage: '/courses/asp.jpg',
        leadInstructorId: instructorId,
        coInstructorIds: [],
        modulesCount: 6,
        totalLessons: 24,
        totalHours: 48,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Ensure student enrollment
    const enrollments = await db.getEnrollments(studentId);
    const hasEnrollment = enrollments.some((e) => e.courseId === courseId && e.status === 'ACTIVE');
    if (!hasEnrollment) {
      await db.enrollStudent({
        userId: studentId,
        courseId,
        batchId,
      });
    }

    // Clear test announcements
    db.announcements.clear();
  });

  // --------------------------------------------------------------------------
  // 1. Cohort Announcements Lifecycle
  // --------------------------------------------------------------------------
  describe('Cohort Stream & Announcements Lifecycle', () => {
    it('allows assigned lead instructor to publish an announcement', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          title: 'Sunday Live Workshop: Ventilation Calculations',
          content: 'Please review ACGIH equations in Chapter 4 before class.',
          batchId,
          isPinned: true,
          attachments: [{ title: 'Formula Sheet', url: '/materials/ventilation.pdf' }],
        }),
      });

      const res = await postAnnouncement(req, { params: { slug: courseId } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.announcement.title).toBe('Sunday Live Workshop: Ventilation Calculations');
      expect(data.announcement.isPinned).toBe(true);
      expect(data.announcement.authorId).toBe(instructorId);
    });

    it('rejects unassigned instructor from publishing announcement', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherInstructorToken}`,
        },
        body: JSON.stringify({
          title: 'Unauthorized Announcement',
          content: 'This should be rejected.',
        }),
      });

      const res = await postAnnouncement(req, { params: { slug: courseId } });
      expect(res.status).toBe(403);
    });

    it('rejects student from posting announcements (privilege escalation defense)', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          title: 'Student Announcement',
          content: 'Students cannot publish announcements.',
        }),
      });

      const res = await postAnnouncement(req, { params: { slug: courseId } });
      expect(res.status).toBe(403);
    });

    it('allows enrolled student to view cohort announcements', async () => {
      // Seed announcement
      await db.saveAnnouncement({
        id: 'anc-seed-01',
        courseId,
        batchId,
        title: 'Exam Date Reminder',
        content: 'Final mock exam sits on the 28th.',
        authorId: instructorId,
        authorName: 'Dr. Ramesh Kumar',
        authorRole: 'INSTRUCTOR',
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const req = new Request(`http://localhost/api/courses/${courseId}/announcements?batchId=${batchId}`, {
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
      });

      const res = await getAnnouncements(req, { params: { slug: courseId } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.announcements.length).toBeGreaterThanOrEqual(1);
      expect(data.announcements[0].title).toBe('Exam Date Reminder');
    });

    it('rejects unenrolled student from accessing announcements', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/announcements`, {
        headers: {
          Authorization: `Bearer ${otherStudentToken}`,
        },
      });

      const res = await getAnnouncements(req, { params: { slug: courseId } });
      expect(res.status).toBe(403);
    });

    it('allows author instructor to delete an announcement', async () => {
      const anc = await db.saveAnnouncement({
        id: 'anc-to-delete',
        courseId,
        batchId,
        title: 'Temporary Notice',
        content: 'This will be deleted.',
        authorId: instructorId,
        authorName: 'Dr. Ramesh Kumar',
        authorRole: 'INSTRUCTOR',
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const req = new Request(`http://localhost/api/courses/${courseId}/announcements/${anc.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${instructorToken}`,
        },
      });

      const res = await deleteAnnouncement(req, { params: { slug: courseId, id: anc.id } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      const check = await db.getAnnouncementById(anc.id);
      expect(check).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Classwork Hub Aggregation
  // --------------------------------------------------------------------------
  describe('Unified Classwork Organization Hub', () => {
    it('aggregates assignments, quizzes, materials, and live sessions for enrolled student', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/classwork?batchId=${batchId}`, {
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
      });

      const res = await getClasswork(req, { params: { slug: courseId } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.course).toBeDefined();
      expect(data.course.id).toBe(courseId);
      expect(Array.isArray(data.assignments)).toBe(true);
      expect(Array.isArray(data.quizzes)).toBe(true);
      expect(Array.isArray(data.materials)).toBe(true);
      expect(Array.isArray(data.liveSessions)).toBe(true);
      expect(Array.isArray(data.upcomingDeadlines)).toBe(true);
    });

    it('denies classwork access to unenrolled student', async () => {
      const req = new Request(`http://localhost/api/courses/${courseId}/classwork`, {
        headers: {
          Authorization: `Bearer ${otherStudentToken}`,
        },
      });

      const res = await getClasswork(req, { params: { slug: courseId } });
      expect(res.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Student Assignment Submission & Resubmission Lifecycle
  // --------------------------------------------------------------------------
  describe('Student Assignment Submission & Resubmission Lifecycle', () => {
    const asgId = 'asg-test-work-01';

    beforeEach(async () => {
      await db.saveAssignment({
        id: asgId,
        courseId,
        batchId,
        title: 'Chemical LEV Ductwork Engineering Design',
        description: 'Calculate minimum required transport velocity for particulate exhaust.',
        dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        maxScore: 100,
        status: 'PUBLISHED',
        rubric: {
          id: 'rub-01',
          title: 'LEV Design Rubric',
          totalPoints: 100,
          criteria: [
            { id: 'crit-1', title: 'Volumetric Airflow', description: 'Accurate CFM calculation', maxPoints: 50 },
            { id: 'crit-2', title: 'Static Pressure', description: 'Correct friction loss', maxPoints: 50 },
          ],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Clear existing submissions for this test assignment
      const existing = await db.getSubmissions(asgId, studentId);
      for (const s of existing) {
        db.submissions.delete(s.id);
      }
    });

    it('allows student to submit initial coursework notes and attachment', async () => {
      const req = new Request(`http://localhost/api/assignments/${asgId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          submissionText: 'Computed required transport velocity: 4,000 fpm for metal dust. Duct diameter 10 inches gives 2,180 cfm.',
          attachmentUrl: '/uploads/arjun-lev-design.pdf',
          attachmentFilename: 'arjun-lev-design.pdf',
        }),
      });

      const res = await submitAssignment(req, { params: { assignmentId: asgId } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.submission.status).toBe('SUBMITTED');
      expect(data.submission.studentEmail).toBe('student@zealosh.com');
      expect(data.submission.submittedAt).toBeDefined();
    });

    it('allows student to resubmit when instructor requests resubmission', async () => {
      // 1. Student submits
      const initialSub = await db.submitAssignment({
        id: `sub-init-${studentId}`,
        assignmentId: asgId,
        courseId,
        batchId,
        userId: studentId,
        studentName: 'Arjun Menon',
        studentEmail: 'student@zealosh.com',
        submissionText: 'Draft calculation without static pressure.',
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
      });

      // 2. Instructor evaluates and requests revision
      const gradeReq = new Request(`http://localhost/api/assignments/${asgId}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          submissionId: initialSub.id,
          status: 'RESUBMISSION_REQUESTED',
          feedback: 'Please include duct friction chart losses and hood entry coefficient Ce.',
        }),
      });

      const gradeRes = await gradeSubmission(gradeReq, { params: { assignmentId: asgId } });
      const gradeData = await gradeRes.json();
      expect(gradeRes.status).toBe(200);
      expect(gradeData.submission.status).toBe('RESUBMISSION_REQUESTED');

      // 3. Student resubmits with revised work
      const resubmitReq = new Request(`http://localhost/api/assignments/${asgId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          submissionText: 'Revised solution incorporating hood Ce = 0.82 and friction loss of 1.4 inches wg.',
          attachmentUrl: '/uploads/arjun-lev-design-revised.pdf',
        }),
      });

      const resubmitRes = await submitAssignment(resubmitReq, { params: { assignmentId: asgId } });
      const resubmitData = await resubmitRes.json();

      expect(resubmitRes.status).toBe(200);
      expect(resubmitData.submission.status).toBe('SUBMITTED');
      expect(resubmitData.submission.submissionText).toContain('Revised solution');
    });

    it('rejects resubmission when assignment is already finalized with GRADED status', async () => {
      // Seed graded submission
      await db.submitAssignment({
        id: `sub-graded-${studentId}`,
        assignmentId: asgId,
        courseId,
        batchId,
        userId: studentId,
        studentName: 'Arjun Menon',
        studentEmail: 'student@zealosh.com',
        submissionText: 'Finalized and officially graded work.',
        status: 'GRADED',
        score: 95,
        submittedAt: new Date().toISOString(),
      });

      const req = new Request(`http://localhost/api/assignments/${asgId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          submissionText: 'Attempting to change already graded work.',
        }),
      });

      const res = await submitAssignment(req, { params: { assignmentId: asgId } });
      expect(res.status).toBe(409);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Instructor Rubric Grading & AI Review Seam (ADR-003)
  // --------------------------------------------------------------------------
  describe('Instructor Rubric Grading & AI Review Seam', () => {
    const asgId = 'asg-test-grading-01';
    let submissionId: string;

    beforeEach(async () => {
      await db.saveAssignment({
        id: asgId,
        courseId,
        batchId,
        title: 'Ergonomic NIOSH Lifting Equation Assessment',
        description: 'Calculate Recommended Weight Limit (RWL) and Lifting Index (LI).',
        dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        maxScore: 100,
        status: 'PUBLISHED',
        rubric: {
          id: 'rub-niosh',
          title: 'NIOSH Equation Rubric',
          totalPoints: 100,
          criteria: [
            { id: 'crit-rwl', title: 'RWL Multiplier Calculations', description: 'LC x HM x VM x DM x AM x FM x CM', maxPoints: 60 },
            { id: 'crit-li', title: 'Lifting Index & Administrative Controls', description: 'LI analysis and hazard controls', maxPoints: 40 },
          ],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const sub = await db.submitAssignment({
        id: `sub-niosh-${studentId}`,
        assignmentId: asgId,
        courseId,
        batchId,
        userId: studentId,
        studentName: 'Arjun Menon',
        studentEmail: 'student@zealosh.com',
        submissionText: 'Load Weight = 20 kg. Computed RWL = 14.5 kg. Lifting Index = 1.38, indicating ergonomic hazard requiring lifting assistance.',
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
      });
      submissionId = sub.id;
    });

    it('enforces ADR-003: AI review endpoint returns 403 AI_TUTOR_DISABLED when capability is disabled', async () => {
      // Ensure feature flag is disabled (default per ADR-003)
      await db.updateFeatureFlags({ aiTutorEnabled: false });

      const req = new Request(`http://localhost/api/assignments/${asgId}/ai-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({ submissionId }),
      });

      const res = await requestAiReview(req, { params: { assignmentId: asgId } });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('AI_TUTOR_DISABLED');
      expect(data.code).toBe('AI_TUTOR_DISABLED');

      // Verify that official submission score and status were completely untouched
      const sub = await db.getSubmissionById(submissionId);
      expect(sub?.status).toBe('SUBMITTED');
      expect(sub?.score).toBeUndefined();
    });

    it('generates structured suggestions when AI capability is active without mutating official score', async () => {
      // Temporarily enable AI tutor feature flag for test verification
      await db.updateFeatureFlags({ aiTutorEnabled: true });

      const req = new Request(`http://localhost/api/assignments/${asgId}/ai-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({ submissionId }),
      });

      const res = await requestAiReview(req, { params: { assignmentId: asgId } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.aiReviewSuggestion).toBeDefined();
      expect(data.aiReviewSuggestion.status).toBe('PENDING_INSTRUCTOR_REVIEW');
      expect(data.aiReviewSuggestion.rubricCriterionScores.length).toBe(2);

      // Verify separation: submission now has aiReviewSuggestions attached, but status is STILL SUBMITTED, and official score is undefined
      const sub = await db.getSubmissionById(submissionId);
      expect(sub?.status).toBe('SUBMITTED');
      expect(sub?.score).toBeUndefined();
      expect(sub?.aiReviewSuggestions).toBeDefined();
      expect(sub?.aiReviewSuggestions?.status).toBe('PENDING_INSTRUCTOR_REVIEW');

      // Reset feature flag
      await db.updateFeatureFlags({ aiTutorEnabled: false });
    });

    it('allows instructor to publish official grade with rubric criterion scores', async () => {
      const req = new Request(`http://localhost/api/assignments/${asgId}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({
          submissionId,
          score: 92,
          feedback: 'Rigorous calculation of multipliers and correct interpretation of Lifting Index > 1.0.',
          rubricScores: [
            { criterionId: 'crit-rwl', score: 56, comment: 'Minor deduction on coupling multiplier' },
            { criterionId: 'crit-li', score: 36, comment: 'Well articulated engineering controls' },
          ],
          status: 'GRADED',
        }),
      });

      const res = await gradeSubmission(req, { params: { assignmentId: asgId } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.submission.status).toBe('GRADED');
      expect(data.submission.score).toBe(92);
      expect(data.submission.rubricScores.length).toBe(2);
      expect(data.submission.gradedByUserId).toBe(instructorId);
    });
  });
});

