import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { bbbAdapter } from '@/lib/adapters/bbb-adapter';

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/zealosh_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const session = db.liveSessions.get(params.sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Live session not found' }, { status: 404 });
    }

    // Role-based authorization: Instructors and Admins have moderator access; Students must be actively enrolled
    const isModerator = payload.role === 'INSTRUCTOR' || payload.role === 'SUPER_ADMIN';

    if (!isModerator) {
      // Check active enrollment
      const isEnrolled = Array.from(db.enrollments.values()).some(
        (e) => e.userId === payload.userId && e.batchId === session.batchId && e.status === 'ACTIVE'
      );

      if (!isEnrolled) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have an active enrollment in this batch' },
          { status: 403 }
        );
      }
    }

    // Provision or verify BBB meeting
    await bbbAdapter.createMeeting({
      meetingId: session.meetingId,
      meetingName: session.title,
      attendeePassword: 'student_pass',
      moderatorPassword: 'instructor_pass',
    });

    // Generate signed join URL
    const joinUrl = bbbAdapter.getJoinUrl({
      meetingId: session.meetingId,
      fullName: payload.name,
      password: isModerator ? 'instructor_pass' : 'student_pass',
      userId: payload.userId,
      role: isModerator ? 'INSTRUCTOR' : 'STUDENT',
    });

    // Record attendance entry
    const existing = db.attendance.get(session.id) || [];
    existing.push({
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sessionId: session.id,
      userId: payload.userId,
      joinedAt: new Date().toISOString(),
      durationMinutes: 0,
      attended: true,
    });
    db.attendance.set(session.id, existing);

    db.recordAudit({
      actorUserId: payload.userId,
      actorEmail: payload.email,
      actorRole: payload.role,
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
      isModerator,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to join live session' }, { status: 500 });
  }
}
