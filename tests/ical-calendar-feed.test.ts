// tests/ical-calendar-feed.test.ts
// Vitest suite for RFC 5545 iCal Calendar Subscription Feed & Token Isolation

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { GET } from '@/app/api/calendar/feed/[token]/route';

describe('iCal Subscription Feed & Security Token Lifecycle', () => {
  const userId = `usr-cal-${Date.now()}`;

  beforeEach(() => {
    (db as any).calendarFeedTokens?.clear();

    // Register a valid student user
    (db as any).users.set(userId, {
      id: userId,
      email: 'cal-student@zealosh.com',
      fullName: 'Rajesh Nair',
      role: 'STUDENT',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('creates, retrieves, and checks calendar feed token for a user', async () => {
    const tokenRecord = await db.createCalendarFeedToken(userId, 'Mac Calendar Feed');

    expect(tokenRecord.token).toBeDefined();
    expect(tokenRecord.token.length).toBeGreaterThanOrEqual(32);
    expect(tokenRecord.userId).toBe(userId);
    expect(tokenRecord.isActive).toBe(true);

    const fetched = await db.getCalendarFeedToken(tokenRecord.token);
    expect(fetched).toBeDefined();
    expect(fetched?.userId).toBe(userId);
  });

  it('revokes a calendar feed token and renders it invalid for subsequent requests', async () => {
    const tokenRecord = await db.createCalendarFeedToken(userId, 'Google Calendar Feed');
    const token = tokenRecord.token;

    // Revoke
    const revoked = await db.revokeCalendarFeedToken(token, userId);
    expect(revoked).toBe(true);

    // Should no longer return active token record
    const fetched = await db.getCalendarFeedToken(token);
    expect(fetched).toBeNull();

    // GET endpoint must return HTTP 404 for revoked token
    const req = new Request(`https://zealosh.com/api/calendar/feed/${token}`);
    const response = await GET(req, { params: Promise.resolve({ token }) });
    expect(response.status).toBe(404);
  });

  it('generates valid RFC 5545 VCALENDAR feed with Zealosh branding and Asia/Kolkata timezone', async () => {
    const tokenRecord = await db.createCalendarFeedToken(userId, 'iPhone Calendar');
    const token = tokenRecord.token;

    // Add a mentorship appointment for this user
    await db.bookMentorshipAppointment({
      instructorId: 'inst-lead-auditor',
      studentId: userId,
      courseId: 'course-iso-45001',
      scheduledStartTime: '2026-11-20T10:00:00.000Z',
      scheduledEndTime: '2026-11-20T10:30:00.000Z',
      topic: 'ISO 45001 Clause 9 Evaluation Mentorship',
      meetingUrl: 'https://zealosh.com/classroom/live/mentorship-room-1',
    });

    const req = new Request(`https://zealosh.com/api/calendar/feed/${token}`);
    const response = await GET(req, { params: Promise.resolve({ token }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/calendar');
    expect(response.headers.get('content-disposition')).toContain('zealosh-calendar.ics');

    const icsText = await response.text();

    // Verify RFC 5545 headers
    expect(icsText).toContain('BEGIN:VCALENDAR');
    expect(icsText).toContain('VERSION:2.0');
    expect(icsText).toContain('PRODID:-//Zealosh Training & Consultants//Zealosh LMS 2.0//EN');
    expect(icsText).toContain('X-WR-TIMEZONE:Asia/Kolkata');

    // Verify VEVENT contents
    expect(icsText).toContain('BEGIN:VEVENT');
    expect(icsText).toContain('SUMMARY:1-on-1 Mentorship:');
    expect(icsText).toContain('ISO 45001 Clause 9 Evaluation Mentorship');
    expect(icsText).toContain('LOCATION:Zealosh VC Mentoring Room');
    expect(icsText).toContain('END:VEVENT');
    expect(icsText).toContain('END:VCALENDAR');
  });

  it('rejects unauthenticated or tampered tokens with HTTP 404', async () => {
    const req = new Request('https://zealosh.com/api/calendar/feed/malicious-random-token');
    const response = await GET(req, { params: Promise.resolve({ token: 'malicious-random-token' }) });
    expect(response.status).toBe(404);
  });
});

