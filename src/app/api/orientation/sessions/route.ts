// Zealosh LMS — Orientation Sessions API
// GET /api/orientation/sessions — List available orientation sessions
// POST /api/orientation/sessions — Create a new orientation session
// File: src/app/api/orientation/sessions/route.ts

import { NextResponse } from 'next/server';
import { OrientationService } from '@/lib/orientation/orientation-service';
import { verifyToken } from '@/lib/auth/jwt';
import { OrientationSessionStatus } from '@/types';

function extractUserToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || undefined;
    const status = (searchParams.get('status') as OrientationSessionStatus) || undefined;
    const onlyUpcoming = searchParams.get('onlyUpcoming') === 'true';

    const sessions = await OrientationService.getOrientationSessions({
      courseId,
      status,
      onlyUpcoming,
    });

    return NextResponse.json({ success: true, count: sessions.length, sessions });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to list orientation sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (
      payload.role !== 'SUPER_ADMIN' &&
      payload.role !== 'ORG_ADMIN' &&
      payload.role !== 'COURSE_MANAGER' &&
      payload.role !== 'INSTRUCTOR'
    ) {
      return NextResponse.json(
        { error: 'Unauthorized: Only faculty and administrators can create orientation sessions' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      courseId,
      title,
      mode = 'ONLINE',
      scheduledStartTime,
      durationMinutes = 60,
      timeZone,
      capacity = 50,
      venueDetails,
      instructions,
    } = body;

    if (!courseId || !title || !scheduledStartTime) {
      return NextResponse.json(
        { error: 'courseId, title, and scheduledStartTime are required' },
        { status: 400 }
      );
    }

    const session = await OrientationService.createOrientationSession({
      courseId,
      title,
      mode,
      scheduledStartTime,
      durationMinutes: parseInt(durationMinutes, 10),
      timeZone,
      capacity: parseInt(capacity, 10),
      coordinatorId: payload.userId,
      coordinatorName: payload.name || 'Coordinator',
      venueDetails,
      instructions,
    });

    return NextResponse.json({ success: true, session });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to create orientation session' },
      { status: 400 }
    );
  }
}

