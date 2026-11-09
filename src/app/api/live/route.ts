import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import {
  isActiveEnrollmentAt,
  isAuthorizedPlatformTenant,
  resolveStudentLiveSessions,
} from '@/lib/store/live-session-resolver';
import { LiveSession } from '@/types';

function extractAuthToken(request: Request): string | undefined {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/zealosh_token=([^;]+)/);
  return match ? match[1].trim() : undefined;
}

export async function GET(request: Request) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired authentication session' }, { status: 401 });
    }

    const user = await db.getUser(payload.userId);
    if (!user) {
      return NextResponse.json({ error: 'Authenticated user record not found' }, { status: 401 });
    }

    const tokenOrgId = (payload as { organizationId?: string }).organizationId;
    if (
      !isAuthorizedPlatformTenant(user.organizationId) ||
      !isAuthorizedPlatformTenant(tokenOrgId) ||
      (tokenOrgId && user.organizationId && tokenOrgId !== user.organizationId)
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Organization tenant boundary violation' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const batchIdParam = searchParams.get('batchId')?.trim() || undefined;

    if (user.role === 'STUDENT') {
      if (batchIdParam) {
        const nowMs = Date.now();
        const batch = await db.getBatch(batchIdParam);
        const enrollments = await db.getEnrollments(user.id, batchIdParam);
        const hasValidBatchEnrollment =
          Boolean(batch) &&
          batch!.status !== 'CANCELLED' &&
          enrollments.some(
            (e) => isActiveEnrollmentAt(e, nowMs) && e.courseId === batch!.courseId
          );

        if (!hasValidBatchEnrollment) {
          return NextResponse.json(
            { error: 'Forbidden: You do not have an active enrollment in this cohort batch' },
            { status: 403 }
          );
        }
      }

      const resolution = await resolveStudentLiveSessions(user.id, {
        batchId: batchIdParam,
        tokenOrganizationId: tokenOrgId,
      });

      return NextResponse.json({
        success: true,
        ...resolution,
      });
    }

    // Staff roles: INSTRUCTOR, SUPER_ADMIN, ORG_ADMIN
    if (user.role !== 'INSTRUCTOR' && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions' }, { status: 403 });
    }

    if (batchIdParam) {
      const batch = await db.getBatch(batchIdParam);
      if (!batch) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
      }
      if (user.role === 'INSTRUCTOR') {
        const course = await db.getCourseById(batch.courseId);
        const isAssigned =
          batch.leadInstructorId === user.id ||
          course?.leadInstructorId === user.id ||
          Boolean(course?.coInstructorIds?.includes(user.id));
        if (!isAssigned) {
          return NextResponse.json(
            { error: 'Forbidden: You are not assigned to this cohort batch' },
            { status: 403 }
          );
        }
      }
      const sessions = await db.getLiveSessions(batchIdParam);
      return NextResponse.json({ success: true, sessions });
    }

    // Staff query without batchId: return sessions across authorized batches
    const allBatches = await db.getBatches();
    const sessions: LiveSession[] = [];
    for (const batch of allBatches) {
      if (user.role === 'INSTRUCTOR') {
        const course = await db.getCourseById(batch.courseId);
        const isAssigned =
          batch.leadInstructorId === user.id ||
          course?.leadInstructorId === user.id ||
          Boolean(course?.coInstructorIds?.includes(user.id));
        if (!isAssigned) continue;
      }
      const batchSessions = await db.getLiveSessions(batch.id);
      sessions.push(...batchSessions);
    }

    return NextResponse.json({ success: true, sessions });
  } catch {
    return NextResponse.json(
      { error: 'Unable to resolve live classroom sessions at this time' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== 'INSTRUCTOR' && payload.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Instructor or Admin privileges required' }, { status: 403 });
    }

    const body = await request.json();
    const { session, recurringRule, count } = body;

    // Handle recurring schedule creation
    if (recurringRule && session?.batchId) {
      const scheduledSessions = await db.scheduleRecurringLiveSessions(
        session.batchId,
        recurringRule,
        count || 4,
        payload.email
      );
      return NextResponse.json({ success: true, sessions: scheduledSessions });
    }

    if (!session || !session.batchId || !session.title || !session.scheduledStartTime) {
      return NextResponse.json(
        { error: 'Missing session fields: batchId, title, scheduledStartTime' },
        { status: 400 }
      );
    }

    const batch = await db.getBatch(session.batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const sessionId = session.id || `sess-${batch.id}-${Date.now().toString(36)}`;
    const newSession: LiveSession = {
      id: sessionId,
      batchId: batch.id,
      courseId: batch.courseId,
      title: session.title,
      scheduledStartTime: session.scheduledStartTime,
      durationMinutes: session.durationMinutes || 120,
      instructorId: session.instructorId || payload.userId,
      meetingId: session.meetingId || `zealosh-${batch.id}-${Date.now().toString(36)}`,
      status: session.status || 'SCHEDULED',
    };

    const saved = await db.saveLiveSession(newSession);
    return NextResponse.json({ success: true, session: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create live session' }, { status: 500 });
  }
}
