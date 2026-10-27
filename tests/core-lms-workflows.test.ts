import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { db } from '../src/lib/store/db';
import { Assignment, GradingRubric, AttendanceRecord, Course } from '../src/types';

describe('Zealosh LMS — Core LMS Workflows & Persistent Integrity Suite', () => {
  const originalStorage = process.env.DATABASE_STORAGE;

  beforeAll(() => {
    process.env.DATABASE_STORAGE = 'in_memory';
  });

  afterAll(() => {
    process.env.DATABASE_STORAGE = originalStorage;
  });

  beforeEach(() => {
    db.resetToSeed();
  });

  // -------------------------------------------------------------
  // Test 1: Course Lifecycle (Draft -> Published -> Archived)
  // -------------------------------------------------------------
  it('should manage course lifecycle with status transitions and persistence', async () => {
    const courseId = 'crs-crsp-2026';
    const newCourse: Course = {
      id: courseId,
      title: 'CRSP Canadian Registered Safety Professional Masterclass',
      slug: 'crsp-masterclass',
      certificationType: 'CRSP',
      deliveryModel: 'HYBRID',
      status: 'DRAFT',
      headline: 'Complete CRSP Examination Preparation Course',
      description: 'Rigorous preparation for BCRSP examination standards across Canadian jurisdictions.',
      learningObjectives: [
        'Occupational Health and Safety Law in Canada',
        'Advanced Risk Assessment & Loss Control',
        'Ergonomics and Industrial Hygiene',
      ],
      prerequisites: ['Valid ASP or 3 years HSE field management'],
      priceInr: 45000,
      priceUsd: 550,
      durationWeeks: 12,
      coverImage: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f',
      leadInstructorId: 'usr-inst-01',
      coInstructorIds: ['usr-inst-02'],
      modulesCount: 6,
      totalLessons: 24,
      totalHours: 48,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Create in DRAFT status
    await db.saveCourse(newCourse, 'admin@zealosh.com');
    let fetched = await db.getCourseById(courseId);
    expect(fetched).toBeDefined();
    expect(fetched?.status).toBe('DRAFT');
    expect(fetched?.title).toContain('CRSP');

    // 2. Publish Course
    await db.saveCourse({ ...fetched!, status: 'PUBLISHED' }, 'admin@zealosh.com');
    fetched = await db.getCourseById(courseId);
    expect(fetched?.status).toBe('PUBLISHED');

    // 3. Verify in course list
    const allCourses = await db.getCourses();
    expect(allCourses.some((c) => c.id === courseId && c.status === 'PUBLISHED')).toBe(true);

    // 4. Archive Course
    await db.saveCourse({ ...fetched!, status: 'ARCHIVED' }, 'admin@zealosh.com');
    fetched = await db.getCourseById(courseId);
    expect(fetched?.status).toBe('ARCHIVED');
  });

  // -------------------------------------------------------------
  // Test 2: Prerequisite Validation & Enrollment Logic
  // -------------------------------------------------------------
  it('should enforce course prerequisites and batch capacity limits', async () => {
    // 1. Verify CSP prerequisites in catalog
    const cspCourse = await db.getCourseById('crs-csp-01');
    expect(cspCourse).toBeDefined();
    expect(cspCourse?.prerequisites.some((p) => p.includes('ASP'))).toBe(true);

    // 2. Student Arjun (usr-std-01) has existing active enrollment in ASP
    const arjunEnrollments = await db.getUserEnrollments('usr-std-01');
    expect(arjunEnrollments.some((e) => e.courseId === 'crs-asp-01')).toBe(true);

    // 3. Enroll student into active batch
    const enrollSuccess = await db.enrollStudent({
      userId: 'usr-std-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
    });
    expect(enrollSuccess.success).toBe(true);
    expect(enrollSuccess.enrollment.status).toBe('ACTIVE');

    // 4. Verify batch capacity limits guard is enforced
    await expect(
      db.enrollStudent({
        userId: 'usr-admin-01',
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-full',
      })
    ).rejects.toThrow('BATCH_CAPACITY_EXCEEDED');
  });

  // -------------------------------------------------------------
  // Test 3: Lesson Progression Persistence & Calculation
  // -------------------------------------------------------------
  it('should track and persist student lesson progression accurately', async () => {
    const studentId = 'usr-std-01';
    const enrollments = await db.getUserEnrollments(studentId);
    const aspEnrollment = enrollments.find((e) => e.courseId === 'crs-asp-01')!;
    expect(aspEnrollment).toBeDefined();

    // Initial state
    const initialCompleted = [...(aspEnrollment.completedLessonIds || [])];

    // Complete lesson 1, 2, and 3
    const updatedLessons = Array.from(new Set([...initialCompleted, 'lsn-asp-01', 'lsn-asp-02', 'lsn-asp-03']));
    const updated = await db.updateEnrollmentProgress(aspEnrollment.id, updatedLessons, 50);

    expect(updated).toBeDefined();
    expect(updated.completedLessonIds).toContain('lsn-asp-01');
    expect(updated.completedLessonIds).toContain('lsn-asp-02');
    expect(updated.completedLessonIds).toContain('lsn-asp-03');
    expect(updated.progressPercent).toBe(50);

    // Verify persistence across repository queries
    const freshFetch = await db.getEnrollmentById(aspEnrollment.id);
    expect(freshFetch?.completedLessonIds).toEqual(updatedLessons);
    expect(freshFetch?.progressPercent).toBe(50);
  });

  // -------------------------------------------------------------
  // Test 4: Assignment Creation with Multi-Criteria Rubric
  // -------------------------------------------------------------
  it('should create coursework assignments with rigorous technical grading rubrics', async () => {
    const rubric: GradingRubric = {
      id: 'rub-chem-01',
      title: 'ACGIH Industrial Hygiene Calculation Rubric',
      criteria: [
        {
          id: 'crit-tlv',
          title: 'ACGIH TLV & Permissible Exposure Limit Calculation',
          description: 'Correctly applies 8-hour TWA and excursion limits for volatile organics',
          maxPoints: 40,
        },
        {
          id: 'crit-vent',
          title: 'Local Exhaust Ventilation Dilution Engineering',
          description: 'Calculates minimum capture velocity and duct friction losses',
          maxPoints: 40,
        },
        {
          id: 'crit-ppe',
          title: 'Respiratory Protection & PPE Matrix',
          description: 'Selects appropriate NIOSH-certified cartridges and Assigned Protection Factors',
          maxPoints: 20,
        },
      ],
      totalPoints: 100,
    };

    const assignment: Assignment = {
      id: 'asg-test-chem-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      title: 'Chemical Hazard Evaluation & Ventilation Design Case Study',
      description: 'Calculate time-weighted averages and design a local exhaust hood for a solvent degreasing tank.',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      maxScore: 100,
      rubric,
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.saveAssignment(assignment, 'instructor@zealosh.com');
    expect(saved.id).toBe('asg-test-chem-01');
    expect(saved.rubric?.criteria.length).toBe(3);

    // Retrieve by ID
    const retrieved = await db.getAssignmentById('asg-test-chem-01');
    expect(retrieved).toBeDefined();
    expect(retrieved?.rubric?.totalPoints).toBe(100);
    expect(retrieved?.rubric?.criteria[0].maxPoints).toBe(40);
  });

  // -------------------------------------------------------------
  // Test 5: Student Submission & Data Isolation
  // -------------------------------------------------------------
  it('should record student assignment submissions while preserving tenant & user isolation', async () => {
    const submission = await db.submitAssignment({
      assignmentId: 'asg-asp-01',
      userId: 'usr-std-02',
      courseId: 'crs-asp-01',
      submissionText: 'Here is my complete ventilation duct friction and capture velocity spreadsheet.',
      attachmentUrl: 'https://storage.zealosh.com/submissions/std-02/ventilation-study.pdf',
    });

    expect(submission).toBeDefined();
    expect(submission.assignmentId).toBe('asg-asp-01');
    expect(submission.userId).toBe('usr-std-02');
    expect(submission.status).toBe('SUBMITTED');
    expect(submission.score).toBeUndefined();

    // Verify student-specific retrieval
    const std02Subs = await db.getSubmissions('asg-asp-01', 'usr-std-02');
    expect(std02Subs.length).toBe(1);
    expect(std02Subs[0].id).toBe(submission.id);

    // Verify isolation: querying for student 01 does NOT return student 02 submission
    const std01Subs = await db.getSubmissions('asg-asp-01', 'usr-std-01');
    expect(std01Subs.every((s) => s.userId === 'usr-std-01')).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 6: Instructor Rubric Grading & Structured Feedback
  // -------------------------------------------------------------
  it('should support instructor rubric grading with score aggregation and feedback', async () => {
    // Arjun has seeded submission sub-std-01-asp-01
    const graded = await db.gradeSubmission('sub-std-01-asp-01', {
      score: 95,
      feedback: 'Outstanding calculations on the hood static pressure and hood entry loss factors.',
      gradedBy: 'usr-inst-01',
      rubricScores: [
        { criterionId: 'crit-calc', score: 38, comment: 'Minor rounding on CFM conversion' },
        { criterionId: 'crit-matrix', score: 29, comment: 'Strong elimination hierarchy' },
        { criterionId: 'crit-compliance', score: 28, comment: 'Full ACGIH TLV adherence' },
      ],
    });

    expect(graded.status).toBe('GRADED');
    expect(graded.score).toBe(95);
    expect(graded.feedback).toContain('Outstanding calculations');
    expect(graded.gradedByUserId).toBe('usr-inst-01');
    expect(graded.rubricScores?.length).toBe(3);

    // Verify persistent state
    const fetched = await db.getSubmissionById('sub-std-01-asp-01');
    expect(fetched?.status).toBe('GRADED');
    expect(fetched?.score).toBe(95);
  });

  // -------------------------------------------------------------
  // Test 7: Recurring Live Sessions & Attendance Logging
  // -------------------------------------------------------------
  it('should generate recurring live session cohorts and record verified attendance', async () => {
    // Generate 4-week weekend live session schedule for btc-asp-nov26
    const sessions = await db.scheduleRecurringLiveSessions(
      'btc-asp-nov26',
      {
        daysOfWeek: [6], // Saturday
        startTime: '10:00',
        durationMinutes: 120,
        timeZone: 'Asia/Kolkata',
      },
      4,
      'instructor@zealosh.com'
    );

    expect(sessions.length).toBe(4);
    expect(sessions[0].courseId).toBe('crs-asp-01');
    expect(sessions[0].batchId).toBe('btc-asp-nov26');

    // Record attendance for session 1
    const sessionId = sessions[0].id;
    const attendance: AttendanceRecord = {
      id: `att-${sessionId}-std-01`,
      sessionId,
      userId: 'usr-std-01',
      joinedAt: new Date().toISOString(),
      leftAt: new Date(Date.now() + 7200000).toISOString(),
      durationMinutes: 120,
      attended: true,
    };

    const recorded = await db.recordAttendance(attendance);
    expect(recorded.sessionId).toBe(sessionId);
    expect(recorded.attended).toBe(true);

    const sessionAttendance = await db.getSessionAttendance(sessionId);
    expect(sessionAttendance.some((a) => a.userId === 'usr-std-01')).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 8: Super Admin Role Governance & Enrollment Lifecycle Audits
  // -------------------------------------------------------------
  it('should update user roles and enrollment statuses with audit trail generation', async () => {
    // 1. Fetch users with role filter
    const students = await db.getUsers({ role: 'STUDENT' });
    expect(students.length).toBeGreaterThan(0);
    expect(students.every((s) => s.role === 'STUDENT')).toBe(true);

    // 2. Promote user to INSTRUCTOR
    const userToPromote = students[0];
    const promoted = await db.saveUser(
      { ...userToPromote, role: 'INSTRUCTOR' },
      'admin@zealosh.com'
    );
    expect(promoted.role).toBe('INSTRUCTOR');

    // 3. Update enrollment status to EXPIRED and check audit trail
    const enrollments = await db.getUserEnrollments('usr-std-01');
    const enrollment = enrollments[0];
    const updatedEnrollment = await db.updateEnrollmentStatus(
      enrollment.id,
      'EXPIRED',
      'admin@zealosh.com'
    );
    expect(updatedEnrollment?.status).toBe('EXPIRED');

    // Verify audit log entry was written
    const latestAudit = db.auditLogs[0];
    expect(latestAudit).toBeDefined();
    expect(latestAudit.action).toBe('ENROLLMENT_STATUS_UPDATED');
    expect(latestAudit.actorEmail).toBe('admin@zealosh.com');
  });
});
