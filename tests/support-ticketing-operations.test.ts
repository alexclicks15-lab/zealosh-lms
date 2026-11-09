// Zealosh LMS — Phase 5C.3 Support Ticketing, Student Helpdesk & Service Operations Test Suite
// Verifies ticket numbers, category validation, academic linking, confidential internal notes,
// lifecycle transitions, SLA states, notification/email dispatch, analytics, and CSV sanitization.

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { supportService } from '@/lib/support';
import { User, SupportTicketPriority } from '@/types';

describe('Phase 5C.3: Support Ticketing, Student Helpdesk & Service Operations', () => {
  const studentUser: User = {
    id: 'usr_student_01',
    organizationId: 'org-zealosh-main',
    name: 'Aarav Patel',
    email: 'aarav.patel@zealosh.test',
    passwordHash: 'mock-hash',
    role: 'STUDENT',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  };

  const studentUserB: User = {
    id: 'usr_student_02',
    organizationId: 'org-zealosh-main',
    name: 'Diya Sharma',
    email: 'diya.sharma@zealosh.test',
    passwordHash: 'mock-hash',
    role: 'STUDENT',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  };

  const staffUser: User = {
    id: 'usr_staff_01',
    organizationId: 'org-zealosh-main',
    name: 'Priya Nair',
    email: 'priya.nair@zealosh.com',
    passwordHash: 'mock-hash',
    role: 'SUPER_ADMIN',
    permissions: [
      'support.tickets.read',
      'support.tickets.manage',
      'support.tickets.reply',
      'support.tickets.assign',
      'support.tickets.resolve',
      'support.analytics.read',
    ],
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  } as any;

  beforeEach(() => {
    db.clearAll();
    db.users.set(studentUser.id, studentUser);
    db.users.set(studentUserB.id, studentUserB);
    db.users.set(staffUser.id, staffUser);
  });

  // --------------------------------------------------------------------------
  // 1. Unique Human-Readable Ticket Number Generation
  // --------------------------------------------------------------------------
  it('generates sequential and collision-free ticket numbers in ZL-YYYY-XXXXX format', async () => {
    const num1 = await db.generateSupportTicketNumber();
    const num2 = await db.generateSupportTicketNumber();
    const num3 = await db.generateSupportTicketNumber();

    const currentYear = new Date().getFullYear();
    const regex = new RegExp(`^ZL-${currentYear}-\\d{5}$`);

    expect(num1).toMatch(regex);
    expect(num2).toMatch(regex);
    expect(num3).toMatch(regex);

    // Concurrency collision safety: ensure distinct sequence numbers
    expect(num1).not.toBe(num2);
    expect(num2).not.toBe(num3);
  });

  // --------------------------------------------------------------------------
  // 2. Category Validation & Academic Context Constraints
  // --------------------------------------------------------------------------
  it('creates ticket successfully for non-academic category without course/batch', async () => {
    const ticket = await supportService.createTicket(
      {
        categoryId: 'cat_acc_access',
        subject: 'Cannot login to mobile application',
        description: 'Receiving an invalid password prompt despite typing correctly.',
        priority: 'NORMAL',
      },
      studentUser
    );

    expect(ticket).toBeDefined();
    expect(ticket.id).toBeDefined();
    expect(ticket.ticketNumber).toMatch(/^ZL-\d{4}-\d{5}$/);
    expect(ticket.status).toBe('NEW');
    expect(ticket.requesterUserId).toBe(studentUser.id);
    expect(ticket.categoryName).toBe('Account & Login Access');
  });

  it('rejects ticket creation when category requires academic context but neither course nor batch is provided', async () => {
    await expect(
      supportService.createTicket(
        {
          categoryId: 'cat_assignments', // Requires academic context
          subject: 'Question on rubric criteria',
          description: 'Need clarification on risk assessment matrix section.',
        },
        studentUser
      )
    ).rejects.toThrow('ACADEMIC_CONTEXT_REQUIRED');
  });

  it('succeeds when category requires academic context and relatedCourseId is provided', async () => {
    // Seed test course
    db.courses.set('crs-asp-01', {
      id: 'crs-asp-01',
      title: 'Associate Safety Professional (ASP) Certification',
      slug: 'asp-certification',
      certificationType: 'ASP',
      status: 'PUBLISHED',
      createdAt: '2026-10-31T00:00:00Z',
      updatedAt: '2026-10-31T00:00:00Z',
    } as any);

    const ticket = await supportService.createTicket(
      {
        categoryId: 'cat_assignments',
        subject: 'Question on rubric criteria',
        description: 'Need clarification on risk assessment matrix section in assignment 2.',
        relatedCourseId: 'crs-asp-01',
      },
      studentUser
    );

    expect(ticket.relatedCourseId).toBe('crs-asp-01');
    expect(ticket.relatedCourseTitle).toBe('Associate Safety Professional (ASP) Certification');
  });

  // --------------------------------------------------------------------------
  // 3. Strict Public Reply vs Internal Note Confidentiality
  // --------------------------------------------------------------------------
  it('enforces strict confidentiality: internal notes are hidden from student at API & service level', async () => {
    // 1. Student creates ticket
    const ticket = await supportService.createTicket(
      {
        categoryId: 'cat_technical',
        subject: 'WebRTC video stream freezing during live lecture',
        description: 'Video freezes every 2 minutes when instructor shares presentation.',
      },
      studentUser
    );

    // 2. Staff posts a public response to learner
    const publicMsg = await supportService.addMessage(
      ticket.id,
      {
        body: 'Hello Aarav, we are reviewing WebRTC signaling logs for your session.',
        visibility: 'PUBLIC',
      },
      staffUser
    );

    // 3. Staff posts a confidential internal note
    const internalNote = await supportService.addMessage(
      ticket.id,
      {
        body: 'CONFIDENTIAL: Client packet loss was 45% due to ISP throttle. Do not mention server load.',
        visibility: 'INTERNAL',
      },
      staffUser
    );

    expect(publicMsg.visibility).toBe('PUBLIC');
    expect(internalNote.visibility).toBe('INTERNAL');

    // 4. Staff inspects ticket -> Sees BOTH public message and private internal note
    const staffView = await supportService.getTicketById(ticket.id, staffUser);
    expect(staffView).toBeDefined();
    expect(staffView?.messages?.length).toBe(3); // Initial + Public reply + Internal note
    expect(staffView?.messages?.some((m) => m.visibility === 'INTERNAL')).toBe(true);

    // 5. Student inspects ticket -> STRICTLY excludes internal note
    const studentView = await supportService.getTicketById(ticket.id, studentUser);
    expect(studentView).toBeDefined();
    expect(studentView?.messages?.length).toBe(2); // Initial + Public reply only
    expect(studentView?.messages?.some((m) => m.visibility === 'INTERNAL')).toBe(false);
    expect(studentView?.messages?.some((m) => m.body.includes('CONFIDENTIAL'))).toBe(false);

    // 6. Student inspection excludes internal audit events
    expect(studentView?.events?.some((e) => e.eventType === 'INTERNAL_NOTE_ADDED')).toBe(false);
  });

  it('rejects attempts by students to post internal notes', async () => {
    const ticket = await supportService.createTicket(
      {
        categoryId: 'cat_acc_access',
        subject: 'MFA prompt error',
        description: 'Unable to receive SMS token.',
      },
      studentUser
    );

    await expect(
      supportService.addMessage(
        ticket.id,
        {
          body: 'Attempting to inject internal note as student',
          visibility: 'INTERNAL',
        },
        studentUser
      )
    ).rejects.toThrow('FORBIDDEN');
  });

  // --------------------------------------------------------------------------
  // 4. Status Lifecycle Transitions & Auto-Reopen Behavior
  // --------------------------------------------------------------------------
  it('governs valid status transitions and auto-transitions on requester reply', async () => {
    const ticket = await supportService.createTicket(
      {
        categoryId: 'cat_crs_cohort',
        subject: 'Batch schedule timetable query',
        description: 'When is the next weekend practical lab scheduled?',
        relatedCourseId: 'crs-asp-01',
      },
      studentUser
    );

    expect(ticket.status).toBe('NEW');

    // Transition NEW -> OPEN
    const openTicket = await supportService.updateStatus(ticket.id, { status: 'OPEN' }, staffUser);
    expect(openTicket.status).toBe('OPEN');

    // Transition OPEN -> WAITING_FOR_REQUESTER
    const waitingTicket = await supportService.updateStatus(
      ticket.id,
      { status: 'WAITING_FOR_REQUESTER', reason: 'Awaiting student confirmation of batch ID' },
      staffUser
    );
    expect(waitingTicket.status).toBe('WAITING_FOR_REQUESTER');

    // Student replies -> Automatically transitions back to OPEN
    await supportService.addMessage(
      ticket.id,
      {
        body: 'I am enrolled in Batch B-2026-OCT-01.',
        visibility: 'PUBLIC',
      },
      studentUser
    );

    const reloaded = await db.getSupportTicketById(ticket.id);
    expect(reloaded?.status).toBe('OPEN');

    // Staff resolves ticket
    const resolvedTicket = await supportService.updateStatus(ticket.id, { status: 'RESOLVED' }, staffUser);
    expect(resolvedTicket.status).toBe('RESOLVED');
    expect(resolvedTicket.resolvedAt).toBeDefined();
    expect(resolvedTicket.resolvedByUserId).toBe(staffUser.id);

    // Student reopens resolved ticket
    const reopenedTicket = await supportService.updateStatus(ticket.id, { status: 'OPEN' }, studentUser);
    expect(reopenedTicket.status).toBe('OPEN');
    expect(reopenedTicket.reopenCount).toBe(1);
    expect(reopenedTicket.reopenedAt).toBeDefined();
    expect(reopenedTicket.reopenedByUserId).toBe(studentUser.id);
  });

  it('rejects invalid status transitions violating lifecycle rules', async () => {
    const ticket = await supportService.createTicket(
      {
        categoryId: 'cat_technical',
        subject: 'Download button not responding',
        description: 'Clicking syllabus download does nothing.',
      },
      studentUser
    );

    // NEW cannot transition directly to CLOSED without resolution or triage
    await expect(
      supportService.updateStatus(ticket.id, { status: 'CLOSED' as any }, studentUser)
    ).rejects.toThrow('FORBIDDEN');
  });

  // --------------------------------------------------------------------------
  // 5. Team and Agent Assignment Operations
  // --------------------------------------------------------------------------
  it('assigns tickets to teams and specialized agents, auto-transitioning NEW to OPEN', async () => {
    const ticket = await supportService.createTicket(
      {
        categoryId: 'cat_technical',
        subject: 'Camera permission prompt fails',
        description: 'Browser blocks camera on WebRTC join.',
      },
      studentUser
    );

    expect(ticket.status).toBe('NEW');

    const assigned = await supportService.assignTicket(
      ticket.id,
      {
        assignedTeamId: 'team_technical_ops',
        assignedAgentUserId: staffUser.id,
        reason: 'Routing to Infrastructure on-call specialist',
      },
      staffUser
    );

    expect(assigned.assignedTeamId).toBe('team_technical_ops');
    expect(assigned.assignedTeamName).toBe('Technical Operations & Infrastructure');
    expect(assigned.assignedAgentUserId).toBe(staffUser.id);
    expect(assigned.assignedAgentName).toBe(staffUser.name);
    expect(assigned.status).toBe('OPEN'); // Auto-transitioned from NEW
  });

  // --------------------------------------------------------------------------
  // 6. In-App Notification and Email Outbox Queueing Integrations
  // --------------------------------------------------------------------------
  it('creates in-app notifications and queues email outbox jobs on ticket creation and public replies', async () => {
    const ticket = await supportService.createTicket(
      {
        categoryId: 'cat_acc_access',
        subject: 'Password reset link expired',
        description: 'Received email but the link timed out.',
      },
      studentUser
    );

    // 1. Verify in-app notification created for student
    const studentNotifs = Array.from(db.notifications.values()).filter(
      (n) => n.recipientUserId === studentUser.id && n.type === 'SUPPORT_TICKET_UPDATE'
    );
    expect(studentNotifs.length).toBeGreaterThan(0);
    expect(studentNotifs[0].entityType).toBe('SUPPORT_TICKET');
    expect(studentNotifs[0].entityId).toBe(ticket.id);

    // 2. Verify transactional email outbox job queued
    const outboxJobs = Array.from(db.emailOutbox.values()).filter(
      (j) => j.recipientUserId === studentUser.id && j.eventType === 'SUPPORT_TICKET_CREATED'
    );
    expect(outboxJobs.length).toBe(1);
    expect(outboxJobs[0].recipientEmail).toBe(studentUser.email);
    expect(outboxJobs[0].templateId).toBe('tpl-support-ticket-created');
    expect(outboxJobs[0].status).toBe('QUEUED');

    // 3. Staff public reply queues reply email
    await supportService.addMessage(
      ticket.id,
      {
        body: 'A new password reset token has been dispatched.',
        visibility: 'PUBLIC',
      },
      staffUser
    );

    const replyEmailJobs = Array.from(db.emailOutbox.values()).filter(
      (j) => j.recipientUserId === studentUser.id && j.eventType === 'SUPPORT_TICKET_REPLY'
    );
    expect(replyEmailJobs.length).toBe(1);

    // 4. Staff internal note NEVER queues email
    const preInternalJobCount = db.emailOutbox.size;
    await supportService.addMessage(
      ticket.id,
      {
        body: 'Internal note: Token lifetime is set to 15 minutes.',
        visibility: 'INTERNAL',
      },
      staffUser
    );
    expect(db.emailOutbox.size).toBe(preInternalJobCount); // Zero new email jobs
  });

  // --------------------------------------------------------------------------
  // 7. SLA State Tracking Foundation & Unconfigured State Explicit Governance
  // --------------------------------------------------------------------------
  it('explicitly reports NOT_CONFIGURED when no SLA policy matches, with zero fabricated compliance', async () => {
    const ticket = await supportService.createTicket(
      {
        categoryId: 'cat_acc_access',
        subject: 'General profile question',
        description: 'How do I update my postal address?',
        priority: 'NORMAL',
      },
      studentUser
    );

    expect(ticket.slaStatus).toBe('NOT_CONFIGURED');
    expect(ticket.firstResponseDueAt).toBeUndefined();
    expect(ticket.resolutionDueAt).toBeUndefined();

    // Analytics reports 0% compliance and summarizes NOT_CONFIGURED
    const analytics = await supportService.getSupportAnalytics(staffUser);
    expect(analytics.slaCompliancePercent).toBe(0);
    expect(analytics.slaStateSummary.notConfigured).toBeGreaterThan(0);
  });

  it('calculates SLA deadlines accurately when an active SLA policy matches', async () => {
    // Seed SLA policy for HSE Examinations
    db.supportSlaPolicies.set('sla_hse_high', {
      id: 'sla_hse_high',
      organizationId: 'org-zealosh-main',
      name: 'HSE Exam Urgent Resolution Policy',
      categoryId: 'cat_hse_exams',
      priority: 'HIGH',
      firstResponseTargetHours: 2,
      resolutionTargetHours: 6,
      isActive: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    });

    const ticket = await supportService.createTicket(
      {
        categoryId: 'cat_hse_exams',
        subject: 'Exam timer stopped unexpectedly',
        description: 'During Domain 2, countdown froze at 45:00.',
        priority: 'HIGH',
        relatedCourseId: 'crs-asp-01',
      },
      studentUser
    );

    expect(ticket.slaStatus).toBe('WITHIN_SLA');
    expect(ticket.slaPolicyId).toBe('sla_hse_high');
    expect(ticket.firstResponseDueAt).toBeDefined();
    expect(ticket.resolutionDueAt).toBeDefined();

    // Verify first response target hours (~2 hours ahead)
    const createdTime = new Date(ticket.createdAt).getTime();
    const firstDueTime = new Date(ticket.firstResponseDueAt!).getTime();
    const diffHours = (firstDueTime - createdTime) / (1000 * 3600);
    expect(Math.round(diffHours)).toBe(2);
  });

  // --------------------------------------------------------------------------
  // 8. Operational Analytics and KPI Metric Calculation
  // --------------------------------------------------------------------------
  it('computes queue metrics, backlog totals, and response benchmarks', async () => {
    // Ticket 1: Resolved
    const t1 = await supportService.createTicket(
      { categoryId: 'cat_acc_access', subject: 'T1 Issue', description: 'Test desc 1' },
      studentUser
    );
    await supportService.addMessage(t1.id, { body: 'Public response 1', visibility: 'PUBLIC' }, staffUser);
    await supportService.updateStatus(t1.id, { status: 'RESOLVED' }, staffUser);

    // Ticket 2: Open
    const t2 = await supportService.createTicket(
      { categoryId: 'cat_technical', subject: 'T2 Issue', description: 'Test desc 2', priority: 'HIGH' },
      studentUser
    );
    await supportService.updateStatus(t2.id, { status: 'OPEN' }, staffUser);

    const analytics = await supportService.getSupportAnalytics(staffUser);

    expect(analytics.totalTicketsCount).toBe(2);
    expect(analytics.resolvedCount).toBe(1);
    expect(analytics.openTicketsCount).toBe(1);
    expect(analytics.highOrUrgentCount).toBe(1);
    expect(analytics.ticketsByCategory.length).toBe(2);
  });

  // --------------------------------------------------------------------------
  // 9. Sanitized CSV Export & Formula Injection Prevention
  // --------------------------------------------------------------------------
  it('generates sanitized RFC 4180 CSV export protecting against spreadsheet formula injection', async () => {
    await supportService.createTicket(
      {
        categoryId: 'cat_acc_access',
        subject: '=CMD|"/C calc"!A0 Malicious Formula Subject',
        description: 'Test description with formula trigger',
      },
      studentUser
    );

    const csv = await supportService.exportTicketsCsv({}, staffUser);

    expect(csv).toBeDefined();
    expect(typeof csv).toBe('string');

    // Verifies RFC 4180 header
    expect(csv).toContain('"Ticket Number","Subject","Category","Status","Priority"');

    // Verifies formula sanitization: leading '=' must be escaped with single quote "'"
    expect(csv).toContain('\'=CMD|""/C calc""!A0 Malicious Formula Subject');
  });

  // --------------------------------------------------------------------------
  // 10. Multi-Tenant and Cross-User Role Boundary Enforcement
  // --------------------------------------------------------------------------
  it('strictly isolates tickets: Student B cannot view or list Student A tickets', async () => {
    const ticketA = await supportService.createTicket(
      {
        categoryId: 'cat_acc_access',
        subject: 'Student A private ticket',
        description: 'Confidential student details',
      },
      studentUser
    );

    // Student A can query their tickets
    const studentAList = await supportService.getTickets({}, studentUser);
    expect(studentAList.tickets.some((t) => t.id === ticketA.id)).toBe(true);

    // Student B queries their tickets -> Zero tickets returned
    const studentBList = await supportService.getTickets({}, studentUserB);
    expect(studentBList.tickets.some((t) => t.id === ticketA.id)).toBe(false);

    // Student B direct ID lookup -> Forbidden
    await expect(
      supportService.getTicketById(ticketA.id, studentUserB)
    ).rejects.toThrow('FORBIDDEN');
  });
});
