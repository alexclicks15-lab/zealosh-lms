// Zealosh LMS — Orientation Booking, Attendance & Admission Gating Test Suite
// File: tests/orientation-booking-gating.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { OrientationService } from '../src/lib/orientation/orientation-service';
import { AdmissionsPipelineService } from '../src/lib/admissions/admissions-pipeline';
import { ProvisioningOrchestrator } from '../src/lib/admissions/provisioning-orchestrator';
import { db } from '../src/lib/store/db';

describe('Zealosh LMS — Course Orientation & Admission Gating (ZM-IMPL-08D)', () => {
  beforeEach(() => {
    OrientationService.resetForTesting();
    AdmissionsPipelineService.resetForTesting();
    ProvisioningOrchestrator.resetForTesting();
  });

  it('manages course-specific orientation configuration', async () => {
    // ASP has default configuration requiring orientation
    const aspConfig = await OrientationService.getCourseOrientationConfig('crs-asp-01');
    expect(aspConfig.isRequired).toBe(true);
    expect(aspConfig.mode).toBe('ONLINE');
    expect(aspConfig.sessionCapacity).toBe(35);

    // Update config
    const updated = await OrientationService.saveCourseOrientationConfig({
      courseId: 'crs-asp-01',
      sessionCapacity: 40,
      instructions: 'Updated faculty guidelines',
    });

    expect(updated.sessionCapacity).toBe(40);
    expect(updated.instructions).toBe('Updated faculty guidelines');
  });

  it('creates orientation session with honest unconfigured provider reporting', async () => {
    const session = await OrientationService.createOrientationSession({
      courseId: 'crs-asp-01',
      title: 'Dec 2026 Cohort Induction Session',
      mode: 'ONLINE',
      scheduledStartTime: '2026-12-05T10:00:00.000Z',
      durationMinutes: 60,
      capacity: 30,
      coordinatorId: 'usr-admin-01',
      coordinatorName: 'Academic Coordinator',
      instructions: 'Bring your enrolment voucher',
    });

    expect(session.id).toBeDefined();
    expect(session.capacity).toBe(30);
    expect(session.bookedCount).toBe(0);
    expect(session.status).toBe('PUBLISHED');
  });

  it('atomically enforces capacity limits and rejects overbooking', async () => {
    // Create a mini-session with capacity of 2
    const session = await OrientationService.createOrientationSession({
      courseId: 'crs-asp-01',
      title: 'High-Touch Intimate Induction Cohort',
      mode: 'ONLINE',
      scheduledStartTime: '2026-12-08T15:00:00.000Z',
      durationMinutes: 45,
      capacity: 2,
      coordinatorId: 'usr-admin-01',
    });

    // 1st applicant books
    const b1 = await OrientationService.bookOrientationSession({
      sessionId: session.id,
      applicationId: 'app-stud-01',
      userId: 'usr-stud-01',
      userEmail: 'student1@zealosh.com',
      userName: 'Candidate One',
    });
    expect(b1.success).toBe(true);
    expect(b1.booking.status).toBe('CONFIRMED');

    // 2nd applicant books
    const b2 = await OrientationService.bookOrientationSession({
      sessionId: session.id,
      applicationId: 'app-stud-02',
      userId: 'usr-stud-02',
      userEmail: 'student2@zealosh.com',
      userName: 'Candidate Two',
    });
    expect(b2.success).toBe(true);

    // 3rd applicant tries to book (should be rejected as SESSION_FULL)
    await expect(
      OrientationService.bookOrientationSession({
        sessionId: session.id,
        applicationId: 'app-stud-03',
        userId: 'usr-stud-03',
        userEmail: 'student3@zealosh.com',
        userName: 'Candidate Three',
      })
    ).rejects.toThrow('SESSION_FULL');

    const refreshed = await OrientationService.getOrientationSessionById(session.id);
    expect(refreshed?.bookedCount).toBe(2);
  });

  it('prevents duplicate active orientation bookings for the same applicant and course', async () => {
    const session1 = await OrientationService.createOrientationSession({
      courseId: 'crs-asp-01',
      title: 'Session Alpha',
      mode: 'ONLINE',
      scheduledStartTime: '2026-12-10T10:00:00.000Z',
      coordinatorId: 'usr-admin-01',
      capacity: 20,
    });

    const session2 = await OrientationService.createOrientationSession({
      courseId: 'crs-asp-01',
      title: 'Session Beta',
      mode: 'ONLINE',
      scheduledStartTime: '2026-12-12T10:00:00.000Z',
      coordinatorId: 'usr-admin-01',
      capacity: 20,
    });

    // Book Session 1
    await OrientationService.bookOrientationSession({
      sessionId: session1.id,
      applicationId: 'app-stud-dup',
      userId: 'usr-stud-dup',
      userEmail: 'dup@zealosh.com',
      userName: 'Duplicate Candidate',
    });

    // Attempt to book Session 2 for the same course
    await expect(
      OrientationService.bookOrientationSession({
        sessionId: session2.id,
        applicationId: 'app-stud-dup',
        userId: 'usr-stud-dup',
        userEmail: 'dup@zealosh.com',
        userName: 'Duplicate Candidate',
      })
    ).rejects.toThrow('ALREADY_BOOKED');
  });

  it('reschedules and cancels orientation bookings and restores session capacity', async () => {
    const session1 = await OrientationService.createOrientationSession({
      courseId: 'crs-asp-01',
      title: 'Morning Session',
      mode: 'ONLINE',
      scheduledStartTime: '2026-12-14T09:00:00.000Z',
      coordinatorId: 'usr-admin-01',
      capacity: 10,
    });

    const session2 = await OrientationService.createOrientationSession({
      courseId: 'crs-asp-01',
      title: 'Evening Session',
      mode: 'ONLINE',
      scheduledStartTime: '2026-12-14T18:00:00.000Z',
      coordinatorId: 'usr-admin-01',
      capacity: 10,
    });

    const { booking } = await OrientationService.bookOrientationSession({
      sessionId: session1.id,
      applicationId: 'app-resched',
      userId: 'usr-resched',
      userEmail: 'resched@zealosh.com',
      userName: 'Reschedule Candidate',
    });

    let s1 = await OrientationService.getOrientationSessionById(session1.id);
    expect(s1?.bookedCount).toBe(1);

    // Reschedule to session 2
    const resched = await OrientationService.rescheduleBooking({
      bookingId: booking.id,
      newSessionId: session2.id,
      userId: 'usr-resched',
    });

    expect(resched.booking.sessionId).toBe(session2.id);

    s1 = await OrientationService.getOrientationSessionById(session1.id);
    let s2 = await OrientationService.getOrientationSessionById(session2.id);
    expect(s1?.bookedCount).toBe(0); // Restored
    expect(s2?.bookedCount).toBe(1); // Incremented

    // Cancel booking
    await OrientationService.cancelBooking(booking.id, 'usr-resched');
    s2 = await OrientationService.getOrientationSessionById(session2.id);
    expect(s2?.bookedCount).toBe(0); // Restored upon cancellation
  });

  it('enforces orientation attendance prerequisite on admission approval gate', async () => {
    // 1. Create an application in ORIENTATION_PENDING stage
    const app = await db.createAdmissionApplication({
      courseId: 'crs-asp-01',
      applicantName: 'Orientation Candidate',
      applicantEmail: 'gate01@zealosh.com',
      applicantPhone: '+91 98765 43210',
    });
    app.userId = 'usr-applicant-gate-01';
    app.pipelineStage = 'ORIENTATION_PENDING';
    app.status = 'ORIENTATION_PENDING';
    db.admissionApplications.set(app.id, app);

    // 2. Attempting to transition directly to APPROVED without attending orientation should be blocked!
    await expect(
      AdmissionsPipelineService.transitionStage({
        applicationId: app.id,
        targetStage: 'APPROVED',
        actorUserId: 'usr-admin-01',
      })
    ).rejects.toThrow('ORIENTATION_ATTENDANCE_REQUIRED');

    // 3. Candidate books orientation and coordinator marks ATTENDED
    const session = await OrientationService.createOrientationSession({
      courseId: 'crs-asp-01',
      title: 'Gated Orientation Induction',
      mode: 'ONLINE',
      scheduledStartTime: '2026-12-16T10:00:00.000Z',
      coordinatorId: 'usr-admin-01',
      capacity: 50,
    });

    const { booking } = await OrientationService.bookOrientationSession({
      sessionId: session.id,
      applicationId: app.id,
      userId: app.userId!,
      userEmail: app.applicantEmail,
      userName: app.applicantName,
    });

    await OrientationService.markAttendance({
      bookingId: booking.id,
      status: 'ATTENDED',
      actorUserId: 'usr-admin-01',
      notes: 'Active participant throughout live orientation',
    });

    // 4. Now transition to APPROVED should succeed!
    const approvedApp = await AdmissionsPipelineService.transitionStage({
      applicationId: app.id,
      targetStage: 'APPROVED',
      actorUserId: 'usr-admin-01',
      reason: 'Orientation completed and verified by coordinator',
    });

    expect(approvedApp.status).toBe('APPROVED');
    expect(approvedApp.pipelineStage).toBe('APPROVED');
  });

  it('permits manual administrative override of orientation prerequisite with mandatory audit reason', async () => {
    const app = await db.createAdmissionApplication({
      courseId: 'crs-asp-01',
      applicantName: 'Executive Candidate',
      applicantEmail: 'exec@zealosh.com',
      applicantPhone: '+91 98765 00000',
    });
    app.userId = 'usr-applicant-override-01';
    app.pipelineStage = 'ORIENTATION_PENDING';
    app.status = 'ORIENTATION_PENDING';
    db.admissionApplications.set(app.id, app);

    // Override without sufficient reason is rejected
    await expect(
      AdmissionsPipelineService.transitionStage({
        applicationId: app.id,
        targetStage: 'APPROVED',
        actorUserId: 'usr-admin-01',
        isOverride: true,
        reason: 'Short', // Less than 10 characters
      })
    ).rejects.toThrow('OVERRIDE_REASON_MANDATORY');

    // Override with valid audit reason succeeds
    const approved = await AdmissionsPipelineService.transitionStage({
      applicationId: app.id,
      targetStage: 'APPROVED',
      actorUserId: 'usr-admin-01',
      isOverride: true,
      reason: 'Executive safety officer waiver granted by Academic Dean',
    });

    expect(approved.status).toBe('APPROVED');
    expect(approved.stageHistory?.some((h) => h.reason?.includes('ADMIN_OVERRIDE'))).toBe(true);
  });
});
