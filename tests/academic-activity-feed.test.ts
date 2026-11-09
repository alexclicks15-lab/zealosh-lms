import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { AcademicActivityEvent } from '@/types';

describe('Workstream D: Expanded Student Activity Feed & Tutor Activity Workspace', () => {

  it('records academic activity events and returns chronological feed for enrolled students', async () => {
    const studentId = 'usr-std-01';
    const courseId = 'crs-asp-01';
    const batchId = 'btc-asp-nov26';

    // Record academic event
    const event = await db.recordActivityEvent({
      category: 'MATERIAL_RELEASED',
      title: 'Material Released: Heat Stress Formula Sheet',
      description: 'WBGT calculation formulas are now available.',
      courseId,
      batchId,
      entityType: 'MATERIAL',
      entityId: 'mat-heat-stress',
      actionUrl: '/classroom?tab=classwork',
    });

    expect(event.id).toBeDefined();
    expect(event.createdAt).toBeDefined();

    // Fetch student feed
    const feed = await db.getStudentActivityFeed(studentId, {
      courseId,
      limit: 10,
    });

    expect(feed.events.length).toBeGreaterThanOrEqual(1);
    const found = feed.events.find((e) => e.id === event.id);
    expect(found).toBeDefined();
    expect(found?.title).toContain('Heat Stress');
  });

  it('allows students to mark activity items as read', async () => {
    const studentId = 'usr-std-01';
    const event = await db.recordActivityEvent({
      category: 'ANNOUNCEMENT_POSTED',
      title: 'Mid-term Review Schedule Announcement',
      description: 'Faculty will host open Q&A on Sunday 6 PM IST.',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      entityType: 'ANNOUNCEMENT',
      entityId: 'anc-mid-term',
    });

    // Mark as read
    const marked = await db.markActivityAsRead(event.id, studentId);
    expect(marked).toBe(true);

    // Verify unread filter hides the read event
    const unreadFeed = await db.getStudentActivityFeed(studentId, {
      courseId: 'crs-asp-01',
      isUnreadOnly: true,
    });
    const foundUnread = unreadFeed.events.find((e) => e.id === event.id);
    expect(foundUnread).toBeUndefined();
  });

  it('scopes tutor activity workspace strictly to assigned cohorts with zero sensitive data leakage', async () => {
    const instructorId = 'usr-inst-01'; // Lead instructor for crs-asp-01
    const courseId = 'crs-asp-01';
    const batchId = 'btc-asp-nov26';

    // 1. Record legitimate academic event for assigned course
    await db.recordActivityEvent({
      category: 'ASSIGNMENT_SUBMITTED',
      title: 'Assignment Submitted: Ventilation Risk Assessment',
      description: 'Arjun Menon submitted Revision 2.',
      courseId,
      batchId,
      entityType: 'ASSIGNMENT',
      entityId: 'asg-ventilation',
    });

    // 2. Record academic event for another course NOT taught by this instructor
    await db.recordActivityEvent({
      category: 'ASSIGNMENT_SUBMITTED',
      title: 'Assignment Submitted: Canadian Environmental Protection Act Review',
      description: 'Another student submitted work.',
      courseId: 'crs-crsp-01', // Different course
      batchId: 'btc-crsp-01',
      entityType: 'ASSIGNMENT',
      entityId: 'asg-crsp',
    });

    const tutorView = await db.getTutorActivityView(instructorId);
    expect(tutorView.events.length).toBeGreaterThanOrEqual(1);

    // Verify assigned course activity IS present
    const assignedActivity = tutorView.events.find((e) => e.courseId === courseId);
    expect(assignedActivity).toBeDefined();

    // Verify unassigned course activity IS NOT present (cohort scoping)
    const unassignedActivity = tutorView.events.find((e) => e.courseId === 'course-crsp');
    expect(unassignedActivity).toBeUndefined();

    // Verify strict privacy boundary: external certifications, payments, invoices, applicant ID docs
    for (const ev of tutorView.events) {
      expect((ev as any).invoiceNumber).toBeUndefined();
      expect((ev as any).taxAmount).toBeUndefined();
      expect((ev as any).creditCardLast4).toBeUndefined();
      expect((ev as any).idProofUrl).toBeUndefined();
      expect((ev as any).bcspCandidateId).toBeUndefined();
    }
  });
});
