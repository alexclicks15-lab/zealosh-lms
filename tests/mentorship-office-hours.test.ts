// tests/mentorship-office-hours.test.ts
// Vitest suite for 1-on-1 Mentorship Booking, Office Hours, and Conflict Prevention

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { InstructorOfficeHour, MentorshipAppointment } from '@/types';

describe('1-on-1 Mentorship Office Hours & Appointment Scheduling', () => {
  const instructorId = `inst-${Date.now()}`;
  const student1Id = `stud-1-${Date.now()}`;
  const student2Id = `stud-2-${Date.now()}`;
  const courseId = 'course-hse-lead-auditor';

  beforeEach(() => {
    (db as any).instructorOfficeHours?.clear();
    (db as any).mentorshipAppointments?.clear();
  });

  it('creates and lists recurring office hours windows for an instructor', async () => {
    const window = await db.createOfficeHour({
      instructorId,
      courseId,
      dayOfWeek: 2, // Tuesday
      startTime: '14:00',
      endTime: '17:00',
      slotDurationMinutes: 30,
      bufferMinutes: 10,
      meetingUrl: 'https://zealosh.com/classroom/live/mentorship-room-1',
      isActive: true,
    });

    expect(window.id).toBeDefined();
    expect(window.dayOfWeek).toBe(2);
    expect(window.slotDurationMinutes).toBe(30);

    const instructorHours = await db.getOfficeHoursByInstructor(instructorId);
    expect(instructorHours).toHaveLength(1);
    expect(instructorHours[0].id).toBe(window.id);

    const courseHours = await db.getOfficeHoursForCourse(courseId);
    expect(courseHours).toHaveLength(1);
  });

  it('books an appointment successfully and blocks conflicting overlapping bookings', async () => {
    const startTime = '2026-11-15T10:00:00.000Z';
    const endTime = '2026-11-15T10:30:00.000Z';

    // Student 1 books the 10:00 - 10:30 slot
    const appointment1 = await db.bookMentorshipAppointment({
      instructorId,
      studentId: student1Id,
      courseId,
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      topic: 'HSE Risk Assessment Matrix Guidance',
      meetingUrl: 'https://zealosh.com/classroom/live/mentorship-room-1',
    });

    expect(appointment1.id).toBeDefined();
    expect(appointment1.status).toBe('SCHEDULED');

    // Student 2 attempts to book the EXACT SAME slot
    await expect(
      db.bookMentorshipAppointment({
        instructorId,
        studentId: student2Id,
        courseId,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        topic: 'NEBOSH Environmental Management Clarification',
      })
    ).rejects.toThrow(/MENTORSHIP_SLOT_CONFLICT|conflict|active appointment booked/i);

    // Student 2 attempts to book an OVERLAPPING slot (10:15 - 10:45)
    await expect(
      db.bookMentorshipAppointment({
        instructorId,
        studentId: student2Id,
        courseId,
        scheduledStartTime: '2026-11-15T10:15:00.000Z',
        scheduledEndTime: '2026-11-15T10:45:00.000Z',
        topic: 'Overlapping Session',
      })
    ).rejects.toThrow(/MENTORSHIP_SLOT_CONFLICT|conflict|active appointment booked/i);

    // Student 2 books an ADJACENT non-conflicting slot (10:45 - 11:15)
    const appointment2 = await db.bookMentorshipAppointment({
      instructorId,
      studentId: student2Id,
      courseId,
      scheduledStartTime: '2026-11-15T10:45:00.000Z',
      scheduledEndTime: '2026-11-15T11:15:00.000Z',
      topic: 'Subcontractor Audit Checklist Review',
    });

    expect(appointment2.id).toBeDefined();
    expect(appointment2.status).toBe('SCHEDULED');
  });

  it('cancels appointment and permits rebooking of the freed slot', async () => {
    const startTime = '2026-11-16T15:00:00.000Z';
    const endTime = '2026-11-16T15:30:00.000Z';

    const appt = await db.bookMentorshipAppointment({
      instructorId,
      studentId: student1Id,
      courseId,
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      topic: 'Emergency Evacuation Drill Protocols',
    });

    // Cancel appointment
    const cancelled = await db.cancelMentorshipAppointment(
      appt.id,
      student1Id,
      'Scheduling conflict with on-site inspection'
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancellationReason).toContain('Scheduling conflict');

    // Slot is now freed: student 2 can book it without conflict error
    const rebooked = await db.bookMentorshipAppointment({
      instructorId,
      studentId: student2Id,
      courseId,
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      topic: 'Confined Space Entry Safety Q&A',
    });

    expect(rebooked.id).toBeDefined();
    expect(rebooked.status).toBe('SCHEDULED');
  });

  it('reschedules appointment to new slot and verifies updated timings', async () => {
    const originalStart = '2026-11-17T09:00:00.000Z';
    const originalEnd = '2026-11-17T09:30:00.000Z';

    const appt = await db.bookMentorshipAppointment({
      instructorId,
      studentId: student1Id,
      courseId,
      scheduledStartTime: originalStart,
      scheduledEndTime: originalEnd,
      topic: 'Hazard Communication Standard (HAZCOM)',
    });

    const newStart = '2026-11-17T11:00:00.000Z';
    const newEnd = '2026-11-17T11:30:00.000Z';

    const rescheduled = await db.rescheduleMentorshipAppointment(
      appt.id,
      student1Id,
      newStart,
      newEnd
    );

    expect(rescheduled.scheduledStartTime).toBe(newStart);
    expect(rescheduled.scheduledEndTime).toBe(newEnd);
  });
});

