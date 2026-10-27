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
  createdAt: string;
  updatedAt: string;
}

export type DeliveryModel = 'RECORDED' | 'LIVE' | 'HYBRID' | 'MATERIALS_ONLY';
export type CertificationType = 'ASP' | 'CSP' | 'CRSP' | 'CIT' | 'NEBOSH_IDIP' | 'CUSTOM';
export type CourseStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface Course {
  id: string;
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
  name: string; // e.g. "Weekend Batch — Nov 2026"
  startDate: string;
  endDate: string;
  scheduleDescription: string; // e.g. "Saturdays & Sundays 7:00 PM - 9:30 PM IST"
  capacity: number;
  enrolledCount: number;
  leadInstructorId: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  batchId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  enrolledAt: string;
  expiresAt: string;
  progressPercent: number;
  completedLessonIds: string[];
  idempotencyKey?: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  moduleTitle: string;
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

export interface LiveSession {
  id: string;
  batchId: string;
  courseId: string;
  title: string;
  scheduledStartTime: string;
  durationMinutes: number;
  instructorId: string;
  meetingId: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'RECORDING_READY';
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
export type QuestionType = 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'TRUE_FALSE' | 'SCENARIO_BASED' | 'CALCULATION';
export type QuestionDifficulty = 'EASY' | 'MODERATE' | 'HARD';

export interface ExamQuestion {
  id: string;
  certificationType: CertificationType;
  domain: string; // e.g. "Domain 1: Advanced Safety Sciences and Math"
  topic: string;
  stem: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  options: {
    id: string;
    text: string;
  }[];
  correctOptionIds: string[]; // Server authoritative; stripped on client exam delivery
  explanation: string;
  referenceSource: string;
}

export interface ExamBlueprint {
  id: string;
  certificationType: CertificationType;
  title: string;
  totalQuestions: number;
  durationMinutes: number;
  passingScorePercent: number;
  domains: {
    name: string;
    weightPercent: number;
    questionCount: number;
  }[];
}

export interface ExamAttempt {
  id: string;
  userId: string;
  blueprintId: string;
  certificationType: CertificationType;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
  startTime: string;
  deadlineTime: string;
  completedTime?: string;
  assignedQuestionIds: string[];
  answers: Record<string, string[]>; // questionId -> selectedOptionIds
  bookmarkedQuestionIds: string[];
  totalScore?: number;
  passingScorePercent: number;
  passed?: boolean;
  domainBreakdown?: Record<string, { total: number; correct: number; percent: number }>;
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
  title: string;
  description: string;
  instructionsHtml?: string;
  dueDate: string; // ISO 8601
  maxScore: number;
  rubric?: GradingRubric;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface RubricScore {
  criterionId: string;
  score: number;
  comment?: string;
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
  gradedByUserId?: string;
  gradedAt?: string;
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

export interface PaymentOrder {
  id: string; // e.g. "ord_asp_98234"
  userId: string;
  userEmail: string;
  userName: string;
  courseId: string;
  batchId: string;
  currency: 'INR' | 'USD';
  amount: number;
  status: PaymentStatus;
  gateway: PaymentGateway;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewayRefundId?: string;
  refundReason?: string;
  refundedAt?: string;
  billingAddress?: BillingAddress;
  invoiceId?: string;
  enrollmentId?: string;
  createdAt: string;
  paidAt?: string;
}

export interface BillingAddress {
  companyName?: string;
  street?: string;
  city?: string;
  state?: string;
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
  totalAmount: number;
  currency: 'INR' | 'USD';
  status: 'ISSUED' | 'PAID' | 'VOID' | 'REFUNDED';
  issuedAt: string;
  paidAt?: string;
  hsnCode: string; // "999293" (Training & Education Services)
  providerGstin: string; // "32AABCZ1234F1Z5"
  providerGstinVerified?: boolean;
  paymentMethod?: string;
  transactionRef?: string;
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
  timestampSeconds: number;
  highlightId?: string;
  question: string;
  status: DoubtStatus;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  answers?: RecordingDoubtAnswer[];
}

export * from './config';


