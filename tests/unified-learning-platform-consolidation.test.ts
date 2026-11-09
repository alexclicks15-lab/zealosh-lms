// Zealosh LMS — Unified Learning Platform, Learning Engine & Classroom Consolidation Suite
// Validates:
// 1. Zealosh Learning Engine: Curriculum structure, lesson progression, resume checkpoints, and completion evaluation.
// 2. Zealosh Classroom: Universal workspace (Stream, Classwork with Learning Engine Modules, Live Classes, People, Calendar, Todo, Grades, Doubts).
// 3. Zealosh VC: Virtual classroom join authorization, WebRTC token generation, and verified attendance logging.
// 4. In-App Messaging: Cohort and direct communications between learners and certified faculty.
// 5. CMS & Visual Configuration: Brand tokens, settings governance, and platform telemetry.
// 6. Unified Identity & Single Sign-On: 1 session valid across LMS, Classroom, and Live Conferencing.
// 7. Brand Primacy Invariant: Complete absence of third-party engine names in customer-facing contracts.
// 8. Protected Data Integrity: Byte-for-byte preservation of data/zealosh-store.json.

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import crypto from 'crypto';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { GET as getClassroomHub } from '@/app/api/classroom/route';
import { GET as getMessages, POST as postMessage } from '@/app/api/messages/route';
import { POST as joinLiveSession } from '@/app/api/live/[sessionId]/join/route';
import { GET as getCourseCompletion, POST as evaluateCompletion } from '@/app/api/courses/[slug]/completion/route';
import { POST as updateProgress } from '@/app/api/courses/[slug]/progress/route';

describe('Zealosh Unified Learning Platform & Learning Engine Consolidation', () => {
  const studentId = 'usr-std-01';
  const instructorId = 'usr-inst-01';
  const adminId = 'usr-admin-01';
  const courseId = 'crs-asp-01';
  const batchId = 'btc-asp-nov26';
  const sessionId = 'sess-asp-01';

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

  const adminToken = signToken({
    userId: adminId,
    email: 'admin@zealosh.com',
    role: 'SUPER_ADMIN',
    name: 'Dr. K. Ravindran',
  });

  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T14:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    await db.resetToSeed();
    const existingEnrollments = await db.getEnrollments(studentId, batchId);
    if (existingEnrollments.length === 0) {
      db.enrollments.set('enr-unified-consolidation-01', {
        id: 'enr-unified-consolidation-01',
        userId: studentId,
        courseId,
        batchId,
        status: 'ACTIVE',
        enrolledAt: '2026-01-10T00:00:00Z',
        expiresAt: '2026-12-31T23:59:59Z',
        progressPercent: 30,
        completedLessonIds: ['lsn-asp-01'],
      });
    }
  });

  // --------------------------------------------------------------------------
  // Test 1: Protected Data Integrity Verification
  // --------------------------------------------------------------------------
  it('1. should verify data/zealosh-store.json is byte-for-byte intact with authoritative checksum', () => {
    const raw = fs.readFileSync('data/zealosh-store.json');
    const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
    expect(hash).toBe('F1CB59D0B3FC129548763266B8A1993300D76EB842070657B7719F5F21B3FB10');
    expect(raw.length).toBe(45005);
  });

  // --------------------------------------------------------------------------
  // Test 2: Zealosh Learning Engine — Progression & Checkpoint Tracking
  // --------------------------------------------------------------------------
  it('2. should record video resume checkpoints, calculate progress, and update enrollment', async () => {
    const req = new Request('http://localhost:3000/api/courses/crs-asp-01/progress', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lessonId: 'lsn-asp-02',
        playbackPositionSeconds: 420,
        totalDurationSeconds: 1200,
        completed: true,
        activityType: 'PRERECORDED_VIDEO',
      }),
    });

    const res = await updateProgress(req, { params: { slug: 'crs-asp-01' } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.completedLessonIds).toContain('lsn-asp-02');
    expect(data.granularProgress).toBeDefined();
    expect(data.granularProgress.lastPlaybackPositionSeconds).toBe(420);
    expect(data.granularProgress.isCompleted).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test 3: Zealosh Learning Engine — Course Completion Policy & Evaluation
  // --------------------------------------------------------------------------
  it('3. should evaluate authoritative course completion against institutional policy criteria', async () => {
    const req = new Request('http://localhost:3000/api/courses/crs-asp-01/completion', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getCourseCompletion(req, { params: { slug: 'crs-asp-01' } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.policy).toBeDefined();
    expect(data.evaluation).toBeDefined();
    expect(typeof data.evaluation.isCompleted).toBe('boolean');
    expect(typeof data.evaluation.lessonCompletionPercentage).toBe('number');
  });

  // --------------------------------------------------------------------------
  // Test 4: Zealosh Classroom — Universal Workspace Payload with Modules
  // --------------------------------------------------------------------------
  it('4. should return unified classroom payload containing Learning Engine modules, classwork, and live sessions', async () => {
    const req = new Request(`http://localhost:3000/api/classroom?courseId=${courseId}&batchId=${batchId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getClassroomHub(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.course.modules).toBeInstanceOf(Array);
    expect(data.course.modules.length).toBeGreaterThan(0);
    expect(data.course.modules[0].lessons).toBeInstanceOf(Array);
    expect(data.assignments).toBeInstanceOf(Array);
    expect(data.materials).toBeInstanceOf(Array);
    expect(data.quizzes).toBeInstanceOf(Array);
    expect(data.people).toBeDefined();
    expect(data.calendarEvents).toBeInstanceOf(Array);
    expect(data.todoTasks).toBeDefined();
    expect(data.messages).toBeInstanceOf(Array);
  });

  // --------------------------------------------------------------------------
  // Test 5: In-App Messaging & Cohort Communications
  // --------------------------------------------------------------------------
  it('5. should support direct and cohort messaging between students and faculty with audit trails', async () => {
    // 1. Post a new message from student to faculty
    const postReq = new Request('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        courseId,
        batchId,
        recipientId: instructorId,
        subject: 'Industrial Hygiene Formula Clarification',
        content: 'Could you review the air flow volumetric calculation for local exhaust ventilation?',
      }),
    });

    const postRes = await postMessage(postReq);
    expect(postRes.status).toBe(200);

    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.message.senderId).toBe(studentId);
    expect(postData.message.subject).toBe('Industrial Hygiene Formula Clarification');

    // 2. Fetch conversation history for instructor
    const getReq = new Request(`http://localhost:3000/api/messages?courseId=${courseId}&batchId=${batchId}`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });

    const getRes = await getMessages(getReq);
    expect(getRes.status).toBe(200);

    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.messages.some((m: any) => m.subject === 'Industrial Hygiene Formula Clarification')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test 6: Zealosh VC (Virtual Classroom) — Authorized Join & Attendance Logging
  // --------------------------------------------------------------------------
  it('6. should enforce role authorization and log verified attendance when joining live session', async () => {
    const joinReq = new Request(`http://localhost:3000/api/live/${sessionId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await joinLiveSession(joinReq, { params: { sessionId } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.joinUrl).toBeDefined();
    expect(data.session.id).toBe(sessionId);

    // Verify verified attendance record was logged in authoritative store
    const attendanceRecords = await db.getAttendance(sessionId);
    const studentRecord = attendanceRecords.find((a) => a.userId === studentId);
    expect(studentRecord).toBeDefined();
    expect(studentRecord?.attended).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test 7: Brand Primacy — Zero Leakage of Internal Third-Party Engine Names
  // --------------------------------------------------------------------------
  it('7. should strictly enforce Brand Primacy across customer-facing API contracts', async () => {
    const req = new Request(`http://localhost:3000/api/classroom?courseId=${courseId}&batchId=${batchId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getClassroomHub(req);
    const rawText = await res.text();

    // Invariant: Customer-facing JSON payloads must NEVER expose internal engines
    expect(rawText).not.toContain('Moodle');
    expect(rawText).not.toContain('BigBlueButton');
    expect(rawText).not.toContain('Keycloak');
  });

  // --------------------------------------------------------------------------
  // Test 8: Single Unified Identity & Session Portability
  // --------------------------------------------------------------------------
  it('8. should authenticate seamlessly across LMS, Classroom, and VC with one session token', async () => {
    // 1. Session works on Classroom Hub
    const classRes = await getClassroomHub(new Request('http://localhost:3000/api/classroom', {
      headers: { Authorization: `Bearer ${studentToken}` },
    }));
    expect(classRes.status).toBe(200);

    // 2. Same token works on Learning Engine progress
    const progRes = await updateProgress(new Request('http://localhost:3000/api/courses/crs-asp-01/progress', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lessonId: 'lsn-asp-01', completed: true }),
    }), { params: { slug: 'crs-asp-01' } });
    expect(progRes.status).toBe(200);

    // 3. Same token works on VC Live Session Join
    const vcRes = await joinLiveSession(new Request(`http://localhost:3000/api/live/${sessionId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    }), { params: { sessionId } });
    expect(vcRes.status).toBe(200);
  });
});
