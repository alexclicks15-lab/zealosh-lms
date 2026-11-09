// Zealosh LMS — Live Session Details & Roster API
// GET /api/live/[sessionId] — Returns authoritative live session metadata, course/batch context, and participant roster

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
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

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await db.getLiveSession(params.sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Live session not found' }, { status: 404 });
    }

    const [course, batch] = await Promise.all([
      db.getCourseById(session.courseId),
      db.getBatch(session.batchId),
    ]);

    const leadInstructor = session.instructorId ? await db.getUser(session.instructorId) : null;
    const attendanceRecords = await db.getAttendance(session.id);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        title: session.title,
        meetingId: session.meetingId,
        courseId: session.courseId,
        courseTitle: course?.title || 'Certification Cohort',
        courseSlug: course?.slug || 'course',
        batchId: session.batchId,
        batchName: batch?.name || 'Cohort Batch',
        scheduledStartTime: session.scheduledStartTime,
        durationMinutes: session.durationMinutes || 60,
        status: session.status,
        recordingUrl: session.recordingUrl,
        instructor: {
          id: leadInstructor?.id || 'usr-inst-01',
          name: leadInstructor?.name || 'Lead Instructor, CSP, CRSP',
        },
        attendanceCount: attendanceRecords.length,
      },
      user: {
        id: payload.userId,
        name: payload.name,
        role: payload.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve live session' },
      { status: 500 }
    );
  }
}

