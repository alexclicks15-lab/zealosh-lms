import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

function formatIcsDateTime(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return '19700101T000000Z';
  }
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return new NextResponse('Calendar feed token is required', { status: 400 });
    }

    const tokenRecord = await db.getCalendarFeedToken(token);
    if (!tokenRecord) {
      return new NextResponse('Invalid or revoked calendar subscription token', { status: 404 });
    }

    const user = await db.getUserById(tokenRecord.userId);
    if (!user) {
      return new NextResponse('User associated with calendar feed not found', { status: 404 });
    }

    const events: string[] = [];
    const nowUtc = formatIcsDateTime(new Date());

    // 1. Live sessions for user's enrolled batches / taught batches
    const enrolledBatchIds = new Set<string>();
    for (const enr of db.enrollments.values()) {
      if (enr.userId === user.id && enr.status === 'ACTIVE' && enr.batchId) {
        enrolledBatchIds.add(enr.batchId);
      }
    }

    for (const session of db.liveSessions.values()) {
      const isStudentEnrolled = session.batchId && enrolledBatchIds.has(session.batchId);
      const isInstructor = session.instructorId === user.id;
      const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';

      if (isStudentEnrolled || isInstructor || isAdmin) {
        const dtStart = formatIcsDateTime(session.scheduledStartTime);
        const durationMin = session.durationMinutes || 90;
        const dtEnd = formatIcsDateTime(new Date(new Date(session.scheduledStartTime).getTime() + durationMin * 60000));
        const uid = `session-${session.id}@zealosh.com`;
        const summary = escapeIcsText(`Zealosh Live: ${session.title}`);
        const description = escapeIcsText('Live virtual classroom session');
        const location = escapeIcsText('Zealosh VC Virtual Classroom');

        events.push([
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${nowUtc}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          `LOCATION:${location}`,
          'STATUS:CONFIRMED',
          'END:VEVENT',
        ].join('\r\n'));
      }
    }

    // 2. Orientation Sessions
    for (const ori of db.orientationSessions.values()) {
      const booking = Array.from(db.orientationBookings.values()).find(
        (b) => b.sessionId === ori.id && b.userId === user.id && b.status === 'CONFIRMED'
      );
      if (booking || user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN') {
        const dtStart = formatIcsDateTime(ori.scheduledStartTime);
        const dtEnd = formatIcsDateTime(ori.scheduledEndTime || new Date(new Date(ori.scheduledStartTime).getTime() + (ori.durationMinutes || 60) * 60000));
        const uid = `orientation-${ori.id}@zealosh.com`;
        const summary = escapeIcsText(`Zealosh Orientation: ${ori.title || 'Course Orientation'}`);
        const location = escapeIcsText(ori.venueDetails || (ori.mode === 'ONLINE' ? 'Zealosh VC' : 'Campus'));

        events.push([
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${nowUtc}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${summary}`,
          `LOCATION:${location}`,
          'STATUS:CONFIRMED',
          'END:VEVENT',
        ].join('\r\n'));
      }
    }

    // 3. 1-on-1 Mentorship Appointments
    for (const app of db.mentorshipAppointments.values()) {
      if (app.status === 'CANCELLED' || app.status === 'NO_SHOW') continue;
      if (app.studentId === user.id || app.instructorId === user.id || user.role === 'SUPER_ADMIN') {
        const dtStart = formatIcsDateTime(app.scheduledStart);
        const dtEnd = formatIcsDateTime(app.scheduledEnd);
        const uid = `mentorship-${app.id}@zealosh.com`;
        const summary = escapeIcsText(`1-on-1 Mentorship: ${app.courseTitle || 'HSE Consultation'}`);
        const otherParty = app.studentId === user.id ? `Instructor: ${app.instructorName || 'Faculty'}` : `Student: ${app.studentName || 'Learner'}`;
        const description = escapeIcsText(`${otherParty}\\nNotes: ${app.studentNotes || 'N/A'}`);

        events.push([
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${nowUtc}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          'LOCATION:Zealosh VC Mentoring Room',
          'STATUS:CONFIRMED',
          'END:VEVENT',
        ].join('\r\n'));
      }
    }

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zealosh Training & Consultants//Zealosh LMS 2.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Zealosh Institutional Calendar',
      'X-WR-TIMEZONE:Asia/Kolkata',
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Kolkata',
      'X-LIC-LOCATION:Asia/Kolkata',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0530',
      'TZOFFSETTO:+0530',
      'TZNAME:IST',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="zealosh-calendar.ics"',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message || 'Error generating iCal feed', { status: 500 });
  }
}
