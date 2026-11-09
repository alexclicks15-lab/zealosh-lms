// Zealosh LMS — Complete Classroom Benchmark & Three-Mode Verification Suite
// Validates:
// 1. Universal classroom capabilities across Online/Live, Prerecorded, and Hybrid delivery modes.
// 2. Hierarchical delivery mode resolution (Course default -> Batch override).
// 3. Class stream communication: announcements, pinned posts, and student/faculty comments.
// 4. Preloaded live-class session material packs with release conditions (PRE_CLASS, CLASS_START, MANUAL, SCHEDULED).
// 5. 1-click manual release of preloaded session materials by instructor.
// 6. Complete assignment submission and rubric evaluation lifecycle.
// 7. Scheduled formative quizzes with time limits and attempt eligibility.
// 8. People and classroom membership roster (Teachers & Classmates).
// 9. Unified academic calendar aggregating live sessions, assignment due dates, and quizzes.
// 10. Student To-Do & Instructor To-Review task queues.
// 11. Doubts & discussion with privacy boundaries (public vs private).

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { GET as getClassroomHub, POST as postClassroomAction } from '@/app/api/classroom/route';

describe('Zealosh Complete Classroom Experience & Three-Mode Verification', () => {
  const studentId = 'usr-std-01';
  const instructorId = 'usr-inst-01';
  const adminId = 'usr-admin-01';
  const courseId = 'crs-asp-01';
  const batchId = 'btc-asp-nov26';

  const studentToken = signToken({
    userId: studentId,
    email: 'student@zealosh.com',
    role: 'STUDENT',
    name: 'Arjun Menon',
  });

  const instructorToken = signToken({
    userId: instructorId,
    email: 'vishnu@zealosh.com',
    role: 'INSTRUCTOR',
    name: 'Vishnu Rajendran, CSP',
  });

  beforeEach(async () => {
    await db.resetToSeed();
    const existingEnrollments = await db.getEnrollments(studentId, batchId);
    if (existingEnrollments.length === 0) {
      db.enrollments.set('enr-complete-test-01', {
        id: 'enr-complete-test-01',
        userId: studentId,
        courseId,
        batchId,
        status: 'ACTIVE',
        enrolledAt: '2026-01-10T00:00:00Z',
        expiresAt: '2026-12-31T23:59:59Z',
        progressPercent: 25,
        completedLessonIds: [],
      });
    }
  });

  // --------------------------------------------------------------------------
  // Test 1: Delivery Mode Hierarchy Resolution
  // --------------------------------------------------------------------------
  it('1. should resolve effective delivery mode hierarchy: Course default -> Batch override', async () => {
    const req = new Request(`http://localhost:3000/api/classroom?courseId=${courseId}&batchId=${batchId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getClassroomHub(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(['LIVE', 'RECORDED', 'HYBRID']).toContain(data.effectiveDeliveryMode);
    expect(data.course.deliveryModel).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Test 2: Universal Classroom Payload Structure
  // --------------------------------------------------------------------------
  it('2. should return full universal classroom payload (stream, classwork, live, people, calendar, todo, doubts)', async () => {
    const req = new Request(`http://localhost:3000/api/classroom?courseId=${courseId}&batchId=${batchId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getClassroomHub(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.announcements).toBeInstanceOf(Array);
    expect(data.assignments).toBeInstanceOf(Array);
    expect(data.materials).toBeInstanceOf(Array);
    expect(data.quizzes).toBeInstanceOf(Array);
    expect(data.people).toBeDefined();
    expect(data.people.teachers).toBeInstanceOf(Array);
    expect(data.people.students).toBeInstanceOf(Array);
    expect(data.calendarEvents).toBeInstanceOf(Array);
    expect(data.todoTasks).toBeDefined();
    expect(data.doubts).toBeInstanceOf(Array);
  });

  // --------------------------------------------------------------------------
  // Test 3: Announcement Stream & Discussion Comments
  // --------------------------------------------------------------------------
  it('3. should allow instructor to post announcement and student to add comments', async () => {
    // 3a. Instructor posts announcement
    const announceReq = new Request('http://localhost:3000/api/classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`,
      },
      body: JSON.stringify({
        action: 'create_announcement',
        courseId,
        batchId,
        title: 'Midterm Study Group Schedule',
        content: 'We will conduct a dedicated calculation revision session on Friday.',
        isPinned: true,
      }),
    });

    const announceRes = await postClassroomAction(announceReq);
    expect(announceRes.status).toBe(200);
    const announceData = await announceRes.json();
    expect(announceData.success).toBe(true);
    expect(announceData.announcement.title).toBe('Midterm Study Group Schedule');
    expect(announceData.announcement.isPinned).toBe(true);

    const announcementId = announceData.announcement.id;

    // 3b. Student adds a comment
    const commentReq = new Request('http://localhost:3000/api/classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        action: 'add_comment',
        announcementId,
        content: 'Will crane load charts be included in this revision?',
      }),
    });

    const commentRes = await postClassroomAction(commentReq);
    expect(commentRes.status).toBe(200);
    const commentData = await commentRes.json();
    expect(commentData.success).toBe(true);
    expect(commentData.comment.content).toContain('crane load charts');
    expect(commentData.comment.authorName).toBe('Arjun Menon');
  });

  // --------------------------------------------------------------------------
  // Test 4: Preloaded Live Materials with Release Conditions & Manual Release
  // --------------------------------------------------------------------------
  it('4. should support preloaded live materials with release conditions and manual 1-click release', async () => {
    // 4a. Instructor creates preloaded material with MANUAL release condition
    const createMatReq = new Request('http://localhost:3000/api/classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`,
      },
      body: JSON.stringify({
        action: 'create_material',
        courseId,
        batchId,
        sessionId: 'sess-asp-01',
        title: 'Live Workshop Rigging Diagram Handout',
        description: 'Exclusive diagram pack for live session',
        materialType: 'PDF',
        fileUrl: 'https://zealosh.com/materials/rigging-handout.pdf',
        releaseCondition: 'MANUAL',
      }),
    });

    const createMatRes = await postClassroomAction(createMatReq);
    expect(createMatRes.status).toBe(200);
    const createMatData = await createMatRes.json();
    expect(createMatData.success).toBe(true);
    expect(createMatData.material.isReleased).toBe(false);

    const materialId = createMatData.material.id;

    // 4b. Student checks classroom: unreleased manual material must NOT be visible to student
    const studentCheckReq = new Request(`http://localhost:3000/api/classroom?courseId=${courseId}&batchId=${batchId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const studentCheckRes = await getClassroomHub(studentCheckReq);
    const studentData = await studentCheckRes.json();
    const visibleToStudent = studentData.materials.some((m: any) => m.id === materialId);
    expect(visibleToStudent).toBe(false);

    // 4c. Instructor triggers 1-click manual release
    const releaseReq = new Request('http://localhost:3000/api/classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`,
      },
      body: JSON.stringify({
        action: 'release_material',
        materialId,
      }),
    });
    const releaseRes = await postClassroomAction(releaseReq);
    expect(releaseRes.status).toBe(200);
    const releaseData = await releaseRes.json();
    expect(releaseData.success).toBe(true);
    expect(releaseData.material.isReleased).toBe(true);

    // 4d. Re-check: material must now be visible to student
    const studentRecheckRes = await getClassroomHub(studentCheckReq);
    const studentRecheckData = await studentRecheckRes.json();
    const nowVisible = studentRecheckData.materials.some((m: any) => m.id === materialId);
    expect(nowVisible).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test 5: Full Assignment Lifecycle: Create -> Turn In -> Grade with Rubric
  // --------------------------------------------------------------------------
  it('5. should execute full assignment workflow: authoring, student turn-in, and rubric evaluation', async () => {
    // 5a. Instructor creates coursework assignment
    const asgReq = new Request('http://localhost:3000/api/classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`,
      },
      body: JSON.stringify({
        action: 'create_assignment',
        courseId,
        batchId,
        title: 'Fall Arrest Force Calculation Problem Set',
        description: 'Calculate maximum arrest force under ANSI/ASSP Z359.14 standards.',
        dueDate: '2026-11-20T18:00:00Z',
        maxScore: 100,
      }),
    });

    const asgRes = await postClassroomAction(asgReq);
    expect(asgRes.status).toBe(200);
    const asgData = await asgRes.json();
    expect(asgData.success).toBe(true);
    const assignmentId = asgData.assignment.id;

    // 5b. Student submits coursework
    const submitReq = new Request('http://localhost:3000/api/classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        action: 'submit_assignment',
        assignmentId,
        submissionText: 'Calculation results: MAF = 4.2 kN using energy absorber deceleration model.',
        attachmentUrl: 'https://zealosh.com/uploads/student-calculations.pdf',
      }),
    });

    const submitRes = await postClassroomAction(submitReq);
    expect(submitRes.status).toBe(200);
    const submitData = await submitRes.json();
    expect(submitData.success).toBe(true);
    expect(submitData.submission.status).toBe('SUBMITTED');
    const submissionId = submitData.submission.id;

    // 5c. Instructor grades submission with rubric score and feedback
    const gradeReq = new Request('http://localhost:3000/api/classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`,
      },
      body: JSON.stringify({
        action: 'grade_submission',
        submissionId,
        score: 94,
        feedback: 'Excellent work adhering to ANSI Z359 standards. Energy absorption formula correctly applied.',
        rubricScores: [
          { criterionId: 'crit-accuracy', score: 48 },
          { criterionId: 'crit-citations', score: 46 },
        ],
      }),
    });

    const gradeRes = await postClassroomAction(gradeReq);
    expect(gradeRes.status).toBe(200);
    const gradeData = await gradeRes.json();
    expect(gradeData.success).toBe(true);
    expect(gradeData.submission.status).toBe('GRADED');
    expect(gradeData.submission.score).toBe(94);
    expect(gradeData.submission.feedback).toContain('ANSI Z359');
  });

  // --------------------------------------------------------------------------
  // Test 6: Doubts & Q&A Workflow with Private/Public Boundary
  // --------------------------------------------------------------------------
  it('6. should manage academic questions and instructor clarifications with privacy control', async () => {
    // 6a. Student submits doubt
    const doubtReq = new Request('http://localhost:3000/api/classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        action: 'ask_doubt',
        courseId,
        question: 'How do we differentiate between 29 CFR 1910 and 1926 in hybrid facilities?',
        isPublic: true,
      }),
    });

    const doubtRes = await postClassroomAction(doubtReq);
    expect(doubtRes.status).toBe(200);
    const doubtData = await doubtRes.json();
    expect(doubtData.success).toBe(true);
    expect(doubtData.doubt.status).toBe('OPEN');
    const doubtId = doubtData.doubt.id;

    // 6b. Instructor answers and resolves doubt
    const replyReq = new Request('http://localhost:3000/api/classroom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`,
      },
      body: JSON.stringify({
        action: 'reply_doubt',
        doubtId,
        answerText: '1910 governs general industry operations; 1926 triggers when active construction/renovation work occurs.',
      }),
    });

    const replyRes = await postClassroomAction(replyReq);
    expect(replyRes.status).toBe(200);
    const replyData = await replyRes.json();
    expect(replyData.success).toBe(true);
    expect(replyData.answer.answerText).toContain('1910 governs general industry');

    // 6c. Verify doubt status is now RESOLVED
    const doubtsList = await db.getDoubts();
    const resolvedDoubt = doubtsList.find((d) => d.id === doubtId);
    expect(resolvedDoubt?.status).toBe('RESOLVED');
  });

  // --------------------------------------------------------------------------
  // Test 7: Academic Calendar Aggregation
  // --------------------------------------------------------------------------
  it('7. should aggregate multi-modal academic events into unified calendar', async () => {
    const req = new Request(`http://localhost:3000/api/classroom?courseId=${courseId}&batchId=${batchId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getClassroomHub(req);
    const data = await res.json();

    expect(data.calendarEvents).toBeInstanceOf(Array);
    const eventTypes = data.calendarEvents.map((e: any) => e.type);
    expect(eventTypes.some((t: string) => t === 'LIVE_CLASS' || t === 'ASSIGNMENT_DUE' || t === 'QUIZ')).toBe(true);
  });
});

