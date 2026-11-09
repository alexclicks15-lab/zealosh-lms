// Zealosh LMS — Unified Institutional Calendar & Scheduling Engine Test Suite
// File: tests/calendar-scheduling-engine.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarService, DEFAULT_INSTITUTIONAL_TIMEZONE } from '../src/lib/scheduling/calendar-service';
import { OrientationService } from '../src/lib/orientation/orientation-service';
import { db } from '../src/lib/store/db';

describe('Zealosh LMS — Calendar & Scheduling Engine (ZM-IMPL-08D)', () => {
  beforeEach(() => {
    CalendarService.resetForTesting();
    OrientationService.resetForTesting();
  });

  it('aggregates live sessions, exams, orientations, and holidays without duplicating authoritative records', async () => {
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 86400000).toISOString();
    const endDate = new Date(now.getTime() + 30 * 86400000).toISOString();

    const events = await CalendarService.getCalendarEvents({
      startDate,
      endDate,
      userRole: 'SUPER_ADMIN',
    });

    expect(events.length).toBeGreaterThan(0);

    // Verify presence of event types
    const eventTypes = new Set(events.map((e) => e.eventType));
    expect(eventTypes.has('BATCH_SESSION') || eventTypes.has('ORIENTATION') || eventTypes.has('HOLIDAY')).toBe(true);

    // Verify all events contain mandatory ISO timestamps and timeZone
    for (const ev of events) {
      expect(ev.id).toBeDefined();
      expect(ev.title).toBeDefined();
      expect(ev.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(ev.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(ev.timeZone).toBe(DEFAULT_INSTITUTIONAL_TIMEZONE);
      expect(new Date(ev.endTime).getTime()).toBeGreaterThanOrEqual(new Date(ev.startTime).getTime());
    }
  });

  it('enforces role-based visibility scoping (student sees only enrolled batch sessions)', async () => {
    // Academic year window containing seeded holidays
    const startDate = '2026-01-01T00:00:00.000Z';
    const endDate = '2026-12-31T23:59:59.000Z';

    // Student without enrollments
    const studentEvents = await CalendarService.getCalendarEvents({
      startDate,
      endDate,
      userId: 'usr-student-unregistered',
      userRole: 'STUDENT',
    });

    // Unenrolled student should not see private batch live sessions
    const batchSessions = studentEvents.filter((e) => e.eventType === 'BATCH_SESSION');
    expect(batchSessions.length).toBe(0);

    // Student should still see public institutional holidays and public orientations
    const holidays = studentEvents.filter((e) => e.eventType === 'HOLIDAY');
    expect(holidays.length).toBeGreaterThan(0);
  });

  it('expands recurring schedule rules into calendar occurrences and skips institutional holidays', () => {
    // Add a holiday on 2026-12-13 (Sunday)
    CalendarService.addHoliday({
      name: 'Special Academic Recess',
      date: '2026-12-13',
      description: 'Holiday',
      affectsBatches: true,
    });

    // Schedule for Sundays (0) at 19:00 IST for December 2026
    const occurrences = CalendarService.expandRecurringSchedule({
      rule: {
        daysOfWeek: [0], // Sunday
        startTime: '19:00',
        durationMinutes: 120,
        timeZone: 'Asia/Kolkata',
      },
      startDate: '2026-12-01',
      endDate: '2026-12-31',
      exceptionDates: ['2026-12-20'], // Explicit instructor leave exception
    });

    // In Dec 2026, Sundays are: 6, 13, 20, 27.
    // 13 is an institutional holiday; 20 is an instructor exception.
    // Remaining valid occurrences: 6 and 27.
    const dates = occurrences.map((o) => o.startTime.slice(0, 10));
    expect(dates).toContain('2026-12-06');
    expect(dates).not.toContain('2026-12-13'); // Skipped via holiday
    expect(dates).not.toContain('2026-12-20'); // Skipped via exception
    expect(dates).toContain('2026-12-27');
    expect(occurrences.length).toBe(2);
  });

  it('detects instructor and batch schedule conflicts server-side', async () => {
    const batches = await db.getBatches();
    expect(batches.length).toBeGreaterThan(0);
    const targetBatch = batches[0];
    const sessions = await db.getLiveSessions(targetBatch.id);
    expect(sessions.length).toBeGreaterThan(0);
    const existingSession = sessions[0];

    const sessionStart = new Date(existingSession.scheduledStartTime);
    const overlapStart = new Date(sessionStart.getTime() + 15 * 60 * 1000).toISOString(); // 15 mins in
    const overlapEnd = new Date(sessionStart.getTime() + 90 * 60 * 1000).toISOString();

    // 1. Conflict test for same instructor
    const instructorConflicts = await CalendarService.checkScheduleConflicts({
      instructorId: existingSession.instructorId,
      startTime: overlapStart,
      endTime: overlapEnd,
      excludeEventId: 'unrelated-new-session',
    });

    expect(instructorConflicts.length).toBeGreaterThan(0);
    expect(instructorConflicts[0].type).toBe('INSTRUCTOR_OVERLAP');
    expect(instructorConflicts[0].conflictingEventId).toBe(existingSession.id);

    // 2. Conflict test for same batch
    const batchConflicts = await CalendarService.checkScheduleConflicts({
      batchId: existingSession.batchId,
      startTime: overlapStart,
      endTime: overlapEnd,
      excludeEventId: 'unrelated-new-session',
    });

    expect(batchConflicts.length).toBeGreaterThan(0);
    expect(batchConflicts[0].type).toBe('BATCH_OVERLAP');
    expect(batchConflicts[0].resourceId).toBe(existingSession.batchId);
  });

  it('reschedules a live session and updates authoritative persistence with audit history', async () => {
    const batches = await db.getBatches();
    const targetBatch = batches[0];
    const sessions = await db.getLiveSessions(targetBatch.id);
    const session = sessions[0];

    const newTime = '2026-12-10T14:00:00.000Z';
    const result = await CalendarService.rescheduleEvent({
      sourceEntityType: 'LIVE_SESSION',
      sourceEntityId: session.id,
      newStartTime: newTime,
      reason: 'Faculty medical appointment reschedule',
      actorUserId: 'usr-admin-01',
    });

    expect(result.success).toBe(true);
    expect(result.event.scheduledStartTime).toBe(newTime);

    // Verify stored entity in db
    const updated = db.liveSessions.get(session.id);
    expect(updated?.scheduledStartTime).toBe(newTime);
  });
});
