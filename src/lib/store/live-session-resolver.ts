// Zealosh LMS — Dynamic Student Live-Session & Replay Resolver
// Resolves eligible live classes, completed sessions, and authorized recording replays
// from authoritative user, enrollment, course, batch, liveSession, and classRecording state.

import { db } from '@/lib/store/db';
import { recordingStorage } from '@/lib/storage/recording-storage';
import { classroomProvider } from '@/lib/classroom';
import { Batch, ClassRecording, Course, Enrollment, LiveSession, User } from '@/types';

export type ResolvedSessionLifecycle = 'LIVE' | 'UPCOMING' | 'COMPLETED';

export type ResolvedReplayState =
  | 'NOT_APPLICABLE'
  | 'AVAILABLE'
  | 'PROCESSING'
  | 'UNAVAILABLE'
  | 'NONE';

export type StudentSessionResolutionStatus =
  | 'LIVE_NOW'
  | 'UPCOMING_SCHEDULED'
  | 'COMPLETED_REPLAY_AVAILABLE'
  | 'COMPLETED_REPLAY_PROCESSING'
  | 'COMPLETED_REPLAY_UNAVAILABLE'
  | 'COMPLETED_NO_RECORDING'
  | 'NO_ACTIVE_ENROLLMENTS'
  | 'NO_SESSIONS_SCHEDULED';

export interface ResolvedReplaySummary {
  recordingId: string;
  title: string;
  durationSeconds: number;
  status: ClassRecording['status'];
  playbackUrl: string | null;
  canDownload: boolean;
}

export interface ResolvedStudentLiveSession {
  id: string;
  batchId: string;
  batchName: string;
  courseId: string;
  courseTitle: string;
  certificationType: Course['certificationType'];
  title: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  durationMinutes: number;
  instructorId: string;
  instructorName: string;
  status: LiveSession['status'];
  lifecycleState: ResolvedSessionLifecycle;
  canJoinLive: boolean;
  replayState: ResolvedReplayState;
  replay: ResolvedReplaySummary | null;
}

export interface StudentLiveSessionResolutionResult {
  resolutionStatus: StudentSessionResolutionStatus;
  primarySession: ResolvedStudentLiveSession | null;
  sessions: ResolvedStudentLiveSession[];
  activeEnrollmentCount: number;
}

const VALID_SESSION_STATUSES = new Set<LiveSession['status']>([
  'SCHEDULED',
  'LIVE',
  'ENDING',
  'ENDED',
  'RECORDING_READY',
]);

const VALID_RECORDING_STATUSES = new Set<ClassRecording['status']>([
  'PROCESSING',
  'AVAILABLE',
  'ARCHIVED',
  'REVOKED',
]);

const ALLOWED_PLATFORM_ORGANIZATIONS = new Set<string>([
  'org-zealosh-main',
  'org-zealosh',
]);

export function isAuthorizedPlatformTenant(organizationId?: string | null): boolean {
  if (!organizationId) return true;
  return ALLOWED_PLATFORM_ORGANIZATIONS.has(organizationId.trim());
}

export function isActiveEnrollmentAt(enrollment: Enrollment | undefined | null, nowMs: number): boolean {
  if (!enrollment || typeof enrollment !== 'object') return false;
  if (!enrollment.id || !enrollment.userId || !enrollment.courseId || !enrollment.batchId) return false;
  if (enrollment.status !== 'ACTIVE') return false;
  if (enrollment.expiresAt) {
    const expiresMs = Date.parse(enrollment.expiresAt);
    if (Number.isNaN(expiresMs) || expiresMs <= nowMs) {
      return false;
    }
  }
  return true;
}

function getLifecyclePriority(state: ResolvedSessionLifecycle): number {
  switch (state) {
    case 'LIVE':
      return 0;
    case 'UPCOMING':
      return 1;
    case 'COMPLETED':
      return 2;
  }
}

function getRecordingPriority(status: ClassRecording['status']): number {
  switch (status) {
    case 'AVAILABLE':
      return 0;
    case 'PROCESSING':
      return 1;
    case 'ARCHIVED':
      return 2;
    case 'REVOKED':
      return 3;
    default:
      return 4;
  }
}

export async function resolveStudentLiveSessions(
  userId: string,
  options?: {
    batchId?: string;
    now?: Date;
    tokenOrganizationId?: string;
  }
): Promise<StudentLiveSessionResolutionResult> {
  const now = options?.now instanceof Date && !Number.isNaN(options.now.getTime()) ? options.now : new Date();
  const nowMs = now.getTime();

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return {
      resolutionStatus: 'NO_ACTIVE_ENROLLMENTS',
      primarySession: null,
      sessions: [],
      activeEnrollmentCount: 0,
    };
  }

  const user = await db.getUser(userId);
  if (!user || user.role !== 'STUDENT') {
    if (!user) {
      return {
        resolutionStatus: 'NO_ACTIVE_ENROLLMENTS',
        primarySession: null,
        sessions: [],
        activeEnrollmentCount: 0,
      };
    }
  }

  // Verify tenant / organization isolation
  if (
    !isAuthorizedPlatformTenant(user.organizationId) ||
    (options?.tokenOrganizationId &&
      user.organizationId &&
      options.tokenOrganizationId !== user.organizationId)
  ) {
    return {
      resolutionStatus: 'NO_ACTIVE_ENROLLMENTS',
      primarySession: null,
      sessions: [],
      activeEnrollmentCount: 0,
    };
  }

  const rawEnrollments = await db.getEnrollments(user.id);
  const candidateEnrollments = Array.isArray(rawEnrollments)
    ? rawEnrollments.filter((e) => {
        if (!isActiveEnrollmentAt(e, nowMs)) return false;
        if (options?.batchId && e.batchId !== options.batchId) return false;
        return true;
      })
    : [];

  // Validate batch & course relationships for each active enrollment
  const eligibleContexts = new Map<string, { batch: Batch; course: Course; directEnrollment: boolean }>();

  for (const enr of candidateEnrollments) {
    const [batch, course] = await Promise.all([
      db.getBatch(enr.batchId),
      db.getCourseById(enr.courseId),
    ]);
    if (!batch || !course) continue;
    if (batch.status === 'CANCELLED') continue;
    if (batch.courseId !== course.id || enr.courseId !== course.id) continue;
    if (course.status && course.status !== 'PUBLISHED') continue;

    eligibleContexts.set(batch.id, { batch, course, directEnrollment: true });
  }

  const activeEnrollmentCount = eligibleContexts.size;
  if (activeEnrollmentCount === 0) {
    return {
      resolutionStatus: 'NO_ACTIVE_ENROLLMENTS',
      primarySession: null,
      sessions: [],
      activeEnrollmentCount: 0,
    };
  }

  // Collect candidate live sessions from directly enrolled batches
  const candidateSessions = new Map<
    string,
    { session: LiveSession; batch: Batch; course: Course; directEnrollment: boolean }
  >();

  for (const [batchId, ctx] of eligibleContexts.entries()) {
    const batchSessions = await db.getLiveSessions(batchId);
    if (!Array.isArray(batchSessions)) continue;
    for (const session of batchSessions) {
      if (!session || typeof session.id !== 'string' || !session.id.trim()) continue;
      if (session.batchId !== batchId) continue;
      if (session.courseId !== ctx.course.id) continue;
      candidateSessions.set(session.id, {
        session,
        batch: ctx.batch,
        course: ctx.course,
        directEnrollment: true,
      });
    }
  }

  // Also check active cross-batch recording grants targeting any of the student's active batches
  if (!options?.batchId) {
    const allGrants = await db.getRecordingBatchAccess();
    if (Array.isArray(allGrants)) {
      for (const grant of allGrants) {
        if (!grant || grant.status !== 'ACTIVE') continue;
        if (grant.expiresAt) {
          const grantExpMs = Date.parse(grant.expiresAt);
          if (Number.isNaN(grantExpMs) || grantExpMs <= nowMs) continue;
        }
        const targetCtx = eligibleContexts.get(grant.targetBatchId);
        if (!targetCtx) continue;

        const rec = await db.getClassRecording(grant.recordingId);
        if (!rec || !rec.sessionId) continue;
        if (candidateSessions.has(rec.sessionId)) continue;

        const grantedSession = await db.getLiveSession(rec.sessionId);
        if (!grantedSession || grantedSession.courseId !== rec.courseId) continue;
        if (grantedSession.status !== 'ENDED' && grantedSession.status !== 'RECORDING_READY') continue;

        const [sourceBatch, sourceCourse] = await Promise.all([
          db.getBatch(grantedSession.batchId),
          db.getCourseById(grantedSession.courseId),
        ]);
        if (
          !sourceBatch ||
          !sourceCourse ||
          sourceBatch.status === 'CANCELLED' ||
          sourceBatch.courseId !== sourceCourse.id
        ) {
          continue;
        }

        candidateSessions.set(grantedSession.id, {
          session: grantedSession,
          batch: sourceBatch,
          course: sourceCourse,
          directEnrollment: false,
        });
      }
    }
  }

  // Cache instructor lookups to avoid duplicate queries
  const instructorCache = new Map<string, User | undefined>();
  const getInstructor = async (instructorId: string): Promise<User | undefined> => {
    if (!instructorId) return undefined;
    if (instructorCache.has(instructorId)) return instructorCache.get(instructorId);
    const inst = await db.getUser(instructorId);
    instructorCache.set(instructorId, inst);
    return inst;
  };

  const resolvedSessions: ResolvedStudentLiveSession[] = [];

  for (const { session, batch, course, directEnrollment } of candidateSessions.values()) {
    // Validate required fields & timestamps
    if (
      typeof session.title !== 'string' ||
      !session.title.trim() ||
      typeof session.scheduledStartTime !== 'string' ||
      !VALID_SESSION_STATUSES.has(session.status)
    ) {
      continue;
    }

    const startMs = Date.parse(session.scheduledStartTime);
    if (Number.isNaN(startMs)) continue;

    const durationMinutes =
      typeof session.durationMinutes === 'number' &&
      Number.isFinite(session.durationMinutes) &&
      session.durationMinutes > 0
        ? session.durationMinutes
        : 0;
    if (durationMinutes <= 0) continue;

    const endMs = startMs + durationMinutes * 60_000;
    const scheduledEndTime = new Date(endMs).toISOString();

    const instructor = await getInstructor(session.instructorId);
    if (instructor?.organizationId && !isAuthorizedPlatformTenant(instructor.organizationId)) {
      continue;
    }
    const instructorName = instructor?.name || 'Zealosh Faculty';

    // Determine lifecycle state using authoritative status and scheduled window
    let lifecycleState: ResolvedSessionLifecycle;
    if (session.status === 'LIVE') {
      lifecycleState = 'LIVE';
    } else if (session.status === 'SCHEDULED') {
      lifecycleState = endMs > nowMs ? 'UPCOMING' : 'COMPLETED';
    } else {
      lifecycleState = 'COMPLETED';
    }

    // Cross-batch grants only permit replay of completed sessions, never live classroom join
    if (!directEnrollment && lifecycleState !== 'COMPLETED') {
      continue;
    }

    const canJoinLive = directEnrollment && (lifecycleState === 'LIVE' || lifecycleState === 'UPCOMING');

    // Resolve replay state for completed sessions
    let replayState: ResolvedReplayState = 'NOT_APPLICABLE';
    let replay: ResolvedReplaySummary | null = null;

    if (lifecycleState === 'COMPLETED') {
      const rawRecordings = await db.getClassRecordings({ sessionId: session.id });
      const validRecordings = Array.isArray(rawRecordings)
        ? rawRecordings.filter(
            (r) =>
              r &&
              typeof r.id === 'string' &&
              r.id.trim() !== '' &&
              r.sessionId === session.id &&
              r.courseId === session.courseId &&
              r.batchId === session.batchId &&
              VALID_RECORDING_STATUSES.has(r.status)
          )
        : [];

      if (validRecordings.length === 0) {
        replayState = 'NONE';
        replay = null;
      } else {
        const sortedRecordings = [...validRecordings].sort((a, b) => {
          const prioDiff = getRecordingPriority(a.status) - getRecordingPriority(b.status);
          if (prioDiff !== 0) return prioDiff;
          const timeA = Date.parse(a.createdAt || a.availableFrom || '') || 0;
          const timeB = Date.parse(b.createdAt || b.availableFrom || '') || 0;
          if (timeA !== timeB) return timeB - timeA;
          return a.id.localeCompare(b.id);
        });

        let matchedAvailable: { rec: ClassRecording; canDownload: boolean } | null = null;
        let matchedProcessing: ClassRecording | null = null;

        for (const rec of sortedRecordings) {
          if (rec.status === 'AVAILABLE') {
            const availFromMs = rec.availableFrom ? Date.parse(rec.availableFrom) : 0;
            const expiresMs = rec.expiresAt ? Date.parse(rec.expiresAt) : null;
            const windowValid =
              !Number.isNaN(availFromMs) &&
              availFromMs <= nowMs &&
              (expiresMs === null || (!Number.isNaN(expiresMs) && expiresMs > nowMs));

            if (windowValid) {
              const access = await recordingStorage.verifyAccess(
                rec.id,
                { userId: user.id, id: user.id, role: user.role, email: user.email },
                'stream'
              );
              if (access.allowed) {
                matchedAvailable = { rec, canDownload: Boolean(access.canDownload) };
                break;
              }
            }
          } else if (rec.status === 'PROCESSING' && !matchedProcessing && directEnrollment) {
            matchedProcessing = rec;
          }
        }

        if (matchedAvailable) {
          replayState = 'AVAILABLE';
          replay = {
            recordingId: matchedAvailable.rec.id,
            title: matchedAvailable.rec.title || session.title,
            durationSeconds:
              typeof matchedAvailable.rec.durationSeconds === 'number' &&
              matchedAvailable.rec.durationSeconds > 0
                ? matchedAvailable.rec.durationSeconds
                : durationMinutes * 60,
            status: 'AVAILABLE',
            playbackUrl: `/recordings/${matchedAvailable.rec.id}`,
            canDownload: matchedAvailable.canDownload,
          };
        } else if (matchedProcessing) {
          replayState = 'PROCESSING';
          replay = {
            recordingId: matchedProcessing.id,
            title: matchedProcessing.title || session.title,
            durationSeconds:
              typeof matchedProcessing.durationSeconds === 'number' &&
              matchedProcessing.durationSeconds > 0
                ? matchedProcessing.durationSeconds
                : durationMinutes * 60,
            status: 'PROCESSING',
            playbackUrl: null,
            canDownload: false,
          };
        } else {
          replayState = 'UNAVAILABLE';
          replay = null;
        }
      }
    }

    resolvedSessions.push({
      id: session.id,
      batchId: batch.id,
      batchName: batch.name,
      courseId: course.id,
      courseTitle: course.title,
      certificationType: course.certificationType,
      title: session.title,
      scheduledStartTime: session.scheduledStartTime,
      scheduledEndTime,
      durationMinutes,
      instructorId: session.instructorId,
      instructorName,
      status: session.status,
      lifecycleState,
      canJoinLive,
      replayState,
      replay,
    });
  }

  // Deterministic ordering:
  // 1. LIVE sessions first (ascending by scheduledStartTime, then id)
  // 2. UPCOMING sessions next (ascending by scheduledStartTime, then id)
  // 3. COMPLETED sessions last (descending by scheduledStartTime, then replay availability, then id)
  resolvedSessions.sort((a, b) => {
    const prioDiff = getLifecyclePriority(a.lifecycleState) - getLifecyclePriority(b.lifecycleState);
    if (prioDiff !== 0) return prioDiff;

    const startA = Date.parse(a.scheduledStartTime);
    const startB = Date.parse(b.scheduledStartTime);

    if (a.lifecycleState === 'LIVE' || a.lifecycleState === 'UPCOMING') {
      if (startA !== startB) return startA - startB;
      return a.id.localeCompare(b.id);
    }

    // Both COMPLETED: most recent completed session first
    if (startA !== startB) return startB - startA;
    return a.id.localeCompare(b.id);
  });

  const primarySession = resolvedSessions[0] ?? null;

  let resolutionStatus: StudentSessionResolutionStatus;
  if (!primarySession) {
    resolutionStatus = 'NO_SESSIONS_SCHEDULED';
  } else if (primarySession.lifecycleState === 'LIVE') {
    resolutionStatus = 'LIVE_NOW';
  } else if (primarySession.lifecycleState === 'UPCOMING') {
    resolutionStatus = 'UPCOMING_SCHEDULED';
  } else {
    switch (primarySession.replayState) {
      case 'AVAILABLE':
        resolutionStatus = 'COMPLETED_REPLAY_AVAILABLE';
        break;
      case 'PROCESSING':
        resolutionStatus = 'COMPLETED_REPLAY_PROCESSING';
        break;
      case 'UNAVAILABLE':
        resolutionStatus = 'COMPLETED_REPLAY_UNAVAILABLE';
        break;
      default:
        resolutionStatus = 'COMPLETED_NO_RECORDING';
        break;
    }
  }

  return {
    resolutionStatus,
    primarySession,
    sessions: resolvedSessions,
    activeEnrollmentCount,
  };
}

/**
 * Reconciles a session that was left in an intermediate 'ENDING' state.
 * Queries provider status and finalizes to 'ENDED' only if meeting is confirmed not running.
 */
export async function reconcileSessionTermination(sessionId: string): Promise<LiveSession | null> {
  const session = await db.getLiveSession(sessionId);
  if (!session || session.status !== 'ENDING') {
    return session || null;
  }

  if (session.meetingId && classroomProvider.getSessionStatus) {
    try {
      const statusRes = await classroomProvider.getSessionStatus(session.meetingId);
      if (!statusRes.isRunning || statusRes.hasEnded) {
        session.status = 'ENDED';
        (session as any).endedAt = new Date().toISOString();
        (session as any).endTime = new Date().toISOString();
        await db.saveLiveSession(session);
      }
    } catch {
      // Retain ENDING state if provider status remains unreachable
    }
  }

  return session;
}
