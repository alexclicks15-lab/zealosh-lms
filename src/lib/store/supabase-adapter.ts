// Zealosh LMS — Authoritative Supabase Database Persistence Adapter
// Architecture: ADR-002 (Server-Side Authoritative & Defense-in-Depth RLS)
// Strict typed mapping between Supabase PostgreSQL schema and TypeScript domain entities

import { getSupabaseAdminClient } from '@/lib/supabase';
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
} from '@/types';


// ============================================================================
// DTO MAPPERS (Database Snake_Case <-> TypeScript CamelCase)
// ============================================================================

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
    gradedByUserId: row.graded_by_user_id || undefined,
    gradedAt: row.graded_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapDomainSubmissionToDb(s: AssignmentSubmission): any {
  return {
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
    coverImage: row.cover_image || '',
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
    completedTime: row.completed_time || undefined,
    assignedQuestionIds: row.assigned_question_ids || [],
    answers: row.answers || {},
    bookmarkedQuestionIds: row.bookmarked_question_ids || [],
    totalScore: row.total_score !== null ? Number(row.total_score) : undefined,
    passingScorePercent: Number(row.passing_score_percent || 70),
    passed: row.passed !== null ? Boolean(row.passed) : undefined,
    domainBreakdown: row.domain_breakdown || undefined,
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
      darkNeutral: '#252c41',
      surfaceColor: '#ffffff',
      lightSurfaceColor: '#f7f9fc',
      secondarySurface: '#eaedf5',
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
    const { data, error } = await client.from('live_sessions').select('*').eq('id', sessionId).single();
    if (error || !data) return null;
    return mapDbLiveSessionToDomain(data);
  }

  public async getLiveSessions(batchId: string): Promise<LiveSession[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('live_sessions')
      .select('*')
      .eq('batch_id', batchId)
      .order('scheduled_start_time', { ascending: true });
    if (error) throw new Error(`Supabase error fetching live sessions: ${error.message}`);
    return (data || []).map(mapDbLiveSessionToDomain);
  }

  public async saveLiveSession(session: LiveSession): Promise<LiveSession> {
    const client = this.getClient();
    const dbPayload = mapDomainLiveSessionToDb(session);
    const { data, error } = await client.from('live_sessions').upsert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error saving live session: ${error.message}`);
    return mapDbLiveSessionToDomain(data);
  }

  public async getAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    const client = this.getClient();
    const { data, error } = await client.from('attendance_records').select('*').eq('session_id', sessionId);
    if (error) throw new Error(`Supabase error fetching attendance: ${error.message}`);
    return (data || []).map(mapDbAttendanceToDomain);
  }

  public async recordAttendance(record: AttendanceRecord): Promise<AttendanceRecord> {
    const client = this.getClient();
    const dbPayload = mapDomainAttendanceToDb(record);
    const { data, error } = await client.from('attendance_records').insert(dbPayload).select('*').single();
    if (error) throw new Error(`Supabase error recording attendance: ${error.message}`);
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
    const dbPayload = mapDomainSubmissionToDb(submission);
    const { data, error } = await client
      .from('assignment_submissions')
      .upsert(dbPayload)
      .select('*, assignments(course_id, batch_id)')
      .single();
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
      score: number;
      feedback?: string;
      rubricScores?: RubricScore[];
      gradedBy: string;
      actorEmail?: string;
    }
  ): Promise<AssignmentSubmission> {
    const client = this.getClient();
    const now = new Date().toISOString();
    const updatePayload: any = {
      score: grade.score,
      feedback: grade.feedback || null,
      status: 'GRADED',
      graded_by_user_id: grade.gradedBy,
      graded_at: now,
      updated_at: now,
    };
    if (grade.rubricScores) {
      updatePayload.rubric_scores = grade.rubricScores;
    }
    const { data, error } = await client
      .from('assignment_submissions')
      .update(updatePayload)
      .eq('id', submissionId)
      .select('*, assignments(course_id, batch_id)')
      .single();

    if (error) {
      throw new Error(`Supabase error grading submission: ${error.message}`);
    }

    await this.recordAudit({
      actorUserId: grade.gradedBy,
      actorEmail: grade.actorEmail || 'instructor@zealosh.com',
      actorRole: 'INSTRUCTOR',
      action: 'ASSIGNMENT_GRADED',
      entityType: 'SUBMISSION',
      entityId: submissionId,
      details: { score: grade.score, submissionId },
    });

    return mapDbSubmissionToDomain(data);
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
    let assignedIds: string[];
    if (blueprintId === 'bp-asp-bcsp-v10') {
      assignedIds = ['q-asp-01', 'q-asp-02', 'q-asp-03', 'q-asp-04', 'q-asp-05'];
    } else {
      const questions = await this.getExamQuestions(blueprint.certificationType);
      assignedIds = questions.slice(0, blueprint.totalQuestions).map((q) => q.id);
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + blueprint.durationMinutes * 60 * 1000);
    const attemptId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newAttempt: ExamAttempt = {
      id: attemptId,
      userId,
      blueprintId: blueprint.id,
      certificationType: blueprint.certificationType,
      status: 'IN_PROGRESS',
      startTime: now.toISOString(),
      deadlineTime: deadline.toISOString(),
      assignedQuestionIds: assignedIds,
      answers: {},
      bookmarkedQuestionIds: [],
      passingScorePercent: blueprint.passingScorePercent,
    };

    const { error } = await client.from('exam_attempts').insert({
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
    });

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

    // Authoritative Server-Side Scoring
    const questions = await this.getExamQuestions(attempt.certificationType);
    const questionsMap = new Map(questions.map((q) => [q.id, q]));

    let correctCount = 0;
    const domainBreakdown: Record<string, { total: number; correct: number; percent: number }> = {};

    attempt.assignedQuestionIds.forEach((qId) => {
      const q = questionsMap.get(qId);
      if (!q) return;

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

    const { data, error } = await client
      .from('exam_attempts')
      .update({
        status: 'COMPLETED',
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
    let query = client.from('certificates').select('*').order('issued_date', { ascending: false });
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
}


export const supabaseAdapter = new SupabaseAdapter();
