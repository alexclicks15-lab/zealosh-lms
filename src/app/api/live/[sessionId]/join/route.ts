import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { classroomProvider, ClassroomProviderError } from '@/lib/classroom';
import {
  isActiveEnrollmentAt,
  isAuthorizedPlatformTenant,
} from '@/lib/store/live-session-resolver';

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/zealosh_token=([^;]+)/);
      if (match) token = match[1].trim();
    }

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
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

    let session = await db.getLiveSession(params.sessionId);
    if (!session) {
      session = await db.getLiveSessionByMeetingId(params.sessionId);
    }
    if (!session) {
      return NextResponse.json({ error: 'Live session not found' }, { status: 404 });
    }

    const [batch, course] = await Promise.all([
      db.getBatch(session.batchId),
      db.getCourseById(session.courseId),
    ]);

    if (!batch || !course || batch.courseId !== session.courseId) {
      return NextResponse.json(
        { error: 'Live session cohort relationship is invalid or unavailable' },
        { status: 404 }
      );
    }

    if (batch.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Forbidden: This cohort batch has been cancelled' },
        { status: 403 }
      );
    }

    const isModerator =
      user.role === 'INSTRUCTOR' || user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';

    if (user.role === 'INSTRUCTOR') {
      const isAssignedFaculty =
        batch.leadInstructorId === user.id ||
        course.leadInstructorId === user.id ||
        Boolean(course.coInstructorIds?.includes(user.id)) ||
        session.instructorId === user.id;

      if (!isAssignedFaculty) {
        return NextResponse.json(
          { error: 'Forbidden: You are not assigned as faculty for this cohort' },
          { status: 403 }
        );
      }
    } else if (!isModerator) {
      const nowMs = Date.now();
      const userEnrollments = await db.getEnrollments(user.id, session.batchId);
      const isEnrolled = userEnrollments.some(
        (e) => isActiveEnrollmentAt(e, nowMs) && e.courseId === session.courseId
      );

      if (!isEnrolled) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have an active enrollment in this batch' },
          { status: 403 }
        );
      }
    }

    // Lifecycle check: completed or terminating sessions cannot be joined as live rooms
    if (session.status === 'ENDED' || session.status === 'RECORDING_READY' || session.status === 'ENDING') {
      return NextResponse.json(
        {
          error: session.status === 'ENDING'
            ? 'This live session is currently ending.'
            : 'This live session has already concluded. Check replay availability for recorded playback.',
          code: session.status === 'ENDING' ? 'SESSION_TERMINATING' : 'SESSION_ALREADY_ENDED',
        },
        { status: 409 }
      );
    }

    if (!isModerator && session.status === 'SCHEDULED') {
      const startMs = Date.parse(session.scheduledStartTime);
      const durationMinutes =
        typeof session.durationMinutes === 'number' && session.durationMinutes > 0
          ? session.durationMinutes
          : 0;
      if (Number.isNaN(startMs) || durationMinutes <= 0 || startMs + durationMinutes * 60_000 <= Date.now()) {
        return NextResponse.json(
          {
            error: 'This scheduled live session window has already ended.',
            code: 'SESSION_WINDOW_ELAPSED',
          },
          { status: 409 }
        );
      }
    }

    // Provision or verify live classroom meeting via decoupled provider interface
    await classroomProvider.provisionSession({
      sessionId: session.id,
      sessionTitle: session.title,
      meetingId: session.meetingId,
      courseId: session.courseId,
      batchId: session.batchId,
      attendeePassword: 'student_pass',
      moderatorPassword: 'instructor_pass',
    });

    // Generate signed join URL via decoupled provider interface
    const joinUrl = await classroomProvider.generateJoinUrl({
      meetingId: session.meetingId,
      sessionId: session.id,
      fullName: user.name || payload.name,
      password: isModerator ? 'instructor_pass' : 'student_pass',
      userId: user.id,
      role: isModerator ? 'INSTRUCTOR' : 'STUDENT',
    });

    // If moderator is launching a scheduled session, transition status to LIVE
    if (isModerator && session.status === 'SCHEDULED') {
      session.status = 'LIVE';
      (session as any).startedAt = new Date().toISOString();
      await db.saveLiveSession(session);
    }

    // Record attendance entry
    await db.recordAttendance({
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sessionId: session.id,
      userId: user.id,
      joinedAt: new Date().toISOString(),
      durationMinutes: 0,
      attended: true,
    });

    await db.recordAudit({
      actorUserId: user.id,
      actorEmail: user.email || payload.email,
      actorRole: user.role,
      action: 'LIVE_SESSION_JOINED',
      entityType: 'LIVE_SESSION',
      entityId: session.id,
      details: { meetingId: session.meetingId, isModerator },
    });

    return NextResponse.json({
      success: true,
      joinUrl,
      meetingId: session.meetingId,
      sessionTitle: session.title,
      status: session.status,
      provider: 'CLASSROOM',
      session: {
        id: session.id,
        title: session.title,
        batchId: session.batchId,
        courseId: session.courseId,
        status: session.status,
      },
      isModerator,
    });
  } catch (err: any) {
    if (err instanceof ClassroomProviderError) {
      let friendlyMessage = err.message;
      if (err.code === 'PROVIDER_UNAVAILABLE') {
        friendlyMessage =
          'The live classroom service is temporarily unreachable. Please try again in a few moments.';
      } else if (err.code === 'CONFIG_MISSING') {
        friendlyMessage = 'The live classroom service is currently not configured.';
      }
      return NextResponse.json(
        { error: friendlyMessage, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'Unable to connect to the live classroom gateway right now' },
      { status: 500 }
    );
  }
}
