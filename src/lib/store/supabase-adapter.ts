// Zealosh LMS — Authoritative Supabase Database Persistence Adapter
// Architecture: ADR-002 (Server-Side Authoritative & Defense-in-Depth RLS)
// Strict typed mapping between Supabase PostgreSQL schema and TypeScript domain entities

import { getSupabaseAdminClient } from '@/lib/supabase';
import { DatabasePersistenceError, classifyDatabaseError } from './db-errors';
import {
  User,
  Course,
  Batch,
  Enrollment,
  Lesson,
  LiveSession,
  AttendanceRecord,
  ExamQuestion,
  ExamBlueprint,
  ExamAttempt,
  FrozenExamQuestionSnapshot,
  AuditLogEntry,
  PlatformSettings,
  BrandingTheme,
  NavigationItem,
  FeatureFlags,
  RoleDefinition,
  PermissionCode,
  ConfigAuditEntry,
  CertificateRecord,
  OAuthCode,
  CourseStatus,
  WorkflowDefinition,
  NotificationTemplate,
  Assignment,
  AssignmentSubmission,
  ClassroomAnnouncement,
  AiReviewSuggestion,
  InAppNotification,
  EmailOutboxJob,
  EmailOutboxStatus,
  EmailErrorClassification,
  EmailDeliveryEvent,
  EmailTemplate,
  UserNotificationPreference,
  RubricScore,
  RubricCriterion,
  RecurringScheduleRule,
  PaymentOrder,
  PaymentStatus,
  PaymentGateway,
  InvoiceRecord,
  BillingAddress,
  ReportDataset,
  ClassRecording,
  RecordingBatchAccess,
  RecordingHighlight,
  RecordingResource,
  RecordingDoubt,
  RecordingDoubtAnswer,
  DoubtStatus,
  DiagnosticIssue,
  DiagnosticEvent,
  DiagnosticCategory,
  DiagnosticSeverity,
  DiagnosticIssueStatus,
  DiagnosticSource,
  ServiceHealthCheck,
  ServiceHealthStatus,
  SupportCategory,
  SupportTeam,
  SupportTeamMember,
  SupportSlaPolicy,
  SupportTicket,
  SupportTicketMessage,
  SupportTicketEvent,
  SupportTicketAttachment,
  SupportTicketFilterParams,
  SupportTicketStatus,
  SupportTicketPriority,
  SupportTicketImpact,
  SupportMessageVisibility,
  SupportSlaStatus,
  SupportTicketEventType,
  DirectMessage,
  CmsPage,
  CmsPageVersion,
  CmsPageNode,
  CmsTemplate,
  CmsReusableBlock,
  CmsPublicationRecord,
  CmsScheduledPublicationJob,
  CmsPublicationJobStatus,
} from '@/types';


export function isTableMissingError(error: any): boolean {
  if (!error) return false;
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  const msg = typeof error.message === 'string' ? error.message : '';
  return (
    msg.includes('relation') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('Could not find the table')
  );
}

// ============================================================================
// DTO MAPPERS (Database Snake_Case <-> TypeScript CamelCase)
// ============================================================================

export function mapDomainDirectMessageToDb(msg: DirectMessage): any {
  return {
    id: msg.id,
    sender_id: msg.senderId,
    sender_name: msg.senderName,
    sender_role: msg.senderRole,
    recipient_id: msg.recipientId || null,
    course_id: msg.courseId,
    batch_id: msg.batchId || null,
    subject: msg.subject || null,
    content: msg.content,
    read: Boolean(msg.read),
    read_at: msg.readAt || (msg.read ? new Date().toISOString() : null),
    client_message_id: msg.clientMessageId || null,
    created_at: msg.createdAt || new Date().toISOString(),
    updated_at: msg.updatedAt || new Date().toISOString(),
  };
}

export function mapDbDirectMessageToDomain(row: any): DirectMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    recipientId: row.recipient_id || undefined,
    courseId: row.course_id,
    batchId: row.batch_id || undefined,
    subject: row.subject || undefined,
    content: row.content,
    read: Boolean(row.read),
    readAt: row.read_at || undefined,
    clientMessageId: row.client_message_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
  };
}

export function mapDomainCmsPageToDb(page: CmsPage): any {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    page_type: page.pageType,
    status: page.status,
    current_draft_version_id: page.currentDraftVersionId || null,
    published_version_id: page.publishedVersionId || null,
    scheduled_publish_at: page.scheduledPublishAt || null,
    scheduled_version_id: page.scheduledVersionId || null,
    seo_metadata: page.seoMetadata || {},
    created_by: page.createdBy,
    updated_by: page.updatedBy,
    created_at: page.createdAt || new Date().toISOString(),
    updated_at: page.updatedAt || new Date().toISOString(),
  };
}

export function mapDbCmsPageToDomain(row: any): CmsPage {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    pageType: row.page_type,
    status: row.status,
    currentDraftVersionId: row.current_draft_version_id || undefined,
    publishedVersionId: row.published_version_id || undefined,
    scheduledPublishAt: row.scheduled_publish_at || undefined,
    scheduledVersionId: row.scheduled_version_id || undefined,
    seoMetadata: row.seo_metadata || {},
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDomainCmsPageVersionToDb(ver: CmsPageVersion): any {
  return {
    id: ver.id,
    page_id: ver.pageId,
    version_number: ver.versionNumber,
    status: ver.status,
    change_summary: ver.changeSummary || null,
    rejection_reason: ver.rejectionReason || null,
    created_by: ver.createdBy,
    approved_by: ver.approvedBy || null,
    published_at: ver.publishedAt || null,
    scheduled_publish_at: ver.scheduledPublishAt || null,
    created_at: ver.createdAt || new Date().toISOString(),
    updated_at: ver.updatedAt || new Date().toISOString(),
  };
}

export function mapDbCmsPageVersionToDomain(row: any): CmsPageVersion {
  return {
    id: row.id,
    pageId: row.page_id,
    versionNumber: row.version_number,
    status: row.status,
    changeSummary: row.change_summary || undefined,
    rejectionReason: row.rejection_reason || undefined,
    createdBy: row.created_by,
    approvedBy: row.approved_by || undefined,
    publishedAt: row.published_at || undefined,
    scheduledPublishAt: row.scheduled_publish_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDomainCmsScheduledPublicationJobToDb(job: CmsScheduledPublicationJob): any {
  return {
    id: job.id,
    page_id: job.pageId,
    version_id: job.versionId,
    scheduled_at: job.scheduledAt,
    scheduled_by: job.scheduledBy,
    status: job.status,
    attempt_count: job.attemptCount || 0,
    max_attempts: job.maxAttempts || 3,
    locked_at: job.lockedAt || null,
    locked_by: job.lockedBy || null,
    completed_at: job.completedAt || null,
    error_message: job.errorMessage || null,
    created_at: job.createdAt || new Date().toISOString(),
    updated_at: job.updatedAt || new Date().toISOString(),
  };
}

export function mapDbCmsScheduledPublicationJobToDomain(row: any): CmsScheduledPublicationJob {
  return {
    id: row.id,
    pageId: row.page_id,
    versionId: row.version_id,
    scheduledAt: row.scheduled_at,
    scheduledBy: row.scheduled_by,
    status: row.status,
    attemptCount: row.attempt_count || 0,
    maxAttempts: row.max_attempts || 3,
    lockedAt: row.locked_at || undefined,
    lockedBy: row.locked_by || undefined,
    completedAt: row.completed_at || undefined,
    errorMessage: row.error_message || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDomainCmsPageNodeToDb(node: CmsPageNode): any {
  return {
    id: node.id,
    page_version_id: node.pageVersionId,
    parent_id: node.parentId || null,
    node_type: node.nodeType,
    component_type: node.componentType,
    position: node.position,
    props: node.props || {},
    styles: node.styles || {},
    responsive_styles: node.responsiveStyles || {},
    dynamic_binding: node.dynamicBinding || null,
    enabled: Boolean(node.enabled),
    created_at: node.createdAt || new Date().toISOString(),
    updated_at: node.updatedAt || new Date().toISOString(),
  };
}

export function mapDbCmsPageNodeToDomain(row: any): CmsPageNode {
  return {
    id: row.id,
    pageVersionId: row.page_version_id,
    parentId: row.parent_id || null,
    nodeType: row.node_type,
    componentType: row.component_type,
    position: row.position,
    props: row.props || {},
    styles: row.styles || {},
    responsiveStyles: row.responsive_styles || {},
    dynamicBinding: row.dynamic_binding || null,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDomainCmsTemplateToDb(tpl: CmsTemplate): any {
  return {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description || null,
    category: tpl.category,
    template_type: tpl.templateType,
    preview_image_url: tpl.previewImageUrl || null,
    nodes_snapshot: tpl.nodesSnapshot || [],
    created_by: tpl.createdBy,
    created_at: tpl.createdAt || new Date().toISOString(),
  };
}

export function mapDbCmsTemplateToDomain(row: any): CmsTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category,
    templateType: row.template_type,
    previewImageUrl: row.preview_image_url || undefined,
    nodesSnapshot: row.nodes_snapshot || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function mapDomainCmsReusableBlockToDb(blk: CmsReusableBlock): any {
  return {
    id: blk.id,
    name: blk.name,
    category: blk.category,
    nodes_snapshot: blk.nodesSnapshot || [],
    created_by: blk.createdBy,
    created_at: blk.createdAt || new Date().toISOString(),
  };
}

export function mapDbCmsReusableBlockToDomain(row: any): CmsReusableBlock {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    nodesSnapshot: row.nodes_snapshot || [],
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function mapDbAssignmentToDomain(row: any): Assignment {
  return {
    id: row.id,
    courseId: row.course_id,
    batchId: row.batch_id || undefined,
    title: row.title,
    description: row.description || '',
    instructionsHtml: row.instructions_html || undefined,
    dueDate: row.due_date,
    maxScore: Number(row.max_score || 100),
    rubric: row.rubric || undefined,
    status: row.status || 'PUBLISHED',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainAssignmentToDb(a: Assignment): any {
  return {
    id: a.id,
    course_id: a.courseId,
    batch_id: a.batchId || null,
    title: a.title,
    description: a.description,
    instructions_html: a.instructionsHtml || null,
    due_date: a.dueDate,
    max_score: a.maxScore,
    rubric: a.rubric || null,
    status: a.status,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbSubmissionToDomain(row: any): AssignmentSubmission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    courseId: row.assignments?.course_id || row.course_id || undefined,
    batchId: row.assignments?.batch_id || row.batch_id || undefined,
    userId: row.user_id,
    studentName: row.student_name || undefined,
    studentEmail: row.student_email || undefined,
    submissionText: row.submission_text || undefined,
    attachmentUrl: row.attachment_url || undefined,
    attachmentFilename: row.attachment_filename || undefined,
    submittedAt: row.submitted_at || new Date().toISOString(),
    status: row.status || 'SUBMITTED',
    score: row.score !== null && row.score !== undefined ? Number(row.score) : undefined,
    feedback: row.feedback || undefined,
    rubricScores: Array.isArray(row.rubric_scores) ? row.rubric_scores : undefined,
    aiReviewSuggestions: row.ai_review_suggestions || undefined,
    gradedByUserId: row.graded_by_user_id || undefined,
    gradedAt: row.graded_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainSubmissionToDb(s: AssignmentSubmission): any {
  const payload: any = {
    id: s.id,
    assignment_id: s.assignmentId,
    user_id: s.userId,
    student_name: s.studentName || null,
    student_email: s.studentEmail || null,
    submission_text: s.submissionText || null,
    attachment_url: s.attachmentUrl || null,
    attachment_filename: s.attachmentFilename || null,
    submitted_at: s.submittedAt,
    status: s.status,
    score: s.score !== undefined ? s.score : null,
    feedback: s.feedback || null,
    rubric_scores: s.rubricScores || [],
    graded_by_user_id: s.gradedByUserId || null,
    graded_at: s.gradedAt || null,
    updated_at: new Date().toISOString(),
  };
  if (s.aiReviewSuggestions !== undefined && s.aiReviewSuggestions !== null) {
    payload.ai_review_suggestions = s.aiReviewSuggestions;
  }
  return payload;
}

export function mapDbAnnouncementToDomain(row: any): ClassroomAnnouncement {
  return {
    id: row.id,
    courseId: row.course_id,
    batchId: row.batch_id || undefined,
    audienceScope: row.audience_scope || (row.batch_id ? 'BATCH_SPECIFIC' : 'COURSE_WIDE'),
    status: row.status || 'PUBLISHED',
    authorId: row.author_id,
    authorName: row.author_name || 'Instructor',
    authorRole: row.author_role || 'INSTRUCTOR',
    title: row.title,
    content: row.content,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    comments: Array.isArray(row.comments) ? row.comments : [],
    isPinned: Boolean(row.is_pinned),
    scheduledPublishAt: row.scheduled_publish_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainAnnouncementToDb(a: ClassroomAnnouncement): any {
  const payload: any = {
    id: a.id,
    course_id: a.courseId,
    batch_id: a.batchId || null,
    author_id: a.authorId,
    author_name: a.authorName,
    author_role: a.authorRole || 'INSTRUCTOR',
    title: a.title,
    content: a.content,
    attachments: a.attachments || [],
    comments: Array.isArray(a.comments) ? a.comments : [],
    is_pinned: Boolean(a.isPinned),
    updated_at: new Date().toISOString(),
  };
  if (a.audienceScope) payload.audience_scope = a.audienceScope;
  if (a.status) payload.status = a.status;
  if (a.scheduledPublishAt) payload.scheduled_publish_at = a.scheduledPublishAt;
  return payload;
}

export function mapDbNotificationToDomain(row: any): InAppNotification {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    type: row.type,
    title: row.title,
    description: row.description,
    entityType: row.entity_type || undefined,
    entityId: row.entity_id || undefined,
    courseId: row.course_id || undefined,
    batchId: row.batch_id || undefined,
    actionUrl: row.action_url || '/',
    isRead: Boolean(row.is_read),
    readAt: row.read_at || undefined,
    idempotencyKey: row.idempotency_key || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainNotificationToDb(n: Partial<InAppNotification>): any {
  return {
    id: n.id,
    recipient_user_id: n.recipientUserId,
    type: n.type,
    title: n.title,
    description: n.description,
    entity_type: n.entityType || null,
    entity_id: n.entityId || null,
    course_id: n.courseId || null,
    batch_id: n.batchId || null,
    action_url: n.actionUrl || '/',
    is_read: Boolean(n.isRead),
    read_at: n.readAt || null,
    idempotency_key: n.idempotencyKey || null,
    created_at: n.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function mapDbEmailOutboxToDomain(row: any): EmailOutboxJob {
  return {
    id: row.id,
    sourceEventId: row.source_event_id || undefined,
    eventType: row.event_type,
    recipientUserId: row.recipient_user_id || undefined,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name || undefined,
    templateId: row.template_id,
    templateVersion: row.template_version || 'v1',
    templateVariables: typeof row.template_variables === 'object' && row.template_variables !== null ? row.template_variables : {},
    subject: row.subject,
    htmlBody: row.html_body,
    textBody: row.text_body,
    status: row.status as EmailOutboxStatus,
    attemptCount: Number(row.attempt_count || 0),
    maxAttempts: Number(row.max_attempts || 3),
    nextAttemptAt: row.next_attempt_at || undefined,
    lastAttemptAt: row.last_attempt_at || undefined,
    lockedAt: row.locked_at || undefined,
    lockedBy: row.locked_by || undefined,
    provider: row.provider || 'unconfigured',
    providerMessageId: row.provider_message_id || undefined,
    errorMessage: row.error_message || undefined,
    errorClassification: row.error_classification || undefined,
    idempotencyKey: row.idempotency_key || undefined,
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {},
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainEmailOutboxToDb(job: Partial<EmailOutboxJob>): any {
  return {
    id: job.id,
    source_event_id: job.sourceEventId || null,
    event_type: job.eventType,
    recipient_user_id: job.recipientUserId || null,
    recipient_email: job.recipientEmail,
    recipient_name: job.recipientName || null,
    template_id: job.templateId,
    template_version: job.templateVersion || 'v1',
    template_variables: job.templateVariables || {},
    subject: job.subject,
    html_body: job.htmlBody,
    text_body: job.textBody,
    status: job.status || 'QUEUED',
    attempt_count: job.attemptCount || 0,
    max_attempts: job.maxAttempts || 3,
    next_attempt_at: job.nextAttemptAt || new Date().toISOString(),
    last_attempt_at: job.lastAttemptAt || null,
    locked_at: job.lockedAt || null,
    locked_by: job.lockedBy || null,
    provider: job.provider || 'unconfigured',
    provider_message_id: job.providerMessageId || null,
    error_message: job.errorMessage || null,
    error_classification: job.errorClassification || null,
    idempotency_key: job.idempotencyKey || null,
    metadata: job.metadata || {},
    created_at: job.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function mapDbEmailDeliveryEventToDomain(row: any): EmailDeliveryEvent {
  return {
    id: row.id,
    outboxId: row.outbox_id || undefined,
    provider: row.provider,
    providerMessageId: row.provider_message_id || undefined,
    eventType: row.event_type,
    recipientEmail: row.recipient_email,
    rawPayload: typeof row.raw_payload === 'object' && row.raw_payload !== null ? row.raw_payload : {},
    occurredAt: row.occurred_at || new Date().toISOString(),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function mapDbUserPreferenceToDomain(row: any): UserNotificationPreference {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel || 'EMAIL',
    category: row.category,
    isEnabled: Boolean(row.is_enabled),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDbDiagnosticIssueToDomain(row: any): DiagnosticIssue {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    title: row.title,
    category: row.category as DiagnosticCategory,
    severity: row.severity as DiagnosticSeverity,
    status: row.status as DiagnosticIssueStatus,
    occurrenceCount: Number(row.occurrence_count || 1),
    firstSeenAt: row.first_seen_at || new Date().toISOString(),
    lastSeenAt: row.last_seen_at || new Date().toISOString(),
    affectedRoutes: Array.isArray(row.affected_routes) ? row.affected_routes : [],
    affectedServices: Array.isArray(row.affected_services) ? row.affected_services : [],
    lastCorrelationId: row.last_correlation_id || undefined,
    lastErrorMessage: row.last_error_message || '',
    sampleStackTrace: row.sample_stack_trace || undefined,
    sampleComponentStack: row.sample_component_stack || undefined,
    acknowledgedBy: row.acknowledged_by || undefined,
    acknowledgedAt: row.acknowledged_at || undefined,
    resolvedBy: row.resolved_by || undefined,
    resolvedAt: row.resolved_at || undefined,
    resolutionNotes: row.resolution_notes || undefined,
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {},
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainDiagnosticIssueToDb(issue: DiagnosticIssue): any {
  return {
    id: issue.id,
    fingerprint: issue.fingerprint,
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    status: issue.status,
    occurrence_count: issue.occurrenceCount,
    first_seen_at: issue.firstSeenAt,
    last_seen_at: issue.lastSeenAt,
    affected_routes: issue.affectedRoutes || [],
    affected_services: issue.affectedServices || [],
    last_correlation_id: issue.lastCorrelationId || null,
    last_error_message: issue.lastErrorMessage,
    sample_stack_trace: issue.sampleStackTrace || null,
    sample_component_stack: issue.sampleComponentStack || null,
    acknowledged_by: issue.acknowledgedBy || null,
    acknowledged_at: issue.acknowledgedAt || null,
    resolved_by: issue.resolvedBy || null,
    resolved_at: issue.resolvedAt || null,
    resolution_notes: issue.resolutionNotes || null,
    metadata: issue.metadata || {},
    created_at: issue.createdAt,
    updated_at: issue.updatedAt,
  };
}

export function mapDbDiagnosticEventToDomain(row: any): DiagnosticEvent {
  return {
    id: row.id,
    issueId: row.issue_id,
    correlationId: row.correlation_id,
    category: row.category as DiagnosticCategory,
    severity: row.severity as DiagnosticSeverity,
    source: (row.source || 'BACKEND') as DiagnosticSource,
    route: row.route || undefined,
    service: row.service || undefined,
    method: row.method || undefined,
    statusCode: row.status_code !== null && row.status_code !== undefined ? Number(row.status_code) : undefined,
    errorCode: row.error_code || undefined,
    sanitizedMessage: row.sanitized_message || '',
    stackTrace: row.stack_trace || undefined,
    componentStack: row.component_stack || undefined,
    userId: row.user_id || undefined,
    userEmail: row.user_email || undefined,
    clientInfo: typeof row.client_info === 'object' && row.client_info !== null ? row.client_info : undefined,
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {},
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function mapDomainDiagnosticEventToDb(event: DiagnosticEvent): any {
  return {
    id: event.id,
    issue_id: event.issueId,
    correlation_id: event.correlationId,
    category: event.category,
    severity: event.severity,
    source: event.source,
    route: event.route || null,
    service: event.service || null,
    method: event.method || null,
    status_code: event.statusCode !== undefined ? event.statusCode : null,
    error_code: event.errorCode || null,
    sanitized_message: event.sanitizedMessage,
    stack_trace: event.stackTrace || null,
    component_stack: event.componentStack || null,
    user_id: event.userId || null,
    user_email: event.userEmail || null,
    client_info: event.clientInfo || {},
    metadata: event.metadata || {},
    created_at: event.createdAt,
  };
}

export function mapDbServiceHealthCheckToDomain(row: any): ServiceHealthCheck {
  return {
    serviceName: row.service_name,
    status: row.status as ServiceHealthStatus,
    latencyMs: row.latency_ms !== null && row.latency_ms !== undefined ? Number(row.latency_ms) : undefined,
    message: row.message || '',
    checkedAt: row.checked_at || new Date().toISOString(),
    details: typeof row.details === 'object' && row.details !== null ? row.details : {},
  };
}

export function mapDomainServiceHealthCheckToDb(check: ServiceHealthCheck): any {
  return {
    service_name: check.serviceName,
    status: check.status,
    latency_ms: check.latencyMs !== undefined ? check.latencyMs : null,
    message: check.message,
    checked_at: check.checkedAt,
    details: check.details || {},
  };
}

export function mapDbSupportCategoryToDomain(row: any): SupportCategory {
  return {
    id: row.id,
    organizationId: row.organization_id || 'org-zealosh-main',
    name: row.name,
    slug: row.slug,
    description: row.description || undefined,
    isActive: row.is_active ?? true,
    requiresAcademicContext: row.requires_academic_context ?? false,
    allowAttachments: row.allow_attachments ?? true,
    defaultPriority: (row.default_priority || 'NORMAL') as SupportTicketPriority,
    defaultTeamId: row.default_team_id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainSupportCategoryToDb(cat: SupportCategory): any {
  return {
    id: cat.id,
    organization_id: cat.organizationId || 'org-zealosh-main',
    name: cat.name,
    slug: cat.slug,
    description: cat.description || null,
    is_active: cat.isActive,
    requires_academic_context: cat.requiresAcademicContext,
    allow_attachments: cat.allowAttachments,
    default_priority: cat.defaultPriority,
    default_team_id: cat.defaultTeamId || null,
    created_at: cat.createdAt,
    updated_at: cat.updatedAt,
  };
}

export function mapDbSupportTeamToDomain(row: any): SupportTeam {
  return {
    id: row.id,
    organizationId: row.organization_id || 'org-zealosh-main',
    name: row.name,
    slug: row.slug,
    description: row.description || undefined,
    leadUserId: row.lead_user_id || undefined,
    isActive: row.is_active ?? true,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainSupportTeamToDb(team: SupportTeam): any {
  return {
    id: team.id,
    organization_id: team.organizationId || 'org-zealosh-main',
    name: team.name,
    slug: team.slug,
    description: team.description || null,
    lead_user_id: team.leadUserId || null,
    is_active: team.isActive,
    created_at: team.createdAt,
    updated_at: team.updatedAt,
  };
}

export function mapDbSupportSlaPolicyToDomain(row: any): SupportSlaPolicy {
  return {
    id: row.id,
    organizationId: row.organization_id || 'org-zealosh-main',
    name: row.name,
    categoryId: row.category_id || undefined,
    priority: (row.priority || 'NORMAL') as SupportTicketPriority,
    firstResponseTargetHours: Number(row.first_response_target_hours || 24),
    resolutionTargetHours: Number(row.resolution_target_hours || 72),
    isActive: row.is_active ?? true,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainSupportSlaPolicyToDb(sla: SupportSlaPolicy): any {
  return {
    id: sla.id,
    organization_id: sla.organizationId || 'org-zealosh-main',
    name: sla.name,
    category_id: sla.categoryId || null,
    priority: sla.priority,
    first_response_target_hours: sla.firstResponseTargetHours,
    resolution_target_hours: sla.resolutionTargetHours,
    is_active: sla.isActive,
    created_at: sla.createdAt,
    updated_at: sla.updatedAt,
  };
}

export function mapDbSupportTicketToDomain(row: any): SupportTicket {
  return {
    id: row.id,
    organizationId: row.organization_id || 'org-zealosh-main',
    ticketNumber: row.ticket_number,
    requesterUserId: row.requester_user_id,
    requesterRole: row.requester_role || 'STUDENT',
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    categoryId: row.category_id,
    categoryName: row.category_name,
    subject: row.subject,
    description: row.description,
    status: row.status as SupportTicketStatus,
    priority: row.priority as SupportTicketPriority,
    impact: row.impact as SupportTicketImpact | undefined,
    assignedTeamId: row.assigned_team_id || undefined,
    assignedTeamName: row.assigned_team_name || undefined,
    assignedAgentUserId: row.assigned_agent_user_id || undefined,
    assignedAgentName: row.assigned_agent_name || undefined,
    assignedAgentEmail: row.assigned_agent_email || undefined,
    relatedCourseId: row.related_course_id || undefined,
    relatedCourseTitle: row.related_course_title || undefined,
    relatedBatchId: row.related_batch_id || undefined,
    relatedBatchName: row.related_batch_name || undefined,
    relatedSessionId: row.related_session_id || undefined,
    relatedAssignmentId: row.related_assignment_id || undefined,
    relatedExamAttemptId: row.related_exam_attempt_id || undefined,
    firstResponseAt: row.first_response_at || undefined,
    resolvedAt: row.resolved_at || undefined,
    resolvedByUserId: row.resolved_by_user_id || undefined,
    closedAt: row.closed_at || undefined,
    closedByUserId: row.closed_by_user_id || undefined,
    reopenedAt: row.reopened_at || undefined,
    reopenedByUserId: row.reopened_by_user_id || undefined,
    reopenCount: Number(row.reopen_count || 0),
    slaPolicyId: row.sla_policy_id || undefined,
    slaStatus: (row.sla_status || 'NOT_CONFIGURED') as SupportSlaStatus,
    firstResponseDueAt: row.first_response_due_at || undefined,
    resolutionDueAt: row.resolution_due_at || undefined,
    version: Number(row.version || 1),
    idempotencyKey: row.idempotency_key || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainSupportTicketToDb(ticket: SupportTicket): any {
  return {
    id: ticket.id,
    organization_id: ticket.organizationId || 'org-zealosh-main',
    ticket_number: ticket.ticketNumber,
    requester_user_id: ticket.requesterUserId,
    requester_role: ticket.requesterRole,
    requester_name: ticket.requesterName,
    requester_email: ticket.requesterEmail,
    category_id: ticket.categoryId,
    category_name: ticket.categoryName,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    impact: ticket.impact || null,
    assigned_team_id: ticket.assignedTeamId || null,
    assigned_team_name: ticket.assignedTeamName || null,
    assigned_agent_user_id: ticket.assignedAgentUserId || null,
    assigned_agent_name: ticket.assignedAgentName || null,
    assigned_agent_email: ticket.assignedAgentEmail || null,
    related_course_id: ticket.relatedCourseId || null,
    related_course_title: ticket.relatedCourseTitle || null,
    related_batch_id: ticket.relatedBatchId || null,
    related_batch_name: ticket.relatedBatchName || null,
    related_session_id: ticket.relatedSessionId || null,
    related_assignment_id: ticket.relatedAssignmentId || null,
    related_exam_attempt_id: ticket.relatedExamAttemptId || null,
    first_response_at: ticket.firstResponseAt || null,
    resolved_at: ticket.resolvedAt || null,
    resolved_by_user_id: ticket.resolvedByUserId || null,
    closed_at: ticket.closedAt || null,
    closed_by_user_id: ticket.closedByUserId || null,
    reopened_at: ticket.reopenedAt || null,
    reopened_by_user_id: ticket.reopenedByUserId || null,
    reopen_count: ticket.reopenCount,
    sla_policy_id: ticket.slaPolicyId || null,
    sla_status: ticket.slaStatus || 'NOT_CONFIGURED',
    first_response_due_at: ticket.firstResponseDueAt || null,
    resolution_due_at: ticket.resolutionDueAt || null,
    version: ticket.version || 1,
    idempotency_key: ticket.idempotencyKey || null,
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
  };
}

export function mapDbSupportTicketMessageToDomain(row: any): SupportTicketMessage {
  return {
    id: row.id,
    organizationId: row.organization_id || 'org-zealosh-main',
    ticketId: row.ticket_id,
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    visibility: row.visibility as SupportMessageVisibility,
    body: row.body,
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {},
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined,
  };
}

export function mapDomainSupportTicketMessageToDb(msg: SupportTicketMessage): any {
  return {
    id: msg.id,
    organization_id: msg.organizationId || 'org-zealosh-main',
    ticket_id: msg.ticketId,
    author_user_id: msg.authorUserId,
    author_name: msg.authorName,
    author_role: msg.authorRole,
    visibility: msg.visibility,
    body: msg.body,
    metadata: msg.metadata || {},
    created_at: msg.createdAt,
    updated_at: msg.updatedAt || null,
  };
}

export function mapDbSupportTicketEventToDomain(row: any): SupportTicketEvent {
  return {
    id: row.id,
    organizationId: row.organization_id || 'org-zealosh-main',
    ticketId: row.ticket_id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    eventType: row.event_type as SupportTicketEventType,
    previousValue: row.previous_value || undefined,
    newValue: row.new_value || undefined,
    reason: row.reason || undefined,
    metadata: typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {},
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function mapDomainSupportTicketEventToDb(evt: SupportTicketEvent): any {
  return {
    id: evt.id,
    organization_id: evt.organizationId || 'org-zealosh-main',
    ticket_id: evt.ticketId,
    actor_user_id: evt.actorUserId,
    actor_name: evt.actorName,
    actor_role: evt.actorRole,
    event_type: evt.eventType,
    previous_value: evt.previousValue || null,
    new_value: evt.newValue || null,
    reason: evt.reason || null,
    metadata: evt.metadata || {},
    created_at: evt.createdAt,
  };
}

export function mapDbSupportTicketAttachmentToDomain(row: any): SupportTicketAttachment {
  return {
    id: row.id,
    organizationId: row.organization_id || 'org-zealosh-main',
    ticketId: row.ticket_id,
    messageId: row.message_id || undefined,
    uploadedByUserId: row.uploaded_by_user_id,
    storageProvider: row.storage_provider || 'SUPABASE_STORAGE',
    storageBucket: row.storage_bucket || 'support-attachments',
    storageKey: row.storage_key,
    originalFilename: row.original_filename,
    sanitizedFilename: row.sanitized_filename,
    contentType: row.content_type,
    fileSize: Number(row.file_size || 0),
    checksum: row.checksum || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function mapDomainSupportTicketAttachmentToDb(att: SupportTicketAttachment): any {
  return {
    id: att.id,
    organization_id: att.organizationId || 'org-zealosh-main',
    ticket_id: att.ticketId,
    message_id: att.messageId || null,
    uploaded_by_user_id: att.uploadedByUserId,
    storage_provider: att.storageProvider,
    storage_bucket: att.storageBucket,
    storage_key: att.storageKey,
    original_filename: att.originalFilename,
    sanitized_filename: att.sanitizedFilename,
    content_type: att.contentType,
    file_size: att.fileSize,
    checksum: att.checksum || null,
    created_at: att.createdAt,
  };
}

export function mapDbCourseToDomain(row: any): Course {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    certificationType: row.certification_type,
    deliveryModel: row.delivery_model,
    status: row.status as CourseStatus,
    headline: row.headline || '',
    description: row.description || '',
    learningObjectives: row.learning_objectives || [],
    prerequisites: row.prerequisites || [],
    priceInr: Number(row.price_inr || 0),
    priceUsd: Number(row.price_usd || 0),
    durationWeeks: Number(row.duration_weeks || 0),
    coverImage: (row.cover_image && row.cover_image !== '/images/cover.jpg') ? row.cover_image : '/logo.png',
    leadInstructorId: row.lead_instructor_id || '',
    coInstructorIds: row.co_instructor_ids || [],
    moodleCourseId: row.moodle_course_id ? Number(row.moodle_course_id) : undefined,
    modulesCount: Number(row.modules_count || 0),
    totalLessons: Number(row.total_lessons || 0),
    totalHours: Number(row.total_hours || 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainCourseToDb(course: Course): any {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    certification_type: course.certificationType,
    delivery_model: course.deliveryModel,
    status: course.status,
    headline: course.headline,
    description: course.description,
    learning_objectives: course.learningObjectives || [],
    prerequisites: course.prerequisites || [],
    price_inr: course.priceInr,
    price_usd: course.priceUsd,
    duration_weeks: course.durationWeeks,
    cover_image: course.coverImage,
    lead_instructor_id: course.leadInstructorId,
    co_instructor_ids: course.coInstructorIds || [],
    moodle_course_id: course.moodleCourseId || null,
    modules_count: course.modulesCount,
    total_lessons: course.totalLessons,
    total_hours: course.totalHours,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbBatchToDomain(row: any): Batch {
  return {
    id: row.id,
    courseId: row.course_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    scheduleDescription: row.schedule_description || '',
    capacity: Number(row.capacity || 0),
    enrolledCount: Number(row.enrolled_count || 0),
    leadInstructorId: row.lead_instructor_id || '',
    status: row.status,
  };
}

export function mapDomainBatchToDb(batch: Batch): any {
  return {
    id: batch.id,
    course_id: batch.courseId,
    name: batch.name,
    start_date: batch.startDate,
    end_date: batch.endDate,
    schedule_description: batch.scheduleDescription,
    capacity: batch.capacity,
    enrolled_count: batch.enrolledCount,
    lead_instructor_id: batch.leadInstructorId,
    status: batch.status,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbEnrollmentToDomain(row: any): Enrollment {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    batchId: row.batch_id,
    status: row.status,
    enrolledAt: row.enrolled_at || row.created_at || new Date().toISOString(),
    expiresAt: row.expires_at || new Date().toISOString(),
    progressPercent: Number(row.progress_percent || 0),
    completedLessonIds: row.completed_lesson_ids || [],
    idempotencyKey: row.idempotency_key || undefined,
  };
}

export function mapDomainEnrollmentToDb(enrollment: Enrollment): any {
  return {
    id: enrollment.id,
    user_id: enrollment.userId,
    course_id: enrollment.courseId,
    batch_id: enrollment.batchId,
    status: enrollment.status,
    enrolled_at: enrollment.enrolledAt,
    expires_at: enrollment.expiresAt,
    progress_percent: enrollment.progressPercent,
    completed_lesson_ids: enrollment.completedLessonIds || [],
    idempotency_key: enrollment.idempotencyKey || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbPaymentOrderToDomain(row: any): PaymentOrder {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.users?.name || row.user_name || '',
    userEmail: row.users?.email || row.user_email || '',
    courseId: row.course_id,
    batchId: row.batch_id,
    currency: (row.currency || 'INR') as 'INR' | 'USD',
    amount: Number(row.amount || 0),
    status: row.status as PaymentStatus,
    gateway: (row.gateway || 'RAZORPAY') as PaymentGateway,
    gatewayOrderId: row.gateway_order_id || undefined,
    gatewayPaymentId: row.gateway_payment_id || undefined,
    gatewayRefundId: row.gateway_refund_id || undefined,
    refundReason: row.refund_reason || undefined,
    refundedAt: row.refunded_at || undefined,
    billingAddress: row.billing_address || undefined,
    invoiceId: row.invoice_id || undefined,
    enrollmentId: row.enrollment_id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    paidAt: row.paid_at || undefined,
  };
}

export function mapDomainPaymentOrderToDb(order: PaymentOrder): any {
  return {
    id: order.id,
    user_id: order.userId,
    course_id: order.courseId,
    batch_id: order.batchId,
    currency: order.currency,
    amount: order.amount,
    status: order.status,
    gateway: order.gateway,
    gateway_order_id: order.gatewayOrderId || null,
    gateway_payment_id: order.gatewayPaymentId || null,
    gateway_refund_id: order.gatewayRefundId || null,
    refund_reason: order.refundReason || null,
    billing_address: order.billingAddress || {},
    invoice_id: order.invoiceId || null,
    enrollment_id: order.enrollmentId || null,
    created_at: order.createdAt,
    paid_at: order.paidAt || null,
    refunded_at: order.refundedAt || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbInvoiceToDomain(row: any): InvoiceRecord {
  const isVerified = process.env.PROVIDER_GSTIN_VERIFIED === 'true';
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    orderId: row.order_id,
    userId: row.user_id,
    userName: row.user_name || row.users?.name || 'Candidate',
    userEmail: row.user_email || row.users?.email || '',
    billingAddress: row.billing_address || undefined,
    courseId: row.course_id,
    courseTitle: row.course_title || row.courses?.title || row.course_id,
    batchId: row.batch_id,
    batchName: row.batch_name || row.batches?.name || row.batch_id,
    subtotal: Number(row.subtotal || 0),
    taxRatePercent: Number(row.tax_rate_percent || 18),
    taxAmount: Number(row.tax_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    currency: (row.currency || 'INR') as 'INR' | 'USD',
    status: row.status as 'ISSUED' | 'PAID' | 'VOID' | 'REFUNDED',
    issuedAt: row.issued_at || row.created_at || new Date().toISOString(),
    paidAt: row.paid_at || undefined,
    hsnCode: row.hsn_code || '999293',
    providerGstin: row.provider_gstin || '32AABCZ1234F1Z5',
    providerGstinVerified: isVerified,
    paymentMethod: row.payment_method || undefined,
    transactionRef: row.transaction_ref || undefined,
  };
}

export function mapDomainInvoiceToDb(inv: InvoiceRecord): any {
  return {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    order_id: inv.orderId,
    user_id: inv.userId,
    user_name: inv.userName,
    user_email: inv.userEmail,
    billing_address: inv.billingAddress || {},
    course_id: inv.courseId,
    course_title: inv.courseTitle,
    batch_id: inv.batchId,
    batch_name: inv.batchName,
    subtotal: inv.subtotal,
    tax_rate_percent: inv.taxRatePercent,
    tax_amount: inv.taxAmount,
    total_amount: inv.totalAmount,
    currency: inv.currency,
    status: inv.status,
    issued_at: inv.issuedAt,
    paid_at: inv.paidAt || inv.issuedAt,
    hsn_code: inv.hsnCode,
    provider_gstin: inv.providerGstin,
    payment_method: inv.paymentMethod || null,
    transaction_ref: inv.transactionRef || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbUserToDomain(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash || '',
    role: row.role,
    avatarUrl: row.avatar_url || undefined,
    organizationId: row.organization_id || 'org-zealosh-main',
    externalLearningId: row.external_learning_id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainUserToDb(user: User): any {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    password_hash: user.passwordHash,
    role: user.role,
    avatar_url: user.avatarUrl || null,
    organization_id: user.organizationId,
    external_learning_id: user.externalLearningId || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbPlatformSettingsToDomain(row: any): PlatformSettings {
  return {
    platformName: row.platform_name,
    organizationName: row.organization_name,
    organizationEmail: row.organization_email,
    supportEmail: row.support_email,
    supportPhone: row.support_phone,
    defaultLanguage: row.default_language,
    defaultTimezone: row.default_timezone,
    defaultCurrency: row.default_currency,
    dateFormat: row.date_format,
    timeFormat: row.time_format,
    maintenanceMode: Boolean(row.maintenance_mode),
    registrationMode: row.registration_mode,
    sessionTimeoutMinutes: Number(row.session_timeout_minutes || 1440),
    maxLoginAttempts: Number(row.max_login_attempts || 5),
    termsOfServiceUrl: row.terms_of_service_url || undefined,
    privacyPolicyUrl: row.privacy_policy_url || undefined,
    notificationPreferences: row.notification_preferences || {
      emailAlerts: true,
      smsAlerts: false,
      inAppAlerts: true,
    },
  };
}

export function mapDomainPlatformSettingsToDb(settings: PlatformSettings): any {
  return {
    id: 'singleton',
    platform_name: settings.platformName,
    organization_name: settings.organizationName,
    organization_email: settings.organizationEmail,
    support_email: settings.supportEmail,
    support_phone: settings.supportPhone,
    default_language: settings.defaultLanguage,
    default_timezone: settings.defaultTimezone,
    default_currency: settings.defaultCurrency,
    date_format: settings.dateFormat,
    time_format: settings.timeFormat,
    maintenance_mode: settings.maintenanceMode,
    registration_mode: settings.registrationMode,
    session_timeout_minutes: settings.sessionTimeoutMinutes,
    max_login_attempts: settings.maxLoginAttempts,
    terms_of_service_url: settings.termsOfServiceUrl || null,
    privacy_policy_url: settings.privacyPolicyUrl || null,
    notification_preferences: settings.notificationPreferences,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbBrandingThemeToDomain(row: any): BrandingTheme {
  return {
    primaryGreen: row.primary_green,
    deepGreen: row.deep_green,
    accentGreen: row.accent_green,
    darkNeutral: row.dark_neutral,
    surfaceColor: row.surface_color,
    lightSurfaceColor: row.light_surface_color,
    secondarySurface: row.secondary_surface,
    fontFamily: row.font_family,
    borderRadius: row.border_radius,
    layoutDensity: row.layout_density,
    buttonStyle: row.button_style || 'rounded',
    cardStyle: row.card_style || 'bordered',
    logoUrl: row.logo_url || undefined,
    faviconUrl: row.favicon_url || undefined,
    customCss: row.custom_css || undefined,
  };
}

export function mapDomainBrandingThemeToDb(theme: BrandingTheme): any {
  return {
    id: 'singleton',
    primary_green: theme.primaryGreen,
    deep_green: theme.deepGreen,
    accent_green: theme.accentGreen,
    dark_neutral: theme.darkNeutral,
    surface_color: theme.surfaceColor,
    light_surface_color: theme.lightSurfaceColor,
    secondary_surface: theme.secondarySurface,
    font_family: theme.fontFamily,
    border_radius: theme.borderRadius,
    layout_density: theme.layoutDensity,
    button_style: theme.buttonStyle || 'rounded',
    card_style: theme.cardStyle || 'bordered',
    logo_url: theme.logoUrl || null,
    favicon_url: theme.faviconUrl || null,
    custom_css: theme.customCss || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbFeatureFlagsToDomain(row: any): FeatureFlags {
  return {
    courseCatalog: Boolean(row.course_catalog),
    cohortManagement: Boolean(row.cohort_management),
    instructorPortal: Boolean(row.instructor_portal),
    studentPortal: Boolean(row.student_portal),
    recordedLearning: Boolean(row.recorded_learning),
    liveClassrooms: Boolean(row.live_classrooms),
    practiceAssessments: Boolean(row.practice_assessments),
    formalExaminations: Boolean(row.formal_examinations),
    certificateIssuance: Boolean(row.certificate_issuance),
    attendanceTracking: Boolean(row.attendance_tracking),
    assignmentSubmissions: Boolean(row.assignment_submissions),
    announcements: Boolean(row.announcements),
    messaging: Boolean(row.messaging),
    reportsAnalytics: Boolean(row.reports_analytics),
    paymentGateway: Boolean(row.payment_gateway),
    pwaOfflineSupport: Boolean(row.pwa_offline_support),
    moodleSync: Boolean(row.moodle_sync),
    bbbIntegration: Boolean(row.bbb_integration),
    aiTutorEnabled: Boolean(row.ai_tutor_enabled ?? false),
  };
}

export function mapDomainFeatureFlagsToDb(flags: FeatureFlags): any {
  return {
    id: 'singleton',
    course_catalog: flags.courseCatalog,
    cohort_management: flags.cohortManagement,
    instructor_portal: flags.instructorPortal,
    student_portal: flags.studentPortal,
    recorded_learning: flags.recordedLearning,
    live_classrooms: flags.liveClassrooms,
    practice_assessments: flags.practiceAssessments,
    formal_examinations: flags.formalExaminations,
    certificate_issuance: flags.certificateIssuance,
    attendance_tracking: flags.attendanceTracking,
    assignment_submissions: flags.assignmentSubmissions,
    announcements: flags.announcements,
    messaging: flags.messaging,
    reports_analytics: flags.reportsAnalytics,
    payment_gateway: flags.paymentGateway,
    pwa_offline_support: flags.pwaOfflineSupport,
    moodle_sync: flags.moodleSync,
    bbb_integration: flags.bbbIntegration,
    ...(flags.aiTutorEnabled !== undefined ? { ai_tutor_enabled: Boolean(flags.aiTutorEnabled) } : {}),
    updated_at: new Date().toISOString(),
  };
}

export function mapDbExamBlueprintToDomain(row: any): ExamBlueprint {
  return {
    id: row.id,
    certificationType: row.certification_type,
    title: row.title,
    totalQuestions: Number(row.total_questions || 0),
    durationMinutes: Number(row.duration_minutes || 0),
    passingScorePercent: Number(row.passing_score_percent || 70),
    domains: row.domains || [],
  };
}

export function mapDbExamQuestionToDomain(row: any): ExamQuestion {
  return {
    id: row.id,
    certificationType: row.certification_type,
    domain: row.domain,
    topic: row.topic,
    stem: row.stem,
    type: row.type,
    difficulty: row.difficulty,
    options: row.options || [],
    correctOptionIds: row.correct_option_ids || [],
    explanation: row.explanation || '',
    referenceSource: row.reference_source || '',
  };
}

export function mapDbExamAttemptToDomain(row: any): ExamAttempt {
  return {
    id: row.id,
    userId: row.user_id,
    blueprintId: row.blueprint_id,
    certificationType: row.certification_type,
    status: row.status,
    startTime: row.start_time,
    deadlineTime: row.deadline_time,
    gracePeriodSeconds: row.grace_period_seconds ?? 60,
    completedTime: row.completed_time || undefined,
    assignedQuestionIds: row.assigned_question_ids || [],
    questionSnapshots: row.question_snapshots || [],
    answers: row.answers || {},
    bookmarkedQuestionIds: row.bookmarked_question_ids || [],
    autosavedAt: row.autosaved_at || undefined,
    totalScore: row.total_score !== null ? Number(row.total_score) : undefined,
    passingScorePercent: Number(row.passing_score_percent || 70),
    passed: row.passed !== null ? Boolean(row.passed) : undefined,
    domainBreakdown: row.domain_breakdown || undefined,
    certificateId: row.certificate_id || undefined,
    certificateCode: row.certificate_code || undefined,
  };
}

export function mapDbCertificateToDomain(row: any): CertificateRecord {
  const code = row.verification_code || row.certificate_number || row.certificate_code || '';
  return {
    id: row.id,
    certificateCode: code,
    userId: row.user_id,
    userName: row.candidate_name || 'Zealosh Certified Graduate',
    userEmail: row.candidate_email || '',
    courseId: row.course_id,
    courseTitle: row.course_title || 'Certification Course',
    certificationType: row.certification_type || 'ASP',
    issueDate: row.issue_date || row.issued_date || row.created_at || new Date().toISOString(),
    expiryDate: row.expiry_date || undefined,
    scorePercent: Number(row.score_percent || 0),
    status: row.status,
    qrVerificationUrl: row.verification_url || `/verify/${code}`,
    issuedBy: 'Zealosh Academic Accreditation Board',
  };
}

export function mapDbLessonToDomain(row: any): Lesson {
  return {
    id: row.id,
    courseId: row.course_id,
    moduleTitle: row.module_title,
    title: row.title,
    durationMinutes: Number(row.duration_minutes || 45),
    videoUrl: row.video_url || undefined,
    downloadableMaterials: row.downloadable_materials || [],
    contentHtml: row.content_html || undefined,
    isFreePreview: Boolean(row.is_free_preview),
  };
}

export function mapDomainLessonToDb(lesson: Lesson): any {
  return {
    id: lesson.id,
    course_id: lesson.courseId,
    module_title: lesson.moduleTitle,
    title: lesson.title,
    duration_minutes: lesson.durationMinutes,
    video_url: lesson.videoUrl || null,
    downloadable_materials: lesson.downloadableMaterials || [],
    content_html: lesson.contentHtml || null,
    is_free_preview: Boolean(lesson.isFreePreview),
    updated_at: new Date().toISOString(),
  };
}

export function mapDbLiveSessionToDomain(row: any): LiveSession {
  return {
    id: row.id,
    batchId: row.batch_id,
    courseId: row.course_id,
    title: row.title,
    scheduledStartTime: row.scheduled_start_time,
    durationMinutes: Number(row.duration_minutes || 120),
    instructorId: row.instructor_id,
    meetingId: row.meeting_id,
    status: row.status,
    recordingUrl: row.recording_url || undefined,
    recordingDurationMinutes: row.recording_duration_minutes ? Number(row.recording_duration_minutes) : undefined,
  };
}

export function mapDomainLiveSessionToDb(session: LiveSession): any {
  return {
    id: session.id,
    batch_id: session.batchId,
    course_id: session.courseId,
    title: session.title,
    scheduled_start_time: session.scheduledStartTime,
    duration_minutes: session.durationMinutes,
    instructor_id: session.instructorId,
    meeting_id: session.meetingId,
    status: session.status,
    recording_url: session.recordingUrl || null,
    recording_duration_minutes: session.recordingDurationMinutes || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbAttendanceToDomain(row: any): AttendanceRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    joinedAt: row.joined_at,
    leftAt: row.left_at || undefined,
    durationMinutes: Number(row.duration_minutes || 0),
    attended: Boolean(row.attended),
  };
}

export function mapDomainAttendanceToDb(att: AttendanceRecord): any {
  return {
    id: att.id,
    session_id: att.sessionId,
    user_id: att.userId,
    joined_at: att.joinedAt,
    left_at: att.leftAt || null,
    duration_minutes: att.durationMinutes,
    attended: att.attended,
  };
}

export function mapDbWorkflowToDomain(row: any): WorkflowDefinition {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    trigger: row.trigger,
    conditions: Array.isArray(row.conditions) ? row.conditions : [],
    actions: Array.isArray(row.actions) ? row.actions : [],
    isEnabled: Boolean(row.is_enabled),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainWorkflowToDb(wf: WorkflowDefinition): any {
  return {
    id: wf.id,
    title: wf.title,
    description: wf.description || '',
    trigger: wf.trigger,
    conditions: wf.conditions || [],
    actions: wf.actions || [],
    is_enabled: wf.isEnabled,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbNotificationTemplateToDomain(row: any): NotificationTemplate {
  return {
    id: row.id,
    trigger: row.trigger,
    channel: row.channel,
    titleTemplate: row.title_template,
    bodyTemplate: row.body_template,
    variables: Array.isArray(row.variables) ? row.variables : [],
    isEnabled: Boolean(row.is_enabled),
  };
}

export function mapDomainNotificationTemplateToDb(tpl: NotificationTemplate): any {
  return {
    id: tpl.id,
    trigger: tpl.trigger,
    channel: tpl.channel,
    title_template: tpl.titleTemplate,
    body_template: tpl.bodyTemplate,
    variables: tpl.variables || [],
    is_enabled: tpl.isEnabled,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbRecordingToDomain(row: any): ClassRecording {
  return {
    id: row.id,
    sessionId: row.session_id,
    courseId: row.course_id,
    batchId: row.batch_id,
    title: row.title,
    description: row.description || undefined,
    storageProvider: row.storage_provider || 'SUPABASE_STORAGE',
    storagePath: row.storage_path || '',
    mediaUrl: row.media_url || '',
    durationSeconds: Number(row.duration_seconds || 0),
    fileSizeBytes: Number(row.file_size_bytes || 0),
    status: row.status || 'AVAILABLE',
    isDownloadable: Boolean(row.is_downloadable),
    availableFrom: row.available_from || row.created_at,
    expiresAt: row.expires_at || undefined,
    createdBy: row.created_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDomainRecordingToDb(rec: ClassRecording): any {
  return {
    id: rec.id,
    session_id: rec.sessionId,
    course_id: rec.courseId,
    batch_id: rec.batchId,
    title: rec.title,
    description: rec.description || null,
    storage_provider: rec.storageProvider,
    storage_path: rec.storagePath,
    media_url: rec.mediaUrl,
    duration_seconds: rec.durationSeconds,
    file_size_bytes: rec.fileSizeBytes,
    status: rec.status,
    is_downloadable: rec.isDownloadable,
    available_from: rec.availableFrom,
    expires_at: rec.expiresAt || null,
    created_by: rec.createdBy || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapDbBatchAccessToDomain(row: any): RecordingBatchAccess {
  return {
    id: row.id,
    recordingId: row.recording_id,
    sourceBatchId: row.source_batch_id,
    targetBatchId: row.target_batch_id,
    allowDownload: Boolean(row.allow_download),
    status: row.status || 'ACTIVE',
    grantedBy: row.granted_by,
    grantedAt: row.granted_at || row.created_at,
    expiresAt: row.expires_at || undefined,
    createdAt: row.created_at,
  };
}

export function mapDbHighlightToDomain(row: any): RecordingHighlight {
  return {
    id: row.id,
    recordingId: row.recording_id,
    title: row.title,
    description: row.description || undefined,
    startTimestampSeconds: Number(row.start_timestamp_seconds || 0),
    endTimestampSeconds: Number(row.end_timestamp_seconds || 0),
    topicId: row.topic_id || undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDbResourceToDomain(row: any): RecordingResource {
  return {
    id: row.id,
    recordingId: row.recording_id,
    highlightId: row.highlight_id || undefined,
    title: row.title,
    description: row.description || undefined,
    resourceType: row.resource_type,
    url: row.url,
    fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : undefined,
    timestampSeconds: row.timestamp_seconds !== null && row.timestamp_seconds !== undefined ? Number(row.timestamp_seconds) : undefined,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export function mapDbDoubtToDomain(row: any): RecordingDoubt {
  return {
    id: row.id,
    recordingId: row.recording_id,
    userId: row.user_id,
    timestampSeconds: Number(row.timestamp_seconds || 0),
    highlightId: row.highlight_id || undefined,
    question: row.question,
    status: row.status || 'OPEN',
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDbDoubtAnswerToDomain(row: any): RecordingDoubtAnswer {
  return {
    id: row.id,
    doubtId: row.doubt_id,
    instructorId: row.instructor_id || row.user_id || 'unknown',
    answerText: row.answer_text || row.answer || '',
    referenceUrl: row.reference_url || undefined,
    createdAt: row.created_at,
  };
}


// ============================================================================
// SUPABASE PERSISTENCE ADAPTER IMPLEMENTATION
// ============================================================================

export class SupabaseAdapter {
  public getClient() {
    const client = getSupabaseAdminClient();
    if (!client) {
      throw new Error('Supabase client is not configured or missing connection keys');
    }
    return client;
  }

  // --------------------------------------------------------------------------
  // Diagnostic & Health Verification
  // --------------------------------------------------------------------------
  public async validateConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      const client = this.getClient();
      const { data, error } = await client.from('courses').select('id').limit(1);
      if (error) {
        return { connected: false, message: error.message };
      }
      return { connected: true, message: 'Supabase gateway and core schema active' };
    } catch (err: any) {
      return { connected: false, message: err.message };
    }
  }

  // --------------------------------------------------------------------------
  // Platform Configuration & Governance
  // --------------------------------------------------------------------------
  public async getPlatformSettings(): Promise<PlatformSettings> {
    const client = this.getClient();
    const { data, error } = await client.from('platform_settings').select('*').eq('id', 'singleton').single();
    if (error || !data) {
      // Fallback to public settings view if anon key used
      const { data: pubData, error: pubErr } = await client.from('public_platform_settings').select('*').limit(1).single();
      if (!pubErr && pubData) {
        return {
          platformName: pubData.platform_name,
          organizationName: pubData.organization_name,
          organizationEmail: pubData.organization_email,
          supportEmail: pubData.support_email,
          supportPhone: pubData.support_phone,
          defaultLanguage: pubData.default_language,
          defaultTimezone: pubData.default_timezone,
          defaultCurrency: pubData.default_currency,
          dateFormat: pubData.date_format,
          timeFormat: pubData.time_format,
          maintenanceMode: Boolean(pubData.maintenance_mode),
          registrationMode: 'PUBLIC',
          sessionTimeoutMinutes: 1440,
          maxLoginAttempts: 5,
          notificationPreferences: { emailAlerts: true, smsAlerts: false, inAppAlerts: true },
        };
      }
      throw new Error(`Failed to load platform settings from Supabase: ${error?.message || pubErr?.message}`);
    }
    return mapDbPlatformSettingsToDomain(data);
  }

  public async updatePlatformSettings(
    settings: Partial<PlatformSettings>,
    actorEmail: string = 'admin@zealosh.com',
    actorUserId: string = 'usr-admin-01',
    reason?: string
  ): Promise<PlatformSettings> {
    const client = this.getClient();
    const current = await this.getPlatformSettings();
    const merged: PlatformSettings = { ...current, ...settings };
    const dbPayload = mapDomainPlatformSettingsToDb(merged);

    const { data, error } = await client.from('platform_settings').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error updating platform settings: ${error.message}`);

    await this.recordConfigAudit({
      actorUserId,
      actorEmail,
      section: 'GENERAL_SETTINGS',
      previousValue: current as any,
      newValue: merged as any,
      changeReason: reason || 'Superadmin updated platform settings',
    });

    return mapDbPlatformSettingsToDomain(data);
  }

  public async getBrandingTheme(): Promise<BrandingTheme> {
    const client = this.getClient();
    const { data, error } = await client.from('branding_theme').select('*').eq('id', 'singleton').single();
    if (error || !data) {
      throw new Error(`Failed to load branding theme from Supabase: ${error?.message}`);
    }
    return mapDbBrandingThemeToDomain(data);
  }

  public async updateBrandingTheme(theme: Partial<BrandingTheme>, actorEmail: string = 'admin@zealosh.com'): Promise<BrandingTheme> {
    const client = this.getClient();
    const current = await this.getBrandingTheme();
    const merged: BrandingTheme = { ...current, ...theme };
    const dbPayload = mapDomainBrandingThemeToDb(merged);

    const { data, error } = await client.from('branding_theme').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error updating branding theme: ${error.message}`);

    await this.recordConfigAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      section: 'BRANDING',
      previousValue: current as any,
      newValue: merged as any,
      changeReason: 'Superadmin updated branding theme',
    });

    return mapDbBrandingThemeToDomain(data);
  }

  public async resetToOfficialBrand(actorEmail: string = 'admin@zealosh.com'): Promise<BrandingTheme> {
    const official: BrandingTheme = {
      primaryGreen: '#4f8c4c',
      deepGreen: '#3a7536',
      accentGreen: '#2ea033',
      darkNeutral: '#0f172a',
      surfaceColor: '#ffffff',
      lightSurfaceColor: '#f4f9f3',
      secondarySurface: '#e2efe1',
      fontFamily: 'Inter',
      borderRadius: 'md',
      layoutDensity: 'comfortable',
      buttonStyle: 'rounded',
      cardStyle: 'bordered',
      logoUrl: '/logo.png',
      faviconUrl: '/logo-round.png',
    };
    return this.updateBrandingTheme(official, actorEmail);
  }

  public async getFeatureFlags(): Promise<FeatureFlags> {
    const client = this.getClient();
    const { data, error } = await client.from('feature_flags').select('*').eq('id', 'singleton').single();
    if (error || !data) {
      throw new Error(`Failed to load feature flags from Supabase: ${error?.message}`);
    }
    return mapDbFeatureFlagsToDomain(data);
  }

  public async updateFeatureFlags(
    flags: Partial<FeatureFlags>,
    actorEmail: string = 'admin@zealosh.com',
    actorUserId: string = 'usr-admin-01',
    reason?: string
  ): Promise<FeatureFlags> {
    const client = this.getClient();
    const current = await this.getFeatureFlags();
    const merged: FeatureFlags = { ...current, ...flags };
    const dbPayload = mapDomainFeatureFlagsToDb(merged);

    let { data, error } = await client.from('feature_flags').upsert(dbPayload).select('*').single();
    if (error && error.message && error.message.includes('ai_tutor_enabled')) {
      const { ai_tutor_enabled, ...fallbackPayload } = dbPayload;
      const retry = await client.from('feature_flags').upsert(fallbackPayload).select('*').single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw new Error(`Supabase error updating feature flags: ${error.message}`);

    await this.recordConfigAudit({
      actorUserId,
      actorEmail,
      section: 'FEATURE_FLAGS',
      previousValue: current as any,
      newValue: merged as any,
      changeReason: reason || 'Superadmin updated feature flags',
    });

    return mapDbFeatureFlagsToDomain(data);
  }

  public async getNavigationConfig(): Promise<NavigationItem[]> {
    const client = this.getClient();
    const { data, error } = await client.from('navigation_items').select('*').order('order_index', { ascending: true });
    if (error) throw new Error(`Supabase error fetching navigation: ${error.message}`);
    return (data || []).map((row: any) => ({
      id: row.id,
      label: row.label,
      href: row.href,
      iconName: row.icon_name,
      requiredRole: row.required_role || [],
      order: row.order_index,
      isVisible: row.is_visible,
      isSystem: row.is_system,
    }));
  }

  public async updateNavigationConfig(
    items: NavigationItem[],
    actorEmail: string = 'admin@zealosh.com',
    actorUserId: string = 'usr-admin-01',
    reason?: string
  ): Promise<NavigationItem[]> {
    const client = this.getClient();
    const current = await this.getNavigationConfig();

    const dbPayloads = items.map((item, idx) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      icon_name: item.iconName,
      required_role: item.requiredRole || [],
      order_index: idx + 1,
      is_visible: item.isVisible,
      is_system: item.isSystem,
    }));

    const { error: upsertErr } = await client.from('navigation_items').upsert(dbPayloads);
    if (upsertErr) throw new Error(`Supabase error updating navigation: ${upsertErr.message}`);

    await this.recordConfigAudit({
      actorUserId,
      actorEmail,
      section: 'NAVIGATION',
      previousValue: current as any,
      newValue: items as any,
      changeReason: reason || 'Superadmin updated navigation structure',
    });

    return this.getNavigationConfig();
  }

  // --------------------------------------------------------------------------
  // Roles and User Governance
  // --------------------------------------------------------------------------
  public async getRoles(): Promise<RoleDefinition[]> {
    const client = this.getClient();
    const { data, error } = await client.from('roles').select('*').order('name');
    if (error) throw new Error(`Supabase error fetching roles: ${error.message}`);
    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isSystem: row.is_system,
      permissions: (row.permissions || []) as PermissionCode[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  public async createRole(role: Omit<RoleDefinition, 'id' | 'createdAt' | 'updatedAt'>, actorEmail: string = 'admin@zealosh.com'): Promise<RoleDefinition> {
    const client = this.getClient();
    const roleId = `role-${role.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const now = new Date().toISOString();

    const newRole: RoleDefinition = {
      id: roleId,
      name: role.name,
      description: role.description,
      isSystem: false,
      permissions: role.permissions,
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await client.from('roles').insert({
      id: newRole.id,
      name: newRole.name,
      description: newRole.description,
      is_system: false,
      permissions: newRole.permissions,
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(`Supabase error creating role: ${error.message}`);

    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'ROLE_CREATED',
      entityType: 'ROLE',
      entityId: roleId,
      details: { name: role.name, permissionsCount: role.permissions.length },
    });

    return newRole;
  }

  public async updateRolePermissions(roleId: string, permissions: PermissionCode[], actorEmail: string = 'admin@zealosh.com'): Promise<RoleDefinition> {
    const client = this.getClient();
    const now = new Date().toISOString();

    const { data, error } = await client
      .from('roles')
      .update({ permissions, updated_at: now })
      .eq('id', roleId)
      .select('*')
      .single();

    if (error || !data) throw new Error(`Supabase error updating role permissions: ${error?.message}`);

    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'ROLE_PERMISSIONS_UPDATED',
      entityType: 'ROLE',
      entityId: roleId,
      details: { roleId, updatedPermissionsCount: permissions.length },
    });

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      isSystem: data.is_system,
      permissions: data.permissions as PermissionCode[],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public async deleteRole(roleId: string, actorEmail: string = 'admin@zealosh.com'): Promise<boolean> {
    const client = this.getClient();
    const { data: role } = await client.from('roles').select('is_system').eq('id', roleId).single();
    if (role?.is_system) {
      throw new Error('System roles cannot be deleted');
    }

    const { error } = await client.from('roles').delete().eq('id', roleId);
    if (error) throw new Error(`Supabase error deleting role: ${error.message}`);

    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'ROLE_DELETED',
      entityType: 'ROLE',
      entityId: roleId,
      details: { roleId },
    });

    return true;
  }

  public async getUser(id: string): Promise<User | null> {
    const client = this.getClient();
    const { data, error } = await client.from('users').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapDbUserToDomain(data);
  }

  public async getUserById(id: string): Promise<User | null> {
    return this.getUser(id);
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    const client = this.getClient();
    const { data, error } = await client.from('users').select('*').eq('email', email.toLowerCase().trim()).single();
    if (error || !data) return null;
    return mapDbUserToDomain(data);
  }

  public async getUsers(): Promise<User[]> {
    const client = this.getClient();
    const { data, error } = await client.from('users').select('*').order('name');
    if (error) throw new Error(`Supabase error fetching users: ${error.message}`);
    return (data || []).map(mapDbUserToDomain);
  }

  public async saveUser(user: User, actorEmail: string = 'admin@zealosh.com'): Promise<User> {
    const client = this.getClient();
    const dbPayload = mapDomainUserToDb(user);
    const { data, error } = await client.from('users').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error saving user: ${error.message}`);
    return mapDbUserToDomain(data);
  }

  // --------------------------------------------------------------------------
  // Courses and Batches Catalog
  // --------------------------------------------------------------------------
  public async getCourses(filter?: { cert?: string; delivery?: string; status?: CourseStatus }): Promise<Course[]> {
    const client = this.getClient();
    let query = client.from('courses').select('*').order('title');

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.cert && filter.cert !== 'ALL') {
      query = query.eq('certification_type', filter.cert);
    }
    if (filter?.delivery && filter.delivery !== 'ALL') {
      query = query.eq('delivery_model', filter.delivery);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase error fetching courses: ${error.message}`);
    return (data || []).map(mapDbCourseToDomain);
  }

  public async getCourse(idOrSlug: string): Promise<Course | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('courses')
      .select('*')
      .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
      .limit(1)
      .single();

    if (error || !data) return null;
    return mapDbCourseToDomain(data);
  }

  public async getCourseById(id: string): Promise<Course | null> {
    return this.getCourse(id);
  }

  public async getCourseBySlug(slug: string): Promise<Course | null> {
    return this.getCourse(slug);
  }

  public async addCourse(course: Course, actorEmail: string = 'admin@zealosh.com'): Promise<Course> {
    const client = this.getClient();
    const dbPayload = mapDomainCourseToDb(course);
    const { data, error } = await client.from('courses').insert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error inserting course: ${error.message}`);

    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'COURSE_CREATED',
      entityType: 'COURSE',
      entityId: course.id,
      details: { title: course.title, certType: course.certificationType },
    });

    return mapDbCourseToDomain(data);
  }

  public async updateCourse(courseId: string, updates: Partial<Course>, actorEmail: string = 'admin@zealosh.com'): Promise<Course> {
    const client = this.getClient();
    const current = await this.getCourse(courseId);
    if (!current) throw new Error(`Course not found: ${courseId}`);

    const merged: Course = { ...current, ...updates, updatedAt: new Date().toISOString() };
    const dbPayload = mapDomainCourseToDb(merged);

    const { data, error } = await client.from('courses').update(dbPayload).eq('id', courseId).select('*').single();
    if (error) throw new Error(`Supabase error updating course: ${error.message}`);

    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'COURSE_UPDATED',
      entityType: 'COURSE',
      entityId: courseId,
      details: { title: merged.title, status: merged.status },
    });

    return mapDbCourseToDomain(data);
  }

  public async deleteCourse(courseId: string, actorEmail: string = 'admin@zealosh.com'): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('courses').delete().eq('id', courseId);
    if (error) throw new Error(`Supabase error deleting course: ${error.message}`);

    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'COURSE_DELETED',
      entityType: 'COURSE',
      entityId: courseId,
      details: { courseId },
    });

    return true;
  }

  public async saveCourse(course: Course, actorEmail: string = 'admin@zealosh.com'): Promise<Course> {
    const existing = await this.getCourse(course.id);
    if (existing) {
      return this.updateCourse(course.id, course, actorEmail);
    }
    return this.addCourse(course, actorEmail);
  }

  public async getBatches(courseId?: string): Promise<Batch[]> {
    const client = this.getClient();
    let query = client.from('batches').select('*').order('start_date');
    if (courseId) {
      query = query.eq('course_id', courseId);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Supabase error fetching batches: ${error.message}`);
    return (data || []).map(mapDbBatchToDomain);
  }

  public async getBatch(batchId: string): Promise<Batch | null> {
    const client = this.getClient();
    const { data, error } = await client.from('batches').select('*').eq('id', batchId).single();
    if (error || !data) return null;
    return mapDbBatchToDomain(data);
  }

  public async addBatch(batch: Batch, actorEmail: string = 'admin@zealosh.com'): Promise<Batch> {
    const client = this.getClient();
    const dbPayload = mapDomainBatchToDb(batch);
    const { data, error } = await client.from('batches').insert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error inserting batch: ${error.message}`);

    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'BATCH_CREATED',
      entityType: 'BATCH',
      entityId: batch.id,
      details: { name: batch.name, capacity: batch.capacity },
    });

    return mapDbBatchToDomain(data);
  }

  public async updateBatch(batchId: string, updates: Partial<Batch>, actorEmail: string = 'admin@zealosh.com'): Promise<Batch> {
    const client = this.getClient();
    const current = await this.getBatch(batchId);
    if (!current) throw new Error(`Batch not found: ${batchId}`);

    const merged: Batch = { ...current, ...updates };
    const dbPayload = mapDomainBatchToDb(merged);

    const { data, error } = await client.from('batches').update(dbPayload).eq('id', batchId).select('*').single();
    if (error) throw new Error(`Supabase error updating batch: ${error.message}`);

    return mapDbBatchToDomain(data);
  }

  public async getBatchById(id: string): Promise<Batch | null> {
    return this.getBatch(id);
  }

  public async getLessons(courseId: string): Promise<Lesson[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('display_order', { ascending: true });
    if (error) throw new Error(`Supabase error fetching lessons: ${error.message}`);
    return (data || []).map(mapDbLessonToDomain);
  }

  public async getLessonsByCourse(courseId: string): Promise<Lesson[]> {
    return this.getLessons(courseId);
  }

  public async saveLesson(lesson: Lesson): Promise<Lesson> {
    const client = this.getClient();
    const dbPayload = mapDomainLessonToDb(lesson);
    const { data, error } = await client.from('lessons').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error saving lesson: ${error.message}`);
    return mapDbLessonToDomain(data);
  }

  public async getLiveSession(sessionId: string): Promise<LiveSession | null> {
    const client = this.getClient();
    let { data, error } = await client.from('live_sessions').select('*').eq('id', sessionId).maybeSingle();
    if (!data) {
      const byMtg = await client.from('live_sessions').select('*').eq('meeting_id', sessionId).maybeSingle();
      if (byMtg.data) data = byMtg.data;
    }
    if (!data) return null;
    return mapDbLiveSessionToDomain(data);
  }

  public async getLiveSessionByMeetingId(meetingId: string): Promise<LiveSession | null> {
    const client = this.getClient();
    const { data, error } = await client.from('live_sessions').select('*').eq('meeting_id', meetingId).maybeSingle();
    if (error) {
      if (isTableMissingError(error)) {
        throw new DatabasePersistenceError(
          `Authoritative query failed for live session meeting "${meetingId}": table "live_sessions" does not exist in database or schema cache`,
          {
            operation: 'getLiveSessionByMeetingId',
            entityType: 'LiveSession',
            category: 'SCHEMA_MISSING',
            retryable: false,
            cause: error,
          }
        );
      }
      const classification = classifyDatabaseError(error);
      throw new DatabasePersistenceError(`Supabase error fetching live session: ${error.message}`, {
        operation: 'getLiveSessionByMeetingId',
        entityType: 'LiveSession',
        category: classification.category,
        retryable: classification.retryable,
        cause: error,
      });
    }
    if (!data) return null;
    return mapDbLiveSessionToDomain(data);
  }

  public async getAllLiveSessions(): Promise<LiveSession[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('live_sessions')
      .select('*')
      .order('scheduled_start_time', { ascending: true });
    if (error) {
      if (isTableMissingError(error)) {
        throw new DatabasePersistenceError(
          `Authoritative query failed for live sessions: table "live_sessions" does not exist in database or schema cache`,
          {
            operation: 'getAllLiveSessions',
            entityType: 'LiveSession',
            category: 'SCHEMA_MISSING',
            retryable: false,
            cause: error,
          }
        );
      }
      const classification = classifyDatabaseError(error);
      throw new DatabasePersistenceError(`Supabase error fetching live sessions: ${error.message}`, {
        operation: 'getAllLiveSessions',
        entityType: 'LiveSession',
        category: classification.category,
        retryable: classification.retryable,
        cause: error,
      });
    }
    return (data || []).map(mapDbLiveSessionToDomain);
  }

  public async getLiveSessions(batchId: string): Promise<LiveSession[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('live_sessions')
      .select('*')
      .eq('batch_id', batchId)
      .order('scheduled_start_time', { ascending: true });
    if (error) {
      if (isTableMissingError(error)) {
        throw new DatabasePersistenceError(
          `Authoritative query failed for live sessions: table "live_sessions" does not exist in database or schema cache`,
          {
            operation: 'getLiveSessions',
            entityType: 'LiveSession',
            category: 'SCHEMA_MISSING',
            retryable: false,
            cause: error,
          }
        );
      }
      const classification = classifyDatabaseError(error);
      throw new DatabasePersistenceError(`Supabase error fetching live sessions: ${error.message}`, {
        operation: 'getLiveSessions',
        entityType: 'LiveSession',
        category: classification.category,
        retryable: classification.retryable,
        cause: error,
      });
    }
    return (data || []).map(mapDbLiveSessionToDomain);
  }

  public async saveLiveSession(session: LiveSession): Promise<LiveSession> {
    const client = this.getClient();
    const dbPayload = mapDomainLiveSessionToDb(session);
    const { data, error } = await client.from('live_sessions').upsert(dbPayload).select('*').single();
    if (error) {
      if (isTableMissingError(error)) {
        throw new DatabasePersistenceError(
          `Authoritative persistence failed for LiveSession "${session.id}": table "live_sessions" does not exist in database or schema cache`,
          {
            operation: 'saveLiveSession',
            entityType: 'LiveSession',
            category: 'SCHEMA_MISSING',
            retryable: false,
            cause: error,
          }
        );
      }
      const classification = classifyDatabaseError(error);
      throw new DatabasePersistenceError(`Supabase error saving live session: ${error.message}`, {
        operation: 'saveLiveSession',
        entityType: 'LiveSession',
        category: classification.category,
        retryable: classification.retryable,
        cause: error,
      });
    }
    return mapDbLiveSessionToDomain(data);
  }

  public async getAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    const client = this.getClient();
    const { data, error } = await client.from('attendance_records').select('*').eq('session_id', sessionId);
    if (error) {
      if (isTableMissingError(error)) {
        throw new DatabasePersistenceError(
          `Authoritative query failed for attendance: table "attendance_records" does not exist in database or schema cache`,
          {
            operation: 'getAttendance',
            entityType: 'AttendanceRecord',
            category: 'SCHEMA_MISSING',
            retryable: false,
            cause: error,
          }
        );
      }
      const classification = classifyDatabaseError(error);
      throw new DatabasePersistenceError(`Supabase error fetching attendance: ${error.message}`, {
        operation: 'getAttendance',
        entityType: 'AttendanceRecord',
        category: classification.category,
        retryable: classification.retryable,
        cause: error,
      });
    }
    return (data || []).map(mapDbAttendanceToDomain);
  }

  public async recordAttendance(record: AttendanceRecord): Promise<AttendanceRecord> {
    const client = this.getClient();
    const dbPayload = mapDomainAttendanceToDb(record);
    const { data, error } = await client.from('attendance_records').insert(dbPayload).select('*').single();
    if (error) {
      if (isTableMissingError(error)) {
        throw new DatabasePersistenceError(
          `Authoritative persistence failed for AttendanceRecord "${record.id}": table "attendance_records" does not exist in database or schema cache`,
          {
            operation: 'recordAttendance',
            entityType: 'AttendanceRecord',
            category: 'SCHEMA_MISSING',
            retryable: false,
            cause: error,
          }
        );
      }
      const classification = classifyDatabaseError(error);
      throw new DatabasePersistenceError(`Supabase error recording attendance: ${error.message}`, {
        operation: 'recordAttendance',
        entityType: 'AttendanceRecord',
        category: classification.category,
        retryable: classification.retryable,
        cause: error,
      });
    }
    return mapDbAttendanceToDomain(data);
  }

  public async deleteBatch(batchId: string, actorEmail: string = 'admin@zealosh.com'): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('batches').delete().eq('id', batchId);
    if (error) throw new Error(`Supabase error deleting batch: ${error.message}`);
    return true;
  }

  // --------------------------------------------------------------------------
  // Atomic Enrollment and Seat Capacity Enforcement
  // --------------------------------------------------------------------------
  public async enrollStudent(params: {
    userId: string;
    courseId?: string;
    batchId: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; enrollment: Enrollment; isNew: boolean }> {
    const client = this.getClient();
    const idempotencyKey = params.idempotencyKey || `enrol_${params.batchId}_${params.userId}`;

    // 1. Attempt PostgreSQL atomic stored procedure first (enforces row-level lock FOR UPDATE)
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('enroll_learner_atomic', {
        p_user_id: params.userId,
        p_batch_id: params.batchId,
        p_idempotency_key: idempotencyKey,
      });

      if (!rpcError && rpcData) {
        const raw = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
        return {
          success: raw.success,
          isNew: raw.isNew,
          enrollment: {
            id: raw.enrollment.id,
            userId: raw.enrollment.userId,
            courseId: raw.enrollment.courseId,
            batchId: raw.enrollment.batchId,
            status: raw.enrollment.status,
            enrolledAt: raw.enrollment.enrolledAt,
            expiresAt: raw.enrollment.expiresAt,
            progressPercent: Number(raw.enrollment.progressPercent || 0),
            completedLessonIds: raw.enrollment.completedLessonIds || [],
            idempotencyKey: raw.enrollment.idempotencyKey,
          },
        };
      }

      if (rpcError && rpcError.message.includes('BATCH_CAPACITY_EXCEEDED')) {
        throw new Error('BATCH_CAPACITY_EXCEEDED');
      }
      if (rpcError && rpcError.message.includes('BATCH_NOT_FOUND')) {
        throw new Error('Batch does not exist');
      }
      if (rpcError && rpcError.message.includes('BATCH_NOT_ACCEPTING_ENROLLMENTS')) {
        throw new Error('Batch is not accepting enrollments');
      }
    } catch (err: any) {
      if (err.message === 'BATCH_CAPACITY_EXCEEDED' || err.message === 'Batch does not exist' || err.message === 'Batch is not accepting enrollments') {
        throw err;
      }
      // If RPC is missing or fails due to network/gateway, continue to safe server-side transaction fallback
    }

    // 2. Safe Server-Side Transaction Path (Strict Invariant Checking)
    const { data: existingByKey } = await client
      .from('enrollments')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingByKey) {
      return { success: true, isNew: false, enrollment: mapDbEnrollmentToDomain(existingByKey) };
    }

    const { data: existingActive } = await client
      .from('enrollments')
      .select('*')
      .eq('user_id', params.userId)
      .eq('batch_id', params.batchId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (existingActive) {
      return { success: true, isNew: false, enrollment: mapDbEnrollmentToDomain(existingActive) };
    }

    const batch = await this.getBatch(params.batchId);
    if (!batch) throw new Error('Batch does not exist');
    if (batch.status !== 'ACTIVE' && batch.status !== 'UPCOMING') {
      throw new Error('Batch is not accepting enrollments');
    }

    if (batch.enrolledCount >= batch.capacity) {
      throw new Error('BATCH_CAPACITY_EXCEEDED');
    }

    const enrollmentId = `enr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const domainEnrollment: Enrollment = {
      id: enrollmentId,
      userId: params.userId,
      courseId: batch.courseId,
      batchId: batch.id,
      status: 'ACTIVE',
      enrolledAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      progressPercent: 0,
      completedLessonIds: [],
      idempotencyKey,
    };

    const dbPayload = mapDomainEnrollmentToDb(domainEnrollment);
    const { data: inserted, error: insertErr } = await client.from('enrollments').insert(dbPayload).select('*').single();
    if (insertErr) throw new Error(`Supabase enrollment insertion error: ${insertErr.message}`);

    // Increment enrolled count
    await client
      .from('batches')
      .update({ enrolled_count: batch.enrolledCount + 1, updated_at: new Date().toISOString() })
      .eq('id', batch.id);

    await this.recordAudit({
      actorUserId: params.userId,
      actorEmail: 'student@zealosh.com',
      actorRole: 'STUDENT',
      action: 'COURSE_ENROLLMENT_COMPLETED',
      entityType: 'ENROLLMENT',
      entityId: enrollmentId,
      details: { batchId: batch.id, courseId: batch.courseId, remainingSeats: batch.capacity - (batch.enrolledCount + 1) },
    });

    return { success: true, isNew: true, enrollment: mapDbEnrollmentToDomain(inserted) };
  }

  public async getEnrollments(userId?: string, batchId?: string): Promise<Enrollment[]> {
    const client = this.getClient();
    let query = client.from('enrollments').select('*').order('enrolled_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    if (batchId) query = query.eq('batch_id', batchId);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase error fetching enrollments: ${error.message}`);
    return (data || []).map(mapDbEnrollmentToDomain);
  }

  public async getUserEnrollments(userId: string): Promise<Enrollment[]> {
    return this.getEnrollments(userId);
  }

  public async getEnrollmentById(id: string): Promise<Enrollment | null> {
    const client = this.getClient();
    const { data, error } = await client.from('enrollments').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapDbEnrollmentToDomain(data);
  }

  public async updateEnrollmentProgress(
    enrollmentId: string,
    completedLessonIds: string[],
    progressPercent: number,
    actorEmail: string = 'student@zealosh.com'
  ): Promise<Enrollment> {
    const client = this.getClient();
    const percent = Math.min(100, Math.max(0, progressPercent));
    const { data, error } = await client
      .from('enrollments')
      .update({
        completed_lesson_ids: completedLessonIds,
        progress_percent: percent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId)
      .select('*')
      .single();

    if (error) throw new Error(`Supabase error updating enrollment progress: ${error.message}`);

    await this.recordAudit({
      actorUserId: data.user_id,
      actorEmail,
      actorRole: 'STUDENT',
      action: 'LESSON_PROGRESS_UPDATED',
      entityType: 'ENROLLMENT',
      entityId: enrollmentId,
      details: { completedLessonsCount: completedLessonIds.length, progressPercent: percent },
    });

    return mapDbEnrollmentToDomain(data);
  }

  public async updateEnrollmentStatus(
    enrollmentId: string,
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED',
    actorEmail: string = 'admin@zealosh.com'
  ): Promise<Enrollment> {
    const client = this.getClient();
    const { data, error } = await client
      .from('enrollments')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId)
      .select('*')
      .single();

    if (error) throw new Error(`Supabase error updating enrollment status: ${error.message}`);

    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'ENROLLMENT_STATUS_UPDATED',
      entityType: 'ENROLLMENT',
      entityId: enrollmentId,
      details: { status, userId: data.user_id, batchId: data.batch_id },
    });

    return mapDbEnrollmentToDomain(data);
  }

  // --------------------------------------------------------------------------
  // Assignments, Rubrics & Student Submissions
  // --------------------------------------------------------------------------
  public async getAssignments(courseId?: string, batchId?: string): Promise<Assignment[]> {
    const client = this.getClient();
    let query = client.from('assignments').select('*').order('created_at', { ascending: false });
    if (courseId) query = query.eq('course_id', courseId);
    if (batchId) query = query.or(`batch_id.eq.${batchId},batch_id.is.null`);
    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase error fetching assignments: ${error.message}`);
    }
    return (data || []).map(mapDbAssignmentToDomain);
  }

  public async getAssignmentById(id: string): Promise<Assignment | null> {
    const client = this.getClient();
    const { data, error } = await client.from('assignments').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Supabase error fetching assignment ${id}: ${error.message}`);
    if (!data) return null;
    return mapDbAssignmentToDomain(data);
  }

  public async saveAssignment(assignment: Assignment, actorEmail: string = 'admin@zealosh.com'): Promise<Assignment> {
    const client = this.getClient();
    const dbPayload = mapDomainAssignmentToDb(assignment);
    const { data, error } = await client.from('assignments').upsert(dbPayload).select('*').single();
    if (error) {
      throw new Error(`Supabase error saving assignment: ${error.message}`);
    }
    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'ASSIGNMENT_SAVED',
      entityType: 'ASSIGNMENT',
      entityId: assignment.id,
      details: { title: assignment.title, maxScore: assignment.maxScore },
    });
    return mapDbAssignmentToDomain(data);
  }

  public async deleteAssignment(id: string, actorEmail: string = 'admin@zealosh.com'): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('assignments').delete().eq('id', id);
    if (error) throw new Error(`Supabase error deleting assignment ${id}: ${error.message}`);
    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'ASSIGNMENT_DELETED',
      entityType: 'ASSIGNMENT',
      entityId: id,
      details: {},
    });
    return true;
  }

  public async getSubmissions(assignmentId?: string, userId?: string, batchId?: string): Promise<AssignmentSubmission[]> {
    const client = this.getClient();
    let query = client.from('assignment_submissions').select('*, assignments(course_id, batch_id)').order('submitted_at', { ascending: false });
    if (assignmentId) query = query.eq('assignment_id', assignmentId);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase error fetching submissions: ${error.message}`);
    let results = (data || []).map(mapDbSubmissionToDomain);
    if (batchId) {
      results = results.filter((s) => s.batchId === batchId);
    }
    return results;
  }

  public async getSubmissionById(id: string): Promise<AssignmentSubmission | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('assignment_submissions')
      .select('*, assignments(course_id, batch_id)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Supabase error fetching submission ${id}: ${error.message}`);
    if (!data) return null;
    return mapDbSubmissionToDomain(data);
  }

  public async submitAssignment(submission: AssignmentSubmission, actorEmail: string = 'student@zealosh.com'): Promise<AssignmentSubmission> {
    const client = this.getClient();
    let dbPayload = mapDomainSubmissionToDb(submission);
    let { data, error } = await client
      .from('assignment_submissions')
      .upsert(dbPayload)
      .select('*, assignments(course_id, batch_id)')
      .single();

    if (error && (error.message.includes('column') || error.message.includes('schema cache')) && dbPayload.ai_review_suggestions !== undefined) {
      delete dbPayload.ai_review_suggestions;
      const retry = await client
        .from('assignment_submissions')
        .upsert(dbPayload)
        .select('*, assignments(course_id, batch_id)')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      throw new Error(`Supabase error submitting assignment: ${error.message}`);
    }
    await this.recordAudit({
      actorUserId: submission.userId,
      actorEmail,
      actorRole: 'STUDENT',
      action: 'ASSIGNMENT_SUBMITTED',
      entityType: 'SUBMISSION',
      entityId: submission.id,
      details: { assignmentId: submission.assignmentId },
    });
    return mapDbSubmissionToDomain(data);
  }

  public async gradeSubmission(
    submissionId: string,
    grade: {
      score?: number;
      feedback?: string;
      rubricScores?: RubricScore[];
      aiReviewSuggestions?: AiReviewSuggestion;
      status?: 'SUBMITTED' | 'GRADED' | 'RESUBMISSION_REQUESTED';
      gradedBy: string;
      actorEmail?: string;
    }
  ): Promise<AssignmentSubmission> {
    const client = this.getClient();
    const now = new Date().toISOString();
    const finalStatus = grade.status || 'GRADED';
    const updatePayload: any = {
      status: finalStatus,
      graded_by_user_id: grade.gradedBy,
      graded_at: now,
      updated_at: now,
    };
    if (grade.score !== undefined) {
      updatePayload.score = grade.score;
    }
    if (grade.feedback !== undefined) {
      updatePayload.feedback = grade.feedback || null;
    }
    if (grade.rubricScores) {
      updatePayload.rubric_scores = grade.rubricScores;
    }
    if (grade.aiReviewSuggestions) {
      updatePayload.ai_review_suggestions = grade.aiReviewSuggestions;
    }
    let { data, error } = await client
      .from('assignment_submissions')
      .update(updatePayload)
      .eq('id', submissionId)
      .select('*, assignments(course_id, batch_id)')
      .single();

    if (error && (error.message.includes('column') || error.message.includes('schema cache')) && updatePayload.ai_review_suggestions !== undefined) {
      delete updatePayload.ai_review_suggestions;
      const retry = await client
        .from('assignment_submissions')
        .update(updatePayload)
        .eq('id', submissionId)
        .select('*, assignments(course_id, batch_id)')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      throw new Error(`Supabase error grading submission: ${error.message}`);
    }

    await this.recordAudit({
      actorUserId: grade.gradedBy,
      actorEmail: grade.actorEmail || 'instructor@zealosh.com',
      actorRole: 'INSTRUCTOR',
      action: finalStatus === 'RESUBMISSION_REQUESTED' ? 'ASSIGNMENT_RESUBMISSION_REQUESTED' : 'ASSIGNMENT_GRADED',
      entityType: 'SUBMISSION',
      entityId: submissionId,
      details: { score: grade.score, submissionId, status: finalStatus },
    });

    return mapDbSubmissionToDomain(data);
  }

  // --------------------------------------------------------------------------
  // Digital Classroom Stream & Cohort Announcements
  // --------------------------------------------------------------------------
  public async getAnnouncements(courseId: string, batchId?: string): Promise<ClassroomAnnouncement[]> {
    const client = this.getClient();
    let query = client
      .from('classroom_announcements')
      .select('*')
      .eq('course_id', courseId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (batchId) {
      query = query.or(`batch_id.eq.${batchId},batch_id.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      if (isTableMissingError(error)) {
        throw new DatabasePersistenceError(
          `Authoritative query failed for announcements: table "classroom_announcements" does not exist in database or schema cache`,
          {
            operation: 'getAnnouncements',
            entityType: 'ClassroomAnnouncement',
            category: 'SCHEMA_MISSING',
            retryable: false,
            cause: error,
          }
        );
      }
      const classification = classifyDatabaseError(error);
      throw new DatabasePersistenceError(`Supabase error fetching announcements: ${error.message}`, {
        operation: 'getAnnouncements',
        entityType: 'ClassroomAnnouncement',
        category: classification.category,
        retryable: classification.retryable,
        cause: error,
      });
    }
    return (data || []).map(mapDbAnnouncementToDomain);
  }

  public async getAnnouncementById(id: string): Promise<ClassroomAnnouncement | null> {
    const client = this.getClient();
    const { data, error } = await client.from('classroom_announcements').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (isTableMissingError(error)) {
        throw new DatabasePersistenceError(
          `Authoritative query failed for announcement "${id}": table "classroom_announcements" does not exist in database or schema cache`,
          {
            operation: 'getAnnouncementById',
            entityType: 'ClassroomAnnouncement',
            category: 'SCHEMA_MISSING',
            retryable: false,
            cause: error,
          }
        );
      }
      const classification = classifyDatabaseError(error);
      throw new DatabasePersistenceError(`Supabase error fetching announcement ${id}: ${error.message}`, {
        operation: 'getAnnouncementById',
        entityType: 'ClassroomAnnouncement',
        category: classification.category,
        retryable: classification.retryable,
        cause: error,
      });
    }
    if (!data) return null;
    return mapDbAnnouncementToDomain(data);
  }

  public async saveAnnouncement(
    announcement: ClassroomAnnouncement,
    actorEmail: string = 'instructor@zealosh.com'
  ): Promise<ClassroomAnnouncement> {
    const client = this.getClient();
    const dbPayload = mapDomainAnnouncementToDb(announcement);
    let { data, error } = await client.from('classroom_announcements').upsert(dbPayload).select('*').single();
    if (error) {
      if (isTableMissingError(error)) {
        throw new DatabasePersistenceError(
          `Authoritative persistence failed for ClassroomAnnouncement "${announcement.id}": table "classroom_announcements" does not exist in database or schema cache`,
          {
            operation: 'saveAnnouncement',
            entityType: 'ClassroomAnnouncement',
            category: 'SCHEMA_MISSING',
            retryable: false,
            cause: error,
          }
        );
      }

      if (
        error.message.includes('audience_scope') ||
        error.message.includes('status') ||
        error.message.includes('comments') ||
        error.message.includes('scheduled_publish_at') ||
        error.message.includes('schema cache')
      ) {
        delete dbPayload.audience_scope;
        delete dbPayload.status;
        delete dbPayload.comments;
        delete dbPayload.scheduled_publish_at;
        const retry = await client.from('classroom_announcements').upsert(dbPayload).select('*').single();
        if (retry.error) {
          if (isTableMissingError(retry.error)) {
            throw new DatabasePersistenceError(
              `Authoritative persistence failed for ClassroomAnnouncement "${announcement.id}": table "classroom_announcements" does not exist in database or schema cache`,
              {
                operation: 'saveAnnouncement',
                entityType: 'ClassroomAnnouncement',
                category: 'SCHEMA_MISSING',
                retryable: false,
                cause: retry.error,
              }
            );
          }
          const retryClass = classifyDatabaseError(retry.error);
          throw new DatabasePersistenceError(`Supabase error saving announcement: ${retry.error.message}`, {
            operation: 'saveAnnouncement',
            entityType: 'ClassroomAnnouncement',
            category: retryClass.category,
            retryable: retryClass.retryable,
            cause: retry.error,
          });
        }
        data = retry.data;
      } else {
        const classification = classifyDatabaseError(error);
        throw new DatabasePersistenceError(`Supabase error saving announcement: ${error.message}`, {
          operation: 'saveAnnouncement',
          entityType: 'ClassroomAnnouncement',
          category: classification.category,
          retryable: classification.retryable,
          cause: error,
        });
      }
    }

    await this.recordAudit({
      actorUserId: announcement.authorId,
      actorEmail,
      actorRole: announcement.authorRole || 'INSTRUCTOR',
      action: 'ANNOUNCEMENT_POSTED',
      entityType: 'ANNOUNCEMENT',
      entityId: announcement.id,
      details: { courseId: announcement.courseId, batchId: announcement.batchId, title: announcement.title },
    });

    return mapDbAnnouncementToDomain(data);
  }

  public async deleteAnnouncement(id: string, actorEmail: string = 'instructor@zealosh.com'): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('classroom_announcements').delete().eq('id', id);
    if (error) {
      if (isTableMissingError(error)) {
        throw new DatabasePersistenceError(
          `Authoritative delete failed for announcement "${id}": table "classroom_announcements" does not exist in database or schema cache`,
          {
            operation: 'deleteAnnouncement',
            entityType: 'ClassroomAnnouncement',
            category: 'SCHEMA_MISSING',
            retryable: false,
            cause: error,
          }
        );
      }
      const classification = classifyDatabaseError(error);
      throw new DatabasePersistenceError(`Supabase error deleting announcement ${id}: ${error.message}`, {
        operation: 'deleteAnnouncement',
        entityType: 'ClassroomAnnouncement',
        category: classification.category,
        retryable: classification.retryable,
        cause: error,
      });
    }

    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'INSTRUCTOR',
      action: 'ANNOUNCEMENT_DELETED',
      entityType: 'ANNOUNCEMENT',
      entityId: id,
      details: {},
    });

    return true;
  }

  // --------------------------------------------------------------------------
  // Phase 5A: In-App Notifications
  // --------------------------------------------------------------------------
  public async getNotifications(
    userId: string,
    filter?: { isRead?: boolean; limit?: number; offset?: number; type?: string }
  ): Promise<{ notifications: InAppNotification[]; unreadCount: number; totalCount: number }> {
    const client = this.getClient();
    let query = client
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false });

    if (filter?.isRead !== undefined) {
      query = query.eq('is_read', filter.isRead);
    }
    if (filter?.type) {
      query = query.eq('type', filter.type);
    }
    if (filter?.limit) {
      const offset = filter.offset || 0;
      query = query.range(offset, offset + filter.limit - 1);
    }

    const { data, count, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return { notifications: [], unreadCount: 0, totalCount: 0 };
      }
      throw new Error(`Supabase error fetching notifications: ${error.message}`);
    }

    // Get unread count
    const { count: unreadCount, error: unreadErr } = await client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .eq('is_read', false);

    return {
      notifications: (data || []).map(mapDbNotificationToDomain),
      unreadCount: unreadCount || 0,
      totalCount: count || 0,
    };
  }

  public async getUnreadNotificationCount(userId: string): Promise<number> {
    const client = this.getClient();
    const { count, error } = await client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .eq('is_read', false);
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return 0;
      }
      throw new Error(`Supabase error fetching unread count: ${error.message}`);
    }
    return count || 0;
  }

  public async markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
    const client = this.getClient();
    const now = new Date().toISOString();
    const { error } = await client
      .from('notifications')
      .update({ is_read: true, read_at: now, updated_at: now })
      .eq('id', notificationId)
      .eq('recipient_user_id', userId);
    if (error) throw new Error(`Supabase error marking notification read: ${error.message}`);
    return true;
  }

  public async markAllNotificationsRead(userId: string): Promise<number> {
    const client = this.getClient();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('notifications')
      .update({ is_read: true, read_at: now, updated_at: now })
      .eq('recipient_user_id', userId)
      .eq('is_read', false)
      .select('id');
    if (error) throw new Error(`Supabase error marking all notifications read: ${error.message}`);
    return data ? data.length : 0;
  }

  public async createNotification(
    notification: Omit<InAppNotification, 'id' | 'createdAt' | 'updatedAt' | 'isRead'>
  ): Promise<InAppNotification | null> {
    const client = this.getClient();
    const id = `ntf-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();
    const full: InAppNotification = {
      ...notification,
      id,
      isRead: false,
      createdAt: now,
      updatedAt: now,
    };
    const dbPayload = mapDomainNotificationToDb(full);

    let res;
    if (full.idempotencyKey) {
      res = await client
        .from('notifications')
        .upsert(dbPayload, { onConflict: 'idempotency_key', ignoreDuplicates: true })
        .select('*')
        .maybeSingle();
    } else {
      res = await client
        .from('notifications')
        .insert(dbPayload)
        .select('*')
        .single();
    }

    if (res.error) {
      if (
        res.error.code === '23505' ||
        res.error.message.includes('unique constraint') ||
        res.error.message.includes('duplicate')
      ) {
        const existing = await client
          .from('notifications')
          .select('*')
          .eq('idempotency_key', full.idempotencyKey)
          .maybeSingle();
        return existing.data ? mapDbNotificationToDomain(existing.data) : null;
      }
      if (res.error.message.includes('relation') || res.error.message.includes('does not exist')) {
        return null;
      }
      throw new Error(`Supabase error creating notification: ${res.error.message}`);
    }

    return res.data ? mapDbNotificationToDomain(res.data) : null;
  }

  public async createBatchNotifications(
    notifications: Array<Omit<InAppNotification, 'id' | 'createdAt' | 'updatedAt' | 'isRead'>>
  ): Promise<number> {
    if (!notifications || notifications.length === 0) return 0;
    const client = this.getClient();
    const now = new Date().toISOString();
    const payloads = notifications.map((n, idx) => {
      const id = `ntf-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
      const full: InAppNotification = {
        ...n,
        id,
        isRead: false,
        createdAt: now,
        updatedAt: now,
      };
      return mapDomainNotificationToDb(full);
    });

    const { data, error } = await client
      .from('notifications')
      .upsert(payloads, { onConflict: 'idempotency_key', ignoreDuplicates: true })
      .select('id');

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return 0;
      }
      throw new Error(`Supabase error batch creating notifications: ${error.message}`);
    }
    return data ? data.length : 0;
  }

  // --------------------------------------------------------------------------
  // Phase 5B: Transactional Email Outbox & Delivery Engine
  // --------------------------------------------------------------------------
  public async queueEmailOutboxJob(job: Partial<EmailOutboxJob>): Promise<EmailOutboxJob | null> {
    const client = this.getClient();
    const id = job.id || `outbox-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();
    const full: EmailOutboxJob = {
      id,
      sourceEventId: job.sourceEventId,
      eventType: job.eventType || 'SYSTEM_ALERT',
      recipientUserId: job.recipientUserId,
      recipientEmail: job.recipientEmail || '',
      recipientName: job.recipientName,
      templateId: job.templateId || 'tpl-announcement',
      templateVersion: job.templateVersion || 'v1',
      templateVariables: job.templateVariables || {},
      subject: job.subject || '',
      htmlBody: job.htmlBody || '',
      textBody: job.textBody || '',
      status: job.status || 'QUEUED',
      attemptCount: job.attemptCount || 0,
      maxAttempts: job.maxAttempts || 3,
      nextAttemptAt: job.nextAttemptAt || now,
      lastAttemptAt: job.lastAttemptAt,
      lockedAt: job.lockedAt,
      lockedBy: job.lockedBy,
      provider: job.provider || 'unconfigured',
      providerMessageId: job.providerMessageId,
      errorMessage: job.errorMessage,
      errorClassification: job.errorClassification,
      idempotencyKey: job.idempotencyKey,
      metadata: job.metadata || {},
      createdAt: job.createdAt || now,
      updatedAt: now,
    };

    const dbPayload = mapDomainEmailOutboxToDb(full);
    const res = await client
      .from('email_outbox')
      .upsert(dbPayload, { onConflict: 'idempotency_key', ignoreDuplicates: true })
      .select('*')
      .maybeSingle();

    if (res.error) {
      if (res.error.code === '23505' && full.idempotencyKey) {
        const existing = await client
          .from('email_outbox')
          .select('*')
          .eq('idempotency_key', full.idempotencyKey)
          .maybeSingle();
        return existing.data ? mapDbEmailOutboxToDomain(existing.data) : null;
      }
      if (res.error.message.includes('relation') || res.error.message.includes('does not exist')) {
        return full;
      }
      throw new Error(`Supabase error queuing email outbox job: ${res.error.message}`);
    }

    return res.data ? mapDbEmailOutboxToDomain(res.data) : full;
  }

  public async queueBatchEmailOutboxJobs(jobs: Partial<EmailOutboxJob>[]): Promise<number> {
    if (!jobs || jobs.length === 0) return 0;
    const client = this.getClient();
    const now = new Date().toISOString();
    const payloads = jobs.map((job, idx) => {
      const id = job.id || `outbox-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
      const full: EmailOutboxJob = {
        id,
        sourceEventId: job.sourceEventId,
        eventType: job.eventType || 'SYSTEM_ALERT',
        recipientUserId: job.recipientUserId,
        recipientEmail: job.recipientEmail || '',
        recipientName: job.recipientName,
        templateId: job.templateId || 'tpl-announcement',
        templateVersion: job.templateVersion || 'v1',
        templateVariables: job.templateVariables || {},
        subject: job.subject || '',
        htmlBody: job.htmlBody || '',
        textBody: job.textBody || '',
        status: job.status || 'QUEUED',
        attemptCount: job.attemptCount || 0,
        maxAttempts: job.maxAttempts || 3,
        nextAttemptAt: job.nextAttemptAt || now,
        lastAttemptAt: job.lastAttemptAt,
        lockedAt: job.lockedAt,
        lockedBy: job.lockedBy,
        provider: job.provider || 'unconfigured',
        providerMessageId: job.providerMessageId,
        errorMessage: job.errorMessage,
        errorClassification: job.errorClassification,
        idempotencyKey: job.idempotencyKey,
        metadata: job.metadata || {},
        createdAt: job.createdAt || now,
        updatedAt: now,
      };
      return mapDomainEmailOutboxToDb(full);
    });

    const { data, error } = await client
      .from('email_outbox')
      .upsert(payloads, { onConflict: 'idempotency_key', ignoreDuplicates: true })
      .select('id');

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return jobs.length;
      }
      throw new Error(`Supabase error batch queuing email jobs: ${error.message}`);
    }
    return data ? data.length : 0;
  }

  public async getEmailOutboxJobs(filter?: {
    status?: EmailOutboxStatus;
    recipientUserId?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{ jobs: EmailOutboxJob[]; totalCount: number }> {
    const client = this.getClient();
    let query = client
      .from('email_outbox')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.recipientUserId) {
      query = query.eq('recipient_user_id', filter.recipientUserId);
    }
    if (filter?.search) {
      query = query.or(`recipient_email.ilike.%${filter.search}%,subject.ilike.%${filter.search}%`);
    }
    if (filter?.limit) {
      const offset = filter.offset || 0;
      query = query.range(offset, offset + filter.limit - 1);
    }

    const { data, count, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return { jobs: [], totalCount: 0 };
      }
      throw new Error(`Supabase error fetching email outbox jobs: ${error.message}`);
    }

    return {
      jobs: (data || []).map(mapDbEmailOutboxToDomain),
      totalCount: count || 0,
    };
  }

  public async getEmailOutboxJobById(id: string): Promise<EmailOutboxJob | null> {
    const client = this.getClient();
    const { data, error } = await client.from('email_outbox').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return mapDbEmailOutboxToDomain(data);
  }

  public async claimEmailOutboxJobs(
    workerId: string,
    limit: number = 10,
    leaseTimeoutMs: number = 300000
  ): Promise<EmailOutboxJob[]> {
    const client = this.getClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const leaseCutoff = new Date(now.getTime() - leaseTimeoutMs).toISOString();

    // Query candidate jobs: QUEUED or RETRY_PENDING where next_attempt_at <= now, and not currently locked
    const { data: candidates, error } = await client
      .from('email_outbox')
      .select('*')
      .in('status', ['QUEUED', 'RETRY_PENDING'])
      .lte('next_attempt_at', nowIso)
      .or(`locked_at.is.null,locked_at.lt.${leaseCutoff}`)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error claiming email jobs: ${error.message}`);
    }

    if (!candidates || candidates.length === 0) return [];

    const claimed: EmailOutboxJob[] = [];
    for (const c of candidates) {
      const { data: updated, error: lockErr } = await client
        .from('email_outbox')
        .update({
          status: 'PROCESSING',
          locked_at: nowIso,
          locked_by: workerId,
          updated_at: nowIso,
        })
        .eq('id', c.id)
        .in('status', ['QUEUED', 'RETRY_PENDING'])
        .select('*')
        .maybeSingle();

      if (!lockErr && updated) {
        claimed.push(mapDbEmailOutboxToDomain(updated));
      }
    }

    return claimed;
  }

  public async updateEmailOutboxJob(id: string, updates: Partial<EmailOutboxJob>): Promise<boolean> {
    const client = this.getClient();
    const dbPayload = mapDomainEmailOutboxToDb(updates);
    delete dbPayload.id; // Protect primary key
    dbPayload.updated_at = new Date().toISOString();

    const { error } = await client.from('email_outbox').update(dbPayload).eq('id', id);
    if (error) throw new Error(`Supabase error updating email outbox job: ${error.message}`);
    return true;
  }

  public async getEmailOutboxStats(): Promise<{
    queued: number;
    processing: number;
    sent: number;
    delivered: number;
    failed: number;
    retryPending: number;
    bounced: number;
    suppressed: number;
    cancelled: number;
    total: number;
  }> {
    const client = this.getClient();
    const { data, error } = await client.from('email_outbox').select('status');
    if (error) {
      return { queued: 0, processing: 0, sent: 0, delivered: 0, failed: 0, retryPending: 0, bounced: 0, suppressed: 0, cancelled: 0, total: 0 };
    }

    const counts = {
      queued: 0,
      processing: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      retryPending: 0,
      bounced: 0,
      suppressed: 0,
      cancelled: 0,
      total: (data || []).length,
    };

    (data || []).forEach((row: any) => {
      if (row.status === 'QUEUED') counts.queued++;
      else if (row.status === 'PROCESSING') counts.processing++;
      else if (row.status === 'SENT') counts.sent++;
      else if (row.status === 'DELIVERED') counts.delivered++;
      else if (row.status === 'FAILED') counts.failed++;
      else if (row.status === 'RETRY_PENDING') counts.retryPending++;
      else if (row.status === 'BOUNCED') counts.bounced++;
      else if (row.status === 'SUPPRESSED') counts.suppressed++;
      else if (row.status === 'CANCELLED') counts.cancelled++;
    });

    return counts;
  }

  public async recordEmailDeliveryEvent(event: Partial<EmailDeliveryEvent>): Promise<EmailDeliveryEvent | null> {
    const client = this.getClient();
    const id = event.id || `evt-dlv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const full: EmailDeliveryEvent = {
      id,
      outboxId: event.outboxId,
      provider: event.provider || 'mock',
      providerMessageId: event.providerMessageId,
      eventType: event.eventType || 'accepted',
      recipientEmail: event.recipientEmail || '',
      rawPayload: event.rawPayload || {},
      occurredAt: event.occurredAt || new Date().toISOString(),
      createdAt: event.createdAt || new Date().toISOString(),
    };

    const dbPayload = {
      id: full.id,
      outbox_id: full.outboxId || null,
      provider: full.provider,
      provider_message_id: full.providerMessageId || null,
      event_type: full.eventType,
      recipient_email: full.recipientEmail,
      raw_payload: full.rawPayload,
      occurred_at: full.occurredAt,
      created_at: full.createdAt,
    };

    const { data, error } = await client.from('email_delivery_events').insert(dbPayload).select('*').maybeSingle();
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return full;
      throw new Error(`Supabase error recording email delivery event: ${error.message}`);
    }
    return data ? mapDbEmailDeliveryEventToDomain(data) : full;
  }

  public async getEmailDeliveryEvents(outboxId?: string, limit: number = 50): Promise<EmailDeliveryEvent[]> {
    const client = this.getClient();
    let query = client.from('email_delivery_events').select('*').order('occurred_at', { ascending: false }).limit(limit);
    if (outboxId) query = query.eq('outbox_id', outboxId);

    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return [];
      throw new Error(`Supabase error fetching email delivery events: ${error.message}`);
    }
    return (data || []).map(mapDbEmailDeliveryEventToDomain);
  }

  public async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreference[]> {
    const client = this.getClient();
    const { data, error } = await client.from('user_notification_preferences').select('*').eq('user_id', userId);
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return [];
      throw new Error(`Supabase error fetching user preferences: ${error.message}`);
    }
    return (data || []).map(mapDbUserPreferenceToDomain);
  }

  public async updateUserNotificationPreference(
    userId: string,
    category: string,
    channel: 'EMAIL' | 'IN_APP',
    isEnabled: boolean
  ): Promise<UserNotificationPreference> {
    const client = this.getClient();
    const now = new Date().toISOString();
    const id = `pref-${userId}-${channel}-${category}`;
    const payload = {
      id,
      user_id: userId,
      channel,
      category,
      is_enabled: isEnabled,
      updated_at: now,
    };

    const { data, error } = await client
      .from('user_notification_preferences')
      .upsert(payload, { onConflict: 'user_id,channel,category' })
      .select('*')
      .single();

    if (error) throw new Error(`Supabase error updating user notification preference: ${error.message}`);
    return mapDbUserPreferenceToDomain(data);
  }

  public async isEmailNotificationEnabled(userId: string, category: string): Promise<boolean> {
    // SECURITY critical notices cannot be disabled
    if (category === 'SECURITY') return true;

    const client = this.getClient();
    const { data, error } = await client
      .from('user_notification_preferences')
      .select('is_enabled')
      .eq('user_id', userId)
      .eq('channel', 'EMAIL')
      .eq('category', category)
      .maybeSingle();

    if (error || !data) return true; // Default enabled
    return Boolean(data.is_enabled);
  }

  // --------------------------------------------------------------------------
  // Examination Simulation & Scoring Engine
  // --------------------------------------------------------------------------
  public async getExamBlueprints(): Promise<ExamBlueprint[]> {
    const client = this.getClient();
    const { data, error } = await client.from('exam_blueprints').select('*');
    if (error) throw new Error(`Supabase error fetching blueprints: ${error.message}`);
    return (data || []).map(mapDbExamBlueprintToDomain);
  }

  public async getExamBlueprint(id: string): Promise<ExamBlueprint | null> {
    const client = this.getClient();
    const { data, error } = await client.from('exam_blueprints').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapDbExamBlueprintToDomain(data);
  }

  public async saveExamBlueprint(blueprint: ExamBlueprint): Promise<ExamBlueprint> {
    const client = this.getClient();
    const { data, error } = await client
      .from('exam_blueprints')
      .upsert({
        id: blueprint.id,
        certification_type: blueprint.certificationType,
        title: blueprint.title,
        total_questions: blueprint.totalQuestions,
        duration_minutes: blueprint.durationMinutes,
        passing_score_percent: blueprint.passingScorePercent,
        domains: blueprint.domains || [],
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) throw new Error(`Supabase error saving exam blueprint: ${error.message}`);
    return mapDbExamBlueprintToDomain(data);
  }

  public async saveExamQuestion(question: ExamQuestion): Promise<ExamQuestion> {
    const client = this.getClient();
    const { data, error } = await client
      .from('exam_questions')
      .upsert({
        id: question.id,
        certification_type: question.certificationType,
        domain: question.domain,
        topic: question.topic,
        stem: question.stem,
        type: question.type,
        difficulty: question.difficulty,
        options: question.options || [],
        correct_option_ids: question.correctOptionIds || [],
        explanation: question.explanation || '',
        reference_source: question.referenceSource || '',
      })
      .select('*')
      .single();
    if (error) throw new Error(`Supabase error saving exam question: ${error.message}`);
    return mapDbExamQuestionToDomain(data);
  }

  public async getExamQuestions(blueprintIdOrCertType?: string): Promise<ExamQuestion[]> {
    const client = this.getClient();
    let query = client.from('exam_questions').select('*');
    if (blueprintIdOrCertType) {
      query = query.eq('certification_type', blueprintIdOrCertType);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Supabase error fetching exam questions: ${error.message}`);
    return (data || []).map(mapDbExamQuestionToDomain);
  }

  public async getQuestionsForClient(questionIds: string[]): Promise<Partial<ExamQuestion>[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('learner_exam_questions')
      .select('*')
      .in('id', questionIds);

    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        certificationType: row.certification_type,
        domain: row.domain,
        topic: row.topic,
        stem: row.stem,
        type: row.type,
        difficulty: row.difficulty,
        options: row.options,
      }));
    }

    // Direct fallback with explicit column projection
    const { data: rawData, error: rawErr } = await client
      .from('exam_questions')
      .select('id, certification_type, domain, topic, stem, type, difficulty, options')
      .in('id', questionIds);

    if (rawErr) throw new Error(`Supabase error fetching candidate questions: ${rawErr.message}`);
    return (rawData || []).map((row: any) => ({
      id: row.id,
      certificationType: row.certification_type,
      domain: row.domain,
      topic: row.topic,
      stem: row.stem,
      type: row.type,
      difficulty: row.difficulty,
      options: row.options,
    }));
  }

  public async startExamAttempt(userId: string, blueprintId: string): Promise<ExamAttempt> {
    const client = this.getClient();
    const blueprint = await this.getExamBlueprint(blueprintId);
    if (!blueprint) throw new Error('EXAM_BLUEPRINT_NOT_FOUND');

    // Retrieve candidate questions for blueprint
    let assignedQuestions: ExamQuestion[] = [];
    if (blueprintId === 'bp-asp-bcsp-v10') {
      const allQ = await this.getExamQuestions('ASP');
      const targetIds = ['q-asp-01', 'q-asp-02', 'q-asp-03', 'q-asp-04', 'q-asp-05'];
      assignedQuestions = allQ.filter((q) => targetIds.includes(q.id));
    } else {
      const questions = await this.getExamQuestions(blueprint.certificationType);
      assignedQuestions = questions.slice(0, blueprint.totalQuestions);
    }
    const assignedIds = assignedQuestions.map((q) => q.id);

    const questionSnapshots: FrozenExamQuestionSnapshot[] = assignedQuestions.map((q) => ({
      id: q.id,
      domain: q.domain,
      topic: q.topic,
      stem: q.stem,
      type: q.type,
      options: q.options ? JSON.parse(JSON.stringify(q.options)) : [],
      points: q.points ?? 1,
      rubricCriteria: q.rubricCriteria ? JSON.parse(JSON.stringify(q.rubricCriteria)) : undefined,
      correctOptionIds: [...(q.correctOptionIds || [])],
      explanation: q.explanation,
    }));

    const now = new Date();
    const gracePeriodSeconds = blueprint.gracePeriodSeconds ?? 60;
    const deadline = new Date(now.getTime() + (blueprint.durationMinutes * 60 + gracePeriodSeconds) * 1000);
    const attemptId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newAttempt: ExamAttempt = {
      id: attemptId,
      userId,
      blueprintId: blueprint.id,
      certificationType: blueprint.certificationType,
      status: 'IN_PROGRESS',
      startTime: now.toISOString(),
      deadlineTime: deadline.toISOString(),
      gracePeriodSeconds,
      assignedQuestionIds: assignedIds,
      questionSnapshots,
      answers: {},
      bookmarkedQuestionIds: [],
      passingScorePercent: blueprint.passingScorePercent,
    };

    const basePayload: any = {
      id: newAttempt.id,
      user_id: newAttempt.userId,
      blueprint_id: newAttempt.blueprintId,
      certification_type: newAttempt.certificationType,
      status: newAttempt.status,
      start_time: newAttempt.startTime,
      deadline_time: newAttempt.deadlineTime,
      assigned_question_ids: newAttempt.assignedQuestionIds,
      answers: newAttempt.answers,
      bookmarked_question_ids: newAttempt.bookmarkedQuestionIds,
      passing_score_percent: newAttempt.passingScorePercent,
    };

    // Attempt insert with Phase 3 extended snapshot and timer columns; fallback to baseline columns if remote schema cache lacks them
    let { error } = await client.from('exam_attempts').insert({
      ...basePayload,
      grace_period_seconds: gracePeriodSeconds,
      question_snapshots: questionSnapshots,
    });

    if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
      const retry = await client.from('exam_attempts').insert(basePayload);
      error = retry.error;
    }

    if (error) throw new Error(`Supabase error starting exam attempt: ${error.message}`);
    return newAttempt;
  }

  public async getExamAttempt(attemptId: string): Promise<ExamAttempt | null> {
    const client = this.getClient();
    const { data, error } = await client.from('exam_attempts').select('*').eq('id', attemptId).single();
    if (error || !data) return null;
    return mapDbExamAttemptToDomain(data);
  }

  public async getUserExamAttempts(userId: string): Promise<ExamAttempt[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('exam_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (error) throw new Error(`Supabase error fetching user attempts: ${error.message}`);
    return (data || []).map(mapDbExamAttemptToDomain);
  }

  public async saveExamAnswers(
    attemptId: string,
    userId: string,
    answers: Record<string, string[]>,
    bookmarks?: string[]
  ): Promise<ExamAttempt> {
    const client = this.getClient();
    const attempt = await this.getExamAttempt(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.userId !== userId) throw new Error('Unauthorized attempt access');
    if (attempt.status !== 'IN_PROGRESS') throw new Error('Attempt is already finalized');

    if (new Date() > new Date(attempt.deadlineTime)) {
      await client.from('exam_attempts').update({ status: 'EXPIRED' }).eq('id', attemptId);
      throw new Error('EXAM_DEADLINE_EXPIRED');
    }

    const mergedAnswers = { ...attempt.answers, ...answers };
    const mergedBookmarks = bookmarks !== undefined ? bookmarks : attempt.bookmarkedQuestionIds;

    const { data, error } = await client
      .from('exam_attempts')
      .update({
        answers: mergedAnswers,
        bookmarked_question_ids: mergedBookmarks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attemptId)
      .select('*')
      .single();

    if (error || !data) throw new Error(`Supabase error saving answers: ${error?.message}`);
    return mapDbExamAttemptToDomain(data);
  }

  public async saveInFlightAnswers(
    attemptId: string,
    userId: string,
    questionId: string,
    selectedOptionIds: string[],
    bookmarked?: boolean
  ): Promise<ExamAttempt> {
    const bookmarksUpdate = bookmarked !== undefined ? (bookmarked ? [questionId] : []) : undefined;
    return this.saveExamAnswers(attemptId, userId, { [questionId]: selectedOptionIds }, bookmarksUpdate);
  }

  public async submitExamAttempt(attemptId: string, userId: string): Promise<ExamAttempt> {
    const client = this.getClient();
    const attempt = await this.getExamAttempt(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.userId !== userId) throw new Error('Unauthorized attempt submission');

    // Idempotent submission: if already completed, return existing graded state
    if (attempt.status === 'COMPLETED') {
      return attempt;
    }

    // Authoritative Server-Side Scoring against immutable snapshots
    const questionsToScore: (ExamQuestion | FrozenExamQuestionSnapshot)[] =
      (attempt.questionSnapshots && attempt.questionSnapshots.length > 0)
        ? attempt.questionSnapshots
        : await this.getExamQuestions(attempt.certificationType);
    const questionsMap = new Map(questionsToScore.map((q) => [q.id, q]));

    let correctCount = 0;
    const domainBreakdown: Record<string, { total: number; correct: number; percent: number }> = {};
    let requiresManualEvaluation = false;

    attempt.assignedQuestionIds.forEach((qId) => {
      const q = questionsMap.get(qId);
      if (!q) return;

      if (q.type === 'SCENARIO_BASED' || (q.rubricCriteria && q.rubricCriteria.length > 0)) {
        requiresManualEvaluation = true;
      }

      if (!domainBreakdown[q.domain]) {
        domainBreakdown[q.domain] = { total: 0, correct: 0, percent: 0 };
      }
      domainBreakdown[q.domain].total += 1;

      const userSelected = (attempt.answers[qId] || []).slice().sort();
      const expectedCorrect = (q.correctOptionIds || []).slice().sort();

      const isCorrect =
        userSelected.length === expectedCorrect.length &&
        userSelected.every((val, idx) => val === expectedCorrect[idx]);

      if (isCorrect) {
        correctCount += 1;
        domainBreakdown[q.domain].correct += 1;
      }
    });

    Object.keys(domainBreakdown).forEach((d) => {
      const stats = domainBreakdown[d];
      stats.percent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    });

    const totalQuestions = attempt.assignedQuestionIds.length || 1;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    const passed = scorePercent >= attempt.passingScorePercent;
    const now = new Date().toISOString();
    const finalStatus = requiresManualEvaluation ? 'PENDING_MANUAL_EVALUATION' : 'COMPLETED';

    const { data, error } = await client
      .from('exam_attempts')
      .update({
        status: finalStatus,
        completed_time: now,
        total_score: scorePercent,
        passed,
        domain_breakdown: domainBreakdown,
        updated_at: now,
      })
      .eq('id', attemptId)
      .select('*')
      .single();

    if (error || !data) throw new Error(`Supabase error submitting attempt: ${error?.message}`);

    if (passed) {
      try {
        const courses = await this.getCourses();
        const relatedCourse = courses.find((c) => c.certificationType === attempt.certificationType);
        if (relatedCourse) {
          const existingCerts = await this.getCertificates(userId);
          const alreadyIssued = existingCerts.some((c) => c.courseId === relatedCourse.id && c.status === 'ISSUED');
          if (!alreadyIssued) {
            await this.issueCertificate(userId, relatedCourse.id, scorePercent);
          }
        }
      } catch (issueErr) {
        console.warn('Certificate auto-issuance notice:', issueErr);
      }
    }

    await this.recordAudit({
      actorUserId: userId,
      actorEmail: 'student@zealosh.com',
      actorRole: 'STUDENT',
      action: 'EXAM_ATTEMPT_SUBMITTED',
      entityType: 'EXAM_ATTEMPT',
      entityId: attemptId,
      details: { scorePercent, passed, blueprintId: attempt.blueprintId },
    });

    return mapDbExamAttemptToDomain(data);
  }

  // --------------------------------------------------------------------------
  // Certificates & Public Verification
  // --------------------------------------------------------------------------
  public async getCertificates(userId?: string): Promise<CertificateRecord[]> {
    const client = this.getClient();
    let query = client.from('certificates').select('*').order('issue_date', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase error fetching certificates: ${error.message}`);
    return (data || []).map(mapDbCertificateToDomain);
  }

  public async verifyCertificate(certificateCode: string): Promise<CertificateRecord | null> {
    const client = this.getClient();
    const code = certificateCode.trim().toUpperCase();
    const { data, error } = await client
      .from('certificates')
      .select('*')
      .or(`verification_code.eq.${code},certificate_number.eq.${code}`)
      .single();

    if (error || !data) return null;
    const cert = mapDbCertificateToDomain(data);
    if (data.user_id) {
      const user = await this.getUser(data.user_id);
      if (user) {
        cert.userName = user.name;
        cert.userEmail = user.email;
      }
    }
    if (data.course_id) {
      const course = await this.getCourse(data.course_id);
      if (course) {
        cert.courseTitle = course.title;
        cert.certificationType = course.certificationType;
      }
    }
    return cert;
  }

  public async getCertificateByCode(certificateCode: string): Promise<CertificateRecord | null> {
    return this.verifyCertificate(certificateCode);
  }

  public async issueCertificate(userId: string, courseId: string, scorePercent: number): Promise<CertificateRecord> {
    const client = this.getClient();
    const user = await this.getUser(userId);
    const course = await this.getCourse(courseId);
    if (!user || !course) throw new Error('User or course not found for certificate issuance');

    const code = `ZEALOSH-${course.certificationType}-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const expiry = new Date(now.getFullYear() + 3, now.getMonth(), now.getDate());

    const cert: CertificateRecord = {
      id: `cert-${Date.now()}`,
      certificateCode: code,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      courseId: course.id,
      courseTitle: course.title,
      certificationType: course.certificationType,
      issueDate: now.toISOString(),
      expiryDate: expiry.toISOString(),
      scorePercent,
      status: 'ISSUED',
      qrVerificationUrl: `/verify/${code}`,
      issuedBy: 'Zealosh Academic Accreditation Board',
    };

    const { data, error } = await client.from('certificates').insert({
      id: cert.id,
      certificate_number: cert.certificateCode,
      verification_code: cert.certificateCode,
      user_id: cert.userId,
      course_id: cert.courseId,
      issue_date: cert.issueDate,
      score_percent: cert.scorePercent,
      status: cert.status,
    }).select('*').single();

    if (error) throw new Error(`Supabase error issuing certificate: ${error.message}`);
    const domainCert = mapDbCertificateToDomain(data);
    domainCert.userName = user.name;
    domainCert.userEmail = user.email;
    domainCert.courseTitle = course.title;
    domainCert.certificationType = course.certificationType;
    return domainCert;
  }

  public async revokeCertificate(certificateCode: string, reason: string = 'Administrative review', actorEmail: string = 'admin@zealosh.com'): Promise<CertificateRecord> {
    const client = this.getClient();
    const code = certificateCode.trim().toUpperCase();
    const { data, error } = await client
      .from('certificates')
      .update({ status: 'REVOKED' })
      .or(`verification_code.eq.${code},certificate_number.eq.${code}`)
      .select('*')
      .single();

    if (error || !data) throw new Error(`Supabase error revoking certificate: ${error?.message}`);

    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'CERTIFICATE_REVOKED',
      entityType: 'CERTIFICATE',
      entityId: certificateCode,
      details: { certificateCode, reason },
    });

    const domainCert = mapDbCertificateToDomain(data);
    if (data.user_id) {
      const user = await this.getUser(data.user_id);
      if (user) {
        domainCert.userName = user.name;
        domainCert.userEmail = user.email;
      }
    }
    if (data.course_id) {
      const course = await this.getCourse(data.course_id);
      if (course) {
        domainCert.courseTitle = course.title;
        domainCert.certificationType = course.certificationType;
      }
    }
    return domainCert;
  }

  // --------------------------------------------------------------------------
  // Audit Logs & Config Governance
  // --------------------------------------------------------------------------
  public async recordAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    const client = this.getClient();
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const auditRow = {
      id,
      actor_user_id: entry.actorUserId,
      actor_email: entry.actorEmail,
      actor_role: entry.actorRole,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      details: entry.details || {},
      ip_address: entry.ipAddress || null,
      created_at: now,
    };

    const { error } = await client.from('audit_logs').insert(auditRow);
    if (error) {
      console.warn('Non-blocking audit log persistence warning:', error.message);
    }

    return {
      id,
      timestamp: now,
      actorUserId: entry.actorUserId,
      actorEmail: entry.actorEmail,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details,
      ipAddress: entry.ipAddress,
    };
  }

  public async getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Supabase error fetching audit logs: ${error.message}`);
    return (data || []).map((row: any) => ({
      id: row.id,
      timestamp: row.created_at,
      actorUserId: row.actor_user_id,
      actorEmail: row.actor_email,
      actorRole: row.actor_role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: row.details || {},
      ipAddress: row.ip_address || undefined,
    }));
  }

  public async recordConfigAudit(params: {
    actorUserId?: string;
    actorEmail: string;
    section: 'GENERAL_SETTINGS' | 'BRANDING' | 'NAVIGATION' | 'FEATURE_FLAGS' | 'ROLES' | 'INTEGRATIONS' | 'WORKFLOWS';
    previousValue: unknown;
    newValue: unknown;
    changeReason?: string;
    isRollback?: boolean;
  }): Promise<ConfigAuditEntry> {
    const client = this.getClient();
    const id = `cfg-aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const { count } = await client.from('config_audits').select('*', { count: 'exact', head: true });
    const version = (count || 0) + 1;

    const { error } = await client.from('config_audits').insert({
      id,
      timestamp: now,
      actor_user_id: params.actorUserId || 'usr-admin-01',
      actor_email: params.actorEmail,
      section: params.section,
      previous_value: params.previousValue,
      new_value: params.newValue,
      change_reason: params.changeReason || `Updated ${params.section}`,
      version,
      is_rollback: Boolean(params.isRollback),
      created_at: now,
    });

    if (error) {
      console.warn('Non-blocking config audit warning:', error.message);
    }

    return {
      id,
      timestamp: now,
      actorUserId: params.actorUserId || 'usr-admin-01',
      actorEmail: params.actorEmail,
      section: params.section,
      previousValue: params.previousValue,
      newValue: params.newValue,
      changeReason: params.changeReason,
      version,
      isRollback: Boolean(params.isRollback),
    };
  }

  public async getConfigAudits(): Promise<ConfigAuditEntry[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('config_audits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Supabase error fetching config audits: ${error.message}`);
    return (data || []).map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp || row.created_at,
      actorUserId: row.actor_user_id,
      actorEmail: row.actor_email,
      section: row.section as any,
      previousValue: row.previous_value,
      newValue: row.new_value,
      changeReason: row.change_reason || undefined,
      version: row.version,
      isRollback: Boolean(row.is_rollback),
    }));
  }

  public async rollbackConfig(auditId: string, actorEmail: string = 'admin@zealosh.com'): Promise<boolean> {
    const client = this.getClient();
    const { data: audit, error } = await client.from('config_audits').select('*').eq('id', auditId).single();
    if (error || !audit || !audit.previous_value) {
      return false;
    }

    const prevValue = audit.previous_value;
    if (audit.section === 'GENERAL_SETTINGS') {
      await this.updatePlatformSettings(prevValue as any, actorEmail);
    } else if (audit.section === 'BRANDING') {
      await this.updateBrandingTheme(prevValue as any, actorEmail);
    } else if (audit.section === 'FEATURE_FLAGS') {
      await this.updateFeatureFlags(prevValue as any, actorEmail);
    } else if (audit.section === 'NAVIGATION') {
      await this.updateNavigationConfig(prevValue as any, actorEmail);
    }

    await this.recordConfigAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      section: audit.section,
      previousValue: audit.new_value,
      newValue: audit.previous_value,
      changeReason: `Rollback to version ${audit.version}`,
      isRollback: true,
    });

    return true;
  }

  // --------------------------------------------------------------------------
  // OAuth Codes Isolation (Privileged Operations Only)
  // --------------------------------------------------------------------------
  public async createOAuthCode(params: {
    userId: string;
    clientId: string;
    redirectUri: string;
    scope?: string;
    state?: string;
    nonce?: string;
    codeChallenge?: string;
    codeChallengeMethod?: 'S256' | 'plain';
    expiresInMs?: number;
  }): Promise<OAuthCode> {
    const client = this.getClient();
    const randomHex = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    const code = `zc_${Date.now().toString(36)}_${randomHex}`;
    const expiresIn = params.expiresInMs !== undefined ? params.expiresInMs : 5 * 60 * 1000;
    const expiresAtMs = Date.now() + expiresIn;

    const newCode: OAuthCode = {
      code,
      userId: params.userId,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      scope: params.scope,
      state: params.state,
      nonce: params.nonce,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
      expiresAt: expiresAtMs,
      used: false,
      createdAt: new Date().toISOString(),
    };

    const { error } = await client.from('oauth_codes').insert({
      code: newCode.code,
      user_id: newCode.userId,
      client_id: newCode.clientId,
      redirect_uri: newCode.redirectUri,
      scope: newCode.scope || null,
      state: newCode.state || null,
      nonce: newCode.nonce || null,
      code_challenge: newCode.codeChallenge || null,
      code_challenge_method: newCode.codeChallengeMethod || null,
      expires_at: expiresAtMs,
      used: false,
    });

    if (error) throw new Error(`Supabase error creating OAuth code: ${error.message}`);
    return newCode;
  }

  public async getOAuthCode(code: string): Promise<OAuthCode | null> {
    const client = this.getClient();
    const { data, error } = await client.from('oauth_codes').select('*').eq('code', code).single();
    if (error || !data) return null;
    const exp = data.expires_at;
    const expiresAtMs = typeof exp === 'number' ? exp : (!isNaN(Number(exp)) ? Number(exp) : new Date(exp).getTime());
    return {
      code: data.code,
      userId: data.user_id,
      clientId: data.client_id,
      redirectUri: data.redirect_uri,
      scope: data.scope || undefined,
      state: data.state || undefined,
      nonce: data.nonce || undefined,
      codeChallenge: data.code_challenge || undefined,
      codeChallengeMethod: data.code_challenge_method || undefined,
      expiresAt: expiresAtMs,
      used: Boolean(data.used),
      createdAt: data.created_at,
    };
  }

  public async markOAuthCodeUsed(code: string, clientId?: string, redirectUri?: string): Promise<boolean> {
    const client = this.getClient();

    // Prefer atomic PostgreSQL function if client_id and redirect_uri supplied
    if (clientId && redirectUri) {
      try {
        const { data, error } = await client.rpc('redeem_oauth_code', {
          p_code: code,
          p_client_id: clientId,
          p_redirect_uri: redirectUri,
        });
        if (!error && data) {
          return true;
        }
      } catch {
        // Fallback to update below
      }
    }

    const { data, error } = await client
      .from('oauth_codes')
      .update({ used: true })
      .eq('code', code)
      .eq('used', false)
      .select('code')
      .maybeSingle();

    return Boolean(!error && data);
  }

  // --------------------------------------------------------------------------
  // Workflow Engine & Notification Templates Persistence
  // --------------------------------------------------------------------------
  public async getWorkflows(): Promise<WorkflowDefinition[]> {
    const client = this.getClient();
    const { data, error } = await client.from('workflows').select('*').order('created_at', { ascending: true });
    if (error) {
      return [];
    }
    return (data || []).map(mapDbWorkflowToDomain);
  }

  public async getWorkflow(id: string): Promise<WorkflowDefinition | null> {
    const client = this.getClient();
    const { data, error } = await client.from('workflows').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapDbWorkflowToDomain(data);
  }

  public async saveWorkflow(workflow: WorkflowDefinition, actorEmail: string = 'admin@zealosh.com'): Promise<WorkflowDefinition> {
    const client = this.getClient();
    const dbPayload = mapDomainWorkflowToDb(workflow);
    const { error } = await client.from('workflows').upsert(dbPayload);
    if (error) {
      console.warn('Supabase saveWorkflow warning:', error.message);
    }
    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'WORKFLOW_SAVED',
      entityType: 'WORKFLOW',
      entityId: workflow.id,
      details: { title: workflow.title, trigger: workflow.trigger },
    });
    return workflow;
  }

  public async deleteWorkflow(workflowId: string, actorEmail: string = 'admin@zealosh.com'): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('workflows').delete().eq('id', workflowId);
    if (error) {
      console.warn('Supabase deleteWorkflow warning:', error.message);
    }
    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'WORKFLOW_DELETED',
      entityType: 'WORKFLOW',
      entityId: workflowId,
      details: { id: workflowId },
    });
    return true;
  }

  public async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    const client = this.getClient();
    const { data, error } = await client.from('notification_templates').select('*');
    if (error) {
      return [];
    }
    return (data || []).map(mapDbNotificationTemplateToDomain);
  }

  public async getNotificationTemplate(id: string): Promise<NotificationTemplate | null> {
    const client = this.getClient();
    const { data, error } = await client.from('notification_templates').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapDbNotificationTemplateToDomain(data);
  }

  public async saveNotificationTemplate(template: NotificationTemplate, actorEmail: string = 'admin@zealosh.com'): Promise<NotificationTemplate> {
    const client = this.getClient();
    const dbPayload = mapDomainNotificationTemplateToDb(template);
    const { error } = await client.from('notification_templates').upsert(dbPayload);
    if (error) {
      console.warn('Supabase saveNotificationTemplate warning:', error.message);
    }
    await this.recordAudit({
      actorUserId: 'usr-admin-01',
      actorEmail,
      actorRole: 'SUPER_ADMIN',
      action: 'NOTIFICATION_TEMPLATE_SAVED',
      entityType: 'TEMPLATE',
      entityId: template.id,
      details: { channel: template.channel, trigger: template.trigger },
    });
    return template;
  }

  // --------------------------------------------------------------------------
  // Enterprise Commerce, Invoicing & Financial Auditing
  // --------------------------------------------------------------------------
  public async createPaymentOrder(order: PaymentOrder): Promise<PaymentOrder> {
    const client = this.getClient();
    const dbPayload = mapDomainPaymentOrderToDb(order);
    const { data, error } = await client
      .from('payment_orders')
      .insert(dbPayload)
      .select('*, users(name, email)')
      .single();

    if (error) {
      throw new Error(`Supabase error creating payment order: ${error.message}`);
    }

    return mapDbPaymentOrderToDomain(data);
  }

  public async getPaymentOrder(orderId: string): Promise<PaymentOrder | undefined> {
    const client = this.getClient();
    const { data, error } = await client
      .from('payment_orders')
      .select('*, users(name, email)')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      return undefined;
    }

    return mapDbPaymentOrderToDomain(data);
  }

  public async listPaymentOrders(userId?: string): Promise<PaymentOrder[]> {
    const client = this.getClient();
    let query = client
      .from('payment_orders')
      .select('*, users(name, email)')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase error listing payment orders: ${error.message}`);
    }

    return (data || []).map(mapDbPaymentOrderToDomain);
  }

  public async completePaymentOrder(params: {
    orderId: string;
    gatewayPaymentId: string;
    actorEmail?: string;
    billingAddress?: BillingAddress;
    hsnCode?: string;
    providerGstin?: string;
  }): Promise<{ order: PaymentOrder; invoice: InvoiceRecord; enrollment: Enrollment }> {
    const client = this.getClient();

    const { data: rpcData, error: rpcError } = await client.rpc('complete_payment_order_atomic', {
      p_order_id: params.orderId,
      p_gateway_payment_id: params.gatewayPaymentId,
      p_actor_email: params.actorEmail || 'system@zealosh.com',
      p_billing_address: params.billingAddress || {},
      p_hsn_code: params.hsnCode || '999293',
      p_provider_gstin: params.providerGstin || process.env.PROVIDER_GSTIN || '32AABCZ1234F1Z5',
    });

    if (rpcError) {
      if (rpcError.message.includes('ORDER_NOT_FOUND')) {
        throw new Error(`Payment order ${params.orderId} not found`);
      }
      if (rpcError.message.includes('INVALID_STATE')) {
        throw new Error(rpcError.message);
      }
      if (rpcError.message.includes('DUPLICATE_PAYMENT_ID')) {
        throw new Error(rpcError.message);
      }
      throw new Error(`Supabase payment completion error: ${rpcError.message}`);
    }

    const invoiceId = rpcData.invoiceId;
    const enrollmentId = rpcData.enrollmentId;

    const [orderRes, invoiceRes, enrollmentRes] = await Promise.all([
      client.from('payment_orders').select('*, users(name, email)').eq('id', params.orderId).single(),
      client.from('invoices').select('*').eq('id', invoiceId).single(),
      client.from('enrollments').select('*').eq('id', enrollmentId).single(),
    ]);

    if (orderRes.error || !orderRes.data) {
      throw new Error(`Failed to load completed payment order: ${orderRes.error?.message}`);
    }
    if (invoiceRes.error || !invoiceRes.data) {
      throw new Error(`Failed to load issued tax invoice: ${invoiceRes.error?.message}`);
    }
    if (enrollmentRes.error || !enrollmentRes.data) {
      throw new Error(`Failed to load completed enrollment: ${enrollmentRes.error?.message}`);
    }

    return {
      order: mapDbPaymentOrderToDomain(orderRes.data),
      invoice: mapDbInvoiceToDomain(invoiceRes.data),
      enrollment: mapDbEnrollmentToDomain(enrollmentRes.data),
    };
  }

  public async getInvoice(invoiceId: string): Promise<InvoiceRecord | undefined> {
    const client = this.getClient();
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .or(`id.eq.${invoiceId},invoice_number.eq.${invoiceId}`)
      .single();

    if (error || !data) {
      return undefined;
    }

    return mapDbInvoiceToDomain(data);
  }

  public async listInvoices(userId?: string): Promise<InvoiceRecord[]> {
    const client = this.getClient();
    let query = client
      .from('invoices')
      .select('*')
      .order('issued_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase error listing invoices: ${error.message}`);
    }

    return (data || []).map(mapDbInvoiceToDomain);
  }

  public async processRefund(params: {
    orderId: string;
    actorUserId: string;
    actorEmail: string;
    actorRole?: string;
    reason?: string;
    gatewayRefundId?: string;
  }): Promise<{ order: PaymentOrder; invoice: InvoiceRecord }> {
    const client = this.getClient();

    const { data: rpcData, error: rpcError } = await client.rpc('process_refund_atomic', {
      p_order_id: params.orderId,
      p_actor_user_id: params.actorUserId,
      p_actor_email: params.actorEmail,
      p_actor_role: params.actorRole || 'SUPER_ADMIN',
      p_reason: params.reason || 'Administrative refund approval',
      p_gateway_refund_id: params.gatewayRefundId || null,
    });

    if (rpcError) {
      if (rpcError.message.includes('ORDER_NOT_FOUND')) {
        throw new Error(`Payment order ${params.orderId} not found`);
      }
      if (rpcError.message.includes('ALREADY_REFUNDED')) {
        throw new Error(`Payment order ${params.orderId} has already been refunded`);
      }
      if (rpcError.message.includes('INVALID_REFUND_STATE')) {
        throw new Error(rpcError.message);
      }
      if (rpcError.message.includes('INVALID_ACTOR') || rpcError.message.includes('INVALID_REFUND_REASON')) {
        throw new Error(rpcError.message);
      }
      throw new Error(`Supabase refund processing error: ${rpcError.message}`);
    }

    const [orderRes, invoiceRes] = await Promise.all([
      client.from('payment_orders').select('*, users(name, email)').eq('id', params.orderId).single(),
      client.from('invoices').select('*').eq('id', rpcData.invoiceId).single(),
    ]);

    if (orderRes.error || !orderRes.data) {
      throw new Error(`Failed to load refunded payment order: ${orderRes.error?.message}`);
    }
    if (invoiceRes.error || !invoiceRes.data) {
      throw new Error(`Failed to load refunded tax invoice: ${invoiceRes.error?.message}`);
    }

    return {
      order: mapDbPaymentOrderToDomain(orderRes.data),
      invoice: mapDbInvoiceToDomain(invoiceRes.data),
    };
  }

  public async getRevenueReport(): Promise<Record<string, unknown>[]> {
    const invoices = await this.listInvoices();
    return invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.userName,
      customerEmail: inv.userEmail,
      courseTitle: inv.courseTitle,
      batchName: inv.batchName,
      currency: inv.currency,
      subtotal: inv.subtotal,
      taxRatePercent: inv.taxRatePercent,
      taxAmount: inv.taxAmount,
      totalAmount: inv.totalAmount,
      status: inv.status,
      issuedAt: inv.issuedAt,
      paymentMethod: inv.paymentMethod || 'Razorpay',
      transactionRef: inv.transactionRef || 'N/A',
      hsnCode: inv.hsnCode,
    }));
  }

  // --------------------------------------------------------------------------
  // Platform Metrics
  // --------------------------------------------------------------------------
  public async getPlatformMetrics(): Promise<Record<string, unknown>> {
    const client = this.getClient();

    const [coursesRes, batchesRes, usersRes, enrollmentsRes, certificatesRes] = await Promise.all([
      client.from('courses').select('id', { count: 'exact', head: true }),
      client.from('batches').select('id', { count: 'exact', head: true }),
      client.from('users').select('id', { count: 'exact', head: true }),
      client.from('enrollments').select('id', { count: 'exact', head: true }),
      client.from('certificates').select('id', { count: 'exact', head: true }),
    ]);

    return {
      totalCourses: coursesRes.count || 0,
      totalBatches: batchesRes.count || 0,
      totalUsers: usersRes.count || 0,
      totalEnrollments: enrollmentsRes.count || 0,
      totalCertificates: certificatesRes.count || 0,
      storageMode: 'supabase',
      databaseEndpoint: process.env.NEXT_PUBLIC_SUPABASE_URL || 'unknown',
    };
  }

  // --------------------------------------------------------------------------
  // Class Recordings & Interactive Doubts
  // --------------------------------------------------------------------------
  public async getClassRecordings(filter?: {
    courseId?: string;
    batchId?: string;
    sessionId?: string;
    status?: string;
  }): Promise<ClassRecording[]> {
    const client = this.getClient();
    let query = client.from('class_recordings').select('*').order('created_at', { ascending: false });

    if (filter?.courseId) query = query.eq('course_id', filter.courseId);
    if (filter?.batchId) query = query.eq('batch_id', filter.batchId);
    if (filter?.sessionId) query = query.eq('session_id', filter.sessionId);
    if (filter?.status) query = query.eq('status', filter.status);

    const { data, error } = await query;
    if (error) throw new Error(`Supabase error fetching class recordings: ${error.message}`);
    return (data || []).map(mapDbRecordingToDomain);
  }

  public async getClassRecording(recordingId: string): Promise<ClassRecording | null> {
    const client = this.getClient();
    const { data, error } = await client.from('class_recordings').select('*').eq('id', recordingId).maybeSingle();
    if (error) throw new Error(`Supabase error fetching recording ${recordingId}: ${error.message}`);
    if (!data) return null;

    const recording = mapDbRecordingToDomain(data);

    // Fetch related highlights, resources, batch access grants, and doubts
    const [highlights, resources, batchGrants, doubts] = await Promise.all([
      this.getRecordingHighlights(recordingId),
      this.getRecordingResources(recordingId),
      this.getRecordingBatchAccess(recordingId),
      this.getRecordingDoubts(recordingId),
    ]);

    recording.highlights = highlights;
    recording.resources = resources;
    recording.batchAccessGrants = batchGrants;
    recording.doubts = doubts;

    return recording;
  }

  public async saveClassRecording(recording: ClassRecording): Promise<ClassRecording> {
    const client = this.getClient();
    const dbPayload = mapDomainRecordingToDb(recording);
    const { data, error } = await client.from('class_recordings').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error saving class recording: ${error.message}`);
    return mapDbRecordingToDomain(data);
  }

  public async deleteClassRecording(recordingId: string): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('class_recordings').delete().eq('id', recordingId);
    if (error) throw new Error(`Supabase error deleting class recording: ${error.message}`);
    return true;
  }

  // --------------------------------------------------------------------------
  // Previous-Batch Access Grants Governance
  // --------------------------------------------------------------------------
  public async getRecordingBatchAccess(recordingId?: string): Promise<RecordingBatchAccess[]> {
    const client = this.getClient();
    let query = client.from('recording_batch_access').select('*');
    if (recordingId) {
      query = query.eq('recording_id', recordingId);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Supabase error fetching batch access for recording: ${error.message}`);
    return (data || []).map(mapDbBatchAccessToDomain);
  }

  public async grantRecordingBatchAccess(grant: RecordingBatchAccess): Promise<RecordingBatchAccess> {
    const client = this.getClient();
    const dbPayload = {
      id: grant.id,
      recording_id: grant.recordingId,
      source_batch_id: grant.sourceBatchId,
      target_batch_id: grant.targetBatchId,
      allow_download: grant.allowDownload,
      status: grant.status || 'ACTIVE',
      granted_by: grant.grantedBy,
      granted_at: grant.grantedAt || new Date().toISOString(),
      expires_at: grant.expiresAt || null,
    };
    const { data, error } = await client.from('recording_batch_access').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error granting batch access: ${error.message}`);
    return mapDbBatchAccessToDomain(data);
  }

  public async revokeRecordingBatchAccess(grantId: string): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('recording_batch_access').update({ status: 'REVOKED' }).eq('id', grantId);
    if (error) throw new Error(`Supabase error revoking batch access: ${error.message}`);
    return true;
  }

  // --------------------------------------------------------------------------
  // Topic Highlights & Chapters
  // --------------------------------------------------------------------------
  public async getRecordingHighlights(recordingId: string): Promise<RecordingHighlight[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('recording_highlights')
      .select('*')
      .eq('recording_id', recordingId)
      .order('start_timestamp_seconds', { ascending: true });
    if (error) throw new Error(`Supabase error fetching highlights: ${error.message}`);
    return (data || []).map(mapDbHighlightToDomain);
  }

  public async saveRecordingHighlight(highlight: RecordingHighlight): Promise<RecordingHighlight> {
    const client = this.getClient();
    const dbPayload = {
      id: highlight.id,
      recording_id: highlight.recordingId,
      title: highlight.title,
      description: highlight.description || null,
      start_timestamp_seconds: highlight.startTimestampSeconds,
      end_timestamp_seconds: highlight.endTimestampSeconds,
      topic_id: highlight.topicId || null,
      created_by: highlight.createdBy,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await client.from('recording_highlights').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error saving highlight: ${error.message}`);
    return mapDbHighlightToDomain(data);
  }

  public async deleteRecordingHighlight(highlightId: string): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('recording_highlights').delete().eq('id', highlightId);
    if (error) throw new Error(`Supabase error deleting highlight: ${error.message}`);
    return true;
  }

  // --------------------------------------------------------------------------
  // Topic-Linked References & Study Resources
  // --------------------------------------------------------------------------
  public async getRecordingResources(recordingId: string): Promise<RecordingResource[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('recording_resources')
      .select('*')
      .eq('recording_id', recordingId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Supabase error fetching resources: ${error.message}`);
    return (data || []).map(mapDbResourceToDomain);
  }

  public async saveRecordingResource(resource: RecordingResource): Promise<RecordingResource> {
    const client = this.getClient();
    const dbPayload = {
      id: resource.id,
      recording_id: resource.recordingId,
      highlight_id: resource.highlightId || null,
      title: resource.title,
      description: resource.description || null,
      resource_type: resource.resourceType,
      url: resource.url,
      file_size_bytes: resource.fileSizeBytes || null,
      timestamp_seconds: resource.timestampSeconds !== undefined ? resource.timestampSeconds : null,
      uploaded_by: resource.uploadedBy,
    };
    const { data, error } = await client.from('recording_resources').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error saving resource: ${error.message}`);
    return mapDbResourceToDomain(data);
  }

  public async deleteRecordingResource(resourceId: string): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('recording_resources').delete().eq('id', resourceId);
    if (error) throw new Error(`Supabase error deleting resource: ${error.message}`);
    return true;
  }

  // --------------------------------------------------------------------------
  // Timestamp-Linked Doubts & Instructor Answers
  // --------------------------------------------------------------------------
  public async getRecordingDoubts(
    recordingId: string,
    currentUserId?: string,
    isStaff: boolean = false
  ): Promise<RecordingDoubt[]> {
    const client = this.getClient();
    let query = client.from('recording_doubts').select('*').eq('recording_id', recordingId).order('timestamp_seconds', { ascending: true });

    // Privacy filter: Staff sees all; Learner sees their own + public doubts
    if (!isStaff && currentUserId) {
      query = query.or(`user_id.eq.${currentUserId},is_public.eq.true`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase error fetching doubts: ${error.message}`);
    const doubts = (data || []).map(mapDbDoubtToDomain);

    // Fetch answers for all retrieved doubts
    if (doubts.length > 0) {
      const doubtIds = doubts.map((d) => d.id);
      const { data: answersData, error: answersErr } = await client
        .from('recording_doubt_answers')
        .select('*')
        .in('doubt_id', doubtIds)
        .order('created_at', { ascending: true });

      if (!answersErr && answersData) {
        const answersByDoubt = new Map<string, RecordingDoubtAnswer[]>();
        for (const row of answersData) {
          const ans = mapDbDoubtAnswerToDomain(row);
          if (!answersByDoubt.has(ans.doubtId)) {
            answersByDoubt.set(ans.doubtId, []);
          }
          answersByDoubt.get(ans.doubtId)!.push(ans);
        }
        for (const d of doubts) {
          d.answers = answersByDoubt.get(d.id) || [];
        }
      }
    }

    return doubts;
  }

  public async saveRecordingDoubt(doubt: RecordingDoubt): Promise<RecordingDoubt> {
    const client = this.getClient();
    const dbPayload = {
      id: doubt.id,
      recording_id: doubt.recordingId,
      user_id: doubt.userId,
      timestamp_seconds: doubt.timestampSeconds,
      highlight_id: doubt.highlightId || null,
      question: doubt.question,
      status: doubt.status || 'OPEN',
      is_public: Boolean(doubt.isPublic),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await client.from('recording_doubts').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error saving doubt: ${error.message}`);
    return mapDbDoubtToDomain(data);
  }

  public async saveRecordingDoubtAnswer(answer: RecordingDoubtAnswer): Promise<RecordingDoubtAnswer> {
    const client = this.getClient();
    const dbPayload = {
      id: answer.id,
      doubt_id: answer.doubtId,
      instructor_id: answer.instructorId,
      answer_text: answer.answerText,
      reference_url: answer.referenceUrl || null,
    };
    const { data, error } = await client.from('recording_doubt_answers').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error saving doubt answer: ${error.message}`);
    return mapDbDoubtAnswerToDomain(data);
  }

  public async resolveRecordingDoubt(doubtId: string, status: DoubtStatus, isPublic?: boolean): Promise<boolean> {
    const client = this.getClient();
    const updatePayload: any = { status, updated_at: new Date().toISOString() };
    if (typeof isPublic === 'boolean') {
      updatePayload.is_public = isPublic;
    }
    const { error } = await client.from('recording_doubts').update(updatePayload).eq('id', doubtId);
    if (error) throw new Error(`Supabase error updating doubt status: ${error.message}`);
    return true;
  }

  // --------------------------------------------------------------------------
  // Phase 5C.1: Live Bug Monitoring & Centralized Diagnostics Engine
  // --------------------------------------------------------------------------

  public async upsertDiagnosticIssue(issue: DiagnosticIssue): Promise<DiagnosticIssue> {
    const client = this.getClient();
    const dbPayload = mapDomainDiagnosticIssueToDb(issue);
    const { data, error } = await client
      .from('diagnostic_issues')
      .upsert(dbPayload, { onConflict: 'fingerprint' })
      .select('*')
      .single();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return issue;
      }
      throw new Error(`Supabase error upserting diagnostic issue: ${error.message}`);
    }

    return mapDbDiagnosticIssueToDomain(data);
  }

  public async getDiagnosticIssues(filter?: {
    status?: DiagnosticIssueStatus;
    severity?: DiagnosticSeverity;
    category?: DiagnosticCategory;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ issues: DiagnosticIssue[]; total: number }> {
    const client = this.getClient();
    let query = client.from('diagnostic_issues').select('*', { count: 'exact' });

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.severity) {
      query = query.eq('severity', filter.severity);
    }
    if (filter?.category) {
      query = query.eq('category', filter.category);
    }
    if (filter?.search) {
      query = query.or(`title.ilike.%${filter.search}%,last_error_message.ilike.%${filter.search}%,last_correlation_id.ilike.%${filter.search}%`);
    }

    query = query.order('last_seen_at', { ascending: false });

    if (filter?.limit) {
      const from = filter.offset || 0;
      const to = from + filter.limit - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return { issues: [], total: 0 };
      }
      throw new Error(`Supabase error fetching diagnostic issues: ${error.message}`);
    }

    return {
      issues: (data || []).map(mapDbDiagnosticIssueToDomain),
      total: count || (data ? data.length : 0),
    };
  }

  public async getDiagnosticIssueById(id: string): Promise<DiagnosticIssue | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('diagnostic_issues')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return null;
      }
      throw new Error(`Supabase error fetching issue ${id}: ${error.message}`);
    }

    return data ? mapDbDiagnosticIssueToDomain(data) : null;
  }

  public async getDiagnosticIssueByFingerprint(fingerprint: string): Promise<DiagnosticIssue | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('diagnostic_issues')
      .select('*')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return null;
      }
      throw new Error(`Supabase error fetching issue by fingerprint: ${error.message}`);
    }

    return data ? mapDbDiagnosticIssueToDomain(data) : null;
  }

  public async updateDiagnosticIssueStatus(
    id: string,
    status: DiagnosticIssueStatus,
    actorId?: string,
    notes?: string
  ): Promise<DiagnosticIssue | null> {
    const client = this.getClient();
    const now = new Date().toISOString();
    const updatePayload: any = {
      status,
      updated_at: now,
    };

    if (status === 'ACKNOWLEDGED') {
      updatePayload.acknowledged_by = actorId || null;
      updatePayload.acknowledged_at = now;
    } else if (status === 'RESOLVED') {
      updatePayload.resolved_by = actorId || null;
      updatePayload.resolved_at = now;
      if (notes) updatePayload.resolution_notes = notes;
    }

    const { data, error } = await client
      .from('diagnostic_issues')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return null;
      }
      throw new Error(`Supabase error updating issue ${id}: ${error.message}`);
    }

    return data ? mapDbDiagnosticIssueToDomain(data) : null;
  }

  public async recordDiagnosticEvent(event: DiagnosticEvent): Promise<DiagnosticEvent> {
    const client = this.getClient();
    const dbPayload = mapDomainDiagnosticEventToDb(event);
    const { data, error } = await client
      .from('diagnostic_events')
      .insert(dbPayload)
      .select('*')
      .single();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return event;
      }
      throw new Error(`Supabase error inserting diagnostic event: ${error.message}`);
    }

    return mapDbDiagnosticEventToDomain(data);
  }

  public async getDiagnosticEventsForIssue(issueId: string, limit: number = 50): Promise<DiagnosticEvent[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('diagnostic_events')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error fetching events for issue ${issueId}: ${error.message}`);
    }

    return (data || []).map(mapDbDiagnosticEventToDomain);
  }

  public async getRecentDiagnosticEvents(limit: number = 100): Promise<DiagnosticEvent[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('diagnostic_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error fetching recent diagnostic events: ${error.message}`);
    }

    return (data || []).map(mapDbDiagnosticEventToDomain);
  }

  public async upsertServiceHealthCheck(check: ServiceHealthCheck): Promise<ServiceHealthCheck> {
    const client = this.getClient();
    const dbPayload = mapDomainServiceHealthCheckToDb(check);
    const { data, error } = await client
      .from('service_health_checks')
      .upsert(dbPayload, { onConflict: 'service_name' })
      .select('*')
      .single();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return check;
      }
      throw new Error(`Supabase error upserting service health check: ${error.message}`);
    }

    return mapDbServiceHealthCheckToDomain(data);
  }

  public async getServiceHealthChecks(): Promise<ServiceHealthCheck[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('service_health_checks')
      .select('*');

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error fetching service health checks: ${error.message}`);
    }

    return (data || []).map(mapDbServiceHealthCheckToDomain);
  }

  // --------------------------------------------------------------------------
  // Phase 5C.3: Support Ticketing, Student Helpdesk & Service Operations
  // --------------------------------------------------------------------------

  public async generateSupportTicketNumber(): Promise<string> {
    const client = this.getClient();
    try {
      const { data, error } = await client.rpc('next_support_ticket_number');
      if (!error && data) return data as string;
    } catch {
      // Fallback below
    }
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    return `ZL-${year}-${randomSeq}`;
  }

  public async getSupportCategories(activeOnly: boolean = false): Promise<SupportCategory[]> {
    const client = this.getClient();
    let query = client.from('support_categories').select('*').order('name', { ascending: true });
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return [];
      throw new Error(`Supabase error fetching support categories: ${error.message}`);
    }
    return (data || []).map(mapDbSupportCategoryToDomain);
  }

  public async getSupportCategoryById(id: string): Promise<SupportCategory | undefined> {
    const client = this.getClient();
    const { data, error } = await client.from('support_categories').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return undefined;
      throw new Error(`Supabase error fetching support category by id: ${error.message}`);
    }
    return data ? mapDbSupportCategoryToDomain(data) : undefined;
  }

  public async getSupportTeams(activeOnly: boolean = false): Promise<SupportTeam[]> {
    const client = this.getClient();
    let query = client.from('support_teams').select('*').order('name', { ascending: true });
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return [];
      throw new Error(`Supabase error fetching support teams: ${error.message}`);
    }
    return (data || []).map(mapDbSupportTeamToDomain);
  }

  public async getSupportTeamById(id: string): Promise<SupportTeam | undefined> {
    const client = this.getClient();
    const { data, error } = await client.from('support_teams').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return undefined;
      throw new Error(`Supabase error fetching support team by id: ${error.message}`);
    }
    return data ? mapDbSupportTeamToDomain(data) : undefined;
  }

  public async getSupportSlaPolicies(activeOnly: boolean = false): Promise<SupportSlaPolicy[]> {
    const client = this.getClient();
    let query = client.from('support_sla_policies').select('*').order('priority', { ascending: true });
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return [];
      throw new Error(`Supabase error fetching SLA policies: ${error.message}`);
    }
    return (data || []).map(mapDbSupportSlaPolicyToDomain);
  }

  public async createSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
    const client = this.getClient();
    const payload = mapDomainSupportTicketToDb(ticket);
    const { data, error } = await client.from('support_tickets').insert(payload).select('*').single();
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return ticket;
      throw new Error(`Supabase error creating support ticket: ${error.message}`);
    }
    return mapDbSupportTicketToDomain(data);
  }

  public async getSupportTicketById(id: string): Promise<SupportTicket | undefined> {
    const client = this.getClient();
    const { data, error } = await client.from('support_tickets').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return undefined;
      throw new Error(`Supabase error fetching support ticket by id: ${error.message}`);
    }
    return data ? mapDbSupportTicketToDomain(data) : undefined;
  }

  public async getSupportTicketByNumber(ticketNumber: string): Promise<SupportTicket | undefined> {
    const client = this.getClient();
    const { data, error } = await client.from('support_tickets').select('*').eq('ticket_number', ticketNumber).maybeSingle();
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return undefined;
      throw new Error(`Supabase error fetching support ticket by number: ${error.message}`);
    }
    return data ? mapDbSupportTicketToDomain(data) : undefined;
  }

  public async updateSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
    const client = this.getClient();
    const payload = mapDomainSupportTicketToDb(ticket);
    const { data, error } = await client.from('support_tickets').update(payload).eq('id', ticket.id).select('*').single();
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return ticket;
      throw new Error(`Supabase error updating support ticket: ${error.message}`);
    }
    return mapDbSupportTicketToDomain(data);
  }

  public async getSupportTickets(filter?: SupportTicketFilterParams): Promise<{ tickets: SupportTicket[]; totalCount: number }> {
    const client = this.getClient();
    let query = client.from('support_tickets').select('*', { count: 'exact' });

    if (filter?.status && filter.status !== 'ALL') {
      query = query.eq('status', filter.status);
    }
    if (filter?.priority && filter.priority !== 'ALL') {
      query = query.eq('priority', filter.priority);
    }
    if (filter?.categoryId) {
      query = query.eq('category_id', filter.categoryId);
    }
    if (filter?.assignedTeamId) {
      query = query.eq('assigned_team_id', filter.assignedTeamId);
    }
    if (filter?.assignedAgentUserId) {
      query = query.eq('assigned_agent_user_id', filter.assignedAgentUserId);
    }
    if (filter?.requesterUserId) {
      query = query.eq('requester_user_id', filter.requesterUserId);
    }
    if (filter?.courseId) {
      query = query.eq('related_course_id', filter.courseId);
    }
    if (filter?.batchId) {
      query = query.eq('related_batch_id', filter.batchId);
    }
    if (filter?.search) {
      const term = `%${filter.search}%`;
      query = query.or(`ticket_number.ilike.${term},subject.ilike.${term},description.ilike.${term},requester_name.ilike.${term}`);
    }

    query = query.order('created_at', { ascending: false });

    if (filter?.limit) {
      const from = filter.offset || 0;
      const to = from + filter.limit - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return { tickets: [], totalCount: 0 };
      throw new Error(`Supabase error querying support tickets: ${error.message}`);
    }

    return {
      tickets: (data || []).map(mapDbSupportTicketToDomain),
      totalCount: count ?? (data?.length || 0),
    };
  }

  public async createSupportTicketMessage(message: SupportTicketMessage): Promise<SupportTicketMessage> {
    const client = this.getClient();
    const payload = mapDomainSupportTicketMessageToDb(message);
    const { data, error } = await client.from('support_ticket_messages').insert(payload).select('*').single();
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return message;
      throw new Error(`Supabase error creating support ticket message: ${error.message}`);
    }
    return mapDbSupportTicketMessageToDomain(data);
  }

  public async getSupportTicketMessages(ticketId: string, includeInternal: boolean = false): Promise<SupportTicketMessage[]> {
    const client = this.getClient();
    let query = client.from('support_ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (!includeInternal) {
      query = query.eq('visibility', 'PUBLIC');
    }
    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return [];
      throw new Error(`Supabase error fetching support ticket messages: ${error.message}`);
    }
    return (data || []).map(mapDbSupportTicketMessageToDomain);
  }

  public async createSupportTicketEvent(event: SupportTicketEvent): Promise<SupportTicketEvent> {
    const client = this.getClient();
    const payload = mapDomainSupportTicketEventToDb(event);
    const { data, error } = await client.from('support_ticket_events').insert(payload).select('*').single();
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return event;
      throw new Error(`Supabase error recording support ticket event: ${error.message}`);
    }
    return mapDbSupportTicketEventToDomain(data);
  }

  public async getSupportTicketEvents(ticketId: string, includeInternal: boolean = false): Promise<SupportTicketEvent[]> {
    const client = this.getClient();
    let query = client.from('support_ticket_events').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (!includeInternal) {
      query = query.not('event_type', 'eq', 'INTERNAL_NOTE_ADDED');
    }
    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return [];
      throw new Error(`Supabase error fetching support ticket events: ${error.message}`);
    }
    return (data || []).map(mapDbSupportTicketEventToDomain);
  }

  public async createSupportTicketAttachment(attachment: SupportTicketAttachment): Promise<SupportTicketAttachment> {
    const client = this.getClient();
    const payload = mapDomainSupportTicketAttachmentToDb(attachment);
    const { data, error } = await client.from('support_ticket_attachments').insert(payload).select('*').single();
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return attachment;
      throw new Error(`Supabase error creating support ticket attachment: ${error.message}`);
    }
    return mapDbSupportTicketAttachmentToDomain(data);
  }

  public async getSupportTicketAttachments(ticketId: string): Promise<SupportTicketAttachment[]> {
    const client = this.getClient();
    const { data, error } = await client.from('support_ticket_attachments').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) return [];
      throw new Error(`Supabase error fetching support ticket attachments: ${error.message}`);
    }
    return (data || []).map(mapDbSupportTicketAttachmentToDomain);
  }

  // ============================================================================
  // DIRECT MESSAGING & COHORT CONVERSATIONS PERSISTENCE (ZM-IMPL-01)
  // ============================================================================

  public async createDirectMessage(message: DirectMessage): Promise<DirectMessage> {
    const client = this.getClient();
    // Idempotency check: if clientMessageId is provided, check if already exists for this sender
    if (message.clientMessageId) {
      const { data: existing, error: checkErr } = await client
        .from('direct_messages')
        .select('*')
        .eq('sender_id', message.senderId)
        .eq('client_message_id', message.clientMessageId)
        .maybeSingle();

      if (!checkErr && existing) {
        return mapDbDirectMessageToDomain(existing);
      }
    }

    const payload = mapDomainDirectMessageToDb(message);
    const { data, error } = await client
      .from('direct_messages')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return message;
      }
      throw new Error(`Supabase error creating direct message: ${error.message}`);
    }
    return mapDbDirectMessageToDomain(data);
  }

  public async getDirectMessages(
    userId: string,
    courseId?: string,
    batchId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<DirectMessage[]> {
    const client = this.getClient();
    let query = client
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId},recipient_id.is.null`);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }
    if (batchId) {
      query = query.or(`batch_id.is.null,batch_id.eq.${batchId}`);
    }

    query = query
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error fetching direct messages: ${error.message}`);
    }
    return (data || []).map(mapDbDirectMessageToDomain);
  }

  public async getDirectMessageById(id: string): Promise<DirectMessage | undefined> {
    const client = this.getClient();
    const { data, error } = await client
      .from('direct_messages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return undefined;
      }
      throw new Error(`Supabase error fetching direct message by id: ${error.message}`);
    }
    return data ? mapDbDirectMessageToDomain(data) : undefined;
  }

  public async markDirectMessageRead(id: string, readByUserId?: string): Promise<boolean> {
    const client = this.getClient();
    let updateQuery = client
      .from('direct_messages')
      .update({
        read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (readByUserId) {
      updateQuery = updateQuery.or(`recipient_id.eq.${readByUserId},recipient_id.is.null`);
    }

    const { error } = await updateQuery;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return false;
      }
      throw new Error(`Supabase error marking direct message read: ${error.message}`);
    }
    return true;
  }

  public async getUnreadDirectMessageCount(userId: string, courseId?: string): Promise<number> {
    const client = this.getClient();
    let query = client
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('read', false)
      .eq('recipient_id', userId);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { count, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return 0;
      }
      throw new Error(`Supabase error counting unread direct messages: ${error.message}`);
    }
    return count || 0;
  }

  // ==========================================================================
  // CMS & PAGEBUILDER REPOSITORY METHODS
  // ==========================================================================

  public async getCmsPages(filter?: { pageType?: string; status?: string }): Promise<CmsPage[]> {
    const client = this.getClient();
    let query = client.from('cms_pages').select('*').order('created_at', { ascending: false });

    if (filter?.pageType) {
      query = query.eq('page_type', filter.pageType);
    }
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error fetching cms pages: ${error.message}`);
    }
    return (data || []).map(mapDbCmsPageToDomain);
  }

  public async getCmsPageById(id: string): Promise<CmsPage | undefined> {
    const client = this.getClient();
    const { data, error } = await client.from('cms_pages').select('*').eq('id', id).maybeSingle();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return undefined;
      }
      throw new Error(`Supabase error fetching cms page by id: ${error.message}`);
    }
    return data ? mapDbCmsPageToDomain(data) : undefined;
  }

  public async getCmsPageBySlug(slug: string): Promise<CmsPage | undefined> {
    const client = this.getClient();
    const { data, error } = await client.from('cms_pages').select('*').eq('slug', slug).maybeSingle();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return undefined;
      }
      throw new Error(`Supabase error fetching cms page by slug: ${error.message}`);
    }
    return data ? mapDbCmsPageToDomain(data) : undefined;
  }

  public async saveCmsPage(page: CmsPage): Promise<CmsPage> {
    const client = this.getClient();
    const payload = mapDomainCmsPageToDb(page);

    const { data, error } = await client
      .from('cms_pages')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Supabase error saving cms page: ${error.message}`);
    }
    if (!data) {
      throw new Error('Supabase error saving cms page: no data returned');
    }
    return mapDbCmsPageToDomain(data);
  }

  public async deleteCmsPage(id: string): Promise<boolean> {
    const client = this.getClient();
    const { error } = await client.from('cms_pages').delete().eq('id', id);

    if (error) {
      throw new Error(`Supabase error deleting cms page: ${error.message}`);
    }
    return true;
  }

  public async getCmsPageVersions(pageId: string): Promise<CmsPageVersion[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('cms_page_versions')
      .select('*')
      .eq('page_id', pageId)
      .order('version_number', { ascending: false });

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error fetching cms page versions: ${error.message}`);
    }
    return (data || []).map(mapDbCmsPageVersionToDomain);
  }

  public async getCmsPageVersionById(id: string): Promise<CmsPageVersion | undefined> {
    const client = this.getClient();
    const { data, error } = await client
      .from('cms_page_versions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return undefined;
      }
      throw new Error(`Supabase error fetching cms page version by id: ${error.message}`);
    }
    return data ? mapDbCmsPageVersionToDomain(data) : undefined;
  }

  public async saveCmsPageVersion(version: CmsPageVersion): Promise<CmsPageVersion> {
    const client = this.getClient();
    const payload = mapDomainCmsPageVersionToDb(version);

    const { data, error } = await client
      .from('cms_page_versions')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Supabase error saving cms page version: ${error.message}`);
    }
    if (!data) {
      throw new Error('Supabase error saving cms page version: no data returned');
    }
    return mapDbCmsPageVersionToDomain(data);
  }

  public async getCmsPageNodes(versionId: string): Promise<CmsPageNode[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('cms_page_nodes')
      .select('*')
      .eq('page_version_id', versionId)
      .order('position', { ascending: true });

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error fetching cms page nodes: ${error.message}`);
    }
    return (data || []).map(mapDbCmsPageNodeToDomain);
  }

  public async saveCmsPageNodes(versionId: string, nodes: CmsPageNode[]): Promise<CmsPageNode[]> {
    const client = this.getClient();

    // Delete existing nodes for this version
    const { error: deleteError } = await client
      .from('cms_page_nodes')
      .delete()
      .eq('page_version_id', versionId);

    if (deleteError) {
      throw new Error(`Supabase error clearing cms page nodes: ${deleteError.message}`);
    }

    if (nodes.length === 0) return [];

    const payloads = nodes.map(mapDomainCmsPageNodeToDb);
    const { data, error: insertError } = await client
      .from('cms_page_nodes')
      .insert(payloads)
      .select('*');

    if (insertError) {
      throw new Error(`Supabase error inserting cms page nodes: ${insertError.message}`);
    }
    if (!data) {
      throw new Error('Supabase error inserting cms page nodes: no data returned');
    }

    return (data || []).map(mapDbCmsPageNodeToDomain);
  }

  public async publishCmsPage(
    pageId: string,
    versionId: string,
    publisherId: string,
    checksum: string
  ): Promise<boolean> {
    const client = this.getClient();

    // 0. Attempt genuinely atomic stored procedure if available
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('publish_cms_page_version', {
        p_page_id: pageId,
        p_version_id: versionId,
        p_actor_id: publisherId,
        p_checksum: checksum,
      });

      if (!rpcError && rpcData && rpcData.success) {
        return true;
      }
      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
        throw new Error(`Supabase atomic publish error: ${rpcError.message}`);
      }
    } catch (rpcEx: any) {
      if (!rpcEx.message.includes('function') && !rpcEx.message.includes('does not exist')) {
        throw rpcEx;
      }
    }

    // 1. Fallback to multi-statement verified transaction
    const { data: verData, error: verError } = await client
      .from('cms_page_versions')
      .update({
        status: 'PUBLISHED',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .select('id');

    if (verError) {
      throw new Error(`Supabase error updating version to published: ${verError.message}`);
    }
    if (!verData || verData.length === 0) {
      throw new Error(`Supabase zero-row update: version "${versionId}" not found`);
    }

    // 2. Update page to PUBLISHED, set published_version_id, clear scheduled fields
    const { data: pageData, error: pageError } = await client
      .from('cms_pages')
      .update({
        status: 'PUBLISHED',
        published_version_id: versionId,
        scheduled_publish_at: null,
        scheduled_version_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)
      .select('id');

    if (pageError) {
      throw new Error(`Supabase error setting published version on page: ${pageError.message}`);
    }
    if (!pageData || pageData.length === 0) {
      throw new Error(`Supabase zero-row update: page "${pageId}" not found`);
    }

    // 3. Record publication audit record
    const pubRecord = {
      id: `pub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      page_id: pageId,
      version_id: versionId,
      published_by: publisherId,
      published_at: new Date().toISOString(),
      snapshot_checksum: checksum,
    };

    const { error: pubError } = await client.from('cms_publication_records').insert(pubRecord);
    if (pubError && !pubError.message.includes('relation') && !pubError.message.includes('does not exist')) {
      console.warn(`Warning: Could not record publication audit log: ${pubError.message}`);
    }

    // 4. Mark any queued scheduled publication jobs as COMPLETED
    try {
      await client
        .from('cms_scheduled_publications')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('page_id', pageId)
        .eq('version_id', versionId)
        .in('status', ['QUEUED', 'PROCESSING']);
    } catch {
      // Non-fatal if table not yet migrated
    }

    return true;
  }

  public async rollbackCmsPage(
    pageId: string,
    sourceVersionId: string,
    newVersionId: string,
    actorId: string,
    changeSummary: string
  ): Promise<{ page: CmsPage; version: CmsPageVersion } | null> {
    const client = this.getClient();

    // 0. Attempt genuinely atomic stored procedure if available
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('rollback_cms_page_version', {
        p_page_id: pageId,
        p_source_version_id: sourceVersionId,
        p_new_version_id: newVersionId,
        p_actor_id: actorId,
        p_change_summary: changeSummary,
      });

      if (!rpcError && rpcData && rpcData.success) {
        return {
          page: mapDbCmsPageToDomain(rpcData.page),
          version: mapDbCmsPageVersionToDomain(rpcData.version),
        };
      }
      if (
        rpcError &&
        !rpcError.message.includes('function') &&
        !rpcError.message.includes('does not exist') &&
        !rpcError.message.includes('fetch failed')
      ) {
        throw new Error(`Supabase atomic rollback error: ${rpcError.message}`);
      }
    } catch (rpcEx: any) {
      if (
        !rpcEx.message.includes('function') &&
        !rpcEx.message.includes('does not exist') &&
        !rpcEx.message.includes('fetch failed')
      ) {
        throw rpcEx;
      }
    }

    // Fallback: Return null indicating caller should use multi-step orchestration
    return null;
  }

  public async saveCmsScheduledPublicationJob(
    job: CmsScheduledPublicationJob
  ): Promise<CmsScheduledPublicationJob> {
    const client = this.getClient();
    const payload = mapDomainCmsScheduledPublicationJobToDb(job);

    const { data, error } = await client
      .from('cms_scheduled_publications')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Supabase error saving scheduled publication job: ${error.message}`);
    }
    if (!data) {
      throw new Error('Supabase error saving scheduled publication job: no data returned');
    }
    return mapDbCmsScheduledPublicationJobToDomain(data);
  }

  public async getCmsScheduledPublicationJobs(filter?: {
    pageId?: string;
    status?: CmsPublicationJobStatus;
  }): Promise<CmsScheduledPublicationJob[]> {
    const client = this.getClient();
    let query = client.from('cms_scheduled_publications').select('*').order('scheduled_at', { ascending: true });

    if (filter?.pageId) query = query.eq('page_id', filter.pageId);
    if (filter?.status) query = query.eq('status', filter.status);

    const { data, error } = await query;
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error fetching scheduled publication jobs: ${error.message}`);
    }
    return (data || []).map(mapDbCmsScheduledPublicationJobToDomain);
  }

  public async claimDueCmsScheduledPublicationJobs(
    workerId: string,
    limit: number = 5
  ): Promise<CmsScheduledPublicationJob[]> {
    const client = this.getClient();
    const nowIso = new Date().toISOString();

    // Query due jobs
    const { data: candidates, error: queryErr } = await client
      .from('cms_scheduled_publications')
      .select('*')
      .eq('status', 'QUEUED')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (queryErr) {
      if (queryErr.message.includes('relation') || queryErr.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error querying due publication jobs: ${queryErr.message}`);
    }

    if (!candidates || candidates.length === 0) return [];

    const claimed: CmsScheduledPublicationJob[] = [];
    for (const cand of candidates) {
      const { data: updated, error: lockErr } = await client
        .from('cms_scheduled_publications')
        .update({
          status: 'PROCESSING',
          locked_at: nowIso,
          locked_by: workerId,
          attempt_count: (cand.attempt_count || 0) + 1,
          updated_at: nowIso,
        })
        .eq('id', cand.id)
        .eq('status', 'QUEUED')
        .select('*');

      if (!lockErr && updated && updated.length > 0) {
        claimed.push(mapDbCmsScheduledPublicationJobToDomain(updated[0]));
      }
    }

    return claimed;
  }

  public async updateCmsScheduledPublicationJob(
    id: string,
    updates: {
      status?: CmsPublicationJobStatus;
      completedAt?: string;
      errorMessage?: string;
      lockedAt?: string | null;
      lockedBy?: string | null;
    }
  ): Promise<CmsScheduledPublicationJob | null> {
    const client = this.getClient();
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;
    if (updates.errorMessage !== undefined) payload.error_message = updates.errorMessage;
    if (updates.lockedAt !== undefined) payload.locked_at = updates.lockedAt;
    if (updates.lockedBy !== undefined) payload.locked_by = updates.lockedBy;

    const { data, error } = await client
      .from('cms_scheduled_publications')
      .update(payload)
      .eq('id', id)
      .select('*');

    if (error) {
      throw new Error(`Supabase error updating scheduled publication job: ${error.message}`);
    }
    if (!data || data.length === 0) return null;
    return mapDbCmsScheduledPublicationJobToDomain(data[0]);
  }

  public async getCmsTemplates(): Promise<CmsTemplate[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('cms_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error fetching cms templates: ${error.message}`);
    }
    return (data || []).map(mapDbCmsTemplateToDomain);
  }

  public async saveCmsTemplate(template: CmsTemplate): Promise<CmsTemplate> {
    const client = this.getClient();
    const payload = mapDomainCmsTemplateToDb(template);

    const { data, error } = await client
      .from('cms_templates')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Supabase error saving cms template: ${error.message}`);
    }
    if (!data) {
      throw new Error('Supabase error saving cms template: no data returned');
    }
    return mapDbCmsTemplateToDomain(data);
  }

  public async getCmsReusableBlocks(): Promise<CmsReusableBlock[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('cms_reusable_blocks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Supabase error fetching cms reusable blocks: ${error.message}`);
    }
    return (data || []).map(mapDbCmsReusableBlockToDomain);
  }

  public async saveCmsReusableBlock(block: CmsReusableBlock): Promise<CmsReusableBlock> {
    const client = this.getClient();
    const payload = mapDomainCmsReusableBlockToDb(block);

    const { data, error } = await client
      .from('cms_reusable_blocks')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Supabase error saving cms reusable block: ${error.message}`);
    }
    if (!data) {
      throw new Error('Supabase error saving cms reusable block: no data returned');
    }
    return mapDbCmsReusableBlockToDomain(data);
  }
}


export const supabaseAdapter = new SupabaseAdapter();
