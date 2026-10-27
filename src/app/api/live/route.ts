import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { LiveSession } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ error: 'batchId query parameter required' }, { status: 400 });
    }

    const sessions = await db.getLiveSessions(batchId);
    return NextResponse.json({ success: true, sessions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch live sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
