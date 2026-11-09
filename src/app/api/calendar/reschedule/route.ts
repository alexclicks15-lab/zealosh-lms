// Zealosh LMS — Calendar Event Reschedule API
// POST /api/calendar/reschedule — Reschedules live sessions or orientation sessions
// File: src/app/api/calendar/reschedule/route.ts

import { NextResponse } from 'next/server';
import { CalendarService } from '@/lib/scheduling/calendar-service';
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
        { error: 'Unauthorized: Only faculty and administrators can reschedule events' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { sourceEntityType, sourceEntityId, newStartTime, newDurationMinutes, reason } = body;

    if (!sourceEntityType || !sourceEntityId || !newStartTime) {
      return NextResponse.json(
        { error: 'sourceEntityType, sourceEntityId, and newStartTime are required' },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: 'A valid reschedule reason is mandatory (at least 5 characters)' },
        { status: 400 }
      );
    }

    const res = await CalendarService.rescheduleEvent({
      sourceEntityType,
      sourceEntityId,
      newStartTime,
      newDurationMinutes: newDurationMinutes ? parseInt(newDurationMinutes, 10) : undefined,
      reason: reason.trim(),
      actorUserId: payload.userId,
    });

    return NextResponse.json({
      success: true,
      event: res.event,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to reschedule event' },
      { status: 400 }
    );
  }
}

