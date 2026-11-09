// Zealosh LMS — Master Institutional Calendar Aggregation API
// GET /api/calendar — Aggregates batches, live sessions, exams, orientations, and holidays
// File: src/app/api/calendar/route.ts

import { NextResponse } from 'next/server';
import { CalendarService, DEFAULT_INSTITUTIONAL_TIMEZONE } from '@/lib/scheduling/calendar-service';
import { verifyToken } from '@/lib/auth/jwt';
import { CalendarEventType } from '@/types';

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
    const payload = extractUserToken(request);
    const { searchParams } = new URL(request.url);

    const now = new Date();
    // Default range: 30 days past to 60 days future if not specified
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const defaultEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const startDate = searchParams.get('startDate') || defaultStart;
    const endDate = searchParams.get('endDate') || defaultEnd;
    const courseId = searchParams.get('courseId') || undefined;
    const batchId = searchParams.get('batchId') || undefined;
    const eventType = (searchParams.get('eventType') as CalendarEventType) || undefined;
    const timeZone = searchParams.get('timeZone') || DEFAULT_INSTITUTIONAL_TIMEZONE;

    const events = await CalendarService.getCalendarEvents({
      startDate,
      endDate,
      userId: payload?.userId,
      userRole: payload?.role,
      courseId,
      batchId,
      eventType,
      timeZone,
    });

    const holidays = CalendarService.getHolidays();

    return NextResponse.json({
      success: true,
      timeZone,
      startDate,
      endDate,
      eventCount: events.length,
      events,
      holidays,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

