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
    const instructorId = searchParams.get('instructorId');
    const courseId = searchParams.get('courseId');
    const targetDateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!instructorId) {
      return NextResponse.json({ error: 'instructorId query parameter is required' }, { status: 400 });
    }

    // Determine day of week for targetDateStr (YYYY-MM-DD)
    const targetDate = new Date(`${targetDateStr}T00:00:00Z`);
    const dayOfWeek = targetDate.getUTCDay();

    // Get instructor's office hours matching day of week
    const officeHours = (await db.getOfficeHoursByInstructor(instructorId)).filter(
      (oh) => oh.dayOfWeek === dayOfWeek && (!courseId || !oh.courseId || oh.courseId === courseId)
    );

    // Get existing bookings for instructor on that date
    const existingAppointments = (await db.getMentorshipAppointments({ instructorId })).filter(
      (app) => app.status !== 'CANCELLED' && app.status !== 'NO_SHOW' && app.scheduledStart.startsWith(targetDateStr)
    );

    // Generate individual time slots for each office hour window
    const availableSlots: Array<{
      officeHourId: string;
      startTime: string; // ISO 8601
      endTime: string;   // ISO 8601
      durationMinutes: number;
      isBooked: boolean;
    }> = [];

    for (const oh of officeHours) {
      const [startH, startM] = oh.startTime.split(':').map(Number);
      const [endH, endM] = oh.endTime.split(':').map(Number);

      let currentSlotMinutes = startH * 60 + startM;
      const endSlotMinutes = endH * 60 + endM;

      while (currentSlotMinutes + oh.slotDurationMinutes <= endSlotMinutes) {
        const slotStartH = Math.floor(currentSlotMinutes / 60).toString().padStart(2, '0');
        const slotStartM = (currentSlotMinutes % 60).toString().padStart(2, '0');
        const slotEndMinutes = currentSlotMinutes + oh.slotDurationMinutes;
        const slotEndH = Math.floor(slotEndMinutes / 60).toString().padStart(2, '0');
        const slotEndM = (slotEndMinutes % 60).toString().padStart(2, '0');

        const slotStartIso = `${targetDateStr}T${slotStartH}:${slotStartM}:00.000Z`;
        const slotEndIso = `${targetDateStr}T${slotEndH}:${slotEndM}:00.000Z`;

        // Check if overlaps with any existing booking
        const isBooked = existingAppointments.some((app) => {
          const bStart = new Date(app.scheduledStart).getTime();
          const bEnd = new Date(app.scheduledEnd).getTime();
          const sStart = new Date(slotStartIso).getTime();
          const sEnd = new Date(slotEndIso).getTime();
          return sStart < bEnd && sEnd > bStart;
        });

        availableSlots.push({
          officeHourId: oh.id,
          startTime: slotStartIso,
          endTime: slotEndIso,
          durationMinutes: oh.slotDurationMinutes,
          isBooked,
        });

        currentSlotMinutes += oh.slotDurationMinutes;
      }
    }

    return NextResponse.json({
      instructorId,
      date: targetDateStr,
      dayOfWeek,
      totalSlots: availableSlots.length,
      availableSlotsCount: availableSlots.filter((s) => !s.isBooked).length,
      slots: availableSlots,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to compute mentorship slots' }, { status: 500 });
  }
}

