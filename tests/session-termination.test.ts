// ==============================================================================
// Zealosh LMS — Live Session Termination & Instructor Lifecycle Suite
// ==============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../src/lib/store/db';
import { signToken } from '../src/lib/auth/jwt';
import { POST as endLiveSessionHandler } from '../src/app/api/live/[sessionId]/end/route';
import { reconcileSessionTermination } from '../src/lib/store/live-session-resolver';
import { classroomProvider } from '../src/lib/classroom';
import { LiveSession, User, Course, Batch } from '../src/types';

describe('Zealosh LMS — Session Termination & Idempotency Lifecycle', () => {
  const studentUser: User = {
    id: 'usr-term-student',
    name: 'Anjali Sharma',
    email: 'anjali@zealosh.com',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const instructorUser: User = {
    id: 'usr-term-instructor',
    name: 'Prof. Vikram Rao',
    email: 'vikram@zealosh.com',
    passwordHash: 'hash',
    role: 'INSTRUCTOR',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const unassignedInstructor: User = {
    id: 'usr-term-unassigned',
    name: 'Prof. Unassigned',
    email: 'unassigned@zealosh.com',
    passwordHash: 'hash',
    role: 'INSTRUCTOR',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const course: Course = {
    id: 'crs-term-01',
    slug: 'csp-prep',
    title: 'CSP Exam Prep',
    headline: 'CSP Prep',
    description: 'Prep course',
    deliveryModel: 'HYBRID',
    leadInstructorId: instructorUser.id,
    coInstructorIds: [],
    certificationType: 'CSP',
    status: 'PUBLISHED',
    learningObjectives: [],
    prerequisites: [],
    priceInr: 35000,
    priceUsd: 450,
    durationWeeks: 10,
    coverImage: '/images/cover.jpg',
    modulesCount: 2,
    totalLessons: 10,
    totalHours: 20,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const batch: Batch = {
    id: 'btc-term-01',
    courseId: course.id,
    name: 'CSP Cohort A',
    leadInstructorId: instructorUser.id,
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-12-31T00:00:00Z',
    scheduleDescription: 'Weekends',
    status: 'ACTIVE',
    capacity: 25,
    enrolledCount: 1,
  };

  const liveSession: LiveSession = {
    id: 'ses-term-01',
    batchId: batch.id,
    courseId: course.id,
    title: 'CSP Hazard Analysis Live Workshop',
    scheduledStartTime: '2026-11-01T10:00:00Z',
    durationMinutes: 120,
    instructorId: instructorUser.id,
    meetingId: 'meet-term-01',
    status: 'LIVE',
  };

  beforeEach(async () => {
    await db.saveUser(studentUser);
    await db.saveUser(instructorUser);
    await db.saveUser(unassignedInstructor);
    await db.saveCourse(course);
    db.batches.set(batch.id, batch);
    await db.saveLiveSession({ ...liveSession, status: 'LIVE' });
  });

  it('1. should allow assigned instructor to terminate a live session and update state to ENDED', async () => {
    const endSessionSpy = vi.spyOn(classroomProvider, 'endSession').mockResolvedValue(true);
    const getStatusSpy = vi.spyOn(classroomProvider, 'getSessionStatus').mockResolvedValue({
      meetingId: liveSession.meetingId,
      isRunning: false,
      hasEnded: true,
    });

    const token = signToken({
      userId: instructorUser.id,
      name: instructorUser.name,
      email: instructorUser.email,
      role: instructorUser.role,
      organizationId: instructorUser.organizationId,
    });

    const request = new Request(`http://localhost:3000/api/live/${liveSession.id}/end`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const response = await endLiveSessionHandler(request, { params: { sessionId: liveSession.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe('ENDED');
    expect(data.providerTerminated).toBe(true);

    expect(endSessionSpy).toHaveBeenCalledWith(liveSession.meetingId);

    const updatedSession = await db.getLiveSession(liveSession.id);
    expect(updatedSession?.status).toBe('ENDED');

    endSessionSpy.mockRestore();
    getStatusSpy.mockRestore();
  });

  it('2. should reject session termination when invoked by a student (HTTP 403)', async () => {
    const token = signToken({
      userId: studentUser.id,
      name: studentUser.name,
      email: studentUser.email,
      role: studentUser.role,
      organizationId: studentUser.organizationId,
    });

    const request = new Request(`http://localhost:3000/api/live/${liveSession.id}/end`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const response = await endLiveSessionHandler(request, { params: { sessionId: liveSession.id } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Forbidden');
  });

  it('3. should reject session termination when invoked by an unassigned instructor (HTTP 403)', async () => {
    const token = signToken({
      userId: unassignedInstructor.id,
      name: unassignedInstructor.name,
      email: unassignedInstructor.email,
      role: unassignedInstructor.role,
      organizationId: unassignedInstructor.organizationId,
    });

    const request = new Request(`http://localhost:3000/api/live/${liveSession.id}/end`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const response = await endLiveSessionHandler(request, { params: { sessionId: liveSession.id } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('not assigned as faculty');
  });

  it('4. should be idempotent: terminating an already ended session returns HTTP 200 without redundant provider calls', async () => {
    const endSessionSpy = vi.spyOn(classroomProvider, 'endSession').mockResolvedValue(true);

    // Set session status to ENDED
    const endedSession = { ...liveSession, status: 'ENDED' as const };
    await db.saveLiveSession(endedSession);

    const token = signToken({
      userId: instructorUser.id,
      name: instructorUser.name,
      email: instructorUser.email,
      role: instructorUser.role,
      organizationId: instructorUser.organizationId,
    });

    const request = new Request(`http://localhost:3000/api/live/${liveSession.id}/end`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const response = await endLiveSessionHandler(request, { params: { sessionId: liveSession.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.alreadyEnded).toBe(true);
    expect(data.message).toContain('already ended');

    // Provider should NOT be called again
    expect(endSessionSpy).not.toHaveBeenCalled();

    endSessionSpy.mockRestore();
  });

  it('5. should handle provider timeout gracefully and preserve truthful ENDING state without falsely claiming ENDED', async () => {
    const endSessionSpy = vi
      .spyOn(classroomProvider, 'endSession')
      .mockRejectedValue(new Error('Connection timeout to media node'));

    const activeSession = { ...liveSession, status: 'LIVE' as const };
    await db.saveLiveSession(activeSession);

    const token = signToken({
      userId: instructorUser.id,
      name: instructorUser.name,
      email: instructorUser.email,
      role: instructorUser.role,
      organizationId: instructorUser.organizationId,
    });

    const request = new Request(`http://localhost:3000/api/live/${liveSession.id}/end`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const response = await endLiveSessionHandler(request, { params: { sessionId: liveSession.id } });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.success).toBe(false);
    expect(data.status).toBe('ENDING');
    expect(data.pendingReconciliation).toBe(true);

    const updatedSession = await db.getLiveSession(liveSession.id);
    expect(updatedSession?.status).toBe('ENDING');

    endSessionSpy.mockRestore();
  });

  it('6. should retain ENDING state if provider end request succeeds but meeting is still running', async () => {
    const endSessionSpy = vi.spyOn(classroomProvider, 'endSession').mockResolvedValue(true);
    const getStatusSpy = vi.spyOn(classroomProvider, 'getSessionStatus').mockResolvedValue({
      meetingId: liveSession.meetingId,
      isRunning: true,
      hasEnded: false,
    });

    const activeSession = { ...liveSession, status: 'LIVE' as const };
    await db.saveLiveSession(activeSession);

    const token = signToken({
      userId: instructorUser.id,
      name: instructorUser.name,
      email: instructorUser.email,
      role: instructorUser.role,
      organizationId: instructorUser.organizationId,
    });

    const request = new Request(`http://localhost:3000/api/live/${liveSession.id}/end`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const response = await endLiveSessionHandler(request, { params: { sessionId: liveSession.id } });
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.status).toBe('ENDING');
    expect(data.pendingReconciliation).toBe(true);

    const updatedSession = await db.getLiveSession(liveSession.id);
    expect(updatedSession?.status).toBe('ENDING');

    endSessionSpy.mockRestore();
    getStatusSpy.mockRestore();
  });

  it('7. should reconcile ENDING session to ENDED when provider reports meeting has concluded', async () => {
    const endingSession = { ...liveSession, status: 'ENDING' as const };
    await db.saveLiveSession(endingSession);

    const getStatusSpy = vi.spyOn(classroomProvider, 'getSessionStatus').mockResolvedValue({
      meetingId: liveSession.meetingId,
      isRunning: false,
      hasEnded: true,
    });

    const reconciled = await reconcileSessionTermination(liveSession.id);
    expect(reconciled?.status).toBe('ENDED');

    const updated = await db.getLiveSession(liveSession.id);
    expect(updated?.status).toBe('ENDED');

    getStatusSpy.mockRestore();
  });
});
