// Zealosh LMS — Phase 5C.2 Institutional Reporting, Academic Analytics & Cohort Telemetry Test Suite
// Path: tests/institutional-reporting-analytics.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { reportingService } from '@/lib/reporting/reporting-service';
import { sanitizeCsvCell, generateSanitizedCsv } from '@/lib/reporting/csv-sanitizer';
import { signToken } from '@/lib/auth/jwt';
import { GET as getOverview } from '@/app/api/admin/reports/overview/route';
import { GET as getEnrollments } from '@/app/api/admin/reports/enrollments/route';
import { GET as getAttendance } from '@/app/api/admin/reports/attendance/route';
import { GET as getAssessments } from '@/app/api/admin/reports/assessments/route';
import { GET as getProgression } from '@/app/api/admin/reports/progression/route';
import { GET as getFaculty } from '@/app/api/admin/reports/faculty/route';
import { GET as getAttention } from '@/app/api/admin/reports/attention/route';
import { GET as getExport } from '@/app/api/admin/reports/export/route';

describe('Phase 5C.2 — Institutional Reporting & Academic Analytics', () => {
  const adminToken = signToken({
    userId: 'admin-super-01',
    email: 'admin@zealosh.com',
    role: 'SUPER_ADMIN',
    name: 'Super Admin',
  });

  const studentToken = signToken({
    userId: 'student-test-01',
    email: 'student@example.com',
    role: 'STUDENT',
    name: 'Student Test',
  });

  beforeEach(() => {
    // Reset seed to ensure deterministic isolated baseline
    db.clearAll();
  });

  describe('CSV Sanitizer & Formula Injection Defense', () => {
    it('prepends single quote to dangerous spreadsheet formula prefixes (=, +, @, tab, CR, and non-numeric minus/plus)', () => {
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"');
      expect(sanitizeCsvCell('+cmd|/c calc')).toBe('"\'+cmd|/c calc"');
      expect(sanitizeCsvCell('-cmd|/c calc')).toBe('"\'-cmd|/c calc"');
      expect(sanitizeCsvCell('-2+3')).toBe('"\'-2+3"');
      expect(sanitizeCsvCell('@HYPERLINK("http://evil.com")')).toBe('"\'@HYPERLINK(""http://evil.com"")"');
      expect(sanitizeCsvCell('\tmalicious')).toBe('"\'\tmalicious"');
    });

    it('preserves legitimate positive and negative numeric values as numeric literals in spreadsheets', () => {
      expect(sanitizeCsvCell(-5000)).toBe('"-5000"');
      expect(sanitizeCsvCell('-5000')).toBe('"-5000"');
      expect(sanitizeCsvCell(-12.5)).toBe('"-12.5"');
      expect(sanitizeCsvCell(1234)).toBe('"1234"');
    });

    it('preserves normal safe strings and escapes internal quotes', () => {
      expect(sanitizeCsvCell('Safe Course Title')).toBe('"Safe Course Title"');
      expect(sanitizeCsvCell('Quote "Test" Label')).toBe('"Quote ""Test"" Label"');
      expect(sanitizeCsvCell(null)).toBe('""');
      expect(sanitizeCsvCell(undefined)).toBe('""');
    });

    it('generates well-formed RFC 4180 CSV with CRLF delimiters', () => {
      const columns = [
        { key: 'name', label: 'Student Name' },
        { key: 'score', label: 'Score', format: (val: number) => `${val}%` },
      ];
      const rows = [
        { name: 'John Doe', score: 85 },
        { name: '=Dangerous Formula', score: 92 },
      ];

      const csv = generateSanitizedCsv(columns, rows);
      expect(csv).toContain('"Student Name","Score"');
      expect(csv).toContain('"John Doe","85%"');
      expect(csv).toContain('"\'=Dangerous Formula","92%"');
      expect(csv.includes('\r\n')).toBe(true);
    });
  });

  describe('Executive Overview KPIs', () => {
    it('counts distinct enrolled learners without double-counting students in multiple courses', async () => {
      // Create student user
      const studentId = 'test-distinct-student';
      db.users.set(studentId, {
        id: studentId,
        name: 'Multi Course Student',
        email: 'multistudent@zealosh.com',
        passwordHash: 'hash',
        role: 'STUDENT',
        organizationId: 'zealosh-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Enroll in Course 1
      db.enrollments.set('enroll-1', {
        id: 'enroll-1',
        userId: studentId,
        courseId: 'course-asp',
        batchId: 'batch-01',
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
        progressPercent: 50,
      } as any);

      // Enroll same student in Course 2
      db.enrollments.set('enroll-2', {
        id: 'enroll-2',
        userId: studentId,
        courseId: 'course-csp',
        batchId: 'batch-02',
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
        progressPercent: 20,
      } as any);

      const overview = await reportingService.getExecutiveOverview();
      expect(overview.totalActiveEnrolments).toBeGreaterThanOrEqual(2);
      // Distinct active learners should be less than or equal to total active enrollments
      expect(overview.activeEnrolledLearners).toBeLessThan(overview.totalActiveEnrolments);
    });

    it('calculates cohort batch capacity utilization percentage accurately', async () => {
      db.batches.set('test-batch-util', {
        id: 'test-batch-util',
        courseId: 'course-asp',
        name: 'Capacity Test Cohort',
        capacity: 40,
        enrolledCount: 30,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        status: 'ACTIVE',
      } as any);

      const overview = await reportingService.getExecutiveOverview({ batchId: 'test-batch-util' });
      // 30 / 40 = 75%
      expect(overview.overallBatchCapacityUtilizationPercent).toBe(75);
    });

    it('strictly separates formative learning quizzes from formal HSE examination pass rates', async () => {
      const courseId = 'course-isolation-test';
      // Add passed formative quiz
      db.quizzes.set('quiz-iso-01', {
        id: 'quiz-iso-01',
        courseId,
        title: 'Weekly Formative Quiz',
      } as any);
      db.quizAttempts.set('qa-iso-01', {
        id: 'qa-iso-01',
        quizId: 'quiz-iso-01',
        userId: 'student-01',
        status: 'GRADED',
        passed: true,
        percentage: 95,
      } as any);

      // Add failed formal HSE certification exam
      db.examAttempts.set('exam-att-iso-01', {
        id: 'exam-att-iso-01',
        userId: 'student-01',
        blueprintId: 'bp-asp-01',
        courseId,
        status: 'COMPLETED',
        passed: false,
        score: 55,
        passingScorePercent: 70,
        certificationType: 'ASP',
        startTime: new Date().toISOString(),
        deadlineTime: new Date().toISOString(),
        assignedQuestionIds: [],
        answers: {},
        bookmarkedQuestionIds: [],
      });

      const assess = await reportingService.getAssessmentAnalytics({ courseId });
      expect(assess.formativeQuizzes.passRatePercent).toBe(100);
      expect(assess.formalHseExams.passRatePercent).toBe(0);
      expect(assess.formalHseExams.failRatePercent).toBe(100);
    });
  });

  describe('Attendance Telemetry & Anomaly Handling', () => {
    it('accurately calculates session attendance rate and caps duration at 100%', async () => {
      const sessionId = 'session-attend-01';
      db.liveSessions.set(sessionId, {
        id: sessionId,
        courseId: 'course-asp',
        batchId: 'batch-01',
        title: 'Hazard Identification Masterclass',
        scheduledStartTime: new Date().toISOString(),
        durationMinutes: 60,
        status: 'COMPLETED',
      } as any);

      db.attendance.set(sessionId, [
        { id: 'att-1', sessionId, userId: 'u1', durationMinutes: 60, attended: true, joinedAt: new Date().toISOString() },
        { id: 'att-2', sessionId, userId: 'u2', durationMinutes: 55, attended: true, joinedAt: new Date().toISOString() },
        { id: 'att-3', sessionId, userId: 'u3', durationMinutes: 0, attended: false, joinedAt: new Date().toISOString() },
        { id: 'att-4', sessionId, userId: 'u4', durationMinutes: 0, attended: false, joinedAt: new Date().toISOString() },
      ]);

      const report = await reportingService.getAttendanceAnalytics({ courseId: 'course-asp' });
      const session = report.recentSessions.find((s) => s.sessionId === sessionId);
      expect(session).toBeDefined();
      expect(session?.attendanceRatePercent).toBe(50); // 2 of 4 attended = 50%
      expect(session?.averageAttendedMinutes).toBe(58); // (60 + 55) / 2 = 57.5 -> 58
    });

    it('detects duration anomalies when student attendance exceeds scheduled time + grace period', async () => {
      const sessionId = 'session-anomaly-01';
      db.liveSessions.set(sessionId, {
        id: sessionId,
        courseId: 'course-asp',
        title: 'Chemical Safety Workshop',
        scheduledStartTime: new Date().toISOString(),
        durationMinutes: 60,
        status: 'COMPLETED',
      } as any);

      db.attendance.set(sessionId, [
        // 120 minutes recorded for a 60-minute session = duration anomaly
        { id: 'att-anom-1', sessionId, userId: 'u1', durationMinutes: 120, attended: true, joinedAt: new Date().toISOString() },
      ]);

      const report = await reportingService.getAttendanceAnalytics();
      expect(report.anomaliesDetectedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Students Requiring Attention (Factual, Deterministic Indicators)', () => {
    it('flags student with OVERDUE_ASSIGNMENT when due date is past without submission', async () => {
      const studentId = 'student-overdue-test';
      db.users.set(studentId, {
        id: studentId,
        name: 'Overdue Learner',
        email: 'overdue@zealosh.com',
        role: 'STUDENT',
        organizationId: 'zealosh-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        passwordHash: 'hash',
      });

      db.enrollments.set('enroll-overdue', {
        id: 'enroll-overdue',
        userId: studentId,
        courseId: 'course-asp',
        batchId: 'batch-01',
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
        progressPercent: 30,
      } as any);

      // Past assignment due date
      db.assignments.set('assign-past-01', {
        id: 'assign-past-01',
        courseId: 'course-asp',
        title: 'Ergonomics Risk Assessment Report',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        maxScore: 100,
        status: 'PUBLISHED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        description: 'Submit report',
      });

      const flagged = await reportingService.getStudentsRequiringAttention({ courseId: 'course-asp' });
      const student = flagged.find((s) => s.studentId === studentId);
      expect(student).toBeDefined();
      expect(student?.flags.some((f) => f.reasonCode === 'OVERDUE_ASSIGNMENT')).toBe(true);
    });

    it('flags student with LOW_ATTENDANCE when attendance is below 60%', async () => {
      const studentId = 'student-low-attend';
      const batchId = 'batch-attend-flag';

      db.users.set(studentId, {
        id: studentId,
        name: 'Absent Learner',
        email: 'absent@zealosh.com',
        role: 'STUDENT',
        organizationId: 'zealosh-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        passwordHash: 'hash',
      });

      db.batches.set(batchId, {
        id: batchId,
        courseId: 'course-asp',
        name: 'Attendance Flag Batch',
        capacity: 30,
        enrolledCount: 1,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      } as any);

      db.enrollments.set('enroll-attend-flag', {
        id: 'enroll-attend-flag',
        userId: studentId,
        courseId: 'course-asp',
        batchId,
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
      } as any);

      // Create 3 sessions, student attends only 1 (33% < 60%)
      ['s1', 's2', 's3'].forEach((sId, index) => {
        db.liveSessions.set(sId, {
          id: sId,
          courseId: 'course-asp',
          batchId,
          title: `Session ${index + 1}`,
          durationMinutes: 60,
          scheduledStartTime: new Date().toISOString(),
          status: 'COMPLETED',
        } as any);

        db.attendance.set(sId, [
          {
            id: `att-${sId}`,
            sessionId: sId,
            userId: studentId,
            durationMinutes: index === 0 ? 60 : 0,
            attended: index === 0,
            joinedAt: new Date().toISOString(),
          },
        ]);
      });

      const flagged = await reportingService.getStudentsRequiringAttention({ batchId });
      const student = flagged.find((s) => s.studentId === studentId);
      expect(student).toBeDefined();
      expect(student?.flags.some((f) => f.reasonCode === 'LOW_ATTENDANCE')).toBe(true);
    });

    it('flags student with LOW_QUIZ_AVERAGE when formative quiz average is below 50%', async () => {
      const studentId = 'student-low-quiz';
      db.users.set(studentId, {
        id: studentId,
        name: 'Struggling Quizzer',
        email: 'quizzer@zealosh.com',
        role: 'STUDENT',
        organizationId: 'zealosh-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        passwordHash: 'hash',
      });

      db.enrollments.set('enroll-quiz-flag', {
        id: 'enroll-quiz-flag',
        userId: studentId,
        courseId: 'course-asp',
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
        progressPercent: 40,
      } as any);

      // 2 attempts with scores 30% and 40% (avg 35% < 50%)
      db.quizAttempts.set('qa-flag-1', {
        id: 'qa-flag-1',
        quizId: 'q-1',
        userId: studentId,
        status: 'GRADED',
        percentage: 30,
      } as any);
      db.quizAttempts.set('qa-flag-2', {
        id: 'qa-flag-2',
        quizId: 'q-2',
        userId: studentId,
        status: 'GRADED',
        percentage: 40,
      } as any);

      const flagged = await reportingService.getStudentsRequiringAttention({ courseId: 'course-asp' });
      const student = flagged.find((s) => s.studentId === studentId);
      expect(student).toBeDefined();
      expect(student?.flags.some((f) => f.reasonCode === 'LOW_QUIZ_AVERAGE')).toBe(true);
    });

    it('flags student with UNRESOLVED_DOUBT when doubt remains unanswered for over 48 hours', async () => {
      const studentId = 'student-doubt-flag';
      db.users.set(studentId, {
        id: studentId,
        name: 'Waiting Learner',
        email: 'waiting@zealosh.com',
        role: 'STUDENT',
        organizationId: 'zealosh-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        passwordHash: 'hash',
      });

      db.enrollments.set('enroll-doubt-flag', {
        id: 'enroll-doubt-flag',
        userId: studentId,
        courseId: 'course-asp',
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
        progressPercent: 40,
      } as any);

      // Open doubt asked 3 days ago (72h > 48h)
      db.recordingDoubts.set('doubt-flag-01', {
        id: 'doubt-flag-01',
        recordingId: 'rec-01',
        userId: studentId,
        question: 'How is threshold limit value (TLV) applied in confined space entry?',
        status: 'OPEN',
        isPublic: true,
        timestampSeconds: 120,
        createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      });

      const flagged = await reportingService.getStudentsRequiringAttention({ courseId: 'course-asp' });
      const student = flagged.find((s) => s.studentId === studentId);
      expect(student).toBeDefined();
      expect(student?.flags.some((f) => f.reasonCode === 'UNRESOLVED_DOUBT')).toBe(true);
    });

    it('flags student with STALLED_PROGRESS when enrolled over 30 days with under 20% progress', async () => {
      const studentId = 'student-stalled-flag';
      db.users.set(studentId, {
        id: studentId,
        name: 'Stalled Learner',
        email: 'stalled@zealosh.com',
        role: 'STUDENT',
        organizationId: 'zealosh-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        passwordHash: 'hash',
      });

      // Enrolled 45 days ago with only 10% progress
      db.enrollments.set('enroll-stalled-flag', {
        id: 'enroll-stalled-flag',
        userId: studentId,
        courseId: 'course-asp',
        status: 'ACTIVE',
        enrolledAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        progressPercent: 10,
      } as any);

      const flagged = await reportingService.getStudentsRequiringAttention({ courseId: 'course-asp' });
      const student = flagged.find((s) => s.studentId === studentId);
      expect(student).toBeDefined();
      expect(student?.flags.some((f) => f.reasonCode === 'STALLED_PROGRESS')).toBe(true);
    });
  });

  describe('Faculty & Instructor Workload', () => {
    it('aggregates teaching workloads, grading queues, and answered doubts per instructor', async () => {
      const instructorId = 'inst-zealosh-01';
      db.users.set(instructorId, {
        id: instructorId,
        name: 'Dr. Rajesh Nair, CSP',
        email: 'rajesh@zealosh.com',
        role: 'INSTRUCTOR',
        organizationId: 'zealosh-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        passwordHash: 'hash',
      });

      db.courses.set('course-asp', {
        id: 'course-asp',
        title: 'Associate Safety Professional (ASP)',
        leadInstructorId: instructorId,
      } as any);

      db.batches.set('batch-asp-01', {
        id: 'batch-asp-01',
        courseId: 'course-asp',
        leadInstructorId: instructorId,
        enrolledCount: 25,
      } as any);

      db.submissions.set('sub-awaiting-1', {
        id: 'sub-awaiting-1',
        assignmentId: 'assign-1',
        courseId: 'course-asp',
        userId: 'student-1',
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.recordingDoubtAnswers.set('ans-01', {
        id: 'ans-01',
        doubtId: 'doubt-01',
        instructorId,
        answerText: 'Per OSHA 1910.120, decontamination occurs in the contamination reduction zone.',
        createdAt: new Date().toISOString(),
      });

      const report = await reportingService.getInstructorAnalytics({ instructorId });
      const inst = report.faculty.find((f) => f.instructorId === instructorId);
      expect(inst).toBeDefined();
      expect(inst?.assignedCoursesCount).toBe(1);
      expect(inst?.activeLearnersCount).toBe(25);
      expect(inst?.submissionsAwaitingGradingCount).toBe(1);
      expect(inst?.doubtsAnsweredCount).toBe(1);
    });
  });

  describe('Reporting REST API Route Handlers & RBAC Guards', () => {
    it('blocks unauthenticated requests with 401 Unauthorized', async () => {
      const req = new Request('http://localhost:3000/api/admin/reports/overview');
      const res = await getOverview(req);
      expect(res.status).toBe(401);
    });

    it('blocks student role requests with 403 Forbidden', async () => {
      const req = new Request('http://localhost:3000/api/admin/reports/overview', {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const res = await getOverview(req);
      expect(res.status).toBe(403);
    });

    it('allows SUPER_ADMIN to query executive overview with 200 OK', async () => {
      const req = new Request('http://localhost:3000/api/admin/reports/overview?preset=last_7_days', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const res = await getOverview(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.totalRegisteredStudents).toBeDefined();
    });

    it('exports sanitized CSV with 200 OK and attachment header', async () => {
      const req = new Request('http://localhost:3000/api/admin/reports/export?type=overview', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const res = await getExport(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(res.headers.get('content-disposition')).toContain('attachment; filename="zealosh_executive_overview_');

      const csvText = await res.text();
      expect(csvText).toContain('"Institutional KPI Metric","Value"');
    });
  });
});
