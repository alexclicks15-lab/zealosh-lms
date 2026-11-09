// Zealosh LMS — Course-Level Recording Discovery & Access Resolver
// Resolves authorized class recordings for a course in the learner experience
// Enforces server-side authentication, tenant isolation, course entitlement,
// cohort batch membership, cross-batch grants, batch cancellation, and lifecycle status.

import { db } from '@/lib/store/db';
import { recordingStorage } from '@/lib/storage/recording-storage';
import {
  isActiveEnrollmentAt,
  isAuthorizedPlatformTenant,
} from '@/lib/store/live-session-resolver';
import { ClassRecording, Course, Enrollment, LiveSession, User } from '@/types';

export type CourseEntitlementStatus =
  | 'ENROLLED'
  | 'NOT_ENROLLED'
  | 'ENROLLMENT_EXPIRED'
  | 'UNAUTHORIZED_TENANT'
  | 'STAFF_AUTHORIZED';

export type RecordingLifecycleState = 'READY' | 'PROCESSING' | 'UNAVAILABLE';

export interface ResolvedCourseRecording {
  id: string;
  sessionId: string;
  sessionTitle: string;
  courseId: string;
  courseTitle: string;
  batchId: string;
  batchName: string;
  title: string;
  description?: string;
  durationSeconds: number;
  status: ClassRecording['status'];
  lifecycleState: RecordingLifecycleState;
  canPlay: boolean;
  playbackUrl: string | null;
  canDownload: boolean;
  isCrossBatchGrant: boolean;
  availableFrom: string;
  createdAt: string;
}

export interface CourseRecordingsResolutionResult {
  success: boolean;
  courseId: string;
  courseTitle: string;
  entitlementStatus: CourseEntitlementStatus;
  recordings: ResolvedCourseRecording[];
  count: number;
  error?: string;
  statusCode?: number;
}

function getLifecycleOrder(state: RecordingLifecycleState): number {
  switch (state) {
    case 'READY':
      return 0;
    case 'PROCESSING':
      return 1;
    case 'UNAVAILABLE':
      return 2;
  }
}

export async function resolveCourseRecordings(
  userId: string,
  courseIdOrSlug: string,
  options?: {
    now?: Date;
    tokenOrganizationId?: string;
  }
): Promise<CourseRecordingsResolutionResult> {
  const now =
    options?.now instanceof Date && !Number.isNaN(options.now.getTime())
      ? options.now
      : new Date();
  const nowMs = now.getTime();

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return {
      success: false,
      courseId: '',
      courseTitle: '',
      entitlementStatus: 'NOT_ENROLLED',
      recordings: [],
      count: 0,
      error: 'Authentication required',
      statusCode: 401,
    };
  }

  if (!courseIdOrSlug || typeof courseIdOrSlug !== 'string' || !courseIdOrSlug.trim()) {
    return {
      success: false,
      courseId: '',
      courseTitle: '',
      entitlementStatus: 'NOT_ENROLLED',
      recordings: [],
      count: 0,
      error: 'Course identifier is required',
      statusCode: 400,
    };
  }

  const user = await db.getUser(userId);
  if (!user) {
    return {
      success: false,
      courseId: '',
      courseTitle: '',
      entitlementStatus: 'NOT_ENROLLED',
      recordings: [],
      count: 0,
      error: 'User not found',
      statusCode: 401,
    };
  }

  // Tenant Boundary Isolation
  const effectiveOrgId = options?.tokenOrganizationId || user.organizationId;
  if (!isAuthorizedPlatformTenant(effectiveOrgId)) {
    return {
      success: false,
      courseId: '',
      courseTitle: '',
      entitlementStatus: 'UNAUTHORIZED_TENANT',
      recordings: [],
      count: 0,
      error: 'Forbidden: Unauthorized tenant organization',
      statusCode: 403,
    };
  }

  // Resolve Course by Slug or Canonical ID
  let course = await db.getCourseBySlug(courseIdOrSlug);
  if (!course) {
    course = await db.getCourseById(courseIdOrSlug);
  }

  if (!course) {
    return {
      success: false,
      courseId: courseIdOrSlug,
      courseTitle: '',
      entitlementStatus: 'NOT_ENROLLED',
      recordings: [],
      count: 0,
      error: 'Course not found',
      statusCode: 404,
    };
  }

  // Check Staff Authorization
  const isSuperOrOrgAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';
  const isCourseInstructor =
    user.role === 'INSTRUCTOR' &&
    (course.leadInstructorId === user.id || course.coInstructorIds?.includes(user.id));
  const hasStaffAccess = isSuperOrOrgAdmin || isCourseInstructor;

  // Retrieve user enrollments
  const allUserEnrollments = await db.getUserEnrollments(user.id);
  const activeEnrollments = allUserEnrollments.filter((e) => isActiveEnrollmentAt(e, nowMs));

  // Determine course-level entitlement
  const activeCourseEnrollment = activeEnrollments.find(
    (e) => e.courseId === course!.id
  );
  const expiredCourseEnrollment = allUserEnrollments.find(
    (e) =>
      e.courseId === course!.id &&
      (e.status !== 'ACTIVE' || (e.expiresAt && new Date(e.expiresAt).getTime() <= nowMs))
  );

  // Retrieve candidate recordings belonging to this course
  const rawRecordings = await db.getClassRecordings({ courseId: course.id });

  // In-memory caches for batch and session lookups
  const batchCache = new Map<string, any>();
  const getBatch = async (batchId: string) => {
    if (!batchId) return null;
    if (batchCache.has(batchId)) return batchCache.get(batchId);
    const b = await db.getBatch(batchId);
    batchCache.set(batchId, b);
    return b;
  };

  const sessionCache = new Map<string, LiveSession | null>();
  const getSession = async (sessionId: string) => {
    if (!sessionId) return null;
    if (sessionCache.has(sessionId)) return sessionCache.get(sessionId)!;
    const s = await db.getLiveSession(sessionId);
    sessionCache.set(sessionId, s || null);
    return s || null;
  };

  const resolvedList: ResolvedCourseRecording[] = [];
  let userHasAuthorizedGrant = false;

  for (const rec of rawRecordings) {
    // Relationship Integrity: Recording must be explicitly linked to this course
    if (rec.courseId !== course.id) {
      continue;
    }

    const recBatch = await getBatch(rec.batchId);
    const recSession = rec.sessionId ? await getSession(rec.sessionId) : null;
    const batchName = recBatch?.name || (rec.batchId ? `Batch ${rec.batchId}` : 'Cohort Batch');
    const sessionTitle = recSession?.title || rec.title;

    // Check Batch Cancellation State
    if (!hasStaffAccess && recBatch?.status === 'CANCELLED') {
      // Cancelled batches do not confer recording access to learners
      continue;
    }

    let isAuthorized = false;
    let isCrossBatchGrant = false;
    let grantAllowDownload = false;

    if (hasStaffAccess) {
      isAuthorized = true;
    } else {
      // 1. Check direct active cohort batch enrollment
      const directEnrollment = activeEnrollments.find(
        (e) => e.batchId === rec.batchId && (!e.courseId || e.courseId === course!.id)
      );

      if (directEnrollment) {
        isAuthorized = true;
      } else {
        // 2. Check active cross-batch grants
        const batchGrants = await db.getRecordingBatchAccess(rec.id);
        const validGrant = batchGrants.find((grant) => {
          if (grant.status !== 'ACTIVE') return false;
          if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= nowMs) return false;
          return activeEnrollments.some((e) => e.batchId === grant.targetBatchId);
        });

        if (validGrant) {
          isAuthorized = true;
          isCrossBatchGrant = true;
          grantAllowDownload = Boolean(validGrant.allowDownload);
          userHasAuthorizedGrant = true;
        }
      }
    }

    if (!isAuthorized) {
      // Learner has neither direct cohort enrollment nor an active cross-batch grant
      continue;
    }

    // Determine Lifecycle State & Playability
    let lifecycleState: RecordingLifecycleState;
    let canPlay = false;
    let playbackUrl: string | null = null;
    let canDownload = false;

    if (rec.status === 'AVAILABLE') {
      const availFromMs = rec.availableFrom ? Date.parse(rec.availableFrom) : 0;
      const expiresMs = rec.expiresAt ? Date.parse(rec.expiresAt) : null;
      const isWindowValid =
        !Number.isNaN(availFromMs) &&
        availFromMs <= nowMs &&
        (expiresMs === null || (!Number.isNaN(expiresMs) && expiresMs > nowMs));

      if (isWindowValid) {
        lifecycleState = 'READY';
        canPlay = true;
        playbackUrl = `/recordings/${rec.id}`;
        canDownload = hasStaffAccess
          ? true
          : isCrossBatchGrant
          ? grantAllowDownload
          : Boolean(rec.isDownloadable ?? rec.allowDownload);
      } else {
        // Available status but time window not yet open or expired
        lifecycleState = 'UNAVAILABLE';
        canPlay = false;
        playbackUrl = null;
        canDownload = false;
      }
    } else if (rec.status === 'PROCESSING') {
      lifecycleState = 'PROCESSING';
      canPlay = false;
      playbackUrl = null;
      canDownload = false;
    } else {
      // ARCHIVED or REVOKED
      lifecycleState = 'UNAVAILABLE';
      canPlay = false;
      playbackUrl = null;
      canDownload = false;
    }

    resolvedList.push({
      id: rec.id,
      sessionId: rec.sessionId,
      sessionTitle,
      courseId: course.id,
      courseTitle: course.title,
      batchId: rec.batchId,
      batchName,
      title: rec.title,
      description: rec.description,
      durationSeconds: rec.durationSeconds || 0,
      status: rec.status,
      lifecycleState,
      canPlay,
      playbackUrl,
      canDownload,
      isCrossBatchGrant,
      availableFrom: rec.availableFrom || rec.createdAt,
      createdAt: rec.createdAt,
    });
  }

  // Determine Overall Entitlement Status
  let entitlementStatus: CourseEntitlementStatus;
  if (hasStaffAccess) {
    entitlementStatus = 'STAFF_AUTHORIZED';
  } else if (activeCourseEnrollment || userHasAuthorizedGrant) {
    entitlementStatus = 'ENROLLED';
  } else if (expiredCourseEnrollment) {
    entitlementStatus = 'ENROLLMENT_EXPIRED';
  } else {
    entitlementStatus = 'NOT_ENROLLED';
  }

  // If learner is not enrolled in the course and holds no authorized grant, return empty recordings
  if (entitlementStatus === 'NOT_ENROLLED' || entitlementStatus === 'ENROLLMENT_EXPIRED') {
    return {
      success: true,
      courseId: course.id,
      courseTitle: course.title,
      entitlementStatus,
      recordings: [],
      count: 0,
    };
  }

  // Deterministic Sorting:
  // 1. Lifecycle order: READY (0) -> PROCESSING (1) -> UNAVAILABLE (2)
  // 2. Within same lifecycle: most recent first (descending by createdAt or availableFrom)
  // 3. Tie-breaker: recording ID ascending
  resolvedList.sort((a, b) => {
    const lifeDiff = getLifecycleOrder(a.lifecycleState) - getLifecycleOrder(b.lifecycleState);
    if (lifeDiff !== 0) return lifeDiff;

    const timeA = Date.parse(a.availableFrom || a.createdAt) || 0;
    const timeB = Date.parse(b.availableFrom || b.createdAt) || 0;
    if (timeA !== timeB) return timeB - timeA;

    return a.id.localeCompare(b.id);
  });

  return {
    success: true,
    courseId: course.id,
    courseTitle: course.title,
    entitlementStatus,
    recordings: resolvedList,
    count: resolvedList.length,
  };
}

