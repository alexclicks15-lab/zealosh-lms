// Zealosh LMS — Orientation Attendance Recording API
// POST /api/orientation/sessions/[id]/attendance — Marks attendance (ATTENDED or ABSENT)
// File: src/app/api/orientation/sessions/[id]/attendance/route.ts

import { NextResponse } from 'next/server';
import { OrientationService } from '@/lib/orientation/orientation-service';
import { verifyToken } from '@/lib/auth/jwt';

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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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
        { error: 'Unauthorized: Only faculty and staff can record orientation attendance' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { bookingId, status, notes, attendanceSource = 'MANUAL_COORDINATOR' } = body;

    if (!bookingId || !status) {
      return NextResponse.json({ error: 'bookingId and status are required' }, { status: 400 });
    }

    if (status !== 'ATTENDED' && status !== 'ABSENT') {
      return NextResponse.json(
        { error: 'status must be either ATTENDED or ABSENT' },
        { status: 400 }
      );
    }

    const updated = await OrientationService.markAttendance({
      bookingId,
      status,
      actorUserId: payload.userId,
      attendanceSource,
      notes,
    });

    return NextResponse.json({
      success: true,
      booking: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to record orientation attendance' },
      { status: 400 }
    );
  }
}

