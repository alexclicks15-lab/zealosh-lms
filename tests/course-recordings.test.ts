import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { db } from '../src/lib/store/db';
import { signToken } from '../src/lib/auth/jwt';
import { resolveCourseRecordings } from '../src/lib/store/course-recording-resolver';
import { GET as getCourseRecordingsHandler } from '../src/app/api/courses/[slug]/recordings/route';
import { GET as getRecordingsHandler } from '../src/app/api/recordings/route';
import { GET as getRecordingDetailHandler } from '../src/app/api/recordings/[recordingId]/route';
import { ClassRecording, Course, Enrollment, LiveSession, RecordingBatchAccess, User } from '../src/types';

describe('Zealosh LMS — CP-8.8: Course-Level Recording Discovery and Access Control Suite', () => {
  const originalStorage = process.env.DATABASE_STORAGE;
  const fixedNow = new Date('2026-11-01T10:00:00Z');

  // Test Entities
  const courseAsp: Course = {
    id: 'crs-asp-01',
    slug: 'asp-examination-prep',
    title: 'Associate Safety Professional (ASP) Examination Prep',
    headline: 'ASP Comprehensive Prep',
    description: 'Comprehensive preparation for BCSP ASP certification.',
    deliveryModel: 'HYBRID',
    leadInstructorId: 'usr-inst-asp',
    coInstructorIds: ['usr-inst-co'],
    certificationType: 'ASP',
    status: 'PUBLISHED',
    learningObjectives: [],
    prerequisites: [],
    priceInr: 35000,
    priceUsd: 499,
    durationWeeks: 10,
    coverImage: '/images/asp-thumb.jpg',
    modulesCount: 4,
    totalLessons: 20,
    totalHours: 40,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const courseCsp: Course = {
    id: 'crs-csp-02',
    slug: 'csp-comprehensive-mastery',
    title: 'Certified Safety Professional (CSP) Comprehensive Mastery',
    headline: 'CSP Mastery',
    description: 'Advanced BCSP CSP preparation.',
    deliveryModel: 'HYBRID',
    leadInstructorId: 'usr-inst-csp',
    coInstructorIds: [],
    certificationType: 'CSP',
    status: 'PUBLISHED',
    learningObjectives: [],
    prerequisites: [],
    priceInr: 45000,
    priceUsd: 599,
    durationWeeks: 12,
    coverImage: '/images/csp-thumb.jpg',
    modulesCount: 6,
    totalLessons: 30,
    totalHours: 60,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const batchActiveAsp: any = {
    id: 'btc-asp-nov26',
    courseId: courseAsp.id,
    name: 'ASP November 2026 Evening Cohort',
    instructorId: 'usr-inst-asp',
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-12-15T00:00:00Z',
    schedule: 'Mon/Wed/Fri 19:00-21:00 IST',
    maxStudents: 35,
    enrolledCount: 15,
    status: 'ACTIVE',
  };

  const batchCancelledAsp: any = {
    id: 'btc-asp-cancelled',
    courseId: courseAsp.id,
    name: 'ASP Cancelled Cohort',
    instructorId: 'usr-inst-asp',
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-10-30T00:00:00Z',
    schedule: 'Sat/Sun 10:00-12:00 IST',
    maxStudents: 20,
    enrolledCount: 5,
    status: 'CANCELLED',
  };

  const batchParallelAsp: any = {
    id: 'btc-asp-parallel',
    courseId: courseAsp.id,
    name: 'ASP Parallel Cohort B',
    instructorId: 'usr-inst-asp',
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-12-15T00:00:00Z',
    schedule: 'Tue/Thu 19:00-21:00 IST',
    maxStudents: 30,
    enrolledCount: 10,
    status: 'ACTIVE',
  };

  const batchCsp: any = {
    id: 'btc-csp-nov26',
    courseId: courseCsp.id,
    name: 'CSP Cohort Nov 2026',
    instructorId: 'usr-inst-csp',
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-12-15T00:00:00Z',
    schedule: 'Sat/Sun 14:00-16:00 IST',
    maxStudents: 30,
    enrolledCount: 8,
    status: 'ACTIVE',
  };

  // Test Users
  const studentEnrolled: User = {
    id: 'usr-std-asp-enrolled',
    name: 'Pooja Varma',
    email: 'pooja.varma@zealosh.com',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const studentExpired: User = {
    id: 'usr-std-asp-expired',
    name: 'Karthik S',
    email: 'karthik.s@zealosh.com',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const studentUnenrolled: User = {
    id: 'usr-std-unenrolled',
    name: 'Naveen Raj',
    email: 'naveen.raj@zealosh.com',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const studentParallel: User = {
    id: 'usr-std-parallel',
    name: 'Anjali Menon',
    email: 'anjali.parallel@zealosh.com',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const foreignTenantStudent: User = {
    id: 'usr-std-foreign',
    name: 'External Tenant User',
    email: 'foreign@otherorg.example',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-unauthorized-999',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const instructorAsp: User = {
    id: 'usr-inst-asp',
    name: 'Er. Vishnu Nair (Lead Faculty)',
    email: 'vishnu.inst@zealosh.com',
    passwordHash: 'hash',
    role: 'INSTRUCTOR',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const superAdminUser: User = {
    id: 'usr-admin-cp88',
    name: 'Super Admin Officer',
    email: 'admin.cp88@zealosh.com',
    passwordHash: 'hash',
    role: 'SUPER_ADMIN',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  // Enrollments
  const activeEnrollment: Enrollment = {
    id: 'enr-asp-active',
    userId: studentEnrolled.id,
    courseId: courseAsp.id,
    batchId: batchActiveAsp.id,
    status: 'ACTIVE',
    enrolledAt: '2026-10-01T00:00:00Z',
    expiresAt: '2027-10-01T00:00:00Z',
    progressPercent: 25,
    completedLessonIds: [],
  };

  const expiredEnrollment: Enrollment = {
    id: 'enr-asp-expired',
    userId: studentExpired.id,
    courseId: courseAsp.id,
    batchId: batchActiveAsp.id,
    status: 'ACTIVE',
    enrolledAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-10-25T00:00:00Z', // Expired before fixedNow (2026-11-01)
    progressPercent: 80,
    completedLessonIds: [],
  };

  const parallelEnrollment: Enrollment = {
    id: 'enr-asp-parallel',
    userId: studentParallel.id,
    courseId: courseAsp.id,
    batchId: batchParallelAsp.id,
    status: 'ACTIVE',
    enrolledAt: '2026-10-01T00:00:00Z',
    expiresAt: '2027-10-01T00:00:00Z',
    progressPercent: 10,
    completedLessonIds: [],
  };

  // Live Sessions
  const sessionAsp01: LiveSession = {
    id: 'ses-asp-01',
    meetingId: 'mtg-asp-01',
    courseId: courseAsp.id,
    batchId: batchActiveAsp.id,
    title: 'Industrial Ventilation & Contaminant Transport Calculations',
    scheduledStartTime: '2026-10-28T18:00:00Z',
    durationMinutes: 90,
    instructorId: instructorAsp.id,
    status: 'ENDED',
    recordingUrl: '/recordings/rec-asp-01',
  };

  const sessionAsp02: LiveSession = {
    id: 'ses-asp-02',
    meetingId: 'mtg-asp-02',
    courseId: courseAsp.id,
    batchId: batchActiveAsp.id,
    title: 'Radiation Safety, Shielding & Inverse Square Laws',
    scheduledStartTime: '2026-10-30T18:00:00Z',
    durationMinutes: 120,
    instructorId: instructorAsp.id,
    status: 'ENDED',
    recordingUrl: '/recordings/rec-asp-02',
  };

  const sessionCsp01: LiveSession = {
    id: 'ses-csp-01',
    meetingId: 'mtg-csp-01',
    courseId: courseCsp.id,
    batchId: batchCsp.id,
    title: 'CSP Risk Management Framework & Quantitative Assessment',
    scheduledStartTime: '2026-10-29T18:00:00Z',
    durationMinutes: 120,
    instructorId: 'usr-inst-csp',
    status: 'ENDED',
    recordingUrl: '/recordings/rec-csp-01',
  };

  // Class Recordings
  const recordingAspAvailable: ClassRecording = {
    id: 'rec-asp-available-01',
    sessionId: sessionAsp01.id,
    courseId: courseAsp.id,
    batchId: batchActiveAsp.id,
    title: 'Industrial Ventilation & Contaminant Transport Calculations — Full Workshop',
    description: 'In-depth engineering calculations covering duct sizing and Q=VA formulas.',
    storageProvider: 'SUPABASE_STORAGE',
    storagePath: 'recordings/crs-asp-01/rec-asp-available-01.mp4',
    mediaUrl: 'https://yeegsljnjwxdhgzfdnyg.supabase.co/storage/v1/object/public/recordings/asp-01.mp4',
    durationSeconds: 5400, // 90 min
    fileSizeBytes: 350000000,
    status: 'AVAILABLE',
    isDownloadable: true,
    availableFrom: '2026-10-28T20:00:00Z',
    createdAt: '2026-10-28T20:00:00Z',
    updatedAt: '2026-10-28T20:00:00Z',
  };

  const recordingAspProcessing: ClassRecording = {
    id: 'rec-asp-processing-02',
    sessionId: sessionAsp02.id,
    courseId: courseAsp.id,
    batchId: batchActiveAsp.id,
    title: 'Radiation Safety, Shielding & Inverse Square Laws — Class Replay',
    description: 'Lecture recording currently processing video transcode.',
    storageProvider: 'SUPABASE_STORAGE',
    storagePath: 'recordings/crs-asp-01/rec-asp-processing-02.mp4',
    mediaUrl: '',
    durationSeconds: 7200, // 120 min
    fileSizeBytes: 0,
    status: 'PROCESSING',
    isDownloadable: false,
    availableFrom: '2026-10-30T20:30:00Z',
    createdAt: '2026-10-30T20:30:00Z',
    updatedAt: '2026-10-30T20:30:00Z',
  };

  const recordingAspArchived: ClassRecording = {
    id: 'rec-asp-archived-03',
    sessionId: sessionAsp01.id,
    courseId: courseAsp.id,
    batchId: batchActiveAsp.id,
    title: 'Outdated Safety Overview (Archived)',
    description: 'Legacy recording retired from active curriculum.',
    storageProvider: 'SUPABASE_STORAGE',
    storagePath: 'recordings/crs-asp-01/rec-asp-archived-03.mp4',
    mediaUrl: '',
    durationSeconds: 3600,
    fileSizeBytes: 200000000,
    status: 'ARCHIVED',
    isDownloadable: false,
    availableFrom: '2026-08-01T00:00:00Z',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };

  const recordingCancelledBatch: ClassRecording = {
    id: 'rec-asp-cancelled-batch',
    sessionId: 'ses-asp-cancelled',
    courseId: courseAsp.id,
    batchId: batchCancelledAsp.id,
    title: 'Cancelled Cohort Session Recording',
    description: 'Session conducted in cancelled cohort.',
    storageProvider: 'SUPABASE_STORAGE',
    storagePath: 'recordings/crs-asp-01/rec-cancelled.mp4',
    mediaUrl: 'https://example.com/cancelled.mp4',
    durationSeconds: 3600,
    fileSizeBytes: 100000000,
    status: 'AVAILABLE',
    isDownloadable: false,
    availableFrom: '2026-10-15T00:00:00Z',
    createdAt: '2026-10-15T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
  };

  const recordingCsp: ClassRecording = {
    id: 'rec-csp-01',
    sessionId: sessionCsp01.id,
    courseId: courseCsp.id,
    batchId: batchCsp.id,
    title: 'CSP Risk Assessment & Probability Modeling Masterclass',
    description: 'CSP advanced session.',
    storageProvider: 'SUPABASE_STORAGE',
    storagePath: 'recordings/crs-csp-02/rec-csp-01.mp4',
    mediaUrl: 'https://yeegsljnjwxdhgzfdnyg.supabase.co/storage/v1/object/public/recordings/csp-01.mp4',
    durationSeconds: 7200,
    fileSizeBytes: 450000000,
    status: 'AVAILABLE',
    isDownloadable: true,
    availableFrom: '2026-10-29T20:30:00Z',
    createdAt: '2026-10-29T20:30:00Z',
    updatedAt: '2026-10-29T20:30:00Z',
  };

  // JWT Tokens
  let tokenEnrolled: string;
  let tokenExpired: string;
  let tokenUnenrolled: string;
  let tokenParallel: string;
  let tokenForeign: string;
  let tokenInstructor: string;
  let tokenAdmin: string;

  beforeAll(() => {
    process.env.DATABASE_STORAGE = 'in_memory';

    tokenEnrolled = signToken(studentEnrolled);
    tokenExpired = signToken(studentExpired);
    tokenUnenrolled = signToken(studentUnenrolled);
    tokenParallel = signToken(studentParallel);
    tokenForeign = signToken(foreignTenantStudent);
    tokenInstructor = signToken(instructorAsp);
    tokenAdmin = signToken(superAdminUser);
  });

  afterAll(() => {
    process.env.DATABASE_STORAGE = originalStorage;
  });

  beforeEach(async () => {
    db.resetToSeed();

    // Seed Courses
    await db.saveCourse(courseAsp);
    await db.saveCourse(courseCsp);

    // Seed Batches
    db.batches.set(batchActiveAsp.id, batchActiveAsp);
    db.batches.set(batchCancelledAsp.id, batchCancelledAsp);
    db.batches.set(batchParallelAsp.id, batchParallelAsp);
    db.batches.set(batchCsp.id, batchCsp);

    // Seed Users
    await db.saveUser(studentEnrolled);
    await db.saveUser(studentExpired);
    await db.saveUser(studentUnenrolled);
    await db.saveUser(studentParallel);
    await db.saveUser(foreignTenantStudent);
    await db.saveUser(instructorAsp);
    await db.saveUser(superAdminUser);

    // Seed Enrollments
    db.enrollments.set(activeEnrollment.id, activeEnrollment);
    db.enrollments.set(expiredEnrollment.id, expiredEnrollment);
    db.enrollments.set(parallelEnrollment.id, parallelEnrollment);

    // Seed Live Sessions
    await db.saveLiveSession(sessionAsp01);
    await db.saveLiveSession(sessionAsp02);
    await db.saveLiveSession(sessionCsp01);

    // Seed Recordings
    await db.saveClassRecording(recordingAspAvailable);
    await db.saveClassRecording(recordingAspProcessing);
    await db.saveClassRecording(recordingAspArchived);
    await db.saveClassRecording(recordingCancelledBatch);
    await db.saveClassRecording(recordingCsp);
  });

  // ==========================================================================
  // Scenario 1: Authorized student discovers ready recording in selected course
  // ==========================================================================
  it('Scenario 1: Authorized student discovers ready recording associated with selected course', async () => {
    const res = await resolveCourseRecordings(studentEnrolled.id, courseAsp.slug, { now: fixedNow });
    expect(res.success).toBe(true);
    expect(res.courseId).toBe(courseAsp.id);
    expect(res.entitlementStatus).toBe('ENROLLED');

    const availableRec = res.recordings.find((r) => r.id === recordingAspAvailable.id);
    expect(availableRec).toBeDefined();
    expect(availableRec?.lifecycleState).toBe('READY');
    expect(availableRec?.canPlay).toBe(true);
    expect(availableRec?.playbackUrl).toBe(`/recordings/${recordingAspAvailable.id}`);
    expect(availableRec?.canDownload).toBe(true);
    expect(availableRec?.isCrossBatchGrant).toBe(false);
  });

  // ==========================================================================
  // Scenario 2: Authorized student sees multiple eligible recordings in deterministic order
  // ==========================================================================
  it('Scenario 2: Authorized student sees recordings in deterministic lifecycle and timestamp order', async () => {
    const res = await resolveCourseRecordings(studentEnrolled.id, courseAsp.id, { now: fixedNow });
    expect(res.recordings.length).toBeGreaterThanOrEqual(3);

    // READY recordings must precede PROCESSING, which must precede UNAVAILABLE
    const readyIndices = res.recordings
      .map((r, i) => (r.lifecycleState === 'READY' ? i : -1))
      .filter((i) => i !== -1);
    const procIndices = res.recordings
      .map((r, i) => (r.lifecycleState === 'PROCESSING' ? i : -1))
      .filter((i) => i !== -1);
    const unavailIndices = res.recordings
      .map((r, i) => (r.lifecycleState === 'UNAVAILABLE' ? i : -1))
      .filter((i) => i !== -1);

    expect(readyIndices.length).toBeGreaterThan(0);
    expect(procIndices.length).toBeGreaterThan(0);
    expect(unavailIndices.length).toBeGreaterThan(0);

    const maxReady = Math.max(...readyIndices);
    const minProc = Math.min(...procIndices);
    const minUnavail = Math.min(...unavailIndices);

    expect(maxReady).toBeLessThan(minProc);
    expect(minProc).toBeLessThan(minUnavail);
  });

  // ==========================================================================
  // Scenario 3: Student cannot discover recording unrelated to the selected course
  // ==========================================================================
  it('Scenario 3: Course discovery strictly isolates recordings to the selected course', async () => {
    const res = await resolveCourseRecordings(studentEnrolled.id, courseAsp.id, { now: fixedNow });
    const cspRec = res.recordings.find((r) => r.courseId === courseCsp.id || r.id === recordingCsp.id);
    expect(cspRec).toBeUndefined();
  });

  // ==========================================================================
  // Scenario 4: Student without eligible enrollment cannot obtain restricted recordings
  // ==========================================================================
  it('Scenario 4: Student without eligible enrollment receives NOT_ENROLLED with empty recordings', async () => {
    const res = await resolveCourseRecordings(studentUnenrolled.id, courseAsp.slug, { now: fixedNow });
    expect(res.success).toBe(true);
    expect(res.entitlementStatus).toBe('NOT_ENROLLED');
    expect(res.recordings).toEqual([]);
    expect(res.count).toBe(0);
  });

  // ==========================================================================
  // Scenario 5: Expired enrollment does not confer access
  // ==========================================================================
  it('Scenario 5: Expired course enrollment receives ENROLLMENT_EXPIRED with empty recordings', async () => {
    const res = await resolveCourseRecordings(studentExpired.id, courseAsp.id, { now: fixedNow });
    expect(res.success).toBe(true);
    expect(res.entitlementStatus).toBe('ENROLLMENT_EXPIRED');
    expect(res.recordings).toEqual([]);
    expect(res.count).toBe(0);
  });

  // ==========================================================================
  // Scenario 6: Cancelled batch does not confer access to learners
  // ==========================================================================
  it('Scenario 6: Cancelled cohort batch recordings are excluded from student discovery', async () => {
    // Add active enrollment for student in cancelled batch to test isolation
    db.enrollments.set('enr-asp-cancelled-user', {
      id: 'enr-asp-cancelled-user',
      userId: studentEnrolled.id,
      courseId: courseAsp.id,
      batchId: batchCancelledAsp.id,
      status: 'ACTIVE',
      enrolledAt: '2026-10-01T00:00:00Z',
      expiresAt: '2027-10-01T00:00:00Z',
      progressPercent: 0,
      completedLessonIds: [],
    });

    const res = await resolveCourseRecordings(studentEnrolled.id, courseAsp.id, { now: fixedNow });
    const cancelledRec = res.recordings.find((r) => r.id === recordingCancelledBatch.id);
    expect(cancelledRec).toBeUndefined();
  });

  // ==========================================================================
  // Scenario 7: Foreign tenant isolation enforcement
  // ==========================================================================
  it('Scenario 7: Foreign tenant caller receives 403 Forbidden UNAUTHORIZED_TENANT', async () => {
    const res = await resolveCourseRecordings(foreignTenantStudent.id, courseAsp.slug, {
      now: fixedNow,
      tokenOrganizationId: foreignTenantStudent.organizationId,
    });
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.entitlementStatus).toBe('UNAUTHORIZED_TENANT');
    expect(res.error).toContain('Unauthorized tenant');
  });

  // ==========================================================================
  // Scenario 8 & 9: Cross-batch grant authorization lifecycle
  // ==========================================================================
  it('Scenario 8: Active cross-batch grant confers contextual course discovery to parallel learner', async () => {
    // StudentParallel is in batchParallelAsp. They cannot access recordingAspAvailable yet.
    const preGrantRes = await resolveCourseRecordings(studentParallel.id, courseAsp.id, { now: fixedNow });
    expect(preGrantRes.recordings.some((r) => r.id === recordingAspAvailable.id)).toBe(false);

    // Admin grants batchParallelAsp access to recordingAspAvailable
    const grant: RecordingBatchAccess = {
      id: 'grant-asp-parallel-01',
      recordingId: recordingAspAvailable.id,
      sourceBatchId: batchActiveAsp.id,
      targetBatchId: batchParallelAsp.id,
      grantedBy: superAdminUser.id,
      grantedAt: '2026-10-29T00:00:00Z',
      expiresAt: '2027-10-29T00:00:00Z',
      allowDownload: false,
      status: 'ACTIVE',
      createdAt: '2026-10-29T00:00:00Z',
    };
    await db.grantRecordingBatchAccess(grant);

    const postGrantRes = await resolveCourseRecordings(studentParallel.id, courseAsp.id, { now: fixedNow });
    const grantedRec = postGrantRes.recordings.find((r) => r.id === recordingAspAvailable.id);
    expect(grantedRec).toBeDefined();
    expect(grantedRec?.canPlay).toBe(true);
    expect(grantedRec?.isCrossBatchGrant).toBe(true);
    expect(grantedRec?.canDownload).toBe(false); // Respects grant's explicit allowDownload=false
  });

  it('Scenario 9: Expired or revoked cross-batch grant does not confer access', async () => {
    // Expired grant
    const expiredGrant: RecordingBatchAccess = {
      id: 'grant-asp-parallel-expired',
      recordingId: recordingAspAvailable.id,
      sourceBatchId: batchActiveAsp.id,
      targetBatchId: batchParallelAsp.id,
      grantedBy: superAdminUser.id,
      grantedAt: '2026-10-01T00:00:00Z',
      expiresAt: '2026-10-25T00:00:00Z', // Before fixedNow (2026-11-01)
      allowDownload: true,
      status: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00Z',
    };
    await db.grantRecordingBatchAccess(expiredGrant);

    const res = await resolveCourseRecordings(studentParallel.id, courseAsp.id, { now: fixedNow });
    expect(res.recordings.some((r) => r.id === recordingAspAvailable.id)).toBe(false);

    // Revoked grant
    await db.grantRecordingBatchAccess({ ...expiredGrant, id: 'grant-revoked', expiresAt: '2027-10-01T00:00:00Z', status: 'REVOKED' });
    const resRevoked = await resolveCourseRecordings(studentParallel.id, courseAsp.id, { now: fixedNow });
    expect(resRevoked.recordings.some((r) => r.id === recordingAspAvailable.id)).toBe(false);
  });

  // ==========================================================================
  // Scenario 10: Processing recordings are visible but not playable
  // ==========================================================================
  it('Scenario 10: Processing recordings are rendered as non-playable with null playbackUrl', async () => {
    const res = await resolveCourseRecordings(studentEnrolled.id, courseAsp.id, { now: fixedNow });
    const procRec = res.recordings.find((r) => r.id === recordingAspProcessing.id);
    expect(procRec).toBeDefined();
    expect(procRec?.lifecycleState).toBe('PROCESSING');
    expect(procRec?.canPlay).toBe(false);
    expect(procRec?.playbackUrl).toBeNull();
  });

  // ==========================================================================
  // Scenario 11: Archived recordings follow non-playable contract
  // ==========================================================================
  it('Scenario 11: Archived recordings are rendered as UNAVAILABLE and non-playable', async () => {
    const res = await resolveCourseRecordings(studentEnrolled.id, courseAsp.id, { now: fixedNow });
    const archivedRec = res.recordings.find((r) => r.id === recordingAspArchived.id);
    expect(archivedRec).toBeDefined();
    expect(archivedRec?.lifecycleState).toBe('UNAVAILABLE');
    expect(archivedRec?.canPlay).toBe(false);
    expect(archivedRec?.playbackUrl).toBeNull();
  });

  // ==========================================================================
  // Scenario 12: Enrolled student with zero recordings produces clean empty state
  // ==========================================================================
  it('Scenario 12: Enrolled student in a course with no recordings receives empty list with ENROLLED status', async () => {
    // Enroll student in CSP course, which has recordingCsp in batchCsp
    // Let's create a new course with zero recordings
    const emptyCourse: Course = {
      id: 'crs-empty-01',
      slug: 'empty-safety-fundamentals',
      title: 'Safety Fundamentals Workshop',
      headline: 'Empty Workshop',
      description: 'Introductory unit with no recordings.',
      deliveryModel: 'RECORDED',
      leadInstructorId: 'usr-inst-asp',
      coInstructorIds: [],
      certificationType: 'ASP',
      status: 'PUBLISHED',
      learningObjectives: [],
      prerequisites: [],
      priceInr: 10000,
      priceUsd: 150,
      durationWeeks: 2,
      coverImage: '/images/empty.jpg',
      modulesCount: 0,
      totalLessons: 0,
      totalHours: 5,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    await db.saveCourse(emptyCourse);

    const emptyBatch: any = {
      id: 'btc-empty-01',
      courseId: emptyCourse.id,
      name: 'Empty Cohort',
      startDate: '2026-11-01T00:00:00Z',
      endDate: '2026-12-01T00:00:00Z',
      status: 'ACTIVE',
    };
    db.batches.set(emptyBatch.id, emptyBatch);

    db.enrollments.set('enr-empty-user', {
      id: 'enr-empty-user',
      userId: studentEnrolled.id,
      courseId: emptyCourse.id,
      batchId: emptyBatch.id,
      status: 'ACTIVE',
      enrolledAt: '2026-10-01T00:00:00Z',
      expiresAt: '2027-10-01T00:00:00Z',
      progressPercent: 0,
      completedLessonIds: [],
    });

    const res = await resolveCourseRecordings(studentEnrolled.id, emptyCourse.id, { now: fixedNow });
    expect(res.success).toBe(true);
    expect(res.entitlementStatus).toBe('ENROLLED');
    expect(res.recordings).toEqual([]);
    expect(res.count).toBe(0);
  });

  // ==========================================================================
  // Scenario 13: Course lookup failure produces 404
  // ==========================================================================
  it('Scenario 13: Invalid course identifier produces 404 COURSE_NOT_FOUND', async () => {
    const res = await resolveCourseRecordings(studentEnrolled.id, 'non-existent-course-slug', { now: fixedNow });
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(404);
    expect(res.error).toBe('Course not found');
  });

  // ==========================================================================
  // Scenario 14: Direct player or media access remains protected against unauthorized IDs
  // ==========================================================================
  it('Scenario 14: Direct recording playback route rejects un-enrolled students with 403', async () => {
    const attackReq = new Request(`http://localhost:3000/api/recordings/${recordingAspAvailable.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenUnenrolled}` },
    });
    const attackRes = await getRecordingDetailHandler(attackReq, {
      params: { recordingId: recordingAspAvailable.id },
    });
    expect(attackRes.status).toBe(403);
    const body = await attackRes.json();
    expect(body.error).toContain('NOT_ENROLLED_IN_COHORT');
  });

  // ==========================================================================
  // Scenario 15: Tampering with tenant, batch, or course cannot bypass server-side checks
  // ==========================================================================
  it('Scenario 15: API route GET /api/courses/[slug]/recordings enforces JWT authentication and tenant boundary', async () => {
    // Unauthenticated request
    const unauthReq = new Request(`http://localhost:3000/api/courses/${courseAsp.slug}/recordings`, {
      method: 'GET',
    });
    const unauthRes = await getCourseRecordingsHandler(unauthReq, { params: { slug: courseAsp.slug } });
    expect(unauthRes.status).toBe(401);

    // Foreign tenant request
    const foreignReq = new Request(`http://localhost:3000/api/courses/${courseAsp.slug}/recordings`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenForeign}` },
    });
    const foreignRes = await getCourseRecordingsHandler(foreignReq, { params: { slug: courseAsp.slug } });
    expect(foreignRes.status).toBe(403);

    // Legitimate enrolled request via API route
    const validReq = new Request(`http://localhost:3000/api/courses/${courseAsp.slug}/recordings`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenEnrolled}` },
    });
    const validRes = await getCourseRecordingsHandler(validReq, { params: { slug: courseAsp.slug } });
    expect(validRes.status).toBe(200);
    const validData = await validRes.json();
    expect(validData.success).toBe(true);
    expect(validData.entitlementStatus).toBe('ENROLLED');
    expect(validData.recordings.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // Scenario 16: Course-level discovery via GET /api/recordings?courseId=...
  // ==========================================================================
  it('Scenario 16: GET /api/recordings?courseId=... returns authoritative course discovery and rejects foreign tenants', async () => {
    // Enrolled learner querying courseId
    const req = new Request(`http://localhost:3000/api/recordings?courseId=${courseAsp.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenEnrolled}` },
    });
    const res = await getRecordingsHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.courseId).toBe(courseAsp.id);
    expect(data.entitlementStatus).toBe('ENROLLED');
    expect(data.recordings.some((r: any) => r.id === recordingAspAvailable.id)).toBe(true);

    // Foreign tenant rejected
    const foreignReq = new Request(`http://localhost:3000/api/recordings?courseId=${courseAsp.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenForeign}` },
    });
    const foreignRes = await getRecordingsHandler(foreignReq);
    expect(foreignRes.status).toBe(403);
  });

  // ==========================================================================
  // Scenario 17: Staff members (Admin / Assigned Instructor) have full course discovery
  // ==========================================================================
  it('Scenario 17: Super Admin and Course Instructor have STAFF_AUTHORIZED visibility over all course recordings', async () => {
    // Lead Instructor
    const instRes = await resolveCourseRecordings(instructorAsp.id, courseAsp.id, { now: fixedNow });
    expect(instRes.success).toBe(true);
    expect(instRes.entitlementStatus).toBe('STAFF_AUTHORIZED');
    expect(instRes.recordings.some((r) => r.id === recordingAspAvailable.id)).toBe(true);
    expect(instRes.recordings.some((r) => r.id === recordingAspProcessing.id)).toBe(true);

    // Super Admin
    const adminRes = await resolveCourseRecordings(superAdminUser.id, courseAsp.slug, { now: fixedNow });
    expect(adminRes.success).toBe(true);
    expect(adminRes.entitlementStatus).toBe('STAFF_AUTHORIZED');
    expect(adminRes.recordings.length).toBeGreaterThanOrEqual(3);
  });
});

