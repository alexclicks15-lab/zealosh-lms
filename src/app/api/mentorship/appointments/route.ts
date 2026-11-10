import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

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

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status') || undefined;
    const courseId = searchParams.get('courseId') || undefined;

    let appointments;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN') {
      appointments = await db.getMentorshipAppointments({ status: filterStatus, courseId });
    } else if (user.role === 'INSTRUCTOR') {
      appointments = await db.getMentorshipAppointments({ instructorId: user.userId, status: filterStatus, courseId });
    } else {
      // Student only sees their own appointments
      appointments = await db.getMentorshipAppointments({ studentId: user.userId, status: filterStatus, courseId });
    }

    return NextResponse.json({ appointments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list mentorship appointments' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { appointmentId, action, reason, scheduledStart, scheduledEnd } = body;

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 });
    }

    const existing = await db.getMentorshipAppointmentById(appointmentId);
    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Role check: only participant (student/instructor) or admin can cancel/reschedule
    const isParticipant = existing.studentId === user.userId || existing.instructorId === user.userId;
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';
    if (!isParticipant && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: You cannot modify this appointment' }, { status: 403 });
    }

    if (action === 'CANCEL') {
      const cancelled = await db.cancelMentorshipAppointment(
        appointmentId,
        reason || 'Cancelled by user',
        user.userId
      );
      return NextResponse.json(cancelled);
    }

    if (action === 'RESCHEDULE') {
      if (!scheduledStart || !scheduledEnd) {
        return NextResponse.json({ error: 'scheduledStart and scheduledEnd are required for rescheduling' }, { status: 400 });
      }
      const rescheduled = await db.rescheduleMentorshipAppointment(appointmentId, scheduledStart, scheduledEnd);
      return NextResponse.json(rescheduled);
    }

    if (action === 'CONFIRM' && (user.role === 'INSTRUCTOR' || isAdmin)) {
      existing.status = 'CONFIRMED';
      existing.updatedAt = new Date().toISOString();
      return NextResponse.json(existing);
    }

    return NextResponse.json({ error: 'Invalid action. Supported: CANCEL, RESCHEDULE, CONFIRM' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update mentorship appointment' }, { status: 500 });
  }
}
