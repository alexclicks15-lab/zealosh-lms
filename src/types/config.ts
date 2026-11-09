// Zealosh LMS — Authoritative Configuration, Governance, and Theming Types

export interface PlatformSettings {
  platformName: string;
  organizationName: string;
  organizationEmail: string;
  supportEmail: string;
  supportPhone: string;
  defaultLanguage: string;
  defaultTimezone: string;
  defaultCurrency: 'INR' | 'USD' | 'EUR' | 'GBP';
  dateFormat: string;
  timeFormat: '12h' | '24h';
  maintenanceMode: boolean;
  registrationMode: 'PUBLIC' | 'INVITE_ONLY' | 'DISABLED';
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  admissionsAutoEnrollEnabled?: boolean; // Institutional auto-enrollment policy gate (default: false pending BDR-01 approval)
  maxDocumentSizeBytes?: number; // Configurable document upload ceiling in bytes
  termsOfServiceUrl?: string;
  privacyPolicyUrl?: string;
  notificationPreferences: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    inAppAlerts: boolean;
  };
}

export interface BrandingTheme {
  primaryGreen: string;      // default '#4f8c4c'
  deepGreen: string;         // default '#3a7536'
  accentGreen: string;       // default '#2ea033'
  darkNeutral: string;       // default '#0f172a'
  surfaceColor: string;      // default '#ffffff'
  lightSurfaceColor: string; // default '#ffffff'
  secondarySurface: string;  // default '#e2efe1'
  fontFamily: 'Inter' | 'Outfit' | 'System';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  layoutDensity: 'compact' | 'comfortable' | 'spacious';
  buttonStyle: 'rounded' | 'pill' | 'square';
  cardStyle: 'bordered' | 'elevated' | 'flat';
  logoUrl?: string;
  faviconUrl?: string;
  customCss?: string;
}

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  iconName: string; // Lucide icon identifier
  requiredRole?: string[]; // Empty means public
  order: number;
  isVisible: boolean;
  isSystem: boolean; // System routes cannot be deleted
}

export interface FeatureFlags {
  courseCatalog: boolean;
  cohortManagement: boolean;
  instructorPortal: boolean;
  studentPortal: boolean;
  recordedLearning: boolean;
  liveClassrooms: boolean;
  practiceAssessments: boolean;
  formalExaminations: boolean;
  certificateIssuance: boolean;
  attendanceTracking: boolean;
  assignmentSubmissions: boolean;
  announcements: boolean;
  messaging: boolean;
  reportsAnalytics: boolean;
  paymentGateway: boolean;
  pwaOfflineSupport: boolean;
  moodleSync: boolean;
  bbbIntegration: boolean;
  /** Optional proposed AI Tutor feature gate. Defaults to false. Unapproved for production. */
  aiTutorEnabled?: boolean;
}

export type PermissionCode =
  | 'courses.read'
  | 'courses.create'
  | 'courses.update'
  | 'courses.publish'
  | 'cohorts.manage'
  | 'enrollments.manage'
  | 'students.read'
  | 'progress.read'
  | 'assessments.manage'
  | 'exams.publish'
  | 'exams.grade'
  | 'certificates.issue'
  | 'payments.read'
  | 'payments.refund'
  | 'reports.export'
  | 'settings.manage'
  | 'integrations.manage'
  | 'users.manage'
  | 'roles.manage'
  | 'audit.read'
  | 'academic.manage'
  | 'admissions.manage'
  | 'admissions.import'
  | 'profiles.manage'
  | 'transfers.manage'
  | 'support.tickets.read'
  | 'support.tickets.manage'
  | 'support.tickets.reply'
  | 'support.tickets.assign'
  | 'support.tickets.resolve'
  | 'support.analytics.read';

export interface PermissionDefinition {
  code: PermissionCode;
  category: 'COURSES' | 'COHORTS' | 'EXAMS' | 'COMMERCE' | 'GOVERNANCE' | 'SYSTEM';
  label: string;
  description: string;
  isDangerous?: boolean;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  isSystem: boolean; // SUPER_ADMIN, INSTRUCTOR, STUDENT are immutable base roles
  permissions: PermissionCode[];
  createdAt: string;
  updatedAt: string;
}

export interface ConfigAuditEntry {
  id: string;
  timestamp: string;
  actorUserId: string;
  actorEmail: string;
  section: 'GENERAL_SETTINGS' | 'BRANDING' | 'NAVIGATION' | 'FEATURE_FLAGS' | 'ROLES' | 'INTEGRATIONS' | 'WORKFLOWS';
  previousValue: unknown;
  newValue: unknown;
  changeReason?: string;
  version: number;
  isRollback?: boolean;
}

export type WorkflowTrigger =
  | 'USER_REGISTERED'
  | 'COURSE_ENROLLED'
  | 'LESSON_COMPLETED'
  | 'EXAM_SUBMITTED'
  | 'EXAM_PASSED'
  | 'CERTIFICATE_ISSUED'
  | 'LIVE_SESSION_SCHEDULED';

export type WorkflowActionType =
  | 'SEND_IN_APP_NOTIFICATION'
  | 'SEND_EMAIL_NOTIFICATION'
  | 'DISPATCH_WEBHOOK'
  | 'AUTO_ENROLL_COHORT'
  | 'LOG_COMPLIANCE_EVENT';

export interface WorkflowAction {
  type: WorkflowActionType;
  parameters: Record<string, string | number | boolean>;
}

export interface WorkflowDefinition {
  id: string;
  title: string;
  description: string;
  trigger: WorkflowTrigger;
  conditions: {
    field: string;
    operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'CONTAINS';
    value: string | number;
  }[];
  actions: WorkflowAction[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplate {
  id: string;
  trigger: WorkflowTrigger;
  channel: 'IN_APP' | 'EMAIL' | 'PUSH';
  titleTemplate: string;
  bodyTemplate: string;
  variables: string[]; // e.g. ["studentName", "courseTitle", "examScore"]
  isEnabled: boolean;
}

export interface IntegrationServiceConfig {
  name: 'Moodle' | 'BigBlueButton' | 'Razorpay' | 'Supabase' | 'EmailSMTP';
  displayName?: string;
  enabled: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'SIMULATED' | 'ERROR';
  endpointUrl: string;
  lastCheckedAt: string;
  lastError?: string;
  isMockMode: boolean;
  syncIntervalMinutes?: number;
}

export interface CertificateRecord {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  courseId: string;
  courseTitle?: string;
  certificationType: string;
  certificateCode: string; // e.g. "ZEALOSH-ASP-2026-8941" or "ZEI/EXAM/2026/000001"
  certificationNumber?: string;
  certificateType?: string;
  enrollmentId?: string;
  studentName?: string;
  issueDate: string;
  expiryDate?: string;
  scorePercent?: number;
  status: 'ISSUED' | 'REVOKED';
  revocationReason?: string;
  qrVerificationUrl?: string;
  verificationUrl?: string;
  issuedBy?: string;
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}
