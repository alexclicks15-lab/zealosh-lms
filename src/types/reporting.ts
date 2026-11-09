// Zealosh LMS — Institutional Reporting, Academic Analytics & Cohort Telemetry Types
// Path: src/types/reporting.ts
// Authoritative definitions for institutional KPIs, cohort analytics, and reporting dimensions

export type ReportingDateRangePreset =
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'previous_month'
  | 'current_academic_year'
  | 'custom';

export interface ReportingFilterParams {
  dateRangePreset?: ReportingDateRangePreset;
  startDate?: string;
  endDate?: string;
  academicYearId?: string;
  departmentId?: string;
  programmeId?: string;
  courseId?: string;
  batchId?: string;
  instructorId?: string;
  enrolmentStatus?: string;
}

// ----------------------------------------------------------------------------
// Executive Overview KPIs
// ----------------------------------------------------------------------------
export interface ExecutiveOverviewKpis {
  totalRegisteredStudents: number;
  activeEnrolledLearners: number;
  totalActiveEnrolments: number;
  newAdmissionsCount: number;
  pendingApplicationsCount: number;
  admissionsConversionRatePercent: number;
  activeCoursesCount: number;
  activeBatchesCount: number;
  overallBatchCapacityUtilizationPercent: number;
  averageLiveAttendancePercent: number;
  assignmentSubmissionRatePercent: number;
  assignmentGradingBacklogCount: number;
  formalExamPassRatePercent: number;
  pendingExamEvaluationsCount: number;
  overallCourseCompletionRatePercent: number;
  studentsRequiringAttentionCount: number;
  generatedAt: string;
}

// ----------------------------------------------------------------------------
// Enrollment & Batch Capacity Telemetry
// ----------------------------------------------------------------------------
export interface BatchOccupancyItem {
  batchId: string;
  batchName: string;
  courseId: string;
  courseTitle: string;
  leadInstructorId?: string;
  leadInstructorName?: string;
  configuredCapacity: number;
  activeEnrolledCount: number;
  availableSeats: number;
  occupancyPercent: number;
  occupancyStatus: 'AVAILABLE' | 'NEAR_CAPACITY' | 'FULL';
  startDate: string;
  endDate: string;
}

export interface EnrollmentAnalyticsReport {
  totalApplications: number;
  approvedAdmissions: number;
  rejectedAdmissions: number;
  pendingAdmissions: number;
  totalEnrolments: number;
  activeEnrolments: number;
  completedEnrolments: number;
  withdrawnEnrolments: number;
  transferredEnrolments: number;
  expiredEnrolments: number;
  batches: BatchOccupancyItem[];
  trendByPeriod: Array<{
    period: string;
    newApplications: number;
    newEnrolments: number;
  }>;
}

// ----------------------------------------------------------------------------
// Attendance Telemetry
// ----------------------------------------------------------------------------
export interface SessionAttendanceItem {
  sessionId: string;
  sessionTitle: string;
  courseId: string;
  courseTitle: string;
  batchId: string;
  batchName: string;
  instructorName?: string;
  scheduledStartTime: string;
  scheduledDurationMinutes: number;
  eligibleStudentCount: number;
  attendedStudentCount: number;
  attendanceRatePercent: number;
  averageAttendedMinutes: number;
  status: string;
}

export interface AttendanceAnalyticsReport {
  totalSessionsConducted: number;
  averageAttendanceRatePercent: number;
  totalParticipantHours: number;
  anomaliesDetectedCount: number;
  recentSessions: SessionAttendanceItem[];
  attendanceByBatch: Array<{
    batchId: string;
    batchName: string;
    averageAttendancePercent: number;
    sessionsCount: number;
  }>;
}

// ----------------------------------------------------------------------------
// Assessment Telemetry (Assignments vs Quizzes vs Formal HSE Exams)
// ----------------------------------------------------------------------------
export interface AssessmentAnalyticsReport {
  // Coursework & Assignments
  assignments: {
    totalPublished: number;
    totalSubmissionsReceived: number;
    overallSubmissionRatePercent: number;
    pendingGradingCount: number;
    gradedCount: number;
    resubmissionsRequestedCount: number;
    averageAwardedScorePercent: number;
  };
  // Formative Learning Quizzes (strictly separate from HSE Exams)
  formativeQuizzes: {
    totalQuizzesConducted: number;
    totalAttemptsCount: number;
    completedAttemptsCount: number;
    passRatePercent: number;
    averageScorePercent: number;
    frequentlyMissedTopics: Array<{
      topicId?: string;
      topicTitle: string;
      missRatePercent: number;
    }>;
  };
  // Formal High-Stakes HSE Certification Examinations
  formalHseExams: {
    totalAttempts: number;
    completedAttempts: number;
    pendingManualEvaluationCount: number;
    publishedResultsCount: number;
    passRatePercent: number;
    failRatePercent: number;
    certificatesIssuedCount: number;
    domainPerformance: Array<{
      domainName: string;
      averagePercent: number;
    }>;
  };
}

// ----------------------------------------------------------------------------
// Course Progression & Completion Telemetry
// ----------------------------------------------------------------------------
export interface CourseProgressionItem {
  courseId: string;
  courseTitle: string;
  certificationType: string;
  enrolledStudentsCount: number;
  completedStudentsCount: number;
  completionRatePercent: number;
  averageLessonProgressPercent: number;
  totalModulesCount: number;
  totalLessonsCount: number;
}

export interface CourseProgressionReport {
  overallCompletionRatePercent: number;
  courses: CourseProgressionItem[];
}

// ----------------------------------------------------------------------------
// Faculty & Instructor Workload Telemetry
// ----------------------------------------------------------------------------
export interface InstructorWorkloadItem {
  instructorId: string;
  instructorName: string;
  instructorEmail: string;
  assignedCoursesCount: number;
  assignedBatchesCount: number;
  activeLearnersCount: number;
  liveSessionsConductedCount: number;
  assignmentsPublishedCount: number;
  submissionsAwaitingGradingCount: number;
  evaluationsCompletedCount: number;
  doubtsAnsweredCount: number;
}

export interface InstructorAnalyticsReport {
  totalActiveInstructors: number;
  totalGradingBacklog: number;
  faculty: InstructorWorkloadItem[];
}

// ----------------------------------------------------------------------------
// Cohort Telemetry & Students Requiring Attention
// ----------------------------------------------------------------------------
export type AttentionReasonCode =
  | 'OVERDUE_ASSIGNMENT'
  | 'LOW_ATTENDANCE'
  | 'LOW_QUIZ_AVERAGE'
  | 'UNRESOLVED_DOUBT'
  | 'STALLED_PROGRESS';

export interface StudentAttentionFlag {
  reasonCode: AttentionReasonCode;
  reasonLabel: string;
  detail: string;
  severity: 'HIGH' | 'MEDIUM';
}

export interface StudentRequiringAttentionItem {
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  batchId: string;
  batchName: string;
  lessonProgressPercent: number;
  attendancePercent: number;
  flags: StudentAttentionFlag[];
  lastActiveAt?: string;
}

export interface CohortAnalyticsReport {
  studentsRequiringAttention: StudentRequiringAttentionItem[];
  totalAttentionFlagsCount: number;
}

