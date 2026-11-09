// Zealosh LMS — Domain Entity Definitions

export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'COURSE_MANAGER' | 'ORG_ADMIN' | 'SUPER_ADMIN' | 'SUPPORT_STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl?: string;
  organizationId: string;
  externalLearningId?: string; // Moodle linked User ID
  emailVerified?: boolean;
  verified?: boolean;
  isActive?: boolean;
  tokenVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryModel = 'RECORDED' | 'LIVE' | 'HYBRID' | 'MATERIALS_ONLY';
export type CertificationType = 'ASP' | 'CSP' | 'CRSP' | 'CIT' | 'NEBOSH_IDIP' | 'CUSTOM';
export type CourseStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface Course {
  id: string;
  departmentId?: string;
  programmeId?: string;
  title: string;
  slug: string;
  certificationType: CertificationType;
  deliveryModel: DeliveryModel;
  status: CourseStatus;
  headline: string;
  description: string;
  learningObjectives: string[];
  prerequisites: string[];
  priceInr: number;
  priceUsd: number;
  price?: number;
  currency?: string;
  category?: string;
  durationWeeks: number;
  coverImage: string;
  leadInstructorId: string;
  coInstructorIds: string[];
  moodleCourseId?: number;
  modulesCount: number;
  totalLessons: number;
  totalHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  courseId: string;
  academicYearId?: string;
  name: string; // e.g. "Weekend Batch — Nov 2026"
  startDate: string;
  endDate: string;
  scheduleDescription: string; // e.g. "Saturdays & Sundays 7:00 PM - 9:30 PM IST"
  capacity: number;
  enrolledCount: number;
  leadInstructorId: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  mode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  batchId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'CANCELLED' | 'TRANSFERRED' | 'COMPLETED';
  enrolledAt: string;
  expiresAt: string;
  progressPercent: number;
  completedLessonIds: string[];
  completedLessons?: string[];
  progress?: number;
  completedAt?: string;
  idempotencyKey?: string;
  updatedAt?: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  moduleTitle: string;
  moduleId?: string;
  topicId?: string;
  title: string;
  durationMinutes: number;
  videoUrl?: string;
  downloadableMaterials?: {
    title: string;
    type: 'PDF' | 'DOC' | 'CARD';
    size: string;
    url: string;
  }[];
  contentHtml?: string;
  isFreePreview?: boolean;
}

export type LiveSessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDING' | 'ENDED' | 'RECORDING_READY';

export interface LiveSession {
  id: string;
  batchId: string;
  courseId: string;
  title: string;
  scheduledStartTime: string;
  actualStartTime?: string;
  startedAt?: string;
  durationMinutes: number;
  instructorId: string;
  meetingId: string;
  status: LiveSessionStatus;
  recordingUrl?: string;
  recordingDurationMinutes?: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  userId: string;
  joinedAt: string;
  leftAt?: string;
  durationMinutes: number;
  attended: boolean;
}

// Examination Engine Types
export type QuestionType = 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'TRUE_FALSE' | 'SCENARIO_BASED' | 'CALCULATION' | 'SINGLE_CHOICE';
export type QuestionDifficulty = 'EASY' | 'MODERATE' | 'HARD';

export interface ExamQuestion {
  id: string;
  certificationType: CertificationType | string;
  domain: string; // e.g. "Domain 1: Advanced Safety Sciences and Math"
  topic: string;
  stem: string;
  type: QuestionType;
  difficulty?: QuestionDifficulty;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  options: {
    id: string;
    text: string;
  }[];
  correctOptionIds: string[]; // Server authoritative; stripped on client exam delivery
  explanation: string;
  referenceSource: string;
  points?: number;
  rubricCriteria?: {
    id: string;
    title?: string;
    name?: string;
    maxPoints: number;
    description?: string;
  }[];
}

export type BlueprintStatus = 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export interface ExamBlueprint {
  id: string;
  certificationType: CertificationType | string;
  title: string;
  version?: number;
  status?: BlueprintStatus;
  totalQuestions: number;
  durationMinutes: number;
  passingScorePercent: number;
  gracePeriodSeconds?: number;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  domains: {
    name: string;
    weightPercent: number;
    questionCount: number;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FrozenExamQuestionSnapshot {
  id: string;
  version?: number;
  domain: string;
  topic?: string;
  stem: string;
  type: QuestionType;
  options: { id: string; text: string }[];
  points?: number;
  rubricCriteria?: { id: string; name?: string; title?: string; maxPoints: number; description?: string }[];
  correctOptionIds: string[]; // Preserved in server-side snapshot for authoritative scoring
  explanation?: string;       // Preserved in server-side snapshot for post-exam publication
}

export type ExamAttemptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'PENDING_MANUAL_EVALUATION' | 'SUBMITTED';

export interface ExamAttempt {
  id: string;
  userId: string;
  blueprintId: string;
  blueprintVersion?: number;
  courseId?: string;
  certificationType: CertificationType | string;
  status: ExamAttemptStatus;
  startTime: string;
  deadlineTime: string;
  gracePeriodSeconds?: number;
  completedTime?: string;
  assignedQuestionIds: string[];
  questionSnapshots?: FrozenExamQuestionSnapshot[]; // Immutable frozen question state at start
  answers: Record<string, string[]>; // questionId -> selectedOptionIds
  bookmarkedQuestionIds: string[];
  autosavedAt?: string;
  score?: number;
  totalScore?: number;
  passingScorePercent: number;
  passed?: boolean;
  domainBreakdown?: Record<string, { total: number; correct: number; percent: number }>;
  manualEvaluations?: Record<string, { points: number; feedback?: string; evaluatorId?: string; evaluatedAt?: string }>;
  certificateId?: string;
  certificateCode?: string;
}

export interface ExamManualEvaluation {
  id: string;
  attemptId: string;
  questionId: string;
  userId: string;
  evaluatorId: string;
  evaluatorName?: string;
  rubricCriterionId?: string;
  awardedPoints: number;
  maxPoints: number;
  feedback?: string;
  evaluatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
}

export interface OAuthCode {
  code: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  expiresAt: number;
  used: boolean;
  createdAt: string;
}

// -------------------------------------------------------------
// Assignment & Grading Rubric Types
// -------------------------------------------------------------
export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
}

export interface GradingRubric {
  id: string;
  title: string;
  criteria: RubricCriterion[];
  totalPoints: number;
}

export interface Assignment {
  id: string;
  courseId: string;
  batchId?: string; // Optional: cohort specific or course-wide
  moduleId?: string;
  topicId?: string;
  lessonId?: string;
  title: string;
  description: string;
  instructionsHtml?: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
  dueDate: string; // ISO 8601
  maxScore: number;
  rubric?: GradingRubric;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  scheduledPublishAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RubricScore {
  criterionId: string;
  score: number;
  comment?: string;
}

export interface AiReviewSuggestion {
  reviewVersion: string;
  generatedAt: string;
  rubricCriterionScores?: { criterionId: string; suggestedScore: number; reason: string }[];
  suggestedOverallScore?: number;
  conceptualFeedback?: string[];
  strengths?: string[];
  areasForImprovement?: string[];
  modelUsed?: string;
  status: 'PENDING_INSTRUCTOR_REVIEW' | 'ACCEPTED' | 'MODIFIED' | 'DISCARDED';
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  courseId?: string; // Derived from assignment
  batchId?: string; // Derived from assignment
  userId: string;
  studentName?: string;
  studentEmail?: string;
  submissionText?: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
  submittedAt: string;
  status: 'SUBMITTED' | 'GRADED' | 'RESUBMISSION_REQUESTED';
  score?: number;
  feedback?: string;
  rubricScores?: RubricScore[];
  aiReviewSuggestions?: AiReviewSuggestion;
  gradedByUserId?: string;
  gradedAt?: string;
  version?: number;
  previousSubmissionText?: string;
  previousAttachmentUrl?: string;
  resubmissionRequestedAt?: string;
  resubmissionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassroomAnnouncementAttachment {
  title: string;
  url: string;
  type?: 'DOCUMENT' | 'PDF' | 'LINK' | 'IMAGE';
}

export interface ClassroomComment {
  id: string;
  announcementId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface ClassroomAnnouncement {
  id: string;
  courseId: string;
  batchId?: string;
  audienceScope?: 'COURSE_WIDE' | 'BATCH_SPECIFIC';
  status?: 'PUBLISHED' | 'ARCHIVED';
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  attachments?: ClassroomAnnouncementAttachment[];
  comments?: ClassroomComment[];
  isPinned?: boolean;
  scheduledPublishAt?: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Phase 5A: In-App Notification Center Types
// -------------------------------------------------------------
export type NotificationType =
  | 'ANNOUNCEMENT_NEW'
  | 'ASSIGNMENT_PUBLISHED'
  | 'ASSIGNMENT_SUBMITTED'
  | 'ASSIGNMENT_GRADED'
  | 'RESUBMISSION_REQUESTED'
  | 'DOUBT_REPLIED'
  | 'LIVE_SESSION_SCHEDULED'
  | 'EXAM_UPDATE'
  | 'SUPPORT_TICKET_UPDATE'
  | 'SYSTEM_ALERT';

export interface InAppNotification {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  description: string;
  entityType?: 'ANNOUNCEMENT' | 'ASSIGNMENT' | 'SUBMISSION' | 'DOUBT' | 'LIVE_SESSION' | 'EXAM' | 'SUPPORT_TICKET' | 'SYSTEM';
  entityId?: string;
  courseId?: string;
  batchId?: string;
  actionUrl: string;
  isRead: boolean;
  readAt?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Phase 5B: Transactional Email Dispatch Engine Types
// -------------------------------------------------------------
export type EmailOutboxStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'DELIVERED'
  | 'RETRY_PENDING'
  | 'FAILED'
  | 'BOUNCED'
  | 'SUPPRESSED'
  | 'CANCELLED';

export type EmailErrorClassification =
  | 'TRANSIENT_NETWORK'
  | 'RATE_LIMIT'
  | 'INVALID_RECIPIENT'
  | 'AUTH_FAILURE'
  | 'PERMANENT_REJECTION'
  | 'SUPPRESSED'
  | 'UNCONFIGURED';

export interface EmailOutboxJob {
  id: string;
  sourceEventId?: string;
  eventType: string;
  recipientUserId?: string;
  recipientEmail: string;
  recipientName?: string;
  templateId: string;
  templateVersion: string;
  templateVariables: Record<string, any>;
  subject: string;
  htmlBody: string;
  textBody: string;
  status: EmailOutboxStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  lastAttemptAt?: string;
  lockedAt?: string;
  lockedBy?: string;
  provider: string;
  providerMessageId?: string;
  errorMessage?: string;
  errorClassification?: EmailErrorClassification;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDeliveryEvent {
  id: string;
  outboxId?: string;
  provider: string;
  providerMessageId?: string;
  eventType: 'accepted' | 'delivered' | 'bounced' | 'complained' | 'rejected' | 'opened' | 'clicked';
  recipientEmail: string;
  rawPayload: Record<string, any>;
  occurredAt: string;
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  eventType: string;
  version: string;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
  requiredVariables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserNotificationPreference {
  id: string;
  userId: string;
  channel: 'EMAIL' | 'IN_APP';
  category: 'ANNOUNCEMENTS' | 'ASSIGNMENTS' | 'GRADES' | 'LIVE_SESSIONS' | 'DOUBTS' | 'SECURITY';
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Recurring Class Schedule Definition
// -------------------------------------------------------------
export interface RecurringScheduleRule {
  daysOfWeek: number[]; // 0 = Sun, 1 = Mon ... 6 = Sat
  startTime: string; // "19:00"
  durationMinutes: number; // 120
  timeZone: string; // "Asia/Kolkata"
}

// -------------------------------------------------------------
// Commerce, Invoicing & Reporting Types
// -------------------------------------------------------------
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type PaymentGateway = 'RAZORPAY' | 'STRIPE' | 'MANUAL';

export type TaxTreatment =
  | 'INTRA_STATE_GST'       // CGST (9%) + SGST (9%)
  | 'INTER_STATE_GST'       // IGST (18%)
  | 'EXPORT_ZERO_RATED_LUT' // 0% under validated Letter of Undertaking
  | 'EXPORT_TAXABLE'        // Export without verified LUT (18% IGST)
  | 'EXEMPT'                // Exempt supply
  | 'TAX_REVIEW_REQUIRED';  // Missing/unverified place of supply or customer class

export interface TaxProfile {
  id: string;
  version: number;
  supplierLegalName: string;
  supplierGstin: string;
  supplierStateCode: string; // '32'
  supplierStateName: string; // 'Kerala'
  sacCode: string;           // '999293'
  standardRatePercent: number;
  cgstRatePercent: number;
  sgstRatePercent: number;
  igstRatePercent: number;
  lutArn?: string;
  lutFinancialYear?: string;
  lutValidFrom?: string;
  lutValidUntil?: string;
  lutVerified: boolean;
  effectiveFrom: string;
  effectiveUntil?: string;
  isActive: boolean;
  notes?: string;
}

export interface TaxDeterminationInput {
  orderAmount?: number;
  amount?: number;
  currency: string;
  billingAddress: BillingAddress;
  courseId?: string;
  recipientGstin?: string;
  isConvertibleForeignExchange?: boolean;
  isDistinctEstablishment?: boolean;
  isExportDeclared?: boolean;
}

export interface TaxDeterminationResult {
  taxTreatment: TaxTreatment;
  subtotal: number;
  taxAmount: number;
  taxRatePercent?: number;
  cgstRatePercent: number;
  cgstAmount: number;
  sgstRatePercent: number;
  sgstAmount: number;
  igstRatePercent: number;
  igstAmount: number;
  totalAmount: number;
  placeOfSupplyStateCode?: string;
  placeOfSupplyStateName?: string;
  isExport: boolean;
  exportEligible?: boolean;
  lutReference?: string;
  taxReviewReasons?: string[];
  notes?: string[];
  determinationAudit: {
    ruleApplied: string;
    supplierStateCode: string;
    recipientStateCode?: string;
    recipientCountry: string;
    statutoryRef: string;
    timestamp: string;
  };
}

export interface PaymentWebhookEvent {
  id: string;
  gateway?: PaymentGateway;
  provider?: 'RAZORPAY' | 'STRIPE';
  eventId: string;
  orderId?: string;
  paymentId?: string;
  eventType: string;
  signatureVerified?: boolean;
  status?: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'DUPLICATE_IGNORED';
  processed?: boolean;
  processingError?: string;
  errorMessage?: string;
  payloadDigest?: string;
  payloadHash?: string;
  createdAt?: string;
  receivedAt?: string;
  processedAt?: string;
}

export interface PaymentOrder {
  id: string; // e.g. "ord_asp_98234"
  userId: string;
  userEmail: string;
  userName: string;
  courseId: string;
  batchId: string;
  offeringId?: string;
  currency: 'INR' | 'USD';
  amount: number;
  status: PaymentStatus;
  refundStatus?: 'NONE' | 'REQUESTED' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  taxTreatment?: TaxTreatment;
  gateway: PaymentGateway;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewayRefundId?: string;
  refundReason?: string;
  refundedAt?: string;
  failureReason?: string;
  failedAt?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  billingAddress?: BillingAddress;
  invoiceId?: string;
  enrollmentId?: string;
  idempotencyKey?: string;
  createdAt: string;
  paidAt?: string;
}

export interface BillingAddress {
  companyName?: string;
  street?: string;
  city?: string;
  state?: string;
  stateCode?: string; // e.g. "32" for Kerala, "27" for Maharashtra
  postalCode?: string;
  country?: string;
  taxId?: string; // GSTIN / Tax ID
}

export interface InvoiceRecord {
  id: string; // e.g. "inv-2026-001"
  invoiceNumber: string; // e.g. "INV-2026-8491"
  orderId: string;
  userId: string;
  userName: string;
  userEmail: string;
  billingAddress?: BillingAddress;
  courseId: string;
  courseTitle: string;
  batchId: string;
  batchName: string;
  subtotal: number;
  taxRatePercent: number; // e.g. 18 for GST
  taxAmount: number;
  cgstRatePercent?: number;
  cgstAmount?: number;
  sgstRatePercent?: number;
  sgstAmount?: number;
  igstRatePercent?: number;
  igstAmount?: number;
  totalAmount: number;
  currency: 'INR' | 'USD';
  status: 'ISSUED' | 'PAID' | 'VOID' | 'REFUNDED';
  issuedAt: string;
  paidAt?: string;
  hsnCode: string; // "999293" (Training & Education Services)
  providerGstin: string; // "32AABCZ1234F1Z5"
  providerGstinVerified?: boolean;
  placeOfSupplyStateCode?: string;
  placeOfSupplyStateName?: string;
  isExport?: boolean;
  lutReference?: string;
  taxTreatment?: TaxTreatment;
  paymentMethod?: string;
  transactionRef?: string;
  creditNoteId?: string;
}

export interface InvoiceCreditNote {
  id: string;
  creditNoteNumber: string; // e.g. "CN-2026-0001"
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  orderId: string;
  userId: string;
  userName: string;
  userEmail: string;
  reason: string;
  subtotal: number;
  taxAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalAmount: number;
  currency: 'INR' | 'USD';
  issuedAt: string;
  issuedByUserId: string;
}

export type ReportDataset = 'enrollments' | 'exams' | 'certificates' | 'revenue';
export type ReportFormat = 'csv' | 'json';

// ============================================================================
// Class Recordings, Topic Highlights, References & Interactive Doubts
// ============================================================================
export type RecordingStorageProvider = 'SUPABASE_STORAGE' | 'S3_COMPATIBLE' | 'BIGBLUEBUTTON' | 'EXTERNAL_SECURE';
export type RecordingStatus = 'PROCESSING' | 'AVAILABLE' | 'ARCHIVED' | 'REVOKED';
export type GrantStatus = 'ACTIVE' | 'REVOKED';
export type ResourceType = 'PDF' | 'SLIDES' | 'URL' | 'CODE' | 'NOTES';
export type DoubtStatus = 'OPEN' | 'RESOLVED' | 'CLARIFICATION_REQUESTED';

export interface ClassRecording {
  id: string;
  sessionId: string;
  courseId: string;
  batchId: string;
  title: string;
  description?: string;
  storageProvider: RecordingStorageProvider;
  storagePath: string;
  mediaUrl: string;
  durationSeconds: number;
  fileSizeBytes: number;
  status: RecordingStatus;
  isDownloadable: boolean;
  allowDownload?: boolean;
  availableFrom: string;
  expiresAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Optional relations
  highlights?: RecordingHighlight[];
  resources?: RecordingResource[];
  doubts?: RecordingDoubt[];
  batchAccessGrants?: RecordingBatchAccess[];
}

export interface RecordingBatchAccess {
  id: string;
  recordingId: string;
  sourceBatchId: string;
  targetBatchId: string;
  allowDownload: boolean;
  status: GrantStatus;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  createdAt: string;
}

export interface RecordingHighlight {
  id: string;
  recordingId: string;
  title: string;
  description?: string;
  startTimestampSeconds: number;
  endTimestampSeconds: number;
  topicId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordingResource {
  id: string;
  recordingId: string;
  highlightId?: string;
  title: string;
  description?: string;
  resourceType: ResourceType;
  url: string;
  fileSizeBytes?: number;
  timestampSeconds?: number;
  uploadedBy: string;
  createdAt: string;
}

export interface RecordingDoubtAnswer {
  id: string;
  doubtId: string;
  instructorId: string;
  instructorName?: string;
  answerText: string;
  referenceUrl?: string;
  createdAt: string;
}

export interface RecordingDoubt {
  id: string;
  recordingId: string;
  userId: string;
  userName?: string;
  userRole?: string;
  timestampSeconds: number;
  highlightId?: string;
  question: string;
  status: DoubtStatus;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  answers?: RecordingDoubtAnswer[];
}

// ============================================================================
// Phase 1 Core Foundations Domain Types
// ============================================================================

export type ProfileStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role?: UserRole;
  status: ProfileStatus;
  failedLoginCount: number;
  lockedUntil?: string;
  mfaEnabled: boolean;
  emailVerified?: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiresAt?: number;
  tokenVersion?: number;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MfaFactor {
  id: string;
  userId: string;
  factorType: 'totp';
  friendlyName?: string;
  status: 'unverified' | 'verified';
  secret: string;
  qrCodeUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MfaChallenge {
  id: string;
  factorId: string;
  userId: string;
  expiresAt: number;
  verified: boolean;
  createdAt: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  registrationNumber?: string;
  emergencyContact?: string;
  educationalBackground?: string;
  educationLevel?: string;
  professionalAffiliation?: string;
  idCardNumber?: string;
  industryExperienceYears?: number;
  currentEmployer?: string;
  currentDesignation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorProfile {
  id: string;
  userId: string;
  designation?: string;
  biography?: string;
  specializations: string[];
  credentials: string[];
  officeHours?: string;
  maxWeeklyHours?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  role: UserRole;
  isPrimary: boolean;
  assignedAt: string;
  assignedBy?: string;
}

export interface AuthAuditEvent {
  id: string;
  timestamp: string;
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  tokenHash: string;
  deviceLabel?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  revoked: boolean;
  revokedAt?: string;
  revokedByUserId?: string;
  revocationReason?: string;
  isCurrent?: boolean;
}

export type MediaAssetStatus = 'PENDING_UPLOAD' | 'AVAILABLE' | 'FAILED' | 'DELETED';

export interface MediaAsset {
  id: string;
  provider: string;
  bucket: string;
  objectKey: string;
  displayFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256?: string;
  ownerUserId?: string;
  status: MediaAssetStatus;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordResetToken {
  token: string;
  userId: string;
  email: string;
  expiresAt: number;
  used: boolean;
  createdAt: string;
}

// --------------------------------------------------------------------------
// Academic Hierarchy Types
// --------------------------------------------------------------------------
export type AcademicHierarchyStatus = 'PLANNING' | 'ACTIVE' | 'ARCHIVED';

export interface AcademicYear {
  id: string;
  name: string;
  code?: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: AcademicHierarchyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  headInstructorId?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface Programme {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  credentialTitle?: string;
  description?: string;
  durationMonths: number;
  qualificationLevel?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  programmeId?: string;
  title: string;
  code?: string;
  description?: string;
  deliveryMode: 'RECORDED' | 'LIVE' | 'HYBRID' | 'MATERIALS_ONLY';
  displayOrder: number;
  orderIndex?: number;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  learningObjectives?: string[];
  displayOrder: number;
  orderIndex?: number;
  estimatedMinutes?: number;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface Subtopic {
  id: string;
  topicId: string;
  title: string;
  code?: string;
  description?: string;
  displayOrder: number;
  orderIndex?: number;
  contentSummary?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface AcademicHierarchyTree {
  academicYears: AcademicYear[];
  departments: Array<
    Department & {
      programmes: Array<
        Programme & {
          courses: Array<
            Course & {
              modules: Array<
                CourseModule & {
                  topics: Array<
                    Topic & {
                      subtopics: Subtopic[];
                    }
                  >;
                }
              >;
            }
          >;
        }
      >;
    }
  >;
}

// --------------------------------------------------------------------------
// Admissions & Student Lifecycle Types
// --------------------------------------------------------------------------
export type AdmissionsPipelineStage =
  | 'NEW'
  | 'CONTACTED'
  | 'APPLICATION_STARTED'
  | 'SUBMITTED'
  | 'DOCUMENT_REVIEW'
  | 'ELIGIBILITY_REVIEW'
  | 'ORIENTATION_PENDING'
  | 'APPROVED'
  | 'OFFER_PAYMENT_PENDING'
  | 'ADMITTED'
  | 'WAITLISTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'CLOSED';

export type AdmissionStatus =
  | AdmissionsPipelineStage
  | 'DRAFT'
  | 'UNDER_REVIEW';

export type DocumentType =
  | 'ID_PROOF'
  | 'DEGREE_CERTIFICATE'
  | 'QUALIFICATION_CERTIFICATE'
  | 'EXPERIENCE_LETTER'
  | 'RESUME'
  | 'OTHER';

export type ApplicantDocumentStatus =
  | 'REQUIRED'
  | 'UPLOADED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'RESUBMISSION_REQUESTED'
  | 'SUPERSEDED';

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  applicantUserId?: string;
  documentType: DocumentType;
  filename: string;
  fileName?: string;
  storagePath: string;
  mediaAssetId?: string;
  fileSizeBytes: number;
  fileSize?: number;
  mimeType: string;
  uploadedAt: string;
  isVerified: boolean;
  verified?: boolean;
  status?: ApplicantDocumentStatus;
  rejectionReason?: string;
  reviewerUserId?: string;
  reviewedAt?: string;
  version?: number;
}

export interface AdmissionApplication {
  id: string;
  applicationNumber: string;
  userId?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  courseId: string;
  offeringId?: string;
  preferredBatchId?: string;
  statementOfPurpose?: string;
  educationLevel?: string;
  industryExperienceYears?: number;
  currentEmployer?: string;
  currentDesignation?: string;
  status: AdmissionStatus;
  pipelineStage?: AdmissionsPipelineStage;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdEnrollmentId?: string;
  documents?: ApplicationDocument[];
  stageHistory?: Array<{
    stage: AdmissionsPipelineStage;
    changedAt: string;
    changedBy: string;
    reason?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentTransfer {
  id: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  sourceBatchId: string;
  targetBatchId: string;
  reason: string;
  transferredBy: string;
  approvedBy?: string;
  transferredAt: string;
  status: 'COMPLETED' | 'REVERTED';
}

export interface EnrollmentWithdrawal {
  id: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  batchId: string;
  reason: string;
  withdrawnBy: string;
  withdrawnAt: string;
  effectiveDate: string;
  refundAmount?: number;
}

export interface BulkImportRowError {
  row: number;
  email?: string;
  error: string;
}

export interface BulkImportOptions {
  defaultCourseId?: string;
  mode?: 'PENDING_REVIEW' | 'AUTO_ENROLL';
  autoApprove?: boolean;
  authorizedBy?: string;
}

export interface BulkImportResult {
  totalRows: number;
  importedCount: number;
  failedCount: number;
  errors: BulkImportRowError[];
  createdApplicationIds: string[];
  createdEnrollmentIds: string[];
  pendingReviewCount?: number;
  mode?: 'PENDING_REVIEW' | 'AUTO_ENROLL';
  policyNotice?: string;
}

// ============================================================================
// Phase 2 Learning Delivery & Academic Experience Domain Types
// ============================================================================

export type DeliveryMode = 'ONLINE_ONLY' | 'RECORDED_ONLY' | 'HYBRID' | 'ALL_MODES';

export interface DeliveryConfiguration {
  id?: string;
  entityType: 'COURSE' | 'BATCH' | 'MODULE' | 'TOPIC' | 'SUBTOPIC' | 'STUDENT_EXCEPTION' | 'STUDENT' | string;
  entityId: string;
  deliveryMode: DeliveryMode;
  liveSessionsEnabled?: boolean;
  recordedLessonsEnabled?: boolean;
  downloadableMaterialsEnabled?: boolean;
  releaseDate?: string;
  accessEndDate?: string;
  settings?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface EffectiveDeliveryConfig {
  deliveryMode: DeliveryMode;
  effectiveMode?: DeliveryMode | string;
  liveSessionsEnabled: boolean;
  allowLiveClassroom?: boolean;
  recordedLessonsEnabled: boolean;
  allowRecordedLessons?: boolean;
  downloadableMaterialsEnabled: boolean;
  allowMaterialDownloads?: boolean;
  isLiveAccessible: boolean;
  isRecordedAccessible: boolean;
  isMaterialsDownloadable: boolean;
  source: 'COURSE' | 'BATCH' | 'MODULE' | 'STUDENT_EXCEPTION' | 'DEFAULT';
  inheritedFrom?: string;
}

export type MaterialType = 'PDF' | 'DOCUMENT' | 'PRESENTATION' | 'IMAGE' | 'EXTERNAL_LINK' | 'BLUEPRINT' | 'HANDOUT';

export interface LearningMaterial {
  id: string;
  courseId: string;
  batchId?: string;
  moduleId?: string;
  lessonId?: string;
  topicId?: string;
  subtopicId?: string;
  sessionId?: string; // Preloaded live session material linkage
  title: string;
  displayName?: string; // Learner-facing display name separate from original filename
  originalFilename?: string; // Original uploaded file name
  description?: string;
  presenterNotes?: string; // Instructor presenter notes (hidden from learners)
  materialType: MaterialType;
  storagePath?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  fileUrl?: string;
  fileFormat?: string;
  sortOrder?: number;
  watermarkEnabled?: boolean;
  allowView?: boolean;
  allowDownload?: boolean;
  allowPrint?: boolean;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  lifecycleState?: 'DRAFT' | 'SCHEDULED' | 'AVAILABLE' | 'PRESENTED' | 'SKIPPED' | 'POSTPONED' | 'CANCELLED';
  releaseCondition?: 'PRE_CLASS' | 'CLASS_START' | 'ELAPSED_TIME' | 'MANUAL' | 'SCHEDULED';
  releaseOffsetMinutes?: number;
  scheduledReleaseTime?: string;
  isReleased?: boolean;
  releasedAt?: string;
  presentedAt?: string;
  postponedReason?: string;
  cancelledReason?: string;
  uploadedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type QuizType =
  | 'TOPIC_QUIZ'
  | 'SUBTOPIC_QUIZ'
  | 'LESSON_END_QUIZ'
  | 'MODULE_QUIZ'
  | 'PRACTICE_QUIZ'
  | 'PRACTICE_DRILL'
  | 'LIVE_CLASS_QUIZ';

export type QuizQuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'NUMERICAL'
  | 'MATCHING'
  | 'ORDERING'
  | 'ESSAY';

export interface QuizQuestionOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  questionType: QuizQuestionType;
  options: QuizQuestionOption[];
  correctAnswer: any; // Server authoritative only; stripped from student payloads
  explanation?: string;
  marks?: number;
  points?: number;
  orderIndex?: number;
  sortOrder?: number;
  createdAt?: string;
}

export interface Quiz {
  id: string;
  courseId: string;
  batchId?: string;
  lessonId?: string;
  moduleId?: string;
  topicId?: string;
  subtopicId?: string;
  title: string;
  description?: string;
  quizType: QuizType;
  totalMarks?: number;
  passingScorePercentage?: number;
  passingScorePercent?: number;
  durationMinutes?: number;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  allowReview?: boolean;
  isLiveActive?: boolean;
  liveSessionId?: string;
  scheduledStartTime?: string; // Scheduled opening time (ISO 8601)
  scheduledEndTime?: string; // Scheduled closing time (ISO 8601)
  timezone?: string; // e.g. "Asia/Kolkata"
  scoreSelection?: 'HIGHEST' | 'LATEST' | 'FIRST' | 'AVERAGE';
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdBy?: string;
  questionsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  userName?: string;
  batchId?: string;
  attemptNumber: number;
  startTime: string;
  endTime?: string;
  deadline?: string; // Server-authoritative calculated deadline (ISO 8601)
  timeLimitMinutes?: number;
  frozenQuestions?: QuizQuestion[]; // Immutable snapshot of questions at attempt creation
  score?: number;
  maxScore?: number;
  percentage?: number;
  scorePercent?: number;
  passed?: boolean;
  isPassed?: boolean;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'TIMED_OUT' | 'GRADED';
  answers: Record<string, any>;
  liveSessionId?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Academic Activity Feed & Tutor Workspace Read Model Types
// -------------------------------------------------------------
export type ActivityCategory =
  | 'MATERIAL_RELEASED'
  | 'QUIZ_PUBLISHED'
  | 'QUIZ_SUBMITTED'
  | 'QUIZ_GRADED'
  | 'ASSIGNMENT_PUBLISHED'
  | 'ASSIGNMENT_SUBMITTED'
  | 'ASSIGNMENT_GRADED'
  | 'RESUBMISSION_REQUESTED'
  | 'LIVE_SESSION_SCHEDULED'
  | 'LIVE_SESSION_STARTED'
  | 'ANNOUNCEMENT_POSTED';

export interface AcademicActivityEvent {
  id: string;
  category: ActivityCategory;
  title: string;
  description: string;
  courseId: string;
  courseName?: string;
  batchId?: string;
  batchName?: string;
  moduleId?: string;
  lessonId?: string;
  sessionId?: string;
  entityType: 'MATERIAL' | 'QUIZ' | 'ASSIGNMENT' | 'ANNOUNCEMENT' | 'LIVE_SESSION';
  entityId: string;
  actorId?: string;
  actorName?: string;
  actorRole?: UserRole;
  targetUserId?: string; // Optional: If specific to one student (e.g. grading/resubmission)
  actionUrl?: string;
  metadata?: Record<string, any>;
  readByUserIds?: string[];
  createdAt: string;
}

export interface LiveScoreStudentEntry {
  userId: string;
  displayName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  status: string;
  submittedAt?: string;
}

export interface LiveScoreQuestionStat {
  questionId: string;
  questionText: string;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  percentCorrect?: number;
  optionBreakdown?: Record<string, number>;
}

export interface LiveScoreDashboardData {
  quizId: string;
  liveSessionId: string;
  totalEligibleParticipants: number;
  participantCount?: number;
  currentlyParticipatingCount: number;
  submittedCount: number;
  remainingCount: number;
  averageScore: number;
  averageScorePercent?: number;
  highestScore: number;
  lowestScore: number;
  studentScores: LiveScoreStudentEntry[];
  students?: LiveScoreStudentEntry[];
  questionStats: LiveScoreQuestionStat[];
}

export type LearningActivityType =
  | 'VIDEO'
  | 'TEXT'
  | 'DOCUMENT'
  | 'QUIZ'
  | 'ASSIGNMENT'
  | 'LIVE_CLASS'
  | 'PRERECORDED_VIDEO';

export interface LearningProgressRecord {
  id: string;
  userId: string;
  courseId: string;
  batchId?: string;
  lessonId?: string;
  moduleId?: string;
  topicId?: string;
  subtopicId?: string;
  activityType: LearningActivityType;
  playbackPositionSeconds?: number;
  lastPlaybackPositionSeconds: number;
  watchedDurationSeconds: number;
  totalDurationSeconds?: number;
  completionPercentage: number;
  isCompleted: boolean;
  completedAt?: string;
  bookmarks?: any[];
  notes?: string;
  lastActivityAt: string;
}

export interface CourseCompletionPolicy {
  id: string;
  courseId: string;
  version: number;
  requiredLessonCompletionPercentage: number;
  minLessonsCompletedPercent?: number;
  requiredLiveAttendancePercentage: number;
  minLiveAttendancePercent?: number;
  requireAllAssignmentsPassed: boolean;
  requireAllQuizzesPassed: boolean;
  requireFormalExamPassed: boolean;
  requireFormalExamPass?: boolean;
  minimumExamScorePercentage: number;
  minQuizAveragePercent?: number;
  mandatoryAssignmentIds?: string[];
  isActive: boolean;
  createdAt: string;
}

export interface CompletionEvaluation {
  id: string;
  enrollmentId: string;
  userId: string;
  courseId: string;
  batchId: string;
  policyId: string;
  policyVersion: number;
  isCompleted: boolean;
  completionDate?: string;
  lessonsCompletedCount: number;
  totalLessonsCount: number;
  lessonCompletionPercentage: number;
  attendancePercentage: number;
  assignmentsPassedCount: number;
  totalAssignmentsCount: number;
  quizzesPassedCount: number;
  totalQuizzesCount: number;
  examPassed?: boolean;
  formalExamPassed?: boolean;
  examScorePercentage?: number;
  formalExamScorePercentage?: number;
  criteriaResults: Record<string, boolean>;
  criteriaBreakdown?: any;
  evaluatedAt: string;
}

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'FATAL';

export type BugResolutionStatus =
  | 'NEW'
  | 'DETECTED'
  | 'GROUPED'
  | 'PRIORITIZED'
  | 'INVESTIGATING'
  | 'FIXING'
  | 'RESOLVED'
  | 'VERIFIED';

export interface AppErrorLog {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  module: string;
  routeOrService?: string;
  requestId?: string;
  requestUrl?: string;
  requestMethod?: string;
  metadata?: Record<string, any>;
  userEmail?: string;
  userId?: string;
  errorCode?: string;
  errorMessage: string;
  errorStack?: string;
  stackTrace?: string;
  componentStack?: string;
  status: BugResolutionStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  fingerprint?: string;
}

// --------------------------------------------------------------------------
// Phase 5C.1: Live Bug Monitoring, Centralized Diagnostics & Observability
// --------------------------------------------------------------------------

export type DiagnosticCategory =
  | 'FRONTEND_RUNTIME'
  | 'FRONTEND_NETWORK'
  | 'API_FAILURE'
  | 'DATABASE_FAILURE'
  | 'AUTH_FAILURE'
  | 'ACADEMIC_WORKFLOW'
  | 'EXAMINATION_FAILURE'
  | 'INTEGRATION_FAILURE'
  | 'WORKER_FAILURE'
  | 'CONFIG_FAILURE';

export type DiagnosticSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type DiagnosticIssueStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'REOPENED' | 'IGNORED' | 'ARCHIVED';

export type DiagnosticSource = 'FRONTEND' | 'BACKEND' | 'WORKER' | 'DATABASE' | 'INTEGRATION';

export interface DiagnosticIssue {
  id: string;
  fingerprint: string;
  title: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  status: DiagnosticIssueStatus;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  affectedRoutes: string[];
  affectedServices: string[];
  lastCorrelationId?: string;
  lastErrorMessage: string;
  sampleStackTrace?: string;
  sampleComponentStack?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticEvent {
  id: string;
  issueId: string;
  correlationId: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  source: DiagnosticSource;
  route?: string;
  service?: string;
  method?: string;
  statusCode?: number;
  errorCode?: string;
  sanitizedMessage: string;
  stackTrace?: string;
  componentStack?: string;
  userId?: string;
  userEmail?: string;
  clientInfo?: {
    userAgent?: string;
    ip?: string;
    url?: string;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}

export type ServiceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNCONFIGURED';

export interface ServiceHealthCheck {
  serviceName: 'supabase' | 'moodle' | 'bigbluebutton' | 'ollama' | 'email' | string;
  status: ServiceHealthStatus;
  latencyMs?: number;
  message: string;
  checkedAt: string;
  details?: Record<string, any>;
}

export interface SystemHealthOverview {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  services: Record<string, ServiceHealthCheck>;
  openCriticalIssues: number;
  openHighIssues: number;
  totalOpenIssues: number;
  eventsLast24Hours: number;
  checkedAt: string;
}

export type ProblemReportCategory =
  | 'VIDEO_PLAYBACK'
  | 'LESSON_ACCESS'
  | 'DOCUMENT_DOWNLOAD'
  | 'ASSIGNMENT_SUBMISSION'
  | 'QUIZ_ATTEMPT'
  | 'LIVE_CLASSROOM'
  | 'OTHER';

export interface StudentProblemReport {
  id: string;
  reportNumber: string;
  ticketNumber?: string;
  title?: string;
  userId: string;
  userName?: string;
  userEmail: string;
  courseId?: string;
  batchId?: string;
  sessionId?: string;
  lessonId?: string;
  category: ProblemReportCategory;
  description: string;
  assignedTo?: string;
  resolutionNotes?: string;
  deviceInfo?: any;
  attachments?: any[];
  clientMetadata?: Record<string, any>;
  status: 'NEW' | 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId?: string;
  courseId: string;
  batchId?: string;
  subject?: string;
  content: string;
  read: boolean;
  readAt?: string;
  clientMessageId?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================================================
// Phase 6: Advanced Academic Workflows & Enterprise Scale Types
// ============================================================================

// 1. Student Progression & Mastery Hierarchy
export interface LessonProgressionRecord {
  lessonId: string;
  title: string;
  isCompleted: boolean;
  completedAt?: string;
  required: boolean;
}

export interface TopicProgressionRecord {
  topicId: string;
  title: string;
  totalLessons: number;
  completedLessons: number;
  isCompleted: boolean;
  lessons: LessonProgressionRecord[];
}

export interface ModuleProgressionRecord {
  moduleId: string;
  title: string;
  totalTopics: number;
  completedTopics: number;
  isCompleted: boolean;
  topics: TopicProgressionRecord[];
}

export interface StudentCourseProgression {
  userId: string;
  courseId: string;
  batchId?: string;
  progressPercent: number;
  totalLessonsCount: number;
  completedLessonsCount: number;
  attendancePercent: number;
  quizzesCompletedCount: number;
  quizzesPassedCount: number;
  assignmentsCompletedCount: number;
  isCourseEligibleForCompletion: boolean;
  modules: ModuleProgressionRecord[];
  lastActivityAt?: string;
}

export interface ProgressionCorrectionAudit {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  action: 'COMPLETION_REOPENED' | 'COMPLETION_GRANTED';
  reason: string;
  actorUserId: string;
  timestamp: string;
}

// 2. Instructor Academic Intervention & Cohort Operations
export type InterventionType = 'ATTENDANCE_WARNING' | 'PROGRESS_BEHIND' | 'ASSESSMENT_RETAKE' | 'CUSTOM';
export type InterventionStatus = 'ACTIVE' | 'RESOLVED' | 'DISMISSED';

export interface AcademicIntervention {
  id: string;
  batchId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  instructorId: string;
  instructorName: string;
  reason: string;
  status: InterventionStatus;
  interventionType: InterventionType;
  notes?: string;
  actionTaken?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface CreateInterventionInput {
  batchId: string;
  courseId: string;
  studentId: string;
  reason: string;
  interventionType: InterventionType;
  notes?: string;
}

export interface CohortAtRiskStudent {
  studentId: string;
  studentName: string;
  studentEmail: string;
  progressPercent: number;
  attendancePercent: number;
  failedQuizzesCount: number;
  pendingAssignmentsCount: number;
  riskFactors: string[];
  lastActivityAt?: string;
}

export interface CohortInterventionOverview {
  batchId: string;
  batchName: string;
  courseId: string;
  courseTitle: string;
  totalStudents: number;
  atRiskCount: number;
  activeInterventionsCount: number;
  atRiskStudents: CohortAtRiskStudent[];
  activeInterventions: AcademicIntervention[];
}

// 3. Assessment Intelligence & Performance Diagnostics
export interface QuestionPerformanceDiagnostic {
  questionId: string;
  prompt: string;
  difficultyIndex: number; // p-value: % correct (0.00 - 1.00)
  discriminationIndex: number; // Correlation between top/bottom quartiles (-1.00 - 1.00)
  totalAttempts: number;
  correctCount: number;
  commonDistractors: {
    optionId: string;
    optionText: string;
    pickCount: number;
    pickPercentage: number;
  }[];
}

export interface TopicMasteryDiagnostic {
  topicId: string;
  topicTitle: string;
  totalQuestions: number;
  totalAttempts: number;
  accuracyPercent: number;
}

export interface QuizPerformanceAnalytics {
  quizId: string;
  quizTitle: string;
  totalAttempts: number;
  averageScore: number;
  averageScorePercent?: number;
  passingRatePercent: number;
  scoreDistribution: {
    band: string; // e.g. "90-100%", "80-89%"
    count: number;
  }[];
  questionDiagnostics: QuestionPerformanceDiagnostic[];
  topicMastery: TopicMasteryDiagnostic[];
}

export interface StudentAttemptComparison {
  studentId: string;
  quizId: string;
  quizTitle: string;
  attemptCount: number;
  attempts: {
    attemptNumber: number;
    attemptId: string;
    scorePercent: number;
    timeSpentSeconds: number;
    completedAt: string;
  }[];
  scoreDelta: number; // Latest score - Initial score
  timeSpentDeltaSeconds: number;
  trajectory: 'IMPROVED' | 'DECLINED' | 'STABLE';
}

// 4. AI Service Architecture & Course-Grounded RAG Seam
export type AiProviderStatus = 'UNCONFIGURED' | 'CONFIGURED' | 'DEGRADED' | 'DOWN';

export interface AiServiceHealth {
  status: AiProviderStatus;
  provider: string;
  model: string;
  isAvailable: boolean;
  latencyMs?: number;
  message?: string;
}

export interface AiTutorSourceCitation {
  moduleTitle: string;
  topicTitle?: string;
  lessonTitle?: string;
  materialName?: string;
  excerpt: string;
}

export interface AiTutorQueryRequest {
  courseId: string;
  query: string;
  lessonId?: string;
}

export interface AiTutorQueryResponse {
  answer: string;
  citations: AiTutorSourceCitation[];
  modelUsed: string;
  generatedAt: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'GROUNDED';
}

export interface AiTutorSession {
  id: string;
  userId: string;
  courseId: string;
  createdAt: string;
}

export interface AiTutorMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AiTutorSourceCitation[];
  createdAt: string;
}

export interface AiReviewActionRequest {
  submissionId: string;
  action: 'ACCEPT' | 'MODIFY' | 'DISCARD';
  modifiedScore?: number;
  modifiedFeedback?: string;
}

// --------------------------------------------------------------------------
// ZM-IMPL-08C: Commerce Decoupling, Entitlements & Provisioning Types
// --------------------------------------------------------------------------

export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';

export interface Product {
  id: string;
  courseId: string;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export type OfferingType =
  | 'COMPLETE'
  | 'VIDEO_ONLY'
  | 'DOCUMENT_ONLY'
  | 'QUESTION_BANK_ONLY'
  | 'MOCK_EXAM_ONLY'
  | 'LIVE_ONLY'
  | 'HYBRID';

export type OfferingStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';

export type EntitlementFeatureScope =
  | 'ALL'
  | 'VIDEO_LESSONS'
  | 'DOCUMENT_LIBRARY'
  | 'QUESTION_BANK'
  | 'MOCK_EXAMS'
  | 'LIVE_CLASSROOM'
  | 'HYBRID_LEARNING';

export interface ProductOffering {
  id: string;
  productId: string;
  courseId: string;
  title: string;
  offeringType: OfferingType;
  priceInr: number;
  priceUsd?: number;
  currency: 'INR' | 'USD';
  validityDays: number;
  status: OfferingStatus;
  includedEntitlements: EntitlementFeatureScope[];
  requiresAdmissionReview: boolean;
  featuresList?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type UserEntitlementStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';

export interface UserEntitlement {
  id: string;
  userId: string;
  courseId: string;
  offeringId: string;
  featureScope: EntitlementFeatureScope;
  status: UserEntitlementStatus;
  validFrom: string;
  validUntil: string;
  sourceOrderId?: string;
  revokedAt?: string;
  revocationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntitlementEvaluationResult {
  hasAccess: boolean;
  featureScope: EntitlementFeatureScope;
  status: UserEntitlementStatus | 'NOT_FOUND';
  validUntil?: string;
  reason: string;
  matchingEntitlements: UserEntitlement[];
}

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'UNRESPONSIVE' | 'LOST';

export interface Lead {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  courseInterest?: string;
  offeringInterest?: string;
  source: string; // 'WEBSITE', 'REFERRAL', 'CAMPAIGN', 'DIRECT'
  campaign?: string;
  status: LeadStatus;
  assignedTo?: string;
  notes?: string;
  convertedApplicationId?: string;
  createdAt: string;
  updatedAt: string;
}

export type AdmissionOfferStatus = 'ISSUED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface AdmissionOffer {
  id: string;
  applicationId: string;
  courseId: string;
  offeringId: string;
  offeredPriceInr: number;
  currency: 'INR' | 'USD';
  validUntil: string;
  status: AdmissionOfferStatus;
  issuedBy: string;
  issuedAt: string;
  acceptedAt?: string;
  orderId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProvisioningJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'RETRYABLE_FAILED'
  | 'TERMINAL_FAILED';

export type ProvisioningStepStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED';

export type ProvisioningStepName =
  | 'RESOLVE_IDENTITY'
  | 'SYNC_PROFILE'
  | 'ASSIGN_ROLE'
  | 'PERSIST_ADMISSION'
  | 'CREATE_ENROLLMENT'
  | 'ALLOCATE_BATCH_SEAT'
  | 'GRANT_ENTITLEMENTS'
  | 'PROVISION_CLASSROOM'
  | 'ACTIVATE_MATERIALS'
  | 'QUEUE_ONBOARDING_NOTIFICATION';

export interface ProvisioningJob {
  id: string;
  applicationId?: string;
  userId: string;
  orderId?: string;
  courseId: string;
  batchId?: string;
  offeringId?: string;
  idempotencyKey: string;
  correlationId: string;
  status: ProvisioningJobStatus;
  currentStep: ProvisioningStepName;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ProvisioningStepRecord {
  id: string;
  jobId: string;
  stepName: ProvisioningStepName;
  stepOrder: number;
  status: ProvisioningStepStatus;
  inputPayload?: any;
  outputPayload?: any;
  errorMessage?: string;
  attemptCount: number;
  startedAt?: string;
  completedAt?: string;
}

// ============================================================================
// Phase 8 Track 3: Institutional Scheduling, Orientation & Messaging Types
// ============================================================================

// 1. Unified Institutional Calendar & Scheduling
export type CalendarEventType =
  | 'BATCH_SESSION'
  | 'EXAM'
  | 'ORIENTATION'
  | 'HOLIDAY'
  | 'ACADEMIC_EVENT'
  | 'FACULTY_MEETING';

export type CalendarEventStatus =
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'RESCHEDULED'
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventType: CalendarEventType;
  courseId?: string;
  courseName?: string;
  batchId?: string;
  batchName?: string;
  instructorId?: string;
  instructorName?: string;
  startTime: string; // ISO 8601 UTC
  endTime: string; // ISO 8601 UTC
  timeZone: string; // e.g. "Asia/Kolkata"
  locationType: 'ONLINE' | 'PHYSICAL' | 'HYBRID';
  meetingId?: string;
  venueDetails?: string;
  capacity?: number;
  enrolledOrBookedCount?: number;
  status: CalendarEventStatus;
  sourceEntityId: string;
  sourceEntityType: 'BATCH' | 'LIVE_SESSION' | 'EXAM' | 'ORIENTATION' | 'HOLIDAY';
  isConflict?: boolean;
  conflictReason?: string;
}

export interface ScheduleConflict {
  type: 'INSTRUCTOR_OVERLAP' | 'BATCH_OVERLAP' | 'RESOURCE_OVERLAP' | 'ORIENTATION_OVERLAP';
  message: string;
  conflictingEventId: string;
  resourceId: string;
  timeOverlap: { start: string; end: string };
}

export interface InstitutionalHoliday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  description?: string;
  affectsBatches: boolean;
  createdAt: string;
}

export interface InstructorAvailability {
  instructorId: string;
  blockedPeriods: { start: string; end: string; reason?: string }[];
  weeklyWorkingHours: { dayOfWeek: number; startHour: number; endHour: number }[];
}

// 2. Course-Specific Orientation Booking & Admission Gating
export type OrientationMode = 'ONLINE' | 'PHYSICAL' | 'HYBRID';

export interface CourseOrientationConfig {
  courseId: string;
  isRequired: boolean;
  mode: OrientationMode;
  sessionCapacity: number;
  bookingWindowDays: number;
  instructions?: string;
  venueDetails?: string;
  reminderHoursBefore: number;
  createdAt: string;
  updatedAt: string;
}

export type OrientationSessionStatus =
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrientationSession {
  id: string;
  courseId: string;
  title: string;
  mode: OrientationMode;
  scheduledStartTime: string; // ISO 8601 UTC
  scheduledEndTime: string; // ISO 8601 UTC
  durationMinutes: number;
  timeZone: string;
  capacity: number;
  bookedCount: number;
  coordinatorId: string;
  coordinatorName: string;
  meetingId?: string;
  venueDetails?: string;
  instructions?: string;
  status: OrientationSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export type OrientationBookingStatus =
  | 'BOOKED'
  | 'CONFIRMED'
  | 'ATTENDED'
  | 'ABSENT'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'WAITLISTED';

export interface OrientationBooking {
  id: string;
  sessionId: string;
  applicationId: string;
  userId: string;
  userEmail: string;
  userName: string;
  courseId: string;
  status: OrientationBookingStatus;
  bookedAt: string;
  attendanceMarkedAt?: string;
  attendanceMarkedBy?: string;
  attendanceSource?: 'MANUAL_COORDINATOR' | 'VC_PROVIDER' | 'ADMIN_OVERRIDE';
  notes?: string;
  idempotencyKey?: string;
}

// 3. Isolated Group, Course & Batch Messaging Channels
export type ConversationType = 'DIRECT' | 'GROUP' | 'COURSE' | 'BATCH' | 'STAFF';

export type ConversationMemberRole = 'OWNER' | 'MODERATOR' | 'MEMBER';

export type ConversationMemberStatus = 'ACTIVE' | 'INVITED' | 'REQUESTED' | 'REMOVED' | 'MUTED';

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  description?: string;
  courseId?: string;
  batchId?: string;
  createdBy: string;
  isArchived: boolean;
  isCrossBatch?: boolean;
  crossBatchApprovedBy?: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  role: ConversationMemberRole;
  status: ConversationMemberStatus;
  joinedAt: string;
  addedBy?: string;
}

export interface ChannelMessageAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface ChannelMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  parentMessageId?: string; // Threading
  attachments?: ChannelMessageAttachment[];
  isPinned: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  replyCount?: number;
  clientMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ChannelModerationReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export interface ChannelModerationReport {
  id: string;
  conversationId: string;
  messageId: string;
  reportedBy: string;
  reason: string;
  status: ChannelModerationReportStatus;
  actionTaken?: 'NONE' | 'MESSAGE_DELETED' | 'USER_WARNED' | 'USER_MUTED' | 'USER_REMOVED';
  moderatorNotes?: string; // Strictly staff-only
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

// ============================================================================
// ZEALOSH ZM-IMPL-08E — ASSESSMENT INTELLIGENCE, CREDENTIALS & KNOWLEDGE
// ============================================================================

// ----------------------------------------------------------------------------
// Workstream A: Central Question Bank & Item Analytics
// ----------------------------------------------------------------------------
export type QuestionVersionStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
export type CognitiveLevel = 'KNOWLEDGE' | 'APPLICATION' | 'ANALYSIS' | 'EVALUATION';

export interface QuestionBankItem {
  id: string;
  code: string; // e.g. "QBK-ASP-001"
  certificationType: string;
  title: string;
  currentVersionNumber: number;
  status: QuestionVersionStatus;
  authorId: string;
  authorName?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionVersion {
  id: string;
  questionBankItemId: string;
  versionNumber: number;
  stem: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  cognitiveLevel: CognitiveLevel;
  domain: string;
  topic: string;
  options: {
    id: string;
    text: string;
  }[];
  correctOptionIds: string[]; // Strictly server-authoritative; severed from student projections
  explanation: string; // Explanation & rationale; severed from student projections
  referenceSource: string;
  points: number;
  rubricCriteria?: {
    id: string;
    title?: string;
    name?: string;
    maxPoints: number;
    description?: string;
  }[];
  status: QuestionVersionStatus;
  changeSummary?: string;
  approvedBy?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface StudentSafeQuestion {
  id: string;
  questionBankItemId: string;
  versionNumber: number;
  stem: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  cognitiveLevel: CognitiveLevel;
  domain: string;
  topic: string;
  options: {
    id: string;
    text: string;
  }[];
  points: number;
  referenceSource?: string;
}

export interface ItemAnalytics {
  questionBankItemId: string;
  versionNumber: number;
  totalAttempts: number;
  correctAttempts: number;
  difficultyPValue: number; // p = correct / total (0.0 to 1.0)
  discriminationD: number; // D = p_upper - p_lower (-1.0 to +1.0)
  distractorFrequencies: Record<string, { count: number; percentage: number }>;
  sampleSizeSufficient: boolean; // true if totalAttempts >= 30
  lastCalculatedAt: string;
}

export interface TaxonomyDomain {
  id: string;
  certificationType: string;
  code: string;
  name: string;
  weightPercentage?: number;
  topics: {
    id: string;
    code: string;
    name: string;
    description?: string;
  }[];
}

// ----------------------------------------------------------------------------
// Workstream B: Tamper-Evident Certificates & Cryptographic Verification
// ----------------------------------------------------------------------------
export interface SignedCertificateManifest {
  issuer: string; // "Zealosh Training & Consultants"
  certificateCode: string; // "ZEI/EXAM/2026/000001" or "ZEALOSH-ASP-2026-8941"
  studentName: string;
  studentId?: string;
  courseId: string;
  courseTitle: string;
  certificationType: string;
  issueDate: string;
  completionDate: string;
  scorePercent: number;
  keyId: string;
  signature: string; // ed25519 signature in hex format
  canonicalHash: string; // SHA-256 hash of canonical payload
}

export interface CertificateSigningKey {
  keyId: string;
  publicKeyPem: string;
  privateKeyPem?: string; // Kept secure on server
  algorithm: 'ed25519';
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  revokedAt?: string;
}

export interface CertificateEligibilityEvaluation {
  eligible: boolean;
  studentId: string;
  courseId: string;
  enrollmentCompleted: boolean;
  orientationAttended: boolean;
  examPassed: boolean;
  examScorePercent: number;
  minimumPassingScore: number;
  reasons: string[];
}

export interface OfflineVerificationResult {
  valid: boolean;
  status: 'VALID' | 'REVOKED' | 'TAMPERED' | 'INVALID_SIGNATURE' | 'UNTRUSTED_KEY' | 'MALFORMED_MANIFEST';
  manifest?: SignedCertificateManifest;
  verifiedAt: string;
  error?: string;
}

export interface CertificateRevocationRecord {
  certificateCode: string;
  revokedAt: string;
  revokedBy: string;
  reason: string;
  replacedByCertificateCode?: string;
}

// ----------------------------------------------------------------------------
// Workstream C: Vector RAG Document Ingestion & Permission-Aware Retrieval
// ----------------------------------------------------------------------------
export type RagDocType = 'SYLLABUS' | 'STUDENT_HANDBOOK' | 'SAFETY_STANDARD' | 'LEARNING_MATERIAL' | 'REGULATORY_CODE';
export type RagDocumentStatus = 'DRAFT' | 'UPLOADED' | 'APPROVED' | 'INDEXED' | 'SUPERSEDED' | 'ARCHIVED';

export interface RagDocument {
  id: string;
  courseId: string;
  title: string;
  docType: RagDocType;
  status: RagDocumentStatus;
  version: number;
  contentChecksum: string; // SHA-256 hex
  totalChunks: number;
  sourceFileName?: string;
  uploadedBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RagDocumentChunk {
  id: string;
  documentId: string;
  courseId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  sectionHeading?: string;
  tokenCount: number;
  embedding?: number[];
  status: 'INDEXED' | 'ARCHIVED';
  createdAt: string;
}

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  courseId: string;
  title: string;
  sectionHeading?: string;
  pageNumber?: number;
  excerpt: string;
  score: number; // Cosine similarity 0.0 - 1.0
}

export interface IEmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  getStatus(): {
    provider: string;
    status: 'ACTIVE' | 'UNCONFIGURED';
    model: string;
    dimensions: number;
  };
}

// ============================================================================
// Track 5: Certification Planning, Reviews, Gamification & Growth (ZM-IMPL-08F)
// ============================================================================

// --- Workstream A: HSE Career Certification Roadmap ---
export type CertificationCategory = 'BCSP' | 'CRSP' | 'NEBOSH' | 'IOSH' | 'OSHA' | 'INSTITUTIONAL';
export type CertificationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface CertificationPrerequisiteRef {
  prerequisiteCertificationId?: string;
  minimumDegreeLevel?: 'NONE' | 'DIPLOMA' | 'BACHELORS' | 'MASTERS';
  minimumExperienceYears?: number;
  description: string;
}

export interface Certification {
  id: string; // e.g. 'cert-asp', 'cert-csp'
  name: string; // 'Associate Safety Professional (ASP)'
  shortName: string; // 'ASP'
  awardingOrg: string; // 'Board of Certified Safety Professionals (BCSP)'
  category: CertificationCategory;
  description: string;
  sourceUrl?: string;
  status: CertificationStatus;
  prerequisites: CertificationPrerequisiteRef[];
  renewalRequirements?: string;
  relatedCourseIds: string[];
  lastReviewedAt: string;
}

export type PathwayPrerequisiteType =
  | 'ZEALOSH_COURSE'
  | 'ZEALOSH_CERTIFICATE'
  | 'EXTERNAL_CERTIFICATION'
  | 'WORK_EXPERIENCE'
  | 'DEGREE';

export interface PathwayPrerequisite {
  id: string;
  type: PathwayPrerequisiteType;
  refId?: string; // e.g., courseId or certificationId
  title: string;
  description: string;
  isMandatory: boolean;
}

export interface CareerPathwayStage {
  id: string;
  pathwayId: string;
  stageOrder: number;
  title: string;
  description: string;
  certificationId: string;
  isOptional: boolean;
  estimatedMonths: number;
  prerequisites: PathwayPrerequisite[];
  relatedCourseIds: string[];
}

export interface CareerPathway {
  id: string;
  slug: string;
  title: string;
  description: string;
  targetRole: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  stages: CareerPathwayStage[];
  createdAt: string;
  updatedAt: string;
}

export type ExternalExamStatus = 'PLANNED' | 'BOOKED' | 'APPEARED' | 'PASSED' | 'FAILED' | 'CANCELLED';

export interface ExternalExamPlan {
  id: string;
  examBody: string;
  certificationName: string;
  targetExamDate: string;
  bookedDate?: string;
  bookingReference?: string;
  status: ExternalExamStatus;
  attemptNumber: number;
  scoreReported?: number;
  notes?: string;
}

export type CredentialVerificationStatus =
  | 'SELF_REPORTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'UNABLE_TO_VERIFY';

export interface ExternalCredentialEvidence {
  id: string;
  studentId: string;
  milestoneId: string;
  credentialName: string;
  issuingBody: string;
  issueDate: string;
  expiryDate?: string;
  credentialNumber?: string;
  documentAssetId?: string;
  verificationStatus: CredentialVerificationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  auditNotes?: string;
  createdAt: string;
}

export type MilestoneStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface StudentCareerMilestone {
  id: string;
  planId: string;
  stageId: string;
  certificationId: string;
  targetDate: string;
  status: MilestoneStatus;
  completedAt?: string;
  evidenceId?: string;
  externalExamPlan?: ExternalExamPlan;
}

export type StudentCareerPlanStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';

export interface StudentCareerPlan {
  id: string;
  studentId: string;
  pathwayId: string;
  pathwayVersion: number;
  status: StudentCareerPlanStatus;
  targetCompletionDate: string;
  notes?: string;
  milestones: StudentCareerMilestone[];
  sharedWithTutorId?: string;
  tutorGuidanceNotes?: string;
  tutorGuidanceUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PrerequisiteEvaluationStatus =
  | 'SATISFIED'
  | 'NOT_SATISFIED'
  | 'PENDING_VERIFICATION'
  | 'NOT_APPLICABLE'
  | 'EXTERNAL_CONFIRMATION_REQUIRED';

export interface PrerequisiteEvaluationResult {
  prerequisiteId: string;
  type: PathwayPrerequisiteType;
  title: string;
  status: PrerequisiteEvaluationStatus;
  evidenceDetails?: string;
}

// --- Workstream B: Verified Student Reviews & Testimonial Management ---
export type ReviewCategory = 'COURSE' | 'INSTRUCTOR' | 'CLASSROOM' | 'INSTITUTIONAL' | 'ACHIEVEMENT_STORY';
export type ReviewSubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'HIDDEN'
  | 'CONSENT_REVOKED'
  | 'ARCHIVED';

export interface TestimonialConsentRecord {
  id: string;
  reviewId: string;
  studentId: string;
  consentVersion: string;
  allowInternalFeedback: boolean; // Must be true for review storage
  allowPublicTestimonial: boolean;
  allowPublicDisplayName: boolean;
  allowPublicPhoto: boolean;
  allowPublicVideo: boolean;
  allowCourseAssociation: boolean;
  allowSocialMedia: boolean;
  allowAchievementPoster: boolean;
  allowPromotionalCampaign: boolean;
  agreedAt: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
}

export interface StudentReview {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  instructorId?: string;
  instructorName?: string;
  category: ReviewCategory;
  rating: number; // 1 to 5
  reviewText: string;
  mediaUrl?: string;
  submissionStatus: ReviewSubmissionStatus;
  consent: TestimonialConsentRecord;
  moderatedBy?: string;
  moderatedAt?: string;
  moderationNotes?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicTestimonial {
  id: string;
  reviewId: string;
  category: ReviewCategory;
  rating: number;
  reviewText: string;
  displayName: string; // Redacted or real depending on consent
  courseTitle?: string;
  mediaUrl?: string; // Redacted if consent not granted
  publishedAt: string;
  verifiedStudent: boolean;
}

export interface AchievementShowcase {
  id: string;
  studentId: string;
  displayName: string;
  courseTitle: string;
  certificateCode: string;
  completionDate: string;
  scoreAchieved?: number;
  posterImageUrl?: string;
  consentGranted: boolean;
  publishedAt: string;
}

// --- Workstream C: Gamification and Learner Motivation ---
export type GamificationActivityType =
  | 'LESSON_COMPLETED'
  | 'ASSIGNMENT_SUBMITTED'
  | 'QUIZ_COMPLETED'
  | 'EXAM_PASSED'
  | 'ATTENDANCE_RECORDED'
  | 'DAILY_QUESTION_ANSWERED'
  | 'COURSE_COMPLETED'
  | 'MANUAL_AWARD';

export interface PointLedgerEntry {
  id: string;
  studentId: string;
  sourceEventId: string;
  activityType: GamificationActivityType;
  pointsAwarded: number;
  awardReason: string;
  courseId?: string;
  batchId?: string;
  earnedAt: string;
  idempotencyKey: string; // e.g., 'usr-01:LESSON_COMPLETED:lsn-01'
  policyVersion: string;
  reversedAt?: string;
  reversalReason?: string;
  awardedBy?: string; // 'SYSTEM' or admin userId
}

export interface GamificationRule {
  id: string;
  activityType: GamificationActivityType;
  points: number;
  maxDailyFrequency?: number;
  cooldownSeconds?: number;
  status: 'ACTIVE' | 'INACTIVE';
  policyVersion: string;
  description: string;
}

export interface StudentStreak {
  studentId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string; // 'YYYY-MM-DD' in Asia/Kolkata
  totalActiveDays: number;
  history: string[]; // List of YYYY-MM-DD dates
  updatedAt: string;
}

export type BadgeCategory = 'MILESTONE' | 'STREAK' | 'ASSESSMENT' | 'COMMUNITY' | 'MASTERY';

export interface BadgeDefinition {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  criteriaDescription: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}

export interface UserBadgeAward {
  id: string;
  studentId: string;
  badgeId: string;
  badgeCode: string;
  badgeTitle: string;
  badgeIcon: string;
  category: BadgeCategory;
  awardedAt: string;
  sourceEventId: string;
  idempotencyKey: string;
  awardedBy: string; // 'SYSTEM' or admin userId
  notes?: string;
}

export type LeaderboardScope = 'INSTITUTION' | 'COURSE' | 'BATCH';
export type LeaderboardPeriod = 'WEEKLY' | 'MONTHLY' | 'ALL_TIME';

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  displayName: string;
  avatarUrl?: string;
  totalPoints: number;
  currentStreak: number;
  badgesCount: number;
  isCurrentUser?: boolean;
}

export interface DailyQuestionChallenge {
  id: string;
  date: string; // YYYY-MM-DD
  questionId: string;
  stem: string;
  options: { id: string; text: string }[];
  domain: string;
  difficulty: string;
  pointsValue: number;
}

export interface DailyChallengeSubmission {
  id: string;
  challengeId: string;
  studentId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  correctOptionId: string; // Returned only after submission
  explanation: string; // Returned only after submission
  pointsEarned: number;
  submittedAt: string;
}

// --- Workstream D & E: Institutional Growth, Referrals, Marketing & Alumni ---
export type ReferralStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export interface ReferralCode {
  id: string;
  code: string; // e.g. 'REF-ALEX-9821'
  ownerUserId: string;
  ownerName: string;
  campaignId?: string;
  targetCourseId?: string;
  status: ReferralStatus;
  expiresAt?: string;
  clickCount: number;
  conversionCount: number;
  createdAt: string;
}

export type AttributionStatus = 'ATTRIBUTED' | 'APPLICATION_SUBMITTED' | 'CONVERTED' | 'REJECTED';

export interface ReferralAttribution {
  id: string;
  referralCode: string;
  referrerUserId: string;
  leadId: string;
  applicationId?: string;
  orderId?: string;
  status: AttributionStatus;
  attributedAt: string;
  convertedAt?: string;
  auditTrail: { event: string; timestamp: string; actor?: string }[];
}

export interface ReferralConversion {
  id: string;
  attributionId: string;
  referralCode: string;
  referrerUserId: string;
  referredUserId: string;
  courseId: string;
  orderId?: string;
  conversionEvent: 'ADMISSION_APPROVED' | 'PAYMENT_VERIFIED';
  convertedAt: string;
  commissionStatus: 'BLOCKED_PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'VOID';
  commissionAmount: number; // Defaults to 0 under freeze
}

export type PartnerType = 'ACADEMIC' | 'CORPORATE' | 'AGENCY';
export type PartnerStatus = 'ACTIVE' | 'INACTIVE';

export interface InstitutionalPartner {
  id: string;
  partnerName: string;
  partnerType: PartnerType;
  contactEmail: string;
  contactPerson: string;
  referralCodeId: string;
  status: PartnerStatus;
  agreementRef?: string;
  notes?: string;
  createdAt: string;
}

export type CampaignChannel = 'WEB' | 'EMAIL' | 'PARTNER' | 'SOCIAL';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface InstitutionalCampaign {
  id: string;
  name: string;
  slug: string;
  objective: string;
  targetCourseId?: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  startDate: string;
  endDate?: string;
  utmSource: string;
  utmCampaign: string;
  referralCodeId?: string;
  leadsCount: number;
  conversionsCount: number;
  createdAt: string;
}

export type AlumniVisibility = 'ALUMNI_ONLY' | 'PUBLIC';
export type AlumniContactPreference = 'PLATFORM_MESSAGE' | 'NONE';

export interface AlumniProfile {
  id: string;
  studentId: string;
  displayName: string;
  completedProgrammes: string[];
  verifiedCredentials: string[];
  industry: string;
  professionalTitle?: string;
  skills: string[];
  contactPreference: AlumniContactPreference;
  visibility: AlumniVisibility;
  isOptedIn: boolean;
  consentAgreedAt: string;
  updatedAt: string;
}

// ============================================================================
// ZEALOSH ZM-IMPL-08G — ENTERPRISE OPERATIONS, PWA & CENTRAL EVENT OUTBOX
// ============================================================================

// --- Workstream A: Authoritative Service & Domain Ownership Registry ---
export type DomainIdentifier =
  | 'IDENTITY'
  | 'ACADEMIC'
  | 'ADMISSIONS'
  | 'COMMERCE'
  | 'ENTITLEMENTS'
  | 'SCHEDULING'
  | 'CLASSROOM'
  | 'ZEALOSH_VC'
  | 'MESSAGING'
  | 'MEDIA'
  | 'CMS'
  | 'ASSESSMENT'
  | 'CREDENTIALS'
  | 'CAREER'
  | 'TESTIMONIALS'
  | 'GAMIFICATION'
  | 'GROWTH'
  | 'NOTIFICATIONS'
  | 'SUPPORT'
  | 'AUDIT';

export type DomainHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNCONFIGURED' | 'MAINTENANCE';

export interface DomainRegistryEntry {
  id: DomainIdentifier;
  displayName: string;
  owner: string;
  authoritativeTables: string[];
  permittedPublishers: DomainIdentifier[];
  permittedConsumers: DomainIdentifier[];
  supportedEventTypes: string[];
  contractVersions: string[];
  enabled: boolean;
  operationalHealth: DomainHealthStatus;
  lastSuccessfulProcessingTime?: string;
  lastError?: string;
}

// --- Workstream B: Central Event Envelope & Contracts ---
export type EventDataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type EventActorType = 'SYSTEM' | 'USER' | 'ADMIN' | 'CRON' | 'WEBHOOK';

export interface DomainEventEnvelope<T = Record<string, any>> {
  eventId: string; // UUID v4
  eventType: string; // e.g. "commerce.order.paid"
  schemaVersion: string; // e.g. "v1.0.0"
  sourceDomain: DomainIdentifier;
  aggregateType: string; // e.g. "Order", "StudentCareerPlan"
  aggregateId: string;
  aggregateVersion: number;
  occurredAt: string; // ISO 8601
  recordedAt: string; // ISO 8601
  correlationId: string;
  causationId?: string;
  idempotencyKey: string;
  actorType: EventActorType;
  actorId?: string;
  payload: T;
  dataClassification: EventDataClassification;
}

export interface EventContract {
  eventType: string;
  schemaVersion: string;
  sourceDomain: DomainIdentifier;
  requiredFields: string[];
  permittedConsumers: DomainIdentifier[];
  dataClassification: EventDataClassification;
  description: string;
}

// --- Workstream C & D: Outbox, Delivery Records & Consumer Inbox ---
export type EventDeliveryStatus =
  | 'PENDING'
  | 'CLAIMED'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'RETRY_SCHEDULED'
  | 'FAILED'
  | 'DEAD_LETTERED'
  | 'CANCELLED';

export interface EventOutboxRecord {
  id: string;
  envelope: DomainEventEnvelope;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export interface EventDeliveryRecord {
  id: string;
  eventId: string;
  consumerDomain: DomainIdentifier;
  status: EventDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  lockedAt?: string;
  lockedBy?: string;
  lastAttemptAt?: string;
  lastError?: string;
  deliveredAt?: string;
  deadLetterId?: string;
}

export interface ConsumerInboxEntry {
  id: string;
  consumerDomain: DomainIdentifier;
  eventId: string;
  aggregateId: string;
  aggregateVersion: number;
  processedAt: string;
  status: 'PROCESSED' | 'SKIPPED_DUPLICATE' | 'SKIPPED_STALE' | 'FAILED';
  resultSummary?: string;
}

export type DeadLetterFailureClassification =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_FAILURE'
  | 'AUTHORIZATION_DENIED'
  | 'SCHEMA_INCOMPATIBLE'
  | 'HANDLER_EXCEPTION'
  | 'MAX_RETRIES_EXCEEDED';

export interface DeadLetterEventRecord {
  id: string;
  deliveryId: string;
  eventId: string;
  consumerDomain: DomainIdentifier;
  failureClassification: DeadLetterFailureClassification;
  errorMessage: string;
  attemptCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  correlationId: string;
  resolutionStatus: 'PENDING_REVIEW' | 'REPLAY_QUEUED' | 'RESOLVED_IGNORED' | 'RESOLVED_REPLAYED';
  resolvedBy?: string;
  resolutionReason?: string;
  replayCount: number;
}

// --- Workstream G: Domain Reconciliation Engine ---
export type ReconciliationStatus =
  | 'MATCHED'
  | 'PENDING_SYNC'
  | 'MISMATCH'
  | 'RESOLUTION_REQUIRED'
  | 'RESOLVED'
  | 'EXEMPTED_BY_POLICY';

export interface ReconciliationRun {
  id: string;
  ruleName: string;
  sourceDomain: DomainIdentifier;
  targetDomain: DomainIdentifier;
  checkedCount: number;
  mismatchCount: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
}

export interface ReconciliationResult {
  id: string;
  runId: string;
  ruleName: string;
  sourceId: string;
  targetId?: string;
  status: ReconciliationStatus;
  details: string;
  suggestedAction: 'REPLAY_OUTBOX' | 'MANUAL_REVIEW' | 'SYNC_PROJECTION' | 'EXEMPT';
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

// --- Workstream N: Administrative Maintenance Mode ---
export type MaintenanceMode = 'NORMAL' | 'READ_ONLY' | 'FULL_MAINTENANCE';

export interface MaintenanceConfig {
  enabled: boolean;
  mode: MaintenanceMode;
  maintenanceMessage: string;
  publicExplanation: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  activatedAt?: string;
  completedAt?: string;
  affectedScope: 'ALL' | 'STUDENT_PORTAL' | 'ADMISSIONS' | 'ASSESSMENTS';
  reason: string;
  updatedBy: string;
  version: number;
}

export interface MaintenanceHistoryEntry {
  id: string;
  mode: MaintenanceMode;
  action: 'SCHEDULED' | 'ACTIVATED' | 'EXTENDED' | 'COMPLETED' | 'CANCELLED';
  reason: string;
  actor: string;
  timestamp: string;
}

// --- Workstream O: Institutional Audit Archives ---
export type AuditArchiveFormat = 'JSONL' | 'CSV';
export type AuditArchiveIntegrityStatus = 'VERIFIED' | 'TAMPER_DETECTED' | 'UNVERIFIED';

export interface InstitutionalAuditArchiveManifest {
  archiveId: string;
  institution: string; // "Zealosh Training & Consultants"
  createdAt: string;
  recordCount: number;
  checksum: string; // SHA-256
  firstRecordTimestamp?: string;
  lastRecordTimestamp?: string;
  createdBy: string;
}

export interface InstitutionalAuditArchive {
  id: string;
  archivePeriod: string; // e.g. "2026-Q4" or "2026-11"
  scope: string; // e.g. "ALL", "FINANCIAL", "ADMISSIONS", "ACADEMIC"
  includedEventTypes: string[];
  sourceRecordCount: number;
  format: AuditArchiveFormat;
  contentChecksum: string; // SHA-256 hash
  manifest: InstitutionalAuditArchiveManifest;
  integrityStatus: AuditArchiveIntegrityStatus;
  retentionStatus: 'RETENTION_POLICY_UNCONFIGURED' | 'ACTIVE';
  createdBy: string;
  createdAt: string;
  downloadCount: number;
  lastDownloadedAt?: string;
  tamperedAt?: string;
}

// --- Workstream J & L: PWA Offline Progress Queue & Push Readiness ---
export type PwaSyncStatus = 'QUEUED' | 'SYNCED' | 'CONFLICT' | 'REJECTED';

export interface PwaOfflineQueueItem {
  clientEventId: string;
  studentId: string;
  eventType: 'LESSON_READING_PROGRESS' | 'BOOKMARK_CREATED' | 'USER_PREFERENCE_UPDATED';
  resourceId: string;
  payload: Record<string, any>;
  createdAt: string;
  syncStatus: PwaSyncStatus;
  conflictDetails?: string;
}

export interface PwaPushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
}

// --- Workstream P: Enterprise Telemetry & Observability ---
export interface TelemetryMetric {
  metricName: string;
  metricValue: number;
  tags: Record<string, string>;
  timestamp: string;
}

export interface OperationalDashboardMetrics {
  domainsCount: number;
  outboxBacklogCount: number;
  deliveriesPendingCount: number;
  deliveriesFailedCount: number;
  deadLetterCount: number;
  reconciliationMismatchCount: number;
  maintenanceMode: MaintenanceMode;
  auditArchivesCount: number;
  systemHealth: 'HEALTHY' | 'DEGRADED' | 'MAINTENANCE';
}


export * from './config';
export * from './reporting';
export * from './support';
export * from './cms';


