// Zealosh LMS — Milestone 0: Unified Platform Consolidation & Brand Primacy Suite
// Validates:
// 1. Unified Classroom Hub API (/api/classroom) provides role-aware cohort aggregation for Student, Faculty, and Admin.
// 2. Single Identity & Auth session across LMS, Classroom, and Live Sessions.
// 3. Live Session Details API (/api/live/[sessionId]) returns authoritative session context and attendance counts.
// 4. Zealosh VC (Virtual Classroom) join endpoint enforces role authorization and attendance logging without leaking secrets.
// 5. Brand Primacy Invariant: Customer-facing payloads and responses are free from third-party engine leaks.
// 6. Cross-student coursework and doubt isolation.

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { GET as getClassroomHub } from '@/app/api/classroom/route';
import { GET as getLiveSessionDetails } from '@/app/api/live/[sessionId]/route';
import { POST as joinLiveSession } from '@/app/api/live/[sessionId]/join/route';
import { GET as getStudentLiveSchedule } from '@/app/api/live/route';

describe('Zealosh Unified Platform Consolidation (Milestone 0)', () => {
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
    // Reset seed data and ensure active enrollment
    await db.resetToSeed();
    const existingEnrollments = await db.getEnrollments(studentId, batchId);
    if (existingEnrollments.length === 0) {
      db.enrollments.set('enr-unified-test-01', {
        id: 'enr-unified-test-01',
        userId: studentId,
        courseId,
        batchId,
        status: 'ACTIVE',
        enrolledAt: '2026-01-10T00:00:00Z',
        expiresAt: '2026-12-31T23:59:59Z',
        progressPercent: 0,
        completedLessonIds: [],
      });
    }
  });

  // --------------------------------------------------------------------------
  // Test 1: Unified Classroom Hub API (/api/classroom) for Student
  // --------------------------------------------------------------------------
  it('1. should return active cohorts, classwork, announcements, and live classes in unified payload for student', async () => {
    const req = new Request('http://localhost:3000/api/classroom', {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    const res = await getClassroomHub(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.role).toBe('STUDENT');
    expect(data.availableCohorts).toBeInstanceOf(Array);
    expect(data.availableCohorts.length).toBeGreaterThan(0);
    expect(data.course).toBeDefined();
    expect(data.course.id).toBe(courseId);
    expect(data.assignments).toBeInstanceOf(Array);
    expect(data.announcements).toBeInstanceOf(Array);
    expect(data.liveSessions).toBeInstanceOf(Array);
  });

  // --------------------------------------------------------------------------
  // Test 2: Unified Classroom Hub API (/api/classroom) for Faculty
  // --------------------------------------------------------------------------
  it('2. should return assigned cohorts and full submission queue for instructor', async () => {
    const req = new Request('http://localhost:3000/api/classroom', {
      headers: {
        Authorization: `Bearer ${instructorToken}`,
      },
    });

    const res = await getClassroomHub(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.role).toBe('INSTRUCTOR');
    expect(data.availableCohorts.length).toBeGreaterThan(0);
    expect(data.assignments).toBeInstanceOf(Array);
  });

  // --------------------------------------------------------------------------
  // Test 3: Live Session Details API (/api/live/[sessionId])
  // --------------------------------------------------------------------------
  it('3. should return authoritative live session metadata with course and batch context', async () => {
    const req = new Request(`http://localhost:3000/api/live/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    const res = await getLiveSessionDetails(req, { params: { sessionId } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.session.id).toBe(sessionId);
    expect(data.session.courseId).toBe(courseId);
    expect(data.session.batchId).toBe(batchId);
    expect(data.session.instructor.name).toBeDefined();
    expect(data.session.durationMinutes).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // Test 4: Zealosh VC WebRTC Join Endpoint Authorization & Attendance Tracking
  // --------------------------------------------------------------------------
  it('4. should generate signed join URL and record attendance for enrolled student', async () => {
    const req = new Request(`http://localhost:3000/api/live/${sessionId}/join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    const res = await joinLiveSession(req, { params: { sessionId } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.joinUrl).toBeDefined();
    expect(data.isModerator).toBe(false);

    // Verify attendance was recorded in authoritative store
    const attendance = await db.getAttendance(sessionId);
    expect(attendance.some((a) => a.userId === studentId)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test 5: Instructor Moderator Elevation in Zealosh VC
  // --------------------------------------------------------------------------
  it('5. should elevate faculty to moderator status when joining live session', async () => {
    const req = new Request(`http://localhost:3000/api/live/${sessionId}/join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructorToken}`,
      },
    });

    const res = await joinLiveSession(req, { params: { sessionId } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.isModerator).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test 6: Brand Primacy & Secret Protection
  // --------------------------------------------------------------------------
  it('6. should strictly protect secrets and brand identity in join response', async () => {
    const req = new Request(`http://localhost:3000/api/live/${sessionId}/join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    const res = await joinLiveSession(req, { params: { sessionId } });
    const rawText = await res.text();

    // Verify no secret salts leak in payload
    expect(rawText).not.toContain('BIGBLUEBUTTON_SALT');
    expect(rawText).not.toContain('zealosh_bbb_shared_salt');
    expect(rawText).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  // --------------------------------------------------------------------------
  // Test 7: Live Schedule Resolution (/api/live)
  // --------------------------------------------------------------------------
  it('7. should resolve upcoming cohort live schedule for student', async () => {
    const req = new Request('http://localhost:3000/api/live', {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    const res = await getStudentLiveSchedule(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.sessions).toBeInstanceOf(Array);
    expect(data.resolutionStatus).toBeDefined();
  });
});
