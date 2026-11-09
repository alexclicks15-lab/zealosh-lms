// Zealosh LMS — Support Ticketing, Student Helpdesk & Service Operations Types
// Path: src/types/support.ts
// Single source of truth for institutional support models, message visibility, and SLA tracking

import { UserRole } from './index';

export type SupportTicketStatus =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED';

export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type SupportTicketImpact = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SupportMessageVisibility = 'PUBLIC' | 'INTERNAL';

export type SupportSlaStatus =
  | 'NOT_CONFIGURED'
  | 'WITHIN_SLA'
  | 'WARNING'
  | 'BREACHED'
  | 'PAUSED';

export type SupportTicketEventType =
  | 'TICKET_CREATED'
  | 'CATEGORY_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'STATUS_CHANGED'
  | 'TEAM_ASSIGNED'
  | 'AGENT_ASSIGNED'
  | 'AGENT_REASSIGNED'
  | 'PUBLIC_REPLY_ADDED'
  | 'INTERNAL_NOTE_ADDED'
  | 'ATTACHMENT_ADDED'
  | 'SLA_WARNING'
  | 'SLA_BREACHED'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'REOPENED'
  | 'CLOSED';

export interface SupportCategory {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  requiresAcademicContext: boolean;
  allowAttachments: boolean;
  defaultPriority: SupportTicketPriority;
  defaultTeamId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTeam {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  leadUserId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTeamMember {
  id: string;
  organizationId: string;
  teamId: string;
  userId: string;
  membershipRole: 'AGENT' | 'LEAD' | 'MANAGER';
  isActive: boolean;
  createdAt: string;
}

export interface SupportSlaPolicy {
  id: string;
  organizationId: string;
  name: string;
  categoryId?: string;
  priority: SupportTicketPriority;
  firstResponseTargetHours: number;
  resolutionTargetHours: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketAttachment {
  id: string;
  organizationId: string;
  ticketId: string;
  messageId?: string;
  uploadedByUserId: string;
  storageProvider: string;
  storageBucket: string;
  storageKey: string;
  originalFilename: string;
  sanitizedFilename: string;
  contentType: string;
  fileSize: number;
  checksum?: string;
  createdAt: string;
}

export interface SupportTicketMessage {
  id: string;
  organizationId: string;
  ticketId: string;
  authorUserId: string;
  authorName: string;
  authorRole: UserRole | string;
  visibility: SupportMessageVisibility;
  body: string;
  attachments?: SupportTicketAttachment[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export interface SupportTicketEvent {
  id: string;
  organizationId: string;
  ticketId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  eventType: SupportTicketEventType;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  organizationId: string;
  ticketNumber: string;
  requesterUserId: string;
  requesterRole: UserRole | string;
  requesterName: string;
  requesterEmail: string;
  categoryId: string;
  categoryName: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  impact?: SupportTicketImpact;
  assignedTeamId?: string;
  assignedTeamName?: string;
  assignedAgentUserId?: string;
  assignedAgentName?: string;
  assignedAgentEmail?: string;
  relatedCourseId?: string;
  relatedCourseTitle?: string;
  relatedBatchId?: string;
  relatedBatchName?: string;
  relatedSessionId?: string;
  relatedAssignmentId?: string;
  relatedExamAttemptId?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  closedAt?: string;
  closedByUserId?: string;
  reopenedAt?: string;
  reopenedByUserId?: string;
  reopenCount: number;
  slaPolicyId?: string;
  slaStatus: SupportSlaStatus;
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  version: number;
  idempotencyKey?: string;
  messages?: SupportTicketMessage[];
  events?: SupportTicketEvent[];
  attachments?: SupportTicketAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketFilterParams {
  status?: SupportTicketStatus | 'ALL' | string;
  priority?: SupportTicketPriority | 'ALL' | string;
  categoryId?: string;
  assignedTeamId?: string;
  assignedAgentUserId?: string;
  requesterUserId?: string;
  search?: string;
  courseId?: string;
  batchId?: string;
  dateRangePreset?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface SupportAnalyticsOverview {
  totalTicketsCount: number;
  openTicketsCount: number;
  newUntriagedCount: number;
  inProgressCount: number;
  waitingForRequesterCount: number;
  resolvedCount: number;
  closedCount: number;
  unassignedCount: number;
  highOrUrgentCount: number;
  averageFirstResponseHours: number;
  averageResolutionHours: number;
  reopenedCount: number;
  ticketsByCategory: Array<{ categoryId: string; categoryName: string; count: number }>;
  ticketsByPriority: Array<{ priority: SupportTicketPriority; count: number }>;
  ticketsByTeam: Array<{ teamId: string; teamName: string; count: number }>;
  slaCompliancePercent: number; // 0 if unconfigured
  slaStateSummary: {
    withinSla: number;
    breached: number;
    warning: number;
    notConfigured: number;
  };
  generatedAt: string;
}

export interface CreateSupportTicketInput {
  categoryId: string;
  subject: string;
  description: string;
  impact?: SupportTicketImpact;
  priority?: SupportTicketPriority;
  relatedCourseId?: string;
  relatedBatchId?: string;
  relatedSessionId?: string;
  relatedAssignmentId?: string;
  relatedExamAttemptId?: string;
  attachments?: Array<{
    originalFilename: string;
    sanitizedFilename: string;
    contentType: string;
    fileSize: number;
    storageKey: string;
    storageBucket?: string;
  }>;
  idempotencyKey?: string;
}

export interface AddTicketMessageInput {
  body: string;
  visibility: SupportMessageVisibility;
  attachments?: Array<{
    originalFilename: string;
    sanitizedFilename: string;
    contentType: string;
    fileSize: number;
    storageKey: string;
    storageBucket?: string;
  }>;
}

export interface UpdateTicketStatusInput {
  status: SupportTicketStatus;
  reason?: string;
}

export interface AssignTicketInput {
  assignedTeamId?: string;
  assignedAgentUserId?: string;
  reason?: string;
}

