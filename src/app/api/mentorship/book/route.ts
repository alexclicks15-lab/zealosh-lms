import { NextResponse } from 'next/server';
import { db, DatabaseOperationalError } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { MentorshipAppointment } from '@/types';

function getAuthUser(request: Request) {
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
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      instructorId,
      courseId,
      batchId,
      officeHourId,
      scheduledStart,
      scheduledEnd,
      durationMinutes = 30,
      studentNotes,
    } = body;

    if (!instructorId || !courseId || !scheduledStart || !scheduledEnd) {
      return NextResponse.json(
        { error: 'instructorId, courseId, scheduledStart, and scheduledEnd are required' },
        { status: 400 }
      );
    }

    // Server-enforced time validity
    const startTimeMs = new Date(scheduledStart).getTime();
    const endTimeMs = new Date(scheduledEnd).getTime();
    if (isNaN(startTimeMs) || isNaN(endTimeMs) || endTimeMs <= startTimeMs) {
      return NextResponse.json({ error: 'Invalid scheduled time range: scheduledEnd must be after scheduledStart' }, { status: 400 });
    }

    const instructor = await db.getUserById(instructorId);
    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    const course = await db.getCourseById(courseId);
    const meetingRoomId = `room-mentor-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const appointment: MentorshipAppointment = {
      id: `map-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      officeHourId,
      instructorId,
      instructorName: instructor.name,
      studentId: user.userId,
      studentName: user.name,
      studentEmail: user.email,
      courseId,
      courseTitle: course?.title || 'Certification Course',
      batchId,
      scheduledStart,
      scheduledEnd,
      durationMinutes,
      status: 'BOOKED',
      meetingRoomId,
      studentNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const booked = await db.bookMentorshipAppointment(appointment);
      return NextResponse.json(booked, { status: 201 });
    } catch (err: any) {
      if (err instanceof DatabaseOperationalError && err.code === 'MENTORSHIP_SLOT_CONFLICT') {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
      }
      throw err;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to book mentorship appointment' }, { status: 500 });
  }
}
