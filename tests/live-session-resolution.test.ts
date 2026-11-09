import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { db } from '../src/lib/store/db';
import { signToken } from '../src/lib/auth/jwt';
import { resolveStudentLiveSessions } from '../src/lib/store/live-session-resolver';
import { recordingStorage } from '../src/lib/storage/recording-storage';
import { GET as getLiveSessionsHandler } from '../src/app/api/live/route';
import { POST as joinLiveSessionHandler } from '../src/app/api/live/[sessionId]/join/route';
import { GET as getRecordingDetailHandler } from '../src/app/api/recordings/[recordingId]/route';
import { ClassRecording, Enrollment, LiveSession, User } from '../src/types';

describe('Zealosh LMS — CP-8.7: Dynamic Live-Session and Replay Resolution Suite', () => {
  const originalStorage = process.env.DATABASE_STORAGE;
  const fixedNow = new Date('2026-11-01T10:00:00Z');

  const enrolledStudent: User = {
    id: 'usr-cp87-student',
    name: 'Meera Krishnan',
    email: 'meera.cp87@zealosh.com',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  };

  const unrelatedStudent: User = {
    id: 'usr-cp87-outsider',
    name: 'Vikram Outsider',
    email: 'vikram.outsider@zealosh.com',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  };

  const foreignTenantStudent: User = {
    id: 'usr-cp87-foreign',
    name: 'External Tenant Learner',
    email: 'foreign@external-corp.example',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-foreign-tenant-99',
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  };

  const activeEnrollment: Enrollment = {
    id: 'enr-cp87-asp-nov26',
    userId: enrolledStudent.id,
    courseId: 'crs-asp-01',
    batchId: 'btc-asp-nov26',
    status: 'ACTIVE',
    enrolledAt: '2026-10-01T00:00:00Z',
    expiresAt: '2027-10-01T00:00:00Z',
    progressPercent: 40,
    completedLessonIds: ['lsn-asp-01'],
  };

  let enrolledToken: string;
  let unrelatedToken: string;
  let foreignTenantToken: string;

  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(fixedNow);
    process.env.DATABASE_STORAGE = 'in_memory';
    enrolledToken = signToken(enrolledStudent);
    unrelatedToken = signToken(unrelatedStudent);
    foreignTenantToken = signToken(foreignTenantStudent);
  });

  afterAll(() => {
    vi.useRealTimers();
    process.env.DATABASE_STORAGE = originalStorage;
  });

  beforeEach(async () => {
    db.resetToSeed();
    await db.saveUser(enrolledStudent);
    await db.saveUser(unrelatedStudent);
    await db.saveUser(foreignTenantStudent);
    db.enrollments.set(activeEnrollment.id, { ...activeEnrollment });
  });

  // --------------------------------------------------------------------------
  // 1. Student with one eligible upcoming class
  // --------------------------------------------------------------------------
  it('1. resolves one eligible upcoming SCHEDULED class for an enrolled student and permits live join', async () => {
    const result = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });

    expect(result.resolutionStatus).toBe('UPCOMING_SCHEDULED');
    expect(result.activeEnrollmentCount).toBe(1);
    expect(result.sessions).toHaveLength(1);
    expect(result.primarySession).not.toBeNull();
    expect(result.primarySession?.id).toBe('sess-asp-01');
    expect(result.primarySession?.title).toBe('ASP Live Workshop: Complex Rigging & Crane Load Charts');
    expect(result.primarySession?.lifecycleState).toBe('UPCOMING');
    expect(result.primarySession?.status).toBe('SCHEDULED');
    expect(result.primarySession?.canJoinLive).toBe(true);
    expect(result.primarySession?.replayState).toBe('NOT_APPLICABLE');
    expect(result.primarySession?.replay).toBeNull();
    expect(result.primarySession?.instructorName).toContain('Vishnu Rajendran');

    // Verify GET /api/live route returns the same authorized resolution
    const getReq = new Request('http://localhost:3000/api/live', {
      method: 'GET',
      headers: { Authorization: `Bearer ${enrolledToken}` },
    });
    const getRes = await getLiveSessionsHandler(getReq);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.success).toBe(true);
    expect(getBody.resolutionStatus).toBe('UPCOMING_SCHEDULED');
    expect(getBody.primarySession.id).toBe('sess-asp-01');

    // Verify POST /api/live/[sessionId]/join succeeds for this upcoming session
    const joinReq = new Request('http://localhost:3000/api/live/sess-asp-01/join', {
      method: 'POST',
      headers: { Authorization: `Bearer ${enrolledToken}` },
    });
    const joinRes = await joinLiveSessionHandler(joinReq, { params: { sessionId: 'sess-asp-01' } });
    expect(joinRes.status).toBe(200);
    const joinBody = await joinRes.json();
    expect(joinBody.success).toBe(true);
    expect(joinBody.joinUrl).toBeDefined();
    expect(joinBody.session.id).toBe('sess-asp-01');
  });

  // --------------------------------------------------------------------------
  // 2. Student with an eligible active LIVE session
  // --------------------------------------------------------------------------
  it('2. resolves an active LIVE session with LIVE_NOW status and join capability', async () => {
    const liveNowSession: LiveSession = {
      id: 'sess-asp-live-active',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'Live Calculation Lab: Industrial Noise TWA & Exchange Rates',
      scheduledStartTime: '2026-11-01T09:30:00Z',
      durationMinutes: 120,
      instructorId: 'usr-inst-01',
      meetingId: 'zealosh-live-asp-active',
      status: 'LIVE',
    };
    db.liveSessions.clear();
    await db.saveLiveSession(liveNowSession);

    const result = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });

    expect(result.resolutionStatus).toBe('LIVE_NOW');
    expect(result.primarySession?.id).toBe('sess-asp-live-active');
    expect(result.primarySession?.lifecycleState).toBe('LIVE');
    expect(result.primarySession?.canJoinLive).toBe(true);
    expect(result.primarySession?.replayState).toBe('NOT_APPLICABLE');
  });

  // --------------------------------------------------------------------------
  // 3. Student with multiple eligible sessions & deterministic ordering
  // --------------------------------------------------------------------------
  it('3. applies deterministic ordering (LIVE > soonest UPCOMING > most recent COMPLETED) and retains all eligible sessions', async () => {
    db.liveSessions.clear();

    // Add a second active enrollment in CSP cohort
    db.enrollments.set('enr-cp87-csp', {
      id: 'enr-cp87-csp',
      userId: enrolledStudent.id,
      courseId: 'crs-csp-02',
      batchId: 'btc-csp-nov26',
      status: 'ACTIVE',
      enrolledAt: '2026-10-05T00:00:00Z',
      expiresAt: '2027-10-05T00:00:00Z',
      progressPercent: 10,
      completedLessonIds: [],
    });

    const olderCompleted: LiveSession = {
      id: 'sess-completed-older',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'Orientation & BCSP Blueprint Walkthrough',
      scheduledStartTime: '2026-10-15T13:30:00Z',
      durationMinutes: 90,
      instructorId: 'usr-inst-01',
      meetingId: 'mtg-older',
      status: 'ENDED',
    };

    const newerCompleted: LiveSession = {
      id: 'sess-completed-newer',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'Module 1 Review: Safety Calculus',
      scheduledStartTime: '2026-10-25T13:30:00Z',
      durationMinutes: 120,
      instructorId: 'usr-inst-01',
      meetingId: 'mtg-newer',
      status: 'ENDED',
    };

    const laterUpcoming: LiveSession = {
      id: 'sess-upcoming-later',
      batchId: 'btc-csp-nov26',
      courseId: 'crs-csp-02',
      title: 'CSP Bowtie & LOPA Workshop',
      scheduledStartTime: '2026-11-15T10:00:00Z',
      durationMinutes: 120,
      instructorId: 'usr-inst-01',
      meetingId: 'mtg-upcoming-later',
      status: 'SCHEDULED',
    };

    const soonerUpcoming: LiveSession = {
      id: 'sess-upcoming-sooner',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'ASP Ventilation Q=VA Workshop',
      scheduledStartTime: '2026-11-05T13:30:00Z',
      durationMinutes: 120,
      instructorId: 'usr-inst-01',
      meetingId: 'mtg-upcoming-sooner',
      status: 'SCHEDULED',
    };

    const activeLive: LiveSession = {
      id: 'sess-live-current',
      batchId: 'btc-csp-nov26',
      courseId: 'crs-csp-02',
      title: 'CSP Live Risk Management Clinic',
      scheduledStartTime: '2026-11-01T09:45:00Z',
      durationMinutes: 90,
      instructorId: 'usr-inst-01',
      meetingId: 'mtg-live-current',
      status: 'LIVE',
    };

    // Insert in deliberately scrambled order to prove selection is not arbitrary insertion order
    await db.saveLiveSession(olderCompleted);
    await db.saveLiveSession(laterUpcoming);
    await db.saveLiveSession(newerCompleted);
    await db.saveLiveSession(soonerUpcoming);
    await db.saveLiveSession(activeLive);

    const result = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });

    expect(result.resolutionStatus).toBe('LIVE_NOW');
    expect(result.primarySession?.id).toBe('sess-live-current');
    expect(result.sessions.map((s) => s.id)).toEqual([
      'sess-live-current',
      'sess-upcoming-sooner',
      'sess-upcoming-later',
      'sess-completed-newer',
      'sess-completed-older',
    ]);

    // When the LIVE session ends, the soonest UPCOMING session becomes primary
    activeLive.status = 'ENDED';
    await db.saveLiveSession(activeLive);

    const afterLiveEnds = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });
    expect(afterLiveEnds.resolutionStatus).toBe('UPCOMING_SCHEDULED');
    expect(afterLiveEnds.primarySession?.id).toBe('sess-upcoming-sooner');
    expect(afterLiveEnds.sessions.map((s) => s.id)).toEqual([
      'sess-upcoming-sooner',
      'sess-upcoming-later',
      'sess-live-current', // most recent completed (Nov 1)
      'sess-completed-newer', // Oct 25
      'sess-completed-older', // Oct 15
    ]);
  });

  // --------------------------------------------------------------------------
  // 4. Student with no eligible sessions
  // --------------------------------------------------------------------------
  it('4. differentiates NO_ACTIVE_ENROLLMENTS from NO_SESSIONS_SCHEDULED when no sessions match', async () => {
    // Case 4A: Unenrolled student -> NO_ACTIVE_ENROLLMENTS
    const unenrolledRes = await resolveStudentLiveSessions(unrelatedStudent.id, { now: fixedNow });
    expect(unenrolledRes.resolutionStatus).toBe('NO_ACTIVE_ENROLLMENTS');
    expect(unenrolledRes.primarySession).toBeNull();
    expect(unenrolledRes.sessions).toEqual([]);
    expect(unenrolledRes.activeEnrollmentCount).toBe(0);

    // Case 4B: Enrolled in a batch (btc-asp-weekday) that has 0 scheduled sessions -> NO_SESSIONS_SCHEDULED
    db.enrollments.clear();
    db.enrollments.set('enr-weekday-empty', {
      id: 'enr-weekday-empty',
      userId: enrolledStudent.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
      status: 'ACTIVE',
      enrolledAt: '2026-10-01T00:00:00Z',
      expiresAt: '2027-10-01T00:00:00Z',
      progressPercent: 0,
      completedLessonIds: [],
    });

    const noSessionsRes = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });
    expect(noSessionsRes.resolutionStatus).toBe('NO_SESSIONS_SCHEDULED');
    expect(noSessionsRes.primarySession).toBeNull();
    expect(noSessionsRes.sessions).toEqual([]);
    expect(noSessionsRes.activeEnrollmentCount).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 5. Unrelated student's restricted session (Server-Side Authorization)
  // --------------------------------------------------------------------------
  it('5. blocks an unrelated student from querying, joining, or streaming another cohort session or recording', async () => {
    // Unauthenticated GET /api/live -> 401
    const unauthReq = new Request('http://localhost:3000/api/live', { method: 'GET' });
    const unauthRes = await getLiveSessionsHandler(unauthReq);
    expect(unauthRes.status).toBe(401);

    // Unrelated student querying GET /api/live?batchId=btc-asp-nov26 -> 403
    const batchProbeReq = new Request('http://localhost:3000/api/live?batchId=btc-asp-nov26', {
      method: 'GET',
      headers: { Authorization: `Bearer ${unrelatedToken}` },
    });
    const batchProbeRes = await getLiveSessionsHandler(batchProbeReq);
    expect(batchProbeRes.status).toBe(403);

    // Unrelated student attempting POST /api/live/sess-asp-01/join -> 403
    const joinAttackReq = new Request('http://localhost:3000/api/live/sess-asp-01/join', {
      method: 'POST',
      headers: { Authorization: `Bearer ${unrelatedToken}` },
    });
    const joinAttackRes = await joinLiveSessionHandler(joinAttackReq, {
      params: { sessionId: 'sess-asp-01' },
    });
    expect(joinAttackRes.status).toBe(403);

    // Unrelated student attempting to fetch a recording for sess-asp-01 -> 403
    const rec: ClassRecording = {
      id: 'rec-restricted-01',
      sessionId: 'sess-asp-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      title: 'Restricted Cohort Replay',
      storageProvider: 'SUPABASE_STORAGE',
      storagePath: 'courses/crs-asp-01/rec-restricted-01.mp4',
      mediaUrl: 'https://cdn.zealosh.com/recordings/rec-restricted-01.mp4',
      durationSeconds: 3600,
      fileSizeBytes: 50_000_000,
      status: 'AVAILABLE',
      isDownloadable: false,
      availableFrom: '2026-10-01T00:00:00Z',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };
    await db.saveClassRecording(rec);

    const recAttackReq = new Request('http://localhost:3000/api/recordings/rec-restricted-01', {
      method: 'GET',
      headers: { Authorization: `Bearer ${unrelatedToken}` },
    });
    const recAttackRes = await getRecordingDetailHandler(recAttackReq, {
      params: { recordingId: 'rec-restricted-01' },
    });
    expect(recAttackRes.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // 6. Session belonging to a different course, batch, organization, or tenant
  // --------------------------------------------------------------------------
  it('6. enforces course, batch, enrollment status/expiry, and organization tenant boundaries', async () => {
    // Add a session in a different course/batch (crs-csp-02 / btc-csp-nov26)
    await db.saveLiveSession({
      id: 'sess-csp-other-cohort',
      batchId: 'btc-csp-nov26',
      courseId: 'crs-csp-02',
      title: 'CSP Cohort Exclusive Session',
      scheduledStartTime: '2026-11-02T10:00:00Z',
      durationMinutes: 120,
      instructorId: 'usr-inst-01',
      meetingId: 'mtg-csp-only',
      status: 'LIVE',
    });

    // Enrolled student (only in crs-asp-01 / btc-asp-nov26) must NOT see sess-csp-other-cohort
    const res = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });
    expect(res.sessions.some((s) => s.id === 'sess-csp-other-cohort')).toBe(false);
    expect(res.primarySession?.id).toBe('sess-asp-01');

    // Foreign tenant user even with an active enrollment record in memory is blocked
    db.enrollments.set('enr-foreign-tenant', {
      id: 'enr-foreign-tenant',
      userId: foreignTenantStudent.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      status: 'ACTIVE',
      enrolledAt: '2026-10-01T00:00:00Z',
      expiresAt: '2027-10-01T00:00:00Z',
      progressPercent: 0,
      completedLessonIds: [],
    });

    const foreignResolverRes = await resolveStudentLiveSessions(foreignTenantStudent.id, {
      now: fixedNow,
    });
    expect(foreignResolverRes.sessions).toHaveLength(0);
    expect(foreignResolverRes.primarySession).toBeNull();

    const foreignApiRes = await getLiveSessionsHandler(
      new Request('http://localhost:3000/api/live', {
        method: 'GET',
        headers: { Authorization: `Bearer ${foreignTenantToken}` },
      })
    );
    expect(foreignApiRes.status).toBe(403);

    const foreignJoinRes = await joinLiveSessionHandler(
      new Request('http://localhost:3000/api/live/sess-asp-01/join', {
        method: 'POST',
        headers: { Authorization: `Bearer ${foreignTenantToken}` },
      }),
      { params: { sessionId: 'sess-asp-01' } }
    );
    expect(foreignJoinRes.status).toBe(403);

    // Expired enrollment is rejected
    db.enrollments.set(activeEnrollment.id, {
      ...activeEnrollment,
      expiresAt: '2026-10-15T00:00:00Z', // expired before fixedNow (2026-11-01)
    });
    const expiredRes = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });
    expect(expiredRes.resolutionStatus).toBe('NO_ACTIVE_ENROLLMENTS');
    expect(expiredRes.sessions).toHaveLength(0);

    // Cancelled batch is rejected
    db.enrollments.set(activeEnrollment.id, { ...activeEnrollment });
    const batch = db.batches.get('btc-asp-nov26')!;
    db.batches.set('btc-asp-nov26', { ...batch, status: 'CANCELLED' });

    const cancelledBatchRes = await resolveStudentLiveSessions(enrolledStudent.id, {
      now: fixedNow,
    });
    expect(cancelledBatchRes.resolutionStatus).toBe('NO_ACTIVE_ENROLLMENTS');
    expect(cancelledBatchRes.sessions).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 7. Completed session with an available recording
  // --------------------------------------------------------------------------
  it('7. resolves a completed session with an AVAILABLE recording as playable and blocks live join on completed session', async () => {
    const completedSession: LiveSession = {
      id: 'sess-asp-01',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'ASP Live Workshop: Complex Rigging & Crane Load Charts',
      scheduledStartTime: '2026-10-20T13:30:00Z',
      durationMinutes: 120,
      instructorId: 'usr-inst-01',
      meetingId: 'zealosh-live-asp-001',
      status: 'RECORDING_READY',
    };
    await db.saveLiveSession(completedSession);

    const availableRec: ClassRecording = {
      id: 'rec-asp-01-playable',
      sessionId: 'sess-asp-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      title: 'Recorded Replay: Complex Rigging & Crane Load Charts',
      storageProvider: 'SUPABASE_STORAGE',
      storagePath: 'courses/crs-asp-01/rec-asp-01-playable.mp4',
      mediaUrl: 'https://cdn.zealosh.com/recordings/rec-asp-01-playable.mp4',
      durationSeconds: 7140,
      fileSizeBytes: 125_000_000,
      status: 'AVAILABLE',
      isDownloadable: true,
      availableFrom: '2026-10-20T16:00:00Z',
      createdAt: '2026-10-20T16:00:00Z',
      updatedAt: '2026-10-20T16:00:00Z',
    };
    await db.saveClassRecording(availableRec);

    const result = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });

    expect(result.resolutionStatus).toBe('COMPLETED_REPLAY_AVAILABLE');
    expect(result.primarySession?.id).toBe('sess-asp-01');
    expect(result.primarySession?.lifecycleState).toBe('COMPLETED');
    expect(result.primarySession?.canJoinLive).toBe(false);
    expect(result.primarySession?.replayState).toBe('AVAILABLE');
    expect(result.primarySession?.replay).toEqual({
      recordingId: 'rec-asp-01-playable',
      title: 'Recorded Replay: Complex Rigging & Crane Load Charts',
      durationSeconds: 7140,
      status: 'AVAILABLE',
      playbackUrl: '/recordings/rec-asp-01-playable',
      canDownload: true,
    });

    // Attempting to join a completed session via POST /api/live/[sessionId]/join returns 409 Conflict
    const joinEndedRes = await joinLiveSessionHandler(
      new Request('http://localhost:3000/api/live/sess-asp-01/join', {
        method: 'POST',
        headers: { Authorization: `Bearer ${enrolledToken}` },
      }),
      { params: { sessionId: 'sess-asp-01' } }
    );
    expect(joinEndedRes.status).toBe(409);
    const joinEndedBody = await joinEndedRes.json();
    expect(joinEndedBody.code).toBe('SESSION_ALREADY_ENDED');
  });

  // --------------------------------------------------------------------------
  // 8. Completed session with no recording
  // --------------------------------------------------------------------------
  it('8. does not equate session completion or RECORDING_READY status with replay availability when no ClassRecording exists', async () => {
    const completedNoRec: LiveSession = {
      id: 'sess-asp-01',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'ASP Live Workshop: Complex Rigging & Crane Load Charts',
      scheduledStartTime: '2026-10-20T13:30:00Z',
      durationMinutes: 120,
      instructorId: 'usr-inst-01',
      meetingId: 'zealosh-live-asp-001',
      status: 'RECORDING_READY',
      recordingUrl: 'https://stale-unverified-url.example/video.mp4',
    };
    await db.saveLiveSession(completedNoRec);

    const result = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });

    expect(result.resolutionStatus).toBe('COMPLETED_NO_RECORDING');
    expect(result.primarySession?.lifecycleState).toBe('COMPLETED');
    expect(result.primarySession?.canJoinLive).toBe(false);
    expect(result.primarySession?.replayState).toBe('NONE');
    expect(result.primarySession?.replay).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 9. Completed session with recording PROCESSING, ARCHIVED, REVOKED, or expired
  // --------------------------------------------------------------------------
  it('9. distinguishes PROCESSING, ARCHIVED, REVOKED, and expired recordings without marking them playable', async () => {
    await db.saveLiveSession({
      id: 'sess-asp-01',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'ASP Live Workshop: Complex Rigging & Crane Load Charts',
      scheduledStartTime: '2026-10-20T13:30:00Z',
      durationMinutes: 120,
      instructorId: 'usr-inst-01',
      meetingId: 'zealosh-live-asp-001',
      status: 'ENDED',
    });

    // Case 9A: PROCESSING recording
    const processingRec: ClassRecording = {
      id: 'rec-asp-processing',
      sessionId: 'sess-asp-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      title: 'Processing Replay',
      storageProvider: 'SUPABASE_STORAGE',
      storagePath: 'courses/crs-asp-01/rec-asp-processing.mp4',
      mediaUrl: 'https://cdn.zealosh.com/recordings/rec-asp-processing.mp4',
      durationSeconds: 7200,
      fileSizeBytes: 0,
      status: 'PROCESSING',
      isDownloadable: false,
      availableFrom: '2026-10-20T15:30:00Z',
      createdAt: '2026-10-20T15:30:00Z',
      updatedAt: '2026-10-20T15:30:00Z',
    };
    await db.saveClassRecording(processingRec);

    const procResult = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });
    expect(procResult.resolutionStatus).toBe('COMPLETED_REPLAY_PROCESSING');
    expect(procResult.primarySession?.replayState).toBe('PROCESSING');
    expect(procResult.primarySession?.replay?.playbackUrl).toBeNull();

    // Case 9B: REVOKED recording
    await db.saveClassRecording({ ...processingRec, status: 'REVOKED' });
    const revokedResult = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });
    expect(revokedResult.resolutionStatus).toBe('COMPLETED_REPLAY_UNAVAILABLE');
    expect(revokedResult.primarySession?.replayState).toBe('UNAVAILABLE');
    expect(revokedResult.primarySession?.replay).toBeNull();

    // Case 9C: ARCHIVED recording
    await db.saveClassRecording({ ...processingRec, status: 'ARCHIVED' });
    const archivedResult = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });
    expect(archivedResult.resolutionStatus).toBe('COMPLETED_REPLAY_UNAVAILABLE');
    expect(archivedResult.primarySession?.replayState).toBe('UNAVAILABLE');
    expect(archivedResult.primarySession?.replay).toBeNull();

    // Case 9D: AVAILABLE status but expired past expiresAt
    await db.saveClassRecording({
      ...processingRec,
      status: 'AVAILABLE',
      expiresAt: '2026-10-25T00:00:00Z', // before fixedNow (2026-11-01)
    });
    const expiredRecResult = await resolveStudentLiveSessions(enrolledStudent.id, {
      now: fixedNow,
    });
    expect(expiredRecResult.resolutionStatus).toBe('COMPLETED_REPLAY_UNAVAILABLE');
    expect(expiredRecResult.primarySession?.replayState).toBe('UNAVAILABLE');
    expect(expiredRecResult.primarySession?.replay).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 10. Missing relationships, stale identifiers, and malformed data
  // --------------------------------------------------------------------------
  it('10. safely filters out malformed sessions, mismatched course/batch links, and treats elapsed SCHEDULED sessions as COMPLETED', async () => {
    db.liveSessions.clear();

    // Malformed scheduledStartTime
    db.liveSessions.set('sess-bad-date', {
      id: 'sess-bad-date',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'Malformed Timestamp Class',
      scheduledStartTime: 'not-a-valid-date',
      durationMinutes: 120,
      instructorId: 'usr-inst-01',
      meetingId: 'mtg-bad-date',
      status: 'SCHEDULED',
    });

    // Invalid durationMinutes
    db.liveSessions.set('sess-bad-duration', {
      id: 'sess-bad-duration',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'Zero Duration Class',
      scheduledStartTime: '2026-11-10T10:00:00Z',
      durationMinutes: 0,
      instructorId: 'usr-inst-01',
      meetingId: 'mtg-bad-dur',
      status: 'SCHEDULED',
    });

    // Mismatched courseId vs batch.courseId
    db.liveSessions.set('sess-course-mismatch', {
      id: 'sess-course-mismatch',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-csp-02', // btc-asp-nov26 belongs to crs-asp-01
      title: 'Mismatched Course Session',
      scheduledStartTime: '2026-11-10T10:00:00Z',
      durationMinutes: 90,
      instructorId: 'usr-inst-01',
      meetingId: 'mtg-mismatch',
      status: 'LIVE',
    });

    // Stale SCHEDULED session whose window has already elapsed before fixedNow (2026-11-01)
    db.liveSessions.set('sess-stale-scheduled', {
      id: 'sess-stale-scheduled',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'Past Window Session Still Marked Scheduled',
      scheduledStartTime: '2026-10-10T10:00:00Z',
      durationMinutes: 60,
      instructorId: 'usr-nonexistent-faculty',
      meetingId: 'mtg-stale',
      status: 'SCHEDULED',
    });

    const result = await resolveStudentLiveSessions(enrolledStudent.id, { now: fixedNow });

    // Malformed and mismatched sessions are ignored; stale scheduled session resolves as COMPLETED with fallback faculty name
    expect(result.sessions).toHaveLength(1);
    expect(result.primarySession?.id).toBe('sess-stale-scheduled');
    expect(result.primarySession?.lifecycleState).toBe('COMPLETED');
    expect(result.primarySession?.canJoinLive).toBe(false);
    expect(result.primarySession?.instructorName).toBe('Zealosh Faculty');
    expect(result.resolutionStatus).toBe('COMPLETED_NO_RECORDING');

    // Student attempting to join an elapsed SCHEDULED session receives 409 SESSION_WINDOW_ELAPSED
    const joinStaleRes = await joinLiveSessionHandler(
      new Request('http://localhost:3000/api/live/sess-stale-scheduled/join', {
        method: 'POST',
        headers: { Authorization: `Bearer ${enrolledToken}` },
      }),
      { params: { sessionId: 'sess-stale-scheduled' } }
    );
    expect(joinStaleRes.status).toBe(409);
    const joinStaleBody = await joinStaleRes.json();
    expect(joinStaleBody.code).toBe('SESSION_WINDOW_ELAPSED');
  });

  // --------------------------------------------------------------------------
  // 11. Lookup or adapter failure handled safely without fallback to demo session
  // --------------------------------------------------------------------------
  it('11. returns a safe 500 error without leaking secrets or falling back to a demo session when store lookup fails', async () => {
    const originalGetEnrollments = db.getEnrollments.bind(db);
    (db as any).getEnrollments = async () => {
      throw new Error('INTERNAL_DB_SECRET_CONN_STRING=postgres://secret:pass@db.internal:5432');
    };

    try {
      const req = new Request('http://localhost:3000/api/live', {
        method: 'GET',
        headers: { Authorization: `Bearer ${enrolledToken}` },
      });
      const res = await getLiveSessionsHandler(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Unable to resolve live classroom sessions at this time');
      expect(JSON.stringify(body)).not.toContain('INTERNAL_DB_SECRET_CONN_STRING');
      expect(JSON.stringify(body)).not.toContain('sess-asp-01');
    } finally {
      (db as any).getEnrollments = originalGetEnrollments;
    }
  });

  // --------------------------------------------------------------------------
  // 12. Student page source verification: no hardcoded sess-asp-01 or BigBlueButton brand leak
  // --------------------------------------------------------------------------
  it('12. verifies src/app/student/page.tsx contains no hardcoded sess-asp-01 identifier, no BigBlueButton brand leak, and no polling interval', () => {
    const studentPagePath = path.join(process.cwd(), 'src', 'app', 'student', 'page.tsx');
    const source = fs.readFileSync(studentPagePath, 'utf-8');

    expect(source).not.toContain('sess-asp-01');
    expect(source).not.toContain('Live Workshop: ASP Math & Ventilation Problem-Solving');
    expect(source).not.toContain('BigBlueButton');
    expect(source).not.toContain('setInterval');
    expect(source).toContain("fetch('/api/live'");
  });
});
