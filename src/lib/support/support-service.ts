// Zealosh LMS — Phase 5C.3 Support Ticketing & Helpdesk Service
// Single source of truth for ticket operations, confidentiality enforcement,
// SLA state management, and academic notification dispatch.

import { db } from '@/lib/store/db';
import { emailOutboxService } from '@/lib/email/email-outbox-service';
import { generateSanitizedCsv, CsvColumn } from '@/lib/reporting/csv-sanitizer';
import {
  User,
  SupportTicket,
  SupportTicketMessage,
  SupportTicketEvent,
  SupportTicketAttachment,
  SupportTicketStatus,
  SupportTicketPriority,
  SupportTicketImpact,
  SupportMessageVisibility,
  SupportSlaStatus,
  SupportAnalyticsOverview,
  SupportTicketFilterParams,
  CreateSupportTicketInput,
  AddTicketMessageInput,
  UpdateTicketStatusInput,
  AssignTicketInput,
} from '@/types';

const ALLOWED_STATUS_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  NEW: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED'],
  WAITING_FOR_REQUESTER: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
};

function isSupportStaffOrAdmin(user: User): boolean {
  const role = user.role as string;
  if (role === 'SUPER_ADMIN' || role === 'ORG_ADMIN' || role === 'SUPPORT_STAFF' || role === 'ADMIN') {
    return true;
  }
  const perms = (user as any).permissions as string[] | undefined;
  return !!perms && perms.some((p) => p.startsWith('support.'));
}

export class SupportService {
  /**
   * Creates a new support ticket submitted by a learner, instructor, or staff member.
   * Enforces category validation, academic context requirements, SLA policy assignment,
   * initial message creation, audit logging, and notification dispatch.
   */
  public async createTicket(input: CreateSupportTicketInput, requester: User): Promise<SupportTicket> {
    if (!input.subject || input.subject.trim().length < 3) {
      throw new Error('INVALID_SUBJECT: Ticket subject must be at least 3 characters');
    }
    if (!input.description || input.description.trim().length < 5) {
      throw new Error('INVALID_DESCRIPTION: Ticket description must be at least 5 characters');
    }

    // 1. Category validation
    const category = await db.getSupportCategoryById(input.categoryId);
    if (!category || !category.isActive) {
      throw new Error(`INVALID_CATEGORY: Support category "${input.categoryId}" not found or inactive`);
    }

    // 2. Academic Context enforcement
    let relatedCourseTitle: string | undefined;
    let relatedBatchName: string | undefined;

    if (category.requiresAcademicContext) {
      if (!input.relatedCourseId && !input.relatedBatchId) {
        throw new Error(`ACADEMIC_CONTEXT_REQUIRED: Category "${category.name}" requires selecting a course or batch`);
      }
    }

    if (input.relatedCourseId) {
      const course = await db.getCourseById(input.relatedCourseId);
      if (course) relatedCourseTitle = course.title;
    }

    if (input.relatedBatchId) {
      const batch = await db.getBatchById(input.relatedBatchId);
      if (batch) relatedBatchName = batch.name;
    }

    // 3. Collision-Safe Ticket Number Generation
    const ticketNumber = await db.generateSupportTicketNumber();

    // 4. SLA Policy Resolution
    const priority = input.priority || category.defaultPriority || 'NORMAL';
    const slaPolicies = await db.getSupportSlaPolicies(true);
    const matchedPolicy =
      slaPolicies.find((p) => p.categoryId === category.id && p.priority === priority) ||
      slaPolicies.find((p) => !p.categoryId && p.priority === priority);

    const now = new Date().toISOString();
    let slaStatus: SupportSlaStatus = 'NOT_CONFIGURED';
    let slaPolicyId: string | undefined;
    let firstResponseDueAt: string | undefined;
    let resolutionDueAt: string | undefined;

    if (matchedPolicy) {
      slaStatus = 'WITHIN_SLA';
      slaPolicyId = matchedPolicy.id;
      firstResponseDueAt = new Date(Date.now() + matchedPolicy.firstResponseTargetHours * 3600 * 1000).toISOString();
      resolutionDueAt = new Date(Date.now() + matchedPolicy.resolutionTargetHours * 3600 * 1000).toISOString();
    }

    // 5. Default Team Assignment
    let assignedTeamId: string | undefined = category.defaultTeamId;
    let assignedTeamName: string | undefined;
    if (assignedTeamId) {
      const team = await db.getSupportTeamById(assignedTeamId);
      if (team) assignedTeamName = team.name;
    }

    // 6. Build and persist ticket record
    const ticketId = `tkt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const ticket: SupportTicket = {
      id: ticketId,
      organizationId: requester.organizationId || 'org-zealosh-main',
      ticketNumber,
      requesterUserId: requester.id,
      requesterRole: requester.role || 'STUDENT',
      requesterName: requester.name || requester.email,
      requesterEmail: requester.email,
      categoryId: category.id,
      categoryName: category.name,
      subject: input.subject.trim(),
      description: input.description.trim(),
      status: 'NEW',
      priority,
      impact: input.impact || 'MEDIUM',
      assignedTeamId,
      assignedTeamName,
      relatedCourseId: input.relatedCourseId,
      relatedCourseTitle,
      relatedBatchId: input.relatedBatchId,
      relatedBatchName,
      relatedSessionId: input.relatedSessionId,
      relatedAssignmentId: input.relatedAssignmentId,
      relatedExamAttemptId: input.relatedExamAttemptId,
      reopenCount: 0,
      slaPolicyId,
      slaStatus,
      firstResponseDueAt,
      resolutionDueAt,
      version: 1,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    const savedTicket = await db.createSupportTicket(ticket);

    // 7. Create initial public message
    const messageId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const initialMessage: SupportTicketMessage = {
      id: messageId,
      organizationId: ticket.organizationId,
      ticketId: savedTicket.id,
      authorUserId: requester.id,
      authorName: requester.name || requester.email,
      authorRole: requester.role || 'STUDENT',
      visibility: 'PUBLIC',
      body: input.description.trim(),
      createdAt: now,
    };
    await db.addSupportTicketMessage(initialMessage);

    // 8. Attachments
    if (input.attachments && input.attachments.length > 0) {
      for (const att of input.attachments) {
        const attachmentId = `att_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        await db.addSupportTicketAttachment({
          id: attachmentId,
          organizationId: ticket.organizationId,
          ticketId: savedTicket.id,
          messageId,
          uploadedByUserId: requester.id,
          storageProvider: 'SUPABASE_STORAGE',
          storageBucket: att.storageBucket || 'support-attachments',
          storageKey: att.storageKey,
          originalFilename: att.originalFilename,
          sanitizedFilename: att.sanitizedFilename,
          contentType: att.contentType,
          fileSize: att.fileSize,
          createdAt: now,
        });
      }
    }

    // 9. Immutable audit event
    const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    await db.addSupportTicketEvent({
      id: eventId,
      organizationId: ticket.organizationId,
      ticketId: savedTicket.id,
      actorUserId: requester.id,
      actorName: requester.name || requester.email,
      actorRole: requester.role || 'STUDENT',
      eventType: 'TICKET_CREATED',
      newValue: 'NEW',
      reason: 'Support ticket submitted by requester',
      createdAt: now,
    });

    // 10. Dispatches: In-App Notification & Transactional Email
    try {
      await db.createNotification({
        recipientUserId: requester.id,
        type: 'SUPPORT_TICKET_UPDATE',
        title: `Support Request Received: ${ticketNumber}`,
        description: `Your ticket regarding "${ticket.subject}" has been received and queued for review.`,
        entityType: 'SUPPORT_TICKET',
        entityId: savedTicket.id,
        actionUrl: `/support/tickets/${savedTicket.id}`,
        idempotencyKey: `notif_tkt_create_${savedTicket.id}`,
      });
    } catch (e) {
      console.warn('[SupportService] In-app notification creation skipped or failed:', e);
    }

    // Queue transactional confirmation email (safely handling unconfigured provider)
    try {
      await emailOutboxService.queueSupportTicketCreatedEmail(savedTicket);
    } catch (e) {
      console.warn('[SupportService] Email outbox queueing skipped or failed:', e);
    }

    savedTicket.messages = [initialMessage];
    return savedTicket;
  }

  /**
   * Retrieves a filtered list of tickets scoped strictly by user role and permissions.
   * Students only see tickets where they are the requester.
   */
  public async getTickets(
    filter: SupportTicketFilterParams = {},
    caller: User
  ): Promise<{ tickets: SupportTicket[]; totalCount: number }> {
    const isStaffOrAdmin = isSupportStaffOrAdmin(caller);

    const effectiveFilter: SupportTicketFilterParams = { ...filter };

    // Enforce role boundaries: Students and unauthorized users can ONLY query their own tickets
    if (!isStaffOrAdmin) {
      effectiveFilter.requesterUserId = caller.id;
    }

    return await db.getSupportTickets(effectiveFilter);
  }

  /**
   * Retrieves a single ticket by ID. Enforces strict message confidentiality:
   * Requesters/Students CANNOT see INTERNAL notes or INTERNAL note events.
   */
  public async getTicketById(ticketId: string, caller: User): Promise<SupportTicket | null> {
    const ticket = await db.getSupportTicketById(ticketId);
    if (!ticket) return null;

    const isStaffOrAdmin = isSupportStaffOrAdmin(caller);

    // Requesters can only access their own tickets
    if (!isStaffOrAdmin && ticket.requesterUserId !== caller.id) {
      throw new Error('FORBIDDEN: You do not have permission to view this support ticket');
    }

    // Confidentiality enforcement: Include internal notes ONLY for authorized support staff
    const includeInternal = isStaffOrAdmin;
    const messages = await db.getSupportTicketMessages(ticketId, includeInternal);
    const events = await db.getSupportTicketEvents(ticketId, includeInternal);
    const attachments = await db.getSupportTicketAttachments(ticketId);

    return {
      ...ticket,
      messages,
      events,
      attachments,
    };
  }

  /**
   * Adds a reply or internal note to a ticket.
   * If a student replies to a ticket in WAITING_FOR_REQUESTER, it automatically transitions back to OPEN.
   * If staff posts the first public reply, firstResponseAt is recorded.
   */
  public async addMessage(
    ticketId: string,
    input: AddTicketMessageInput,
    caller: User
  ): Promise<SupportTicketMessage> {
    if (!input.body || input.body.trim().length === 0) {
      throw new Error('INVALID_MESSAGE: Message body cannot be empty');
    }

    const ticket = await db.getSupportTicketById(ticketId);
    if (!ticket) {
      throw new Error('TICKET_NOT_FOUND: Support ticket not found');
    }

    const isStaffOrAdmin = isSupportStaffOrAdmin(caller);

    // Student access check
    if (!isStaffOrAdmin) {
      if (ticket.requesterUserId !== caller.id) {
        throw new Error('FORBIDDEN: You can only reply to your own support tickets');
      }
      if (input.visibility === 'INTERNAL') {
        throw new Error('FORBIDDEN: Requesters cannot post internal notes');
      }
    }

    const visibility: SupportMessageVisibility = isStaffOrAdmin ? input.visibility : 'PUBLIC';
    const now = new Date().toISOString();
    const messageId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    const message: SupportTicketMessage = {
      id: messageId,
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      authorUserId: caller.id,
      authorName: caller.name || caller.email,
      authorRole: caller.role || 'STUDENT',
      visibility,
      body: input.body.trim(),
      createdAt: now,
    };

    await db.addSupportTicketMessage(message);

    // Save attachments if provided
    if (input.attachments && input.attachments.length > 0) {
      for (const att of input.attachments) {
        const attachmentId = `att_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        await db.addSupportTicketAttachment({
          id: attachmentId,
          organizationId: ticket.organizationId,
          ticketId: ticket.id,
          messageId,
          uploadedByUserId: caller.id,
          storageProvider: 'SUPABASE_STORAGE',
          storageBucket: att.storageBucket || 'support-attachments',
          storageKey: att.storageKey,
          originalFilename: att.originalFilename,
          sanitizedFilename: att.sanitizedFilename,
          contentType: att.contentType,
          fileSize: att.fileSize,
          createdAt: now,
        });
      }
    }

    // Record immutable event
    const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    await db.addSupportTicketEvent({
      id: eventId,
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      actorUserId: caller.id,
      actorName: caller.name || caller.email,
      actorRole: caller.role || 'STUDENT',
      eventType: visibility === 'INTERNAL' ? 'INTERNAL_NOTE_ADDED' : 'PUBLIC_REPLY_ADDED',
      reason: visibility === 'INTERNAL' ? 'Internal note added' : 'Public response posted',
      createdAt: now,
    });

    // Lifecycle transitions based on reply
    let ticketNeedsUpdate = false;

    // A. Student replies on a ticket that was waiting for them -> transition back to OPEN
    if (caller.id === ticket.requesterUserId && ticket.status === 'WAITING_FOR_REQUESTER') {
      const prevStatus = ticket.status;
      ticket.status = 'OPEN';
      ticketNeedsUpdate = true;

      await db.addSupportTicketEvent({
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        actorUserId: caller.id,
        actorName: caller.name || caller.email,
        actorRole: caller.role || 'STUDENT',
        eventType: 'STATUS_CHANGED',
        previousValue: prevStatus,
        newValue: 'OPEN',
        reason: 'Requester responded with information',
        createdAt: now,
      });
    }

    // B. Staff replies publicly -> record first response time if unset
    if (isStaffOrAdmin && visibility === 'PUBLIC') {
      if (!ticket.firstResponseAt) {
        ticket.firstResponseAt = now;
        if (ticket.status === 'NEW') {
          ticket.status = 'OPEN';
        }
        ticketNeedsUpdate = true;
      }
    }

    if (ticketNeedsUpdate) {
      ticket.updatedAt = now;
      await db.updateSupportTicket(ticket);
    }

    // Dispatches
    if (visibility === 'PUBLIC') {
      if (isStaffOrAdmin) {
        // Staff replied -> notify requester
        try {
          await db.createNotification({
            recipientUserId: ticket.requesterUserId,
            type: 'SUPPORT_TICKET_UPDATE',
            title: `New Reply on Ticket: ${ticket.ticketNumber}`,
            description: `${caller.name || 'Support Staff'} responded to your ticket "${ticket.subject}".`,
            entityType: 'SUPPORT_TICKET',
            entityId: ticket.id,
            actionUrl: `/support/tickets/${ticket.id}`,
            idempotencyKey: `notif_reply_${message.id}_${ticket.requesterUserId}`,
          });
          await emailOutboxService.queueSupportTicketReplyEmail(
            ticket,
            message,
            ticket.requesterEmail,
            ticket.requesterName,
            ticket.requesterUserId
          );
        } catch (e) {
          console.warn('[SupportService] Failed dispatching requester reply alerts:', e);
        }
      } else {
        // Student replied -> notify assigned agent if set
        if (ticket.assignedAgentUserId) {
          try {
            await db.createNotification({
              recipientUserId: ticket.assignedAgentUserId,
              type: 'SUPPORT_TICKET_UPDATE',
              title: `Learner Replied: ${ticket.ticketNumber}`,
              description: `${ticket.requesterName} posted a response on "${ticket.subject}".`,
              entityType: 'SUPPORT_TICKET',
              entityId: ticket.id,
              actionUrl: `/admin/support?ticketId=${ticket.id}`,
              idempotencyKey: `notif_reply_${message.id}_${ticket.assignedAgentUserId}`,
            });
          } catch (e) {
            console.warn('[SupportService] Failed notifying assigned agent:', e);
          }
        }
      }
    }

    return message;
  }

  /**
   * Updates ticket status enforcing the strict lifecycle transition matrix.
   */
  public async updateStatus(
    ticketId: string,
    input: UpdateTicketStatusInput,
    caller: User
  ): Promise<SupportTicket> {
    const ticket = await db.getSupportTicketById(ticketId);
    if (!ticket) {
      throw new Error('TICKET_NOT_FOUND: Support ticket not found');
    }

    const isStaffOrAdmin = isSupportStaffOrAdmin(caller);

    // Requester can only close their own resolved ticket or reopen it
    if (!isStaffOrAdmin) {
      if (ticket.requesterUserId !== caller.id) {
        throw new Error('FORBIDDEN: You can only update the status of your own tickets');
      }
      if (input.status === 'CLOSED' && ticket.status !== 'RESOLVED') {
        throw new Error('FORBIDDEN: Requesters can only close tickets that are marked as RESOLVED');
      }
      if (input.status === 'OPEN' && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
        throw new Error('FORBIDDEN: Requesters can only reopen tickets that are marked as RESOLVED or CLOSED');
      }
      if (!['CLOSED', 'OPEN'].includes(input.status)) {
        throw new Error('FORBIDDEN: Requesters can only close or reopen resolved tickets');
      }
    }

    const currentStatus = ticket.status;
    const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(input.status)) {
      throw new Error(
        `INVALID_STATUS_TRANSITION: Cannot transition ticket from "${currentStatus}" to "${input.status}"`
      );
    }

    const now = new Date().toISOString();
    ticket.status = input.status;
    ticket.updatedAt = now;

    if (input.status === 'RESOLVED') {
      ticket.resolvedAt = now;
      ticket.resolvedByUserId = caller.id;
    } else if (input.status === 'CLOSED') {
      ticket.closedAt = now;
      ticket.closedByUserId = caller.id;
    } else if (input.status === 'OPEN' && (currentStatus === 'RESOLVED' || currentStatus === 'CLOSED')) {
      ticket.reopenedAt = now;
      ticket.reopenedByUserId = caller.id;
      ticket.reopenCount = (ticket.reopenCount || 0) + 1;
    }

    const updated = await db.updateSupportTicket(ticket);

    // Record immutable audit event
    const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    await db.addSupportTicketEvent({
      id: eventId,
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      actorUserId: caller.id,
      actorName: caller.name || caller.email,
      actorRole: caller.role || 'STUDENT',
      eventType: input.status === 'RESOLVED' ? 'RESOLVED' : input.status === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGED',
      previousValue: currentStatus,
      newValue: input.status,
      reason: input.reason || `Status updated from ${currentStatus} to ${input.status}`,
      createdAt: now,
    });

    // Notify requester if resolved or closed by staff
    if (isStaffOrAdmin && (input.status === 'RESOLVED' || input.status === 'CLOSED')) {
      try {
        await db.createNotification({
          recipientUserId: ticket.requesterUserId,
          type: 'SUPPORT_TICKET_UPDATE',
          title: `Ticket ${input.status === 'RESOLVED' ? 'Resolved' : 'Closed'}: ${ticket.ticketNumber}`,
          description: `Your ticket "${ticket.subject}" has been marked as ${input.status.toLowerCase()}.`,
          entityType: 'SUPPORT_TICKET',
          entityId: ticket.id,
          actionUrl: `/support/tickets/${ticket.id}`,
          idempotencyKey: `notif_status_${ticket.id}_${input.status}`,
        });
      } catch (e) {
        console.warn('[SupportService] Failed dispatching status notification:', e);
      }
    }

    return updated;
  }

  /**
   * Assigns a ticket to a specialized support team or dedicated staff agent.
   */
  public async assignTicket(ticketId: string, input: AssignTicketInput, caller: User): Promise<SupportTicket> {
    const isAuthorized = isSupportStaffOrAdmin(caller);

    if (!isAuthorized) {
      throw new Error('FORBIDDEN: You do not have permission to assign support tickets');
    }

    const ticket = await db.getSupportTicketById(ticketId);
    if (!ticket) {
      throw new Error('TICKET_NOT_FOUND: Support ticket not found');
    }

    const now = new Date().toISOString();
    let teamName: string | undefined;
    let agentName: string | undefined;
    let agentEmail: string | undefined;

    if (input.assignedTeamId) {
      const team = await db.getSupportTeamById(input.assignedTeamId);
      if (!team) throw new Error(`TEAM_NOT_FOUND: Team ${input.assignedTeamId} does not exist`);
      teamName = team.name;
    }

    if (input.assignedAgentUserId) {
      const agent = await db.getUserById(input.assignedAgentUserId);
      if (!agent) throw new Error(`AGENT_NOT_FOUND: User ${input.assignedAgentUserId} does not exist`);
      agentName = agent.name;
      agentEmail = agent.email;
    }

    const prevTeamId = ticket.assignedTeamId;
    const prevAgentId = ticket.assignedAgentUserId;

    ticket.assignedTeamId = input.assignedTeamId || undefined;
    ticket.assignedTeamName = teamName;
    ticket.assignedAgentUserId = input.assignedAgentUserId || undefined;
    ticket.assignedAgentName = agentName;
    ticket.assignedAgentEmail = agentEmail;
    ticket.updatedAt = now;

    // If ticket was in NEW state, auto-transition to OPEN
    if (ticket.status === 'NEW') {
      ticket.status = 'OPEN';
    }

    const updated = await db.updateSupportTicket(ticket);

    // Record team assignment event if changed
    if (prevTeamId !== ticket.assignedTeamId) {
      await db.addSupportTicketEvent({
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        actorUserId: caller.id,
        actorName: caller.name || caller.email,
        actorRole: caller.role,
        eventType: 'TEAM_ASSIGNED',
        previousValue: prevTeamId,
        newValue: ticket.assignedTeamId,
        reason: input.reason || 'Team assignment updated',
        createdAt: now,
      });
    }

    // Record agent assignment event if changed
    if (prevAgentId !== ticket.assignedAgentUserId) {
      await db.addSupportTicketEvent({
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        actorUserId: caller.id,
        actorName: caller.name || caller.email,
        actorRole: caller.role,
        eventType: 'AGENT_ASSIGNED',
        previousValue: prevAgentId,
        newValue: ticket.assignedAgentUserId,
        reason: input.reason || 'Agent assignment updated',
        createdAt: now,
      });

      // Notify the newly assigned agent
      if (ticket.assignedAgentUserId && ticket.assignedAgentUserId !== caller.id) {
        try {
          await db.createNotification({
            recipientUserId: ticket.assignedAgentUserId,
            type: 'SUPPORT_TICKET_UPDATE',
            title: `Ticket Assigned: ${ticket.ticketNumber}`,
            description: `You have been assigned to handle support ticket "${ticket.subject}".`,
            entityType: 'SUPPORT_TICKET',
            entityId: ticket.id,
            actionUrl: `/admin/support?ticketId=${ticket.id}`,
            idempotencyKey: `notif_assign_${ticket.id}_${ticket.assignedAgentUserId}`,
          });
        } catch (e) {
          console.warn('[SupportService] Failed notifying assigned agent:', e);
        }
      }
    }

    return updated;
  }

  /**
   * Updates ticket priority and recalculates SLA if applicable.
   */
  public async updatePriority(
    ticketId: string,
    priority: SupportTicketPriority,
    caller: User,
    reason?: string
  ): Promise<SupportTicket> {
    const isAuthorized = isSupportStaffOrAdmin(caller);

    if (!isAuthorized) {
      throw new Error('FORBIDDEN: You do not have permission to change ticket priority');
    }

    const ticket = await db.getSupportTicketById(ticketId);
    if (!ticket) throw new Error('TICKET_NOT_FOUND: Support ticket not found');

    const prevPriority = ticket.priority;
    if (prevPriority === priority) return ticket;

    const now = new Date().toISOString();
    ticket.priority = priority;
    ticket.updatedAt = now;

    const updated = await db.updateSupportTicket(ticket);

    await db.addSupportTicketEvent({
      id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      actorUserId: caller.id,
      actorName: caller.name || caller.email,
      actorRole: caller.role,
      eventType: 'PRIORITY_CHANGED',
      previousValue: prevPriority,
      newValue: priority,
      reason: reason || `Priority changed to ${priority}`,
      createdAt: now,
    });

    return updated;
  }

  /**
   * Computes institutional support analytics and queue KPIs.
   * Explicitly sets SLA compliance to 0% and status to NOT_CONFIGURED when no SLA policies match.
   */
  public async getSupportAnalytics(caller: User): Promise<SupportAnalyticsOverview> {
    const isAuthorized = isSupportStaffOrAdmin(caller);

    if (!isAuthorized) {
      throw new Error('FORBIDDEN: You do not have permission to view support analytics');
    }

    const { tickets } = await db.getSupportTickets();

    const totalTicketsCount = tickets.length;
    const openTicketsCount = tickets.filter((t) =>
      ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER'].includes(t.status)
    ).length;
    const newUntriagedCount = tickets.filter((t) => t.status === 'NEW').length;
    const inProgressCount = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
    const waitingForRequesterCount = tickets.filter((t) => t.status === 'WAITING_FOR_REQUESTER').length;
    const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED').length;
    const closedCount = tickets.filter((t) => t.status === 'CLOSED').length;
    const unassignedCount = tickets.filter(
      (t) => !t.assignedAgentUserId && !t.assignedTeamId && !['RESOLVED', 'CLOSED'].includes(t.status)
    ).length;
    const highOrUrgentCount = tickets.filter(
      (t) => ['HIGH', 'URGENT'].includes(t.priority) && !['RESOLVED', 'CLOSED'].includes(t.status)
    ).length;
    const reopenedCount = tickets.filter((t) => (t.reopenCount || 0) > 0).length;

    // Response Times Calculation
    const ticketsWithFirstResponse = tickets.filter((t) => t.firstResponseAt);
    let averageFirstResponseHours = 0;
    if (ticketsWithFirstResponse.length > 0) {
      const totalHours = ticketsWithFirstResponse.reduce((acc, t) => {
        const diff = new Date(t.firstResponseAt!).getTime() - new Date(t.createdAt).getTime();
        return acc + diff / (1000 * 3600);
      }, 0);
      averageFirstResponseHours = Number((totalHours / ticketsWithFirstResponse.length).toFixed(1));
    }

    const resolvedTickets = tickets.filter((t) => t.resolvedAt);
    let averageResolutionHours = 0;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((acc, t) => {
        const diff = new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime();
        return acc + diff / (1000 * 3600);
      }, 0);
      averageResolutionHours = Number((totalHours / resolvedTickets.length).toFixed(1));
    }

    // SLA State Breakdown
    const slaStateSummary = {
      withinSla: tickets.filter((t) => t.slaStatus === 'WITHIN_SLA').length,
      warning: tickets.filter((t) => t.slaStatus === 'WARNING').length,
      breached: tickets.filter((t) => t.slaStatus === 'BREACHED').length,
      notConfigured: tickets.filter((t) => t.slaStatus === 'NOT_CONFIGURED').length,
    };

    const configuredCount = slaStateSummary.withinSla + slaStateSummary.warning + slaStateSummary.breached;
    const slaCompliancePercent =
      configuredCount > 0 ? Number(((slaStateSummary.withinSla / configuredCount) * 100).toFixed(1)) : 0;

    // Categorization breakdowns
    const categoryMap = new Map<string, { categoryId: string; categoryName: string; count: number }>();
    tickets.forEach((t) => {
      const existing = categoryMap.get(t.categoryId) || {
        categoryId: t.categoryId,
        categoryName: t.categoryName,
        count: 0,
      };
      existing.count++;
      categoryMap.set(t.categoryId, existing);
    });

    const priorityMap = new Map<SupportTicketPriority, number>();
    tickets.forEach((t) => {
      priorityMap.set(t.priority, (priorityMap.get(t.priority) || 0) + 1);
    });

    const teamMap = new Map<string, { teamId: string; teamName: string; count: number }>();
    tickets.forEach((t) => {
      if (t.assignedTeamId) {
        const existing = teamMap.get(t.assignedTeamId) || {
          teamId: t.assignedTeamId,
          teamName: t.assignedTeamName || t.assignedTeamId,
          count: 0,
        };
        existing.count++;
        teamMap.set(t.assignedTeamId, existing);
      }
    });

    return {
      totalTicketsCount,
      openTicketsCount,
      newUntriagedCount,
      inProgressCount,
      waitingForRequesterCount,
      resolvedCount,
      closedCount,
      unassignedCount,
      highOrUrgentCount,
      averageFirstResponseHours,
      averageResolutionHours,
      reopenedCount,
      ticketsByCategory: Array.from(categoryMap.values()),
      ticketsByPriority: Array.from(priorityMap.entries()).map(([priority, count]) => ({ priority, count })),
      ticketsByTeam: Array.from(teamMap.values()),
      slaCompliancePercent,
      slaStateSummary,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates sanitized RFC 4180 CSV export of support tickets.
   * Internal notes are strictly excluded from output.
   */
  public async exportTicketsCsv(filter: SupportTicketFilterParams, caller: User): Promise<string> {
    const isAuthorized = isSupportStaffOrAdmin(caller);

    if (!isAuthorized) {
      throw new Error('FORBIDDEN: You do not have permission to export support tickets');
    }

    const { tickets } = await db.getSupportTickets(filter);

    const columns: CsvColumn<SupportTicket>[] = [
      { key: 'ticketNumber', label: 'Ticket Number' },
      { key: 'subject', label: 'Subject' },
      { key: 'categoryName', label: 'Category' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'impact', label: 'Impact', format: (val) => val || 'MEDIUM' },
      { key: 'requesterName', label: 'Requester Name' },
      { key: 'requesterEmail', label: 'Requester Email' },
      { key: 'assignedTeamName', label: 'Assigned Team', format: (val) => val || 'Unassigned' },
      { key: 'assignedAgentName', label: 'Assigned Agent', format: (val) => val || 'Unassigned' },
      { key: 'relatedCourseTitle', label: 'Course', format: (val) => val || 'None' },
      { key: 'relatedBatchName', label: 'Batch', format: (val) => val || 'None' },
      { key: 'slaStatus', label: 'SLA Status' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'firstResponseAt', label: 'First Response At', format: (val) => val || 'N/A' },
      { key: 'resolvedAt', label: 'Resolved At', format: (val) => val || 'N/A' },
      { key: 'closedAt', label: 'Closed At', format: (val) => val || 'N/A' },
    ];

    return generateSanitizedCsv(columns, tickets);
  }
}

export const supportService = new SupportService();
