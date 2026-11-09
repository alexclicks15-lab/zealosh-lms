import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { LearningMaterial } from '@/types';

describe('Workstream B: Preloaded, Named & Scheduled Live-Class Teaching Materials', () => {

  it('stores learner-facing displayName separate from originalFilename and stores presenterNotes', async () => {
    const material = await db.saveLearningMaterial({
      courseId: 'course-asp',
      batchId: 'batch-asp-01',
      sessionId: 'session-live-01',
      title: 'Internal LEV Calculation Sheet v3_final.pdf',
      displayName: 'Ventilation & Capture Velocity Reference',
      originalFilename: 'Internal LEV Calculation Sheet v3_final.pdf',
      description: 'Reference tables for capture velocity calculations.',
      presenterNotes: 'Walk students through formula on Slide 4 before providing download link.',
      materialType: 'PDF',
      fileUrl: '/materials/lev-calc.pdf',
      releaseCondition: 'ELAPSED_TIME',
      releaseOffsetMinutes: 15,
      allowDownload: true,
      allowView: true,
    });

    expect(material.displayName).toBe('Ventilation & Capture Velocity Reference');
    expect(material.originalFilename).toBe('Internal LEV Calculation Sheet v3_final.pdf');
    expect(material.presenterNotes).toContain('Slide 4');
    expect(material.lifecycleState).toBe('SCHEDULED');
    expect(material.isReleased).toBe(false);
  });

  it('denies student access to unreleased materials (server-enforced gating)', async () => {
    const unreleased = await db.saveLearningMaterial({
      courseId: 'course-asp',
      batchId: 'batch-asp-01',
      title: 'Mid-Session Pop Quiz Worksheet',
      displayName: 'Mid-Session Worksheet',
      materialType: 'PDF',
      fileUrl: '/materials/worksheet.pdf',
      releaseCondition: 'MANUAL',
      isReleased: false,
      lifecycleState: 'SCHEDULED',
      allowView: true,
      allowDownload: true,
    });

    // Student access check MUST fail closed
    const studentAccess = await db.checkMaterialAccess(unreleased.id, {
      id: 'student-user-01',
      role: 'STUDENT',
    });
    expect(studentAccess.canView).toBe(false);
    expect(studentAccess.canDownload).toBe(false);
    expect(studentAccess.reason).toContain('not yet been released');

    // Instructor access check succeeds
    const instructorAccess = await db.checkMaterialAccess(unreleased.id, {
      id: 'instructor-user-01',
      role: 'INSTRUCTOR',
    });
    expect(instructorAccess.canView).toBe(true);
    expect(instructorAccess.canDownload).toBe(true);
  });

  it('automatically reconciles elapsed-time scheduled materials anchored to live session start', async () => {
    const sessionId = 'session-reconcile-test-01';
    const now = new Date();
    // Simulate session started 20 minutes ago
    const started20MinAgo = new Date(now.getTime() - 20 * 60 * 1000).toISOString();

    // Create session in store
    const session = {
      id: sessionId,
      batchId: 'batch-asp-01',
      courseId: 'course-asp',
      title: 'Chemical Safety Workshop',
      scheduledStartTime: started20MinAgo,
      actualStartTime: started20MinAgo,
      startedAt: started20MinAgo,
      durationMinutes: 90,
      instructorId: 'inst-01',
      meetingId: 'meet-01',
      status: 'LIVE' as const,
    };
    db.liveSessions.set(sessionId, session);

    // Material with 10-minute offset (should be released since 20 > 10)
    const mat1 = await db.saveLearningMaterial({
      id: `mat-rec-1-${Date.now()}`,
      courseId: 'course-asp',
      sessionId,
      title: '10-Min Handout',
      displayName: 'First 10-Min Handout',
      materialType: 'PDF',
      releaseCondition: 'ELAPSED_TIME',
      releaseOffsetMinutes: 10,
      isReleased: false,
    });

    // Material with 30-minute offset (should NOT be released yet since 20 < 30)
    const mat2 = await db.saveLearningMaterial({
      id: `mat-rec-2-${Date.now()}`,
      courseId: 'course-asp',
      sessionId,
      title: '30-Min Handout',
      displayName: 'Late 30-Min Handout',
      materialType: 'PDF',
      releaseCondition: 'ELAPSED_TIME',
      releaseOffsetMinutes: 30,
      isReleased: false,
    });

    const reconciliation = await db.reconcileScheduledMaterials(sessionId);
    expect(reconciliation.reconciledCount).toBeGreaterThanOrEqual(1);

    const check1 = await db.getLearningMaterial(mat1.id);
    expect(check1?.isReleased).toBe(true);
    expect(check1?.lifecycleState).toBe('AVAILABLE');

    const check2 = await db.getLearningMaterial(mat2.id);
    expect(check2?.isReleased).toBe(false);
    expect(check2?.lifecycleState).toBe('SCHEDULED');
  });

  it('supports in-class instructor lifecycle transitions: release_now, present, postpone, skip, cancel', async () => {
    const mat = await db.saveLearningMaterial({
      id: `mat-lifecycle-${Date.now()}`,
      courseId: 'course-asp',
      title: 'Slide Pack 4',
      displayName: 'Aerosol Dynamics Slides',
      materialType: 'PRESENTATION',
      releaseCondition: 'MANUAL',
      isReleased: false,
    });

    // 1. Release Now
    const released = await db.releaseMaterialNow(mat.id);
    expect(released?.isReleased).toBe(true);
    expect(released?.lifecycleState).toBe('AVAILABLE');

    // 2. Present
    const presented = await db.presentMaterial(mat.id);
    expect(presented?.lifecycleState).toBe('PRESENTED');
    expect(presented?.presentedAt).toBeDefined();

    // 3. Postpone
    const postponed = await db.postponeMaterial(mat.id, 'Deferred to next lecture due to time constraints');
    expect(postponed?.lifecycleState).toBe('POSTPONED');
    expect(postponed?.isReleased).toBe(false);
    expect(postponed?.postponedReason).toContain('Deferred to next lecture');

    // Verify student is gated with postponed reason
    const studentAccess = await db.checkMaterialAccess(mat.id, { role: 'STUDENT' });
    expect(studentAccess.canView).toBe(false);
    expect(studentAccess.reason).toContain('Deferred to next lecture');

    // 4. Cancel
    const cancelled = await db.cancelMaterial(mat.id, 'Topic covered on whiteboard directly');
    expect(cancelled?.lifecycleState).toBe('CANCELLED');
    expect(cancelled?.cancelledReason).toContain('covered on whiteboard');
  });
});
