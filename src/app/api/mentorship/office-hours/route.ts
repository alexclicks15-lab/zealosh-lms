import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { InstructorOfficeHour } from '@/types';

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
    const instructorId = searchParams.get('instructorId') || (user.role === 'INSTRUCTOR' ? user.userId : undefined);
    const courseId = searchParams.get('courseId');

    if (instructorId) {
      const officeHours = await db.getOfficeHoursByInstructor(instructorId);
      return NextResponse.json({ instructorId, officeHours });
    }

    if (courseId) {
      const officeHours = await db.getOfficeHoursForCourse(courseId);
      return NextResponse.json({ courseId, officeHours });
    }

    // Default: return all active office hours
    const all = Array.from(db.instructorOfficeHours.values()).filter((oh) => oh.isActive);
    return NextResponse.json({ officeHours: all });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list office hours' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'INSTRUCTOR' && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only instructors and admins can configure office hours' }, { status: 403 });
    }

    const body = await request.json();
    const {
      instructorId = user.userId,
      courseId,
      dayOfWeek,
      startTime,
      endTime,
      slotDurationMinutes = 30,
      maxStudentsPerSlot = 1,
      locationType = 'VIRTUAL',
      meetingInstructions,
    } = body;

    if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: 'Valid dayOfWeek (0-6) is required' }, { status: 400 });
    }
    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'startTime and endTime (HH:MM) are required' }, { status: 400 });
    }

    const instructor = await db.getUserById(instructorId);
    const ohRecord: InstructorOfficeHour = {
      id: `ofh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      instructorId,
      instructorName: instructor?.name || 'Instructor',
      courseId,
      dayOfWeek,
      startTime,
      endTime,
      slotDurationMinutes,
      maxStudentsPerSlot,
      locationType,
      meetingInstructions: meetingInstructions || 'Zealosh VC 1-on-1 virtual mentoring room',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.createOfficeHour(ohRecord);
    return NextResponse.json(saved, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create office hour' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Office hour id is required' }, { status: 400 });
    }

    const existing = db.instructorOfficeHours.get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Office hour slot not found' }, { status: 404 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && existing.instructorId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete office hour of another instructor' }, { status: 403 });
    }

    await db.deleteOfficeHour(id);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete office hour' }, { status: 500 });
  }
}
