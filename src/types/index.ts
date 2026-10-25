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
