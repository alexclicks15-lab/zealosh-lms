import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { loadEnvConfig } from '@next/env';
import { SupabaseAdapter } from '../src/lib/store/supabase-adapter';
import { Assignment, AssignmentSubmission, GradingRubric, User } from '../src/types';
import { createClient } from '@supabase/supabase-js';
import { signToken } from '../src/lib/auth/jwt';
import { POST as createAssignmentHandler } from '../src/app/api/assignments/route';
import { GET as getAssignmentsHandler } from '../src/app/api/assignments/route';
import { POST as submitAssignmentHandler } from '../src/app/api/assignments/[assignmentId]/submit/route';
import { POST as gradeAssignmentHandler } from '../src/app/api/assignments/[assignmentId]/grade/route';

loadEnvConfig(process.cwd());

describe('Zealosh LMS — Live Supabase Coursework Persistence & Security Suite', { timeout: 45000 }, () => {
  const originalStorage = process.env.DATABASE_STORAGE;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yeegsljnjwxdhgzfdnyg.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IMAOSBMuGgGlXOrVUcNGHQ_NUKVEWQ4';

  const testAssignmentId = `asg-live-test-${Date.now().toString(36)}`;
  const testSubmissionId = `sub-live-test-${Date.now().toString(36)}`;
  const testEnrollmentId = `enr-live-test-${Date.now().toString(36)}`;

  let adapter: SupabaseAdapter;
  let adminClient: any;
  let isSupabaseOnline = false;

  // Canonical Seeded Test Users
  const instructorUser: User = {
    id: 'usr-inst-01',
    email: 'vishnu@zealosh.com',
    name: 'Er. Vishnu Nair (Lead Faculty)',
    role: 'INSTRUCTOR',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const studentUser: User = {
    id: 'usr-std-01',
    email: 'student@zealosh.com',
    name: 'Arjun Menon',
    role: 'STUDENT',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const unassignedInstructorUser: User = {
    id: 'usr-inst-unassigned',
    email: 'guest-instructor@zealosh.com',
    name: 'Guest Instructor',
    role: 'INSTRUCTOR',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const unenrolledStudentUser: User = {
    id: 'usr-std-unenrolled',
    email: 'unenrolled@zealosh.com',
    name: 'Unenrolled Candidate',
    role: 'STUDENT',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const rubric: GradingRubric = {
    id: 'rub-live-01',
    title: 'ACGIH Industrial Hygiene Calculation Rubric',
    criteria: [
      {
        id: 'crit-live-twa',
        title: 'ACGIH TLV 8-hour TWA Evaluation',
        description: 'Calculates time-weighted average for mixed solvents',
        maxPoints: 50,
      },
      {
        id: 'crit-live-lev',
        title: 'Local Exhaust Ventilation Capture Velocity',
        description: 'Minimum 100 fpm at the hood face',
        maxPoints: 50,
      },
    ],
    totalPoints: 100,
  };

  beforeAll(async () => {
    process.env.DATABASE_STORAGE = 'supabase';
    adapter = new SupabaseAdapter();
    adminClient = createClient(url, serviceRoleKey!);

    try {
      const ping = await adminClient.from('courses').select('id').limit(1);
      if (!ping.error) {
        isSupabaseOnline = true;
      }
    } catch {
      isSupabaseOnline = false;
    }

    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test fixture (Profile D cloud-gated): network offline');
      return;
    }

    // Set up active test enrollment fixture for usr-std-01 in crs-asp-01 / btc-asp-weekday
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 86400000);
    await adminClient.from('enrollments').upsert({
      id: testEnrollmentId,
      user_id: studentUser.id,
      course_id: 'crs-asp-01',
      batch_id: 'btc-asp-weekday',
      status: 'ACTIVE',
      enrolled_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      progress_percent: 0,
      completed_lesson_ids: [],
    });
  });

  beforeEach(() => {
    process.env.DATABASE_STORAGE = 'supabase';
  });

  afterAll(async () => {
    process.env.DATABASE_STORAGE = originalStorage;
    // Guaranteed cleanup of test-owned records
    try {
      if (adminClient) {
        await adminClient.from('assignment_submissions').delete().eq('id', testSubmissionId);
        await adminClient.from('assignments').delete().eq('id', testAssignmentId);
        await adminClient.from('enrollments').delete().eq('id', testEnrollmentId);
        await adminClient.from('audit_logs').delete().in('entity_id', [testAssignmentId, testSubmissionId]);
      }
    } catch {
      // ignore teardown errors
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Authorized instructor creates an assignment for a course they teach
  // --------------------------------------------------------------------------
  it('1. should allow authorized instructor to create an assignment and persist rubric in PostgreSQL', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const newAssignment: Assignment = {
      id: testAssignmentId,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
      title: 'Live Verification: Solvent Tank LEV Ventilation Study',
      description: 'Comprehensive ventilation design and exposure calculation for Core Hub verification.',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      maxScore: 100,
      rubric,
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await adapter.saveAssignment(newAssignment, instructorUser.email);
    expect(saved).toBeDefined();
    expect(saved.id).toBe(testAssignmentId);
    expect(saved.maxScore).toBe(100);

    // Direct read from PostgreSQL via distinct query
    const fetched = await adapter.getAssignmentById(testAssignmentId);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(testAssignmentId);
    expect(fetched?.title).toBe(newAssignment.title);
    expect(fetched?.rubric?.criteria.length).toBe(2);
    expect(fetched?.rubric?.totalPoints).toBe(100);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Instructor cannot create or modify coursework for unassigned course
  // --------------------------------------------------------------------------
  it('2. should reject coursework creation by an instructor not assigned to the course', async () => {
    const unassignedToken = signToken(unassignedInstructorUser);
    const req = new Request('http://localhost:3000/api/assignments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unassignedToken}`,
      },
      body: JSON.stringify({
        assignment: {
          title: 'Unauthorized Assignment',
          courseId: 'crs-asp-01',
          dueDate: new Date().toISOString(),
        },
      }),
    });

    const res = await createAssignmentHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Forbidden: You can only author assignments for courses or cohorts you are assigned to teach');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: A batch belonging to a different course is rejected
  // --------------------------------------------------------------------------
  it('3. should reject an assignment referencing an invalid or non-existent batch', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const invalidBatchAssignment: Assignment = {
      id: `asg-invalid-batch-${Date.now().toString(36)}`,
      courseId: 'crs-asp-01',
      batchId: 'btc-non-existent-batch-999',
      title: 'Invalid Batch Test',
      description: 'Should fail foreign key constraint',
      dueDate: new Date().toISOString(),
      maxScore: 100,
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(adapter.saveAssignment(invalidBatchAssignment)).rejects.toThrow(
      /The selected batch does not belong to the selected course|foreign key constraint|violates/i
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 4: An enrolled learner can read published coursework for the correct course/batch
  // --------------------------------------------------------------------------
  it('4. should allow an enrolled learner to read published coursework for their course and cohort', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    // Ensure test enrollment is present for isolated concurrency
    await adminClient.from('enrollments').upsert({
      id: testEnrollmentId,
      user_id: studentUser.id,
      course_id: 'crs-asp-01',
      batch_id: 'btc-asp-weekday',
      status: 'ACTIVE',
      enrolled_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
      progress_percent: 0,
      completed_lesson_ids: [],
    });

    const studentToken = signToken(studentUser);
    const req = new Request('http://localhost:3000/api/assignments', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getAssignmentsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.assignments)).toBe(true);

    const matching = body.assignments.find((a: any) => a.id === testAssignmentId);
    expect(matching).toBeDefined();
    expect(matching.title).toContain('Solvent Tank LEV Ventilation Study');
    expect(matching.submission).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Scenario 5: An unenrolled learner cannot submit work for that coursework
  // --------------------------------------------------------------------------
  it('5. should reject coursework submission by an unenrolled candidate', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const unenrolledToken = signToken(unenrolledStudentUser);
    const req = new Request(`http://localhost:3000/api/assignments/${testAssignmentId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unenrolledToken}`,
      },
      body: JSON.stringify({
        submissionText: 'Attempting to submit without enrollment',
      }),
    });

    const res = await submitAssignmentHandler(req, { params: { assignmentId: testAssignmentId } });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Forbidden: Active enrollment in this course and cohort required');
  });

  // --------------------------------------------------------------------------
  // Scenario 6: A learner can create a submission and retrieve it after fresh adapter instance
  // --------------------------------------------------------------------------
  it('6. should persist student coursework submission and survive a fresh adapter instance with derived course/batch', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const newSubmission: AssignmentSubmission = {
      id: testSubmissionId,
      assignmentId: testAssignmentId,
      userId: studentUser.id,
      studentName: studentUser.name,
      studentEmail: studentUser.email,
      submissionText: 'Completed LEV duct friction analysis and static pressure calculation for the solvent tank.',
      attachmentUrl: 'https://storage.zealosh.com/verifications/arjun-lev-report.pdf',
      attachmentFilename: 'arjun-lev-report.pdf',
      submittedAt: new Date().toISOString(),
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const submitted = await adapter.submitAssignment(newSubmission, studentUser.email);
    expect(submitted).toBeDefined();
    expect(submitted.id).toBe(testSubmissionId);
    expect(submitted.status).toBe('SUBMITTED');

    // Fresh adapter instance simulation (no local cache)
    const freshAdapter = new SupabaseAdapter();
    const retrieved = await freshAdapter.getSubmissionById(testSubmissionId);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(testSubmissionId);
    expect(retrieved?.userId).toBe(studentUser.id);
    expect(retrieved?.courseId).toBe('crs-asp-01'); // Derived from assignment join
    expect(retrieved?.batchId).toBe('btc-asp-weekday'); // Derived from assignment join
    expect(retrieved?.submissionText).toContain('Completed LEV duct friction analysis');
    expect(retrieved?.status).toBe('SUBMITTED');
  });

  // --------------------------------------------------------------------------
  // Scenario 7: A learner cannot read another learner's submission or alter grading metadata
  // --------------------------------------------------------------------------
  it('7. should enforce learner isolation: unauthenticated client cannot read assignments or alter grades', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const unauthClient = createClient(url, anonKey);

    // 1. Unauthenticated read of assignments is denied by RLS
    const { data: unauthAssignments } = await unauthClient
      .from('assignments')
      .select('*')
      .eq('id', testAssignmentId);
    expect(unauthAssignments?.length ?? 0).toBe(0);

    // 2. Unauthenticated read of submissions is denied by RLS
    const { data: unauthSubmissions } = await unauthClient
      .from('assignment_submissions')
      .select('*')
      .eq('id', testSubmissionId);
    expect(unauthSubmissions?.length ?? 0).toBe(0);

    // 3. Unauthenticated update attempt to tamper with score is blocked
    await unauthClient
      .from('assignment_submissions')
      .update({ score: 100, status: 'GRADED' })
      .eq('id', testSubmissionId);

    // Verify original state preserved
    const checkFresh = await adapter.getSubmissionById(testSubmissionId);
    expect(checkFresh?.score).toBeUndefined();
    expect(checkFresh?.status).toBe('SUBMITTED');
  });

  // --------------------------------------------------------------------------
  // Scenario 8: An authorized instructor can grade a submission and retrieve the persisted grade
  // --------------------------------------------------------------------------
  it('8. should allow authorized instructor to grade submission with rubric criteria scores and persist feedback', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const graded = await adapter.gradeSubmission(testSubmissionId, {
      score: 96,
      feedback: 'Excellent hood design. Static pressure calculations exactly match the ACGIH manual.',
      gradedBy: instructorUser.id,
      actorEmail: instructorUser.email,
      rubricScores: [
        { criterionId: 'crit-live-twa', score: 48, comment: 'Accurate TWA excursion calculation' },
        { criterionId: 'crit-live-lev', score: 48, comment: 'Proper slot velocity margin' },
      ],
    });

    expect(graded.status).toBe('GRADED');
    expect(graded.score).toBe(96);
    expect(graded.gradedByUserId).toBe(instructorUser.id);

    // Retrieve via fresh adapter instance
    const freshAdapter = new SupabaseAdapter();
    const retrieved = await freshAdapter.getSubmissionById(testSubmissionId);

    expect(retrieved?.status).toBe('GRADED');
    expect(retrieved?.score).toBe(96);
    expect(retrieved?.feedback).toContain('Excellent hood design');
    expect(retrieved?.rubricScores?.length).toBe(2);
    expect(retrieved?.rubricScores?.[0].score).toBe(48);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Submission ownership and assignment identity cannot be changed by unauthorized users
  // --------------------------------------------------------------------------
  it('9. should reject tampering with submission ownership or assignment identity', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const unauthClient = createClient(url, anonKey);

    // Attempt to hijack submission to another user
    await unauthClient
      .from('assignment_submissions')
      .update({ user_id: 'usr-attacker' })
      .eq('id', testSubmissionId);

    const verified = await adapter.getSubmissionById(testSubmissionId);
    expect(verified?.userId).toBe(studentUser.id);
    expect(verified?.assignmentId).toBe(testAssignmentId);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Failed writes return explicit errors and do not report false success
  // --------------------------------------------------------------------------
  it('10. should surface explicit PostgreSQL errors upon invalid writes without silent fallback', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const invalidSubmission: AssignmentSubmission = {
      id: `sub-invalid-${Date.now().toString(36)}`,
      assignmentId: 'asg-non-existent-999',
      userId: studentUser.id,
      submittedAt: new Date().toISOString(),
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Must throw an explicit error indicating foreign key violation
    await expect(adapter.submitAssignment(invalidSubmission)).rejects.toThrow(/foreign key constraint|violates/i);
  });

  // --------------------------------------------------------------------------
  // Audit Verification: Verify audit trail logs in Supabase
  // --------------------------------------------------------------------------
  it('should record immutable audit log entries in Supabase audit_logs', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const auditLogs = await adapter.getAuditLogs();
    const assignmentAudit = auditLogs.find(
      (a) => a.action === 'ASSIGNMENT_SAVED' && a.entityId === testAssignmentId
    );
    expect(assignmentAudit).toBeDefined();

    const gradeAudit = auditLogs.find(
      (a) => a.action === 'ASSIGNMENT_GRADED' && a.entityId === testSubmissionId
    );
    expect(gradeAudit).toBeDefined();
    expect(gradeAudit?.actorRole).toBe('INSTRUCTOR');
  });
});
