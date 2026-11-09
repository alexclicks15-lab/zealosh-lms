import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { isAuthorizedPlatformTenant } from '@/lib/store/live-session-resolver';
import { classroomProvider, ClassroomProviderError } from '@/lib/classroom';
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

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
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

    const isModerator =
      user.role === 'INSTRUCTOR' || user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';

    if (!isModerator) {
      return NextResponse.json(
        { error: 'Forbidden: Only faculty or administrators can end a live classroom session' },
        { status: 403 }
      );
    }

    const session = await db.getLiveSession(params.sessionId);
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
    }

    // Idempotency Check: Verified faculty/admin ending an already ended session returns success cleanly without redundant provider calls
    if (session.status === 'ENDED' || session.status === 'RECORDING_READY') {
      return NextResponse.json({
        success: true,
        sessionId: session.id,
        status: session.status,
        alreadyEnded: true,
        message: 'Live session has already ended',
        session,
      });
    }

    // If session is already in ENDING state, verify provider status before deciding
    if (session.status === 'ENDING') {
      let isConfirmedEnded = false;
      if (session.meetingId && classroomProvider.getSessionStatus) {
        try {
          const statusRes = await classroomProvider.getSessionStatus(session.meetingId);
          if (!statusRes.isRunning || statusRes.hasEnded) {
            isConfirmedEnded = true;
          }
        } catch {
          // Provider status check failed; retain ENDING
        }
      }

      if (isConfirmedEnded) {
        session.status = 'ENDED';
        (session as any).endedAt = new Date().toISOString();
        (session as any).endTime = new Date().toISOString();
        await db.saveLiveSession(session);

        return NextResponse.json({
          success: true,
          sessionId: session.id,
          status: 'ENDED',
          providerTerminated: true,
          session,
        });
      }

      return NextResponse.json(
        {
          success: false,
          sessionId: session.id,
          status: 'ENDING',
          pendingReconciliation: true,
          error: 'Termination is already in progress on media cluster',
        },
        { status: 202 }
      );
    }

    // Step 1: Persist transition to ENDING state before requesting provider termination
    session.status = 'ENDING';
    await db.saveLiveSession(session);

    // Step 2: Request provider termination
    let providerAcknowledged = false;
    let providerConfirmedEnded = false;
    let providerErrorMsg: string | undefined = undefined;

    if (session.meetingId && classroomProvider.endSession) {
      try {
        await classroomProvider.endSession(session.meetingId);
        providerAcknowledged = true;

        // Step 3: Verify provider state - do not equate request acceptance with confirmed termination
        if (classroomProvider.getSessionStatus) {
          const statusRes = await classroomProvider.getSessionStatus(session.meetingId);
          if (!statusRes.isRunning || statusRes.hasEnded) {
            providerConfirmedEnded = true;
          }
        } else {
          providerConfirmedEnded = true;
        }
      } catch (err: any) {
        providerAcknowledged = false;
        providerConfirmedEnded = false;
        providerErrorMsg = err?.message || 'Upstream provider termination failed or timed out';
      }
    } else {
      // No meetingId on provider (e.g. scheduled session that was never launched)
      providerConfirmedEnded = true;
    }

    // Step 4: Persist ENDED only after confirmed termination
    if (providerConfirmedEnded) {
      session.status = 'ENDED';
      (session as any).endedAt = new Date().toISOString();
      (session as any).endTime = new Date().toISOString();
      await db.saveLiveSession(session);

      // Audit Log: Confirmed Ended
      await db.recordAudit({
        actorUserId: user.id,
        actorEmail: user.email || payload.email,
        actorRole: user.role,
        action: 'LIVE_SESSION_ENDED',
        entityType: 'LIVE_SESSION',
        entityId: session.id,
        details: {
          meetingId: session.meetingId,
          title: session.title,
          providerTerminated: true,
        },
      });

      return NextResponse.json({
        success: true,
        sessionId: session.id,
        status: 'ENDED',
        providerTerminated: true,
        session,
      });
    }

    // Step 5: Termination not confirmed: Retain truthful ENDING state for controlled reconciliation
    await db.recordAudit({
      actorUserId: user.id,
      actorEmail: user.email || payload.email,
      actorRole: user.role,
      action: 'LIVE_SESSION_TERMINATION_PENDING',
      entityType: 'LIVE_SESSION',
      entityId: session.id,
      details: {
        meetingId: session.meetingId,
        title: session.title,
        providerAcknowledged,
        providerError: providerErrorMsg,
        reason: providerAcknowledged ? 'MEETING_STILL_RUNNING_ON_PROVIDER' : 'PROVIDER_UNAVAILABLE',
      },
    });

    return NextResponse.json(
      {
        success: false,
        sessionId: session.id,
        status: 'ENDING',
        pendingReconciliation: true,
        error: providerAcknowledged
          ? 'Termination requested; meeting is still shutting down on media node'
          : 'Upstream provider failed or timed out; session remains pending reconciliation',
      },
      { status: providerAcknowledged ? 202 : 502 }
    );
  } catch (err: any) {
    if (err instanceof ClassroomProviderError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'Unable to end live classroom session at this time' },
      { status: 500 }
    );
  }
}

