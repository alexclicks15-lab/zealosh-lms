// Zealosh LMS — Calendar Schedule Conflict Detection API
// POST /api/calendar/conflicts — Evaluates proposed session slot for instructor/batch overlap
// File: src/app/api/calendar/conflicts/route.ts

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

    const body = await request.json().catch(() => ({}));
    const { instructorId, batchId, startTime, endTime, excludeEventId } = body;

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'startTime and endTime are required ISO 8601 timestamps' },
        { status: 400 }
      );
    }

    const conflicts = await CalendarService.checkScheduleConflicts({
      instructorId,
      batchId,
      startTime,
      endTime,
      excludeEventId,
    });

    return NextResponse.json({
      success: true,
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflicts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to check schedule conflicts' },
      { status: 500 }
    );
  }
}

