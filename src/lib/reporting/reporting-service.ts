// Zealosh LMS — Institutional Reporting, Academic Analytics & Cohort Telemetry Service
// Path: src/lib/reporting/reporting-service.ts
// Single source of truth for academic KPIs, cohort analytics, and reporting dimensions

import { db } from '@/lib/store/db';
import {
  ReportingFilterParams,
  ExecutiveOverviewKpis,
  EnrollmentAnalyticsReport,
  BatchOccupancyItem,
  AttendanceAnalyticsReport,
  SessionAttendanceItem,
  AssessmentAnalyticsReport,
  CourseProgressionReport,
  CourseProgressionItem,
  InstructorAnalyticsReport,
  InstructorWorkloadItem,
  CohortAnalyticsReport,
  StudentRequiringAttentionItem,
  StudentAttentionFlag,
  ReportingDateRangePreset,
} from '@/types/reporting';
import { generateSanitizedCsv } from './csv-sanitizer';

export class ReportingService {
  /**
   * Resolves filter parameters to absolute millisecond timestamps for date range bounds.
   */
  public resolveDateRange(params: ReportingFilterParams): { startMs: number; endMs: number } {
    const now = new Date();
    const preset = params.dateRangePreset || 'last_30_days';

    if (preset === 'custom' && (params.startDate || params.endDate)) {
      const startMs = params.startDate ? new Date(params.startDate).getTime() : 0;
      const endMs = params.endDate ? new Date(params.endDate).getTime() : now.getTime();
      return { startMs, endMs };
    }

    switch (preset) {
      case 'today': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return { startMs: start.getTime(), endMs: end.getTime() };
      }
      case 'last_7_days': {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { startMs: start.getTime(), endMs: now.getTime() };
      }
      case 'last_30_days': {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { startMs: start.getTime(), endMs: now.getTime() };
      }
      case 'this_month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { startMs: start.getTime(), endMs: end.getTime() };
      }
      case 'previous_month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { startMs: start.getTime(), endMs: end.getTime() };
      }
      case 'current_academic_year': {
        // Institutional academic year: starts April 1st or current calendar year
        const currentYear = now.getFullYear();
        const startMonth = now.getMonth() >= 3 ? currentYear : currentYear - 1;
        const start = new Date(startMonth, 3, 1, 0, 0, 0, 0);
        const end = new Date(startMonth + 1, 2, 31, 23, 59, 59, 999);
        return { startMs: start.getTime(), endMs: end.getTime() };
      }
      default: {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { startMs: start.getTime(), endMs: now.getTime() };
      }
    }
  }

  /**
   * Helper to check whether an ISO timestamp falls within the resolved date range.
   */
  public isWithinDateRange(
    dateStr: string | undefined | null,
    startMs: number,
    endMs: number
  ): boolean {
    if (!dateStr) return false;
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return false;
    return time >= startMs && time <= endMs;
  }

  /**
   * Generates Executive Overview KPIs.
   */
  public async getExecutiveOverview(params: ReportingFilterParams = {}): Promise<ExecutiveOverviewKpis> {
    const { startMs, endMs } = this.resolveDateRange(params);

    // 1. Students & Active Enrolled Learners (Distinct counting)
    const allUsers = Array.from(db.users.values());
    const registeredStudents = allUsers.filter((u) => u.role === 'STUDENT');
    const totalRegisteredStudents = registeredStudents.length;

    const allEnrollments = Array.from(db.enrollments.values());
    const filteredEnrollments = allEnrollments.filter((e) => {
      if (params.courseId && e.courseId !== params.courseId) return false;
      if (params.batchId && e.batchId !== params.batchId) return false;
      if (params.enrolmentStatus && e.status !== params.enrolmentStatus) return false;
      return true;
    });

    const activeEnrollments = filteredEnrollments.filter((e) => e.status === 'ACTIVE');
    const totalActiveEnrolments = activeEnrollments.length;

    // Distinct students who have at least 1 active enrollment
    const activeLearnerUserIds = new Set<string>();
    activeEnrollments.forEach((e) => activeLearnerUserIds.add(e.userId));
    const activeEnrolledLearners = activeLearnerUserIds.size;

    // 2. Admissions Funnel
    const allApplications = Array.from(db.admissionApplications.values());
    const filteredApplications = allApplications.filter((app) => {
      if (params.courseId && app.courseId !== params.courseId) return false;
      return true;
    });

    const periodApplications = filteredApplications.filter((app) =>
      this.isWithinDateRange(app.createdAt, startMs, endMs)
    );
    const newAdmissionsCount = periodApplications.length;

    const pendingStatuses = new Set(['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING']);
    const pendingApplicationsCount = filteredApplications.filter((app) =>
      pendingStatuses.has(app.status)
    ).length;

    const approvedApplicationsCount = filteredApplications.filter((app) => app.status === 'APPROVED').length;
    const totalProcessedApplications = filteredApplications.filter((app) =>
      app.status === 'APPROVED' || app.status === 'REJECTED'
    ).length;
    const admissionsConversionRatePercent =
      totalProcessedApplications > 0
        ? Math.round((approvedApplicationsCount / totalProcessedApplications) * 1000) / 10
        : filteredApplications.length > 0
        ? Math.round((approvedApplicationsCount / filteredApplications.length) * 1000) / 10
        : 0;

    // 3. Courses & Batches
    const allCourses = Array.from(db.courses.values());
    const activeCoursesCount = allCourses.filter((c) => c.status === 'PUBLISHED').length;

    const allBatches = Array.from(db.batches.values());
    const filteredBatches = allBatches.filter((b) => {
      if (params.courseId && b.courseId !== params.courseId) return false;
      if (params.batchId && b.id !== params.batchId) return false;
      if (params.instructorId && b.leadInstructorId !== params.instructorId) return false;
      return true;
    });
    const activeBatchesCount = filteredBatches.length;

    // Batch Capacity Utilization
    let totalConfiguredCapacity = 0;
    let totalEnrolledInBatches = 0;
    filteredBatches.forEach((b) => {
      totalConfiguredCapacity += b.capacity || 0;
      totalEnrolledInBatches += b.enrolledCount || 0;
    });
    const overallBatchCapacityUtilizationPercent =
      totalConfiguredCapacity > 0
        ? Math.min(100, Math.round((totalEnrolledInBatches / totalConfiguredCapacity) * 1000) / 10)
        : 0;

    // 4. Live Attendance
    const allSessions = Array.from(db.liveSessions.values()).filter((s) => {
      if (params.courseId && s.courseId !== params.courseId) return false;
      if (params.batchId && s.batchId !== params.batchId) return false;
      if (params.instructorId && s.instructorId !== params.instructorId) return false;
      return true;
    });

    let totalAttendanceRatesSum = 0;
    let countedSessions = 0;
    allSessions.forEach((s) => {
      const records = db.attendance.get(s.id) || [];
      if (records.length > 0) {
        const attendedCount = records.filter((r) => r.attended).length;
        const rate = Math.min(100, (attendedCount / records.length) * 100);
        totalAttendanceRatesSum += rate;
        countedSessions++;
      }
    });
    const averageLiveAttendancePercent =
      countedSessions > 0 ? Math.round((totalAttendanceRatesSum / countedSessions) * 10) / 10 : 0;

    // 5. Coursework & Assignments
    const allAssignments = Array.from(db.assignments.values()).filter((a) => {
      if (params.courseId && a.courseId !== params.courseId) return false;
      if (params.batchId && a.batchId && a.batchId !== params.batchId) return false;
      return true;
    });
    const publishedAssignments = allAssignments.filter((a) => a.status === 'PUBLISHED');

    const allSubmissions = Array.from(db.submissions.values()).filter((sub) => {
      if (params.courseId && sub.courseId && sub.courseId !== params.courseId) return false;
      if (params.batchId && sub.batchId && sub.batchId !== params.batchId) return false;
      return true;
    });

    const assignmentGradingBacklogCount = allSubmissions.filter(
      (sub) => sub.status === 'SUBMITTED'
    ).length;

    // Submission rate: total received / expected eligible assignment–student pairs
    let expectedSubmissions = 0;
    publishedAssignments.forEach((a) => {
      const eligible = filteredEnrollments.filter((e) => {
        if (e.status !== 'ACTIVE') return false;
        if (a.courseId && e.courseId !== a.courseId) return false;
        if (a.batchId && e.batchId !== a.batchId) return false;
        return true;
      }).length;
      expectedSubmissions += eligible;
    });
    const assignmentSubmissionRatePercent =
      expectedSubmissions > 0
        ? Math.min(100, Math.round((allSubmissions.length / expectedSubmissions) * 1000) / 10)
        : 100;

    // 6. Formal High-Stakes HSE Certification Examinations (Strict Separation)
    const allExamAttempts = Array.from(db.examAttempts.values()).filter((att) => {
      if (params.courseId) {
        const course = db.courses.get(params.courseId);
        const bp = db.examBlueprints.get(att.blueprintId);
        const matchesCourse =
          att.courseId === params.courseId ||
          (course && (bp?.certificationType === course.certificationType || att.certificationType === course.certificationType));
        if (!matchesCourse) return false;
      }
      return true;
    });

    const completedExamAttempts = allExamAttempts.filter((att) => att.status === 'COMPLETED');
    const passedExamAttempts = completedExamAttempts.filter((att) => att.passed === true);
    const formalExamPassRatePercent =
      completedExamAttempts.length > 0
        ? Math.round((passedExamAttempts.length / completedExamAttempts.length) * 1000) / 10
        : 0;

    const pendingExamEvaluationsCount = allExamAttempts.filter(
      (att) => att.status === 'PENDING_MANUAL_EVALUATION'
    ).length;

    // 7. Overall Course Completion
    const completedEnrollments = filteredEnrollments.filter((e) => e.status === 'COMPLETED');
    const overallCourseCompletionRatePercent =
      filteredEnrollments.length > 0
        ? Math.round((completedEnrollments.length / filteredEnrollments.length) * 1000) / 10
        : 0;

    // 8. Students Requiring Attention Count
    const attentionList = await this.getStudentsRequiringAttention(params);
    const studentsRequiringAttentionCount = attentionList.length;

    return {
      totalRegisteredStudents,
      activeEnrolledLearners,
      totalActiveEnrolments,
      newAdmissionsCount,
      pendingApplicationsCount,
      admissionsConversionRatePercent,
      activeCoursesCount,
      activeBatchesCount,
      overallBatchCapacityUtilizationPercent,
      averageLiveAttendancePercent,
      assignmentSubmissionRatePercent,
      assignmentGradingBacklogCount,
      formalExamPassRatePercent,
      pendingExamEvaluationsCount,
      overallCourseCompletionRatePercent,
      studentsRequiringAttentionCount,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates Enrollment & Batch Capacity Telemetry Report.
   */
  public async getEnrollmentAnalytics(params: ReportingFilterParams = {}): Promise<EnrollmentAnalyticsReport> {
    const allApps = Array.from(db.admissionApplications.values()).filter((app) => {
      if (params.courseId && app.courseId !== params.courseId) return false;
      return true;
    });

    const totalApplications = allApps.length;
    const approvedAdmissions = allApps.filter((a) => a.status === 'APPROVED').length;
    const rejectedAdmissions = allApps.filter((a) => a.status === 'REJECTED').length;
    const pendingStatuses = new Set(['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING']);
    const pendingAdmissions = allApps.filter((a) => pendingStatuses.has(a.status)).length;

    const allEnrollments = Array.from(db.enrollments.values()).filter((e) => {
      if (params.courseId && e.courseId !== params.courseId) return false;
      if (params.batchId && e.batchId !== params.batchId) return false;
      return true;
    });

    const totalEnrolments = allEnrollments.length;
    const activeEnrolments = allEnrollments.filter((e) => e.status === 'ACTIVE').length;
    const completedEnrolments = allEnrollments.filter((e) => e.status === 'COMPLETED').length;
    const withdrawnEnrolments = allEnrollments.filter((e) => e.status === 'CANCELLED').length;
    const transferredEnrolments = Array.from(db.enrollmentTransfers.values()).length;
    const expiredEnrolments = allEnrollments.filter((e) => e.status === 'EXPIRED').length;

    // Batches with occupancy calculation
    const allBatches = Array.from(db.batches.values()).filter((b) => {
      if (params.courseId && b.courseId !== params.courseId) return false;
      if (params.batchId && b.id !== params.batchId) return false;
      if (params.instructorId && b.leadInstructorId !== params.instructorId) return false;
      return true;
    });

    const batches: BatchOccupancyItem[] = allBatches.map((b) => {
      const course = db.courses.get(b.courseId);
      const instructor = b.leadInstructorId ? db.users.get(b.leadInstructorId) : undefined;
      const capacity = b.capacity || 30;
      const enrolled = b.enrolledCount || 0;
      const availableSeats = Math.max(0, capacity - enrolled);
      const occupancyPercent = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 1000) / 10) : 0;

      let occupancyStatus: 'AVAILABLE' | 'NEAR_CAPACITY' | 'FULL' = 'AVAILABLE';
      if (enrolled >= capacity) {
        occupancyStatus = 'FULL';
      } else if (occupancyPercent >= 80) {
        occupancyStatus = 'NEAR_CAPACITY';
      }

      return {
        batchId: b.id,
        batchName: b.name,
        courseId: b.courseId,
        courseTitle: course?.title || 'Unknown Course',
        leadInstructorId: b.leadInstructorId,
        leadInstructorName: instructor?.name || 'Unassigned',
        configuredCapacity: capacity,
        activeEnrolledCount: enrolled,
        availableSeats,
        occupancyPercent,
        occupancyStatus,
        startDate: b.startDate,
        endDate: b.endDate,
      };
    });

    // Trend by month (last 6 months)
    const trendMap = new Map<string, { newApplications: number; newEnrolments: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trendMap.set(key, { newApplications: 0, newEnrolments: 0 });
    }

    allApps.forEach((app) => {
      if (app.createdAt) {
        const key = app.createdAt.slice(0, 7);
        if (trendMap.has(key)) {
          trendMap.get(key)!.newApplications++;
        }
      }
    });

    allEnrollments.forEach((e) => {
      if (e.enrolledAt) {
        const key = e.enrolledAt.slice(0, 7);
        if (trendMap.has(key)) {
          trendMap.get(key)!.newEnrolments++;
        }
      }
    });

    const trendByPeriod = Array.from(trendMap.entries()).map(([period, data]) => ({
      period,
      newApplications: data.newApplications,
      newEnrolments: data.newEnrolments,
    }));

    return {
      totalApplications,
      approvedAdmissions,
      rejectedAdmissions,
      pendingAdmissions,
      totalEnrolments,
      activeEnrolments,
      completedEnrolments,
      withdrawnEnrolments,
      transferredEnrolments,
      expiredEnrolments,
      batches,
      trendByPeriod,
    };
  }

  /**
   * Generates Attendance Telemetry Report.
   */
  public async getAttendanceAnalytics(params: ReportingFilterParams = {}): Promise<AttendanceAnalyticsReport> {
    const allSessions = Array.from(db.liveSessions.values()).filter((s) => {
      if (params.courseId && s.courseId !== params.courseId) return false;
      if (params.batchId && s.batchId !== params.batchId) return false;
      if (params.instructorId && s.instructorId !== params.instructorId) return false;
      return true;
    });

    let totalParticipantHours = 0;
    let anomaliesDetectedCount = 0;
    const sessionItems: SessionAttendanceItem[] = [];
    const batchAttendanceMap = new Map<string, { totalRate: number; count: number; name: string }>();

    allSessions.forEach((s) => {
      const course = db.courses.get(s.courseId);
      const batch = s.batchId ? db.batches.get(s.batchId) : undefined;
      const instructor = s.instructorId ? db.users.get(s.instructorId) : undefined;
      const records = db.attendance.get(s.id) || [];

      let attendedMinutesSum = 0;
      let attendedCount = 0;

      records.forEach((r) => {
        if (r.attended) {
          attendedCount++;
          attendedMinutesSum += r.durationMinutes || 0;
          totalParticipantHours += (r.durationMinutes || 0) / 60;

          // Duration anomaly: student claimed more minutes than scheduled duration + grace period
          if (r.durationMinutes > (s.durationMinutes || 60) + 15) {
            anomaliesDetectedCount++;
          }
        }
      });

      const eligibleCount = records.length > 0 ? records.length : batch?.enrolledCount || 0;
      const rate = eligibleCount > 0 ? Math.min(100, Math.round((attendedCount / eligibleCount) * 1000) / 10) : 0;
      const avgMinutes = attendedCount > 0 ? Math.round(attendedMinutesSum / attendedCount) : 0;

      sessionItems.push({
        sessionId: s.id,
        sessionTitle: s.title,
        courseId: s.courseId,
        courseTitle: course?.title || 'Unknown Course',
        batchId: s.batchId || '',
        batchName: batch?.name || 'All Cohorts',
        instructorName: instructor?.name,
        scheduledStartTime: s.scheduledStartTime,
        scheduledDurationMinutes: s.durationMinutes || 60,
        eligibleStudentCount: eligibleCount,
        attendedStudentCount: attendedCount,
        attendanceRatePercent: rate,
        averageAttendedMinutes: avgMinutes,
        status: s.status,
      });

      if (s.batchId && batch) {
        const existing = batchAttendanceMap.get(s.batchId) || {
          totalRate: 0,
          count: 0,
          name: batch.name,
        };
        existing.totalRate += rate;
        existing.count += 1;
        batchAttendanceMap.set(s.batchId, existing);
      }
    });

    const averageAttendanceRatePercent =
      sessionItems.length > 0
        ? Math.round(
            (sessionItems.reduce((acc, curr) => acc + curr.attendanceRatePercent, 0) /
              sessionItems.length) *
              10
          ) / 10
        : 0;

    const attendanceByBatch = Array.from(batchAttendanceMap.entries()).map(([batchId, data]) => ({
      batchId,
      batchName: data.name,
      averageAttendancePercent: data.count > 0 ? Math.round((data.totalRate / data.count) * 10) / 10 : 0,
      sessionsCount: data.count,
    }));

    return {
      totalSessionsConducted: allSessions.length,
      averageAttendanceRatePercent,
      totalParticipantHours: Math.round(totalParticipantHours * 10) / 10,
      anomaliesDetectedCount,
      recentSessions: sessionItems.slice(0, 50),
      attendanceByBatch,
    };
  }

  /**
   * Generates Assessment Analytics Report.
   * Strictly separates Formative Quizzes from Formal High-Stakes HSE Certification Exams.
   */
  public async getAssessmentAnalytics(params: ReportingFilterParams = {}): Promise<AssessmentAnalyticsReport> {
    // 1. Coursework & Assignments
    const allAssignments = Array.from(db.assignments.values()).filter((a) => {
      if (params.courseId && a.courseId !== params.courseId) return false;
      if (params.batchId && a.batchId && a.batchId !== params.batchId) return false;
      return true;
    });

    const published = allAssignments.filter((a) => a.status === 'PUBLISHED');
    const allSubmissions = Array.from(db.submissions.values()).filter((sub) => {
      if (params.courseId && sub.courseId && sub.courseId !== params.courseId) return false;
      if (params.batchId && sub.batchId && sub.batchId !== params.batchId) return false;
      return true;
    });

    const pendingGrading = allSubmissions.filter((sub) => sub.status === 'SUBMITTED').length;
    const graded = allSubmissions.filter((sub) => sub.status === 'GRADED');
    const resubmissionsRequested = allSubmissions.filter(
      (sub) => sub.status === 'RESUBMISSION_REQUESTED'
    ).length;

    let scoreSum = 0;
    graded.forEach((sub) => {
      const assignment = db.assignments.get(sub.assignmentId);
      const maxScore = assignment?.maxScore || 100;
      if (maxScore > 0 && typeof sub.score === 'number') {
        scoreSum += (sub.score / maxScore) * 100;
      }
    });
    const avgScorePercent = graded.length > 0 ? Math.round((scoreSum / graded.length) * 10) / 10 : 0;

    const allEnrollments = Array.from(db.enrollments.values()).filter((e) => e.status === 'ACTIVE');
    let expected = 0;
    published.forEach((a) => {
      const eligible = allEnrollments.filter((e) => {
        if (a.courseId && e.courseId !== a.courseId) return false;
        if (a.batchId && e.batchId !== a.batchId) return false;
        return true;
      }).length;
      expected += eligible;
    });
    const submissionRatePercent =
      expected > 0 ? Math.min(100, Math.round((allSubmissions.length / expected) * 1000) / 10) : 100;

    // 2. Formative Learning Quizzes (Separate from HSE Exams)
    const allQuizzes = Array.from(db.quizzes.values()).filter((q) => {
      if (params.courseId && q.courseId !== params.courseId) return false;
      return true;
    });

    const allQuizAttempts = Array.from(db.quizAttempts.values()).filter((qa) => {
      const quiz = db.quizzes.get(qa.quizId);
      if (params.courseId && quiz && quiz.courseId !== params.courseId) return false;
      return true;
    });

    const completedQuizAttempts = allQuizAttempts.filter(
      (qa) => qa.status === 'GRADED' || qa.status === 'SUBMITTED'
    );
    const passedQuizAttempts = completedQuizAttempts.filter(
      (qa) => qa.passed === true || qa.isPassed === true
    );
    const quizPassRate =
      completedQuizAttempts.length > 0
        ? Math.round((passedQuizAttempts.length / completedQuizAttempts.length) * 1000) / 10
        : 0;

    let quizScoreSum = 0;
    completedQuizAttempts.forEach((qa) => {
      const pct = qa.percentage ?? qa.scorePercent ?? (qa.maxScore && qa.score ? (qa.score / qa.maxScore) * 100 : 0);
      quizScoreSum += pct;
    });
    const avgQuizScore =
      completedQuizAttempts.length > 0 ? Math.round((quizScoreSum / completedQuizAttempts.length) * 10) / 10 : 0;

    // 3. Formal High-Stakes HSE Certification Examinations
    const allExamAttempts = Array.from(db.examAttempts.values()).filter((att) => {
      if (params.courseId) {
        const course = db.courses.get(params.courseId);
        const bp = db.examBlueprints.get(att.blueprintId);
        const matchesCourse =
          att.courseId === params.courseId ||
          (course && (bp?.certificationType === course.certificationType || att.certificationType === course.certificationType));
        if (!matchesCourse) return false;
      }
      return true;
    });

    const completedExamAttempts = allExamAttempts.filter((att) => att.status === 'COMPLETED');
    const pendingManual = allExamAttempts.filter(
      (att) => att.status === 'PENDING_MANUAL_EVALUATION'
    ).length;
    const passedExams = completedExamAttempts.filter((att) => att.passed === true).length;
    const totalPublishedExams = completedExamAttempts.length;

    const examPassRate =
      totalPublishedExams > 0 ? Math.round((passedExams / totalPublishedExams) * 1000) / 10 : 0;
    const examFailRate = totalPublishedExams > 0 ? Math.round((100 - examPassRate) * 10) / 10 : 0;

    const certCount = Array.from(db.certificates.values()).filter((c) => {
      if (params.courseId && c.courseId !== params.courseId) return false;
      return c.status === 'ISSUED';
    }).length;

    // Examination domain breakdown
    const domainMap = new Map<string, { totalPercent: number; count: number }>();
    completedExamAttempts.forEach((att) => {
      if (att.domainBreakdown) {
        Object.entries(att.domainBreakdown).forEach(([domain, stats]) => {
          const current = domainMap.get(domain) || { totalPercent: 0, count: 0 };
          current.totalPercent += stats.percent || 0;
          current.count += 1;
          domainMap.set(domain, current);
        });
      }
    });

    const domainPerformance = Array.from(domainMap.entries()).map(([domainName, data]) => ({
      domainName,
      averagePercent: data.count > 0 ? Math.round((data.totalPercent / data.count) * 10) / 10 : 0,
    }));

    return {
      assignments: {
        totalPublished: published.length,
        totalSubmissionsReceived: allSubmissions.length,
        overallSubmissionRatePercent: submissionRatePercent,
        pendingGradingCount: pendingGrading,
        gradedCount: graded.length,
        resubmissionsRequestedCount: resubmissionsRequested,
        averageAwardedScorePercent: avgScorePercent,
      },
      formativeQuizzes: {
        totalQuizzesConducted: allQuizzes.length,
        totalAttemptsCount: allQuizAttempts.length,
        completedAttemptsCount: completedQuizAttempts.length,
        passRatePercent: quizPassRate,
        averageScorePercent: avgQuizScore,
        frequentlyMissedTopics: [],
      },
      formalHseExams: {
        totalAttempts: allExamAttempts.length,
        completedAttempts: completedExamAttempts.length,
        pendingManualEvaluationCount: pendingManual,
        publishedResultsCount: totalPublishedExams,
        passRatePercent: examPassRate,
        failRatePercent: examFailRate,
        certificatesIssuedCount: certCount,
        domainPerformance,
      },
    };
  }

  /**
   * Generates Course Progression & Completion Telemetry Report.
   */
  public async getCourseProgressionAnalytics(params: ReportingFilterParams = {}): Promise<CourseProgressionReport> {
    const allCourses = Array.from(db.courses.values()).filter((c) => {
      if (params.courseId && c.id !== params.courseId) return false;
      return true;
    });

    const progressionItems: CourseProgressionItem[] = [];
    let totalEnrolledSum = 0;
    let totalCompletedSum = 0;

    allCourses.forEach((c) => {
      const courseEnrollments = Array.from(db.enrollments.values()).filter(
        (e) => e.courseId === c.id
      );
      const enrolledCount = courseEnrollments.length;
      const completedCount = courseEnrollments.filter((e) => e.status === 'COMPLETED').length;

      totalEnrolledSum += enrolledCount;
      totalCompletedSum += completedCount;

      const completionRate =
        enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 1000) / 10 : 0;

      let progressSum = 0;
      courseEnrollments.forEach((e) => {
        progressSum += e.progressPercent || 0;
      });
      const avgProgress =
        enrolledCount > 0 ? Math.round((progressSum / enrolledCount) * 10) / 10 : 0;

      progressionItems.push({
        courseId: c.id,
        courseTitle: c.title,
        certificationType: c.certificationType,
        enrolledStudentsCount: enrolledCount,
        completedStudentsCount: completedCount,
        completionRatePercent: completionRate,
        averageLessonProgressPercent: avgProgress,
        totalModulesCount: c.modulesCount || 0,
        totalLessonsCount: c.totalLessons || 0,
      });
    });

    const overallCompletionRatePercent =
      totalEnrolledSum > 0 ? Math.round((totalCompletedSum / totalEnrolledSum) * 1000) / 10 : 0;

    return {
      overallCompletionRatePercent,
      courses: progressionItems,
    };
  }

  /**
   * Generates Faculty & Instructor Workload Telemetry Report.
   */
  public async getInstructorAnalytics(params: ReportingFilterParams = {}): Promise<InstructorAnalyticsReport> {
    const allInstructors = Array.from(db.users.values()).filter(
      (u) => u.role === 'INSTRUCTOR' && (params.instructorId ? u.id === params.instructorId : true)
    );

    const facultyItems: InstructorWorkloadItem[] = [];
    let totalGradingBacklog = 0;

    allInstructors.forEach((inst) => {
      // Courses where instructor is lead
      const assignedCourses = Array.from(db.courses.values()).filter(
        (c) => c.leadInstructorId === inst.id
      );

      // Batches led by instructor
      const assignedBatches = Array.from(db.batches.values()).filter(
        (b) => b.leadInstructorId === inst.id
      );

      // Active learners in instructor's batches
      let activeLearners = 0;
      assignedBatches.forEach((b) => {
        activeLearners += b.enrolledCount || 0;
      });

      // Live sessions conducted
      const liveSessions = Array.from(db.liveSessions.values()).filter(
        (s) => s.instructorId === inst.id
      );

      // Assignments published in instructor's courses/batches
      const assignedCourseIds = new Set(assignedCourses.map((c) => c.id));
      const assignmentsPublished = Array.from(db.assignments.values()).filter(
        (a) => assignedCourseIds.has(a.courseId)
      ).length;

      // Submissions awaiting grading
      const submissions = Array.from(db.submissions.values()).filter((sub) => {
        if (!sub.courseId) return false;
        return assignedCourseIds.has(sub.courseId);
      });
      const awaitingGrading = submissions.filter((sub) => sub.status === 'SUBMITTED').length;
      totalGradingBacklog += awaitingGrading;

      const evaluationsCompleted = submissions.filter((sub) => sub.status === 'GRADED').length;

      // Doubts answered by this instructor
      const doubtsAnswered = Array.from(db.recordingDoubtAnswers.values()).filter(
        (ans) => ans.instructorId === inst.id
      ).length;

      facultyItems.push({
        instructorId: inst.id,
        instructorName: inst.name,
        instructorEmail: inst.email,
        assignedCoursesCount: assignedCourses.length,
        assignedBatchesCount: assignedBatches.length,
        activeLearnersCount: activeLearners,
        liveSessionsConductedCount: liveSessions.length,
        assignmentsPublishedCount: assignmentsPublished,
        submissionsAwaitingGradingCount: awaitingGrading,
        evaluationsCompletedCount: evaluationsCompleted,
        doubtsAnsweredCount: doubtsAnswered,
      });
    });

    return {
      totalActiveInstructors: allInstructors.length,
      totalGradingBacklog,
      faculty: facultyItems,
    };
  }

  /**
   * Generates Cohort Telemetry & Students Requiring Attention Report.
   * Employs 5 factual, rule-based indicators with zero black-box / hallucinated AI scores.
   */
  public async getStudentsRequiringAttention(
    params: ReportingFilterParams = {}
  ): Promise<StudentRequiringAttentionItem[]> {
    const now = new Date();
    const studentsMap = new Map<string, StudentRequiringAttentionItem>();

    const activeEnrollments = Array.from(db.enrollments.values()).filter((e) => {
      if (params.courseId && e.courseId !== params.courseId) return false;
      if (params.batchId && e.batchId !== params.batchId) return false;
      return e.status === 'ACTIVE';
    });

    // Pre-index submissions by studentId and assignmentId
    const submissionsByStudentAndAssignment = new Set<string>();
    Array.from(db.submissions.values()).forEach((sub) => {
      submissionsByStudentAndAssignment.add(`${sub.userId}:${sub.assignmentId}`);
    });

    // Pre-index doubt answers by doubtId
    const answeredDoubtIds = new Set<string>();
    Array.from(db.recordingDoubtAnswers.values()).forEach((ans) => {
      answeredDoubtIds.add(ans.doubtId);
    });

    // Pre-calculate session attendance per batch and per student
    const batchSessionsMap = new Map<string, string[]>();
    Array.from(db.liveSessions.values()).forEach((s) => {
      if (s.batchId) {
        const list = batchSessionsMap.get(s.batchId) || [];
        list.push(s.id);
        batchSessionsMap.set(s.batchId, list);
      }
    });

    for (const enrollment of activeEnrollments) {
      const student = db.users.get(enrollment.userId);
      if (!student) continue;

      const course = db.courses.get(enrollment.courseId);
      const batch = enrollment.batchId ? db.batches.get(enrollment.batchId) : undefined;
      const flags: StudentAttentionFlag[] = [];

      // 1. OVERDUE_ASSIGNMENT: Check published assignments where dueDate < now and student has no submission
      const relevantAssignments = Array.from(db.assignments.values()).filter(
        (a) =>
          a.courseId === enrollment.courseId &&
          (!a.batchId || a.batchId === enrollment.batchId) &&
          a.status === 'PUBLISHED'
      );

      for (const assignment of relevantAssignments) {
        if (assignment.dueDate && new Date(assignment.dueDate) < now) {
          const hasSubmission = submissionsByStudentAndAssignment.has(
            `${student.id}:${assignment.id}`
          );
          if (!hasSubmission) {
            flags.push({
              reasonCode: 'OVERDUE_ASSIGNMENT',
              reasonLabel: 'Overdue Assignment',
              detail: `Missing submission for "${assignment.title}" (Due ${assignment.dueDate.slice(0, 10)})`,
              severity: 'HIGH',
            });
            break; // Report at most one overdue assignment flag per student to avoid clutter
          }
        }
      }

      // 2. LOW_ATTENDANCE: Attendance < 60% across completed sessions
      let studentAttendancePercent = 100;
      if (enrollment.batchId && batchSessionsMap.has(enrollment.batchId)) {
        const sessionIds = batchSessionsMap.get(enrollment.batchId)!;
        if (sessionIds.length > 0) {
          let attendedCount = 0;
          sessionIds.forEach((sessionId) => {
            const records = db.attendance.get(sessionId) || [];
            const studentRecord = records.find((r) => r.userId === student.id);
            if (studentRecord?.attended) {
              attendedCount++;
            }
          });

          studentAttendancePercent = Math.round((attendedCount / sessionIds.length) * 100);
          if (studentAttendancePercent < 60 && sessionIds.length >= 2) {
            flags.push({
              reasonCode: 'LOW_ATTENDANCE',
              reasonLabel: 'Low Live Attendance',
              detail: `Attended ${attendedCount} of ${sessionIds.length} live sessions (${studentAttendancePercent}%)`,
              severity: 'HIGH',
            });
          }
        }
      }

      // 3. LOW_QUIZ_AVERAGE: Formative quiz average < 50%
      const studentQuizAttempts = Array.from(db.quizAttempts.values()).filter(
        (qa) => qa.userId === student.id
      );
      if (studentQuizAttempts.length >= 2) {
        let scoreSum = 0;
        studentQuizAttempts.forEach((qa) => {
          scoreSum += qa.percentage ?? qa.scorePercent ?? 0;
        });
        const avg = Math.round(scoreSum / studentQuizAttempts.length);
        if (avg < 50) {
          flags.push({
            reasonCode: 'LOW_QUIZ_AVERAGE',
            reasonLabel: 'Low Formative Quiz Scores',
            detail: `Average quiz score across ${studentQuizAttempts.length} attempts is ${avg}%`,
            severity: 'MEDIUM',
          });
        }
      }

      // 4. UNRESOLVED_DOUBT: Student asked a doubt > 48h ago that remains unanswered
      const studentDoubts = Array.from(db.recordingDoubts.values()).filter(
        (d) => d.userId === student.id && d.status === 'OPEN'
      );
      for (const doubt of studentDoubts) {
        if (!answeredDoubtIds.has(doubt.id) && doubt.createdAt) {
          const ageMs = now.getTime() - new Date(doubt.createdAt).getTime();
          if (ageMs > 48 * 60 * 60 * 1000) {
            flags.push({
              reasonCode: 'UNRESOLVED_DOUBT',
              reasonLabel: 'Unresolved Question / Doubt',
              detail: `Doubt on recording awaiting faculty response for > 48 hours`,
              severity: 'MEDIUM',
            });
            break;
          }
        }
      }

      // 5. STALLED_PROGRESS: Progress < 20% after > 30 days of enrollment
      const progressPercent = enrollment.progressPercent || 0;
      if (enrollment.enrolledAt) {
        const enrolledDays =
          (now.getTime() - new Date(enrollment.enrolledAt).getTime()) / (1000 * 60 * 60 * 24);
        if (enrolledDays > 30 && progressPercent < 20) {
          flags.push({
            reasonCode: 'STALLED_PROGRESS',
            reasonLabel: 'Stalled Academic Progress',
            detail: `Only ${progressPercent}% completed after ${Math.floor(enrolledDays)} days of enrollment`,
            severity: 'HIGH',
          });
        }
      }

      // If any factual flags triggered, add to report
      if (flags.length > 0) {
        studentsMap.set(student.id, {
          studentId: student.id,
          studentName: student.name,
          studentEmail: student.email,
          courseId: enrollment.courseId,
          courseTitle: course?.title || 'Unknown Course',
          batchId: enrollment.batchId || '',
          batchName: batch?.name || 'All Cohorts',
          lessonProgressPercent: progressPercent,
          attendancePercent: studentAttendancePercent,
          flags,
          lastActiveAt: enrollment.updatedAt || enrollment.enrolledAt,
        });
      }
    }

    return Array.from(studentsMap.values());
  }

  /**
   * Generates sanitized CSV export for any institutional reporting domain.
   */
  public async exportReportCsv(
    reportType: string,
    params: ReportingFilterParams = {}
  ): Promise<{ filename: string; csv: string }> {
    const timestamp = new Date().toISOString().slice(0, 10);

    switch (reportType) {
      case 'overview': {
        const kpis = await this.getExecutiveOverview(params);
        const rows = [
          { metric: 'Total Registered Students', value: kpis.totalRegisteredStudents },
          { metric: 'Active Enrolled Learners', value: kpis.activeEnrolledLearners },
          { metric: 'Total Active Enrolments', value: kpis.totalActiveEnrolments },
          { metric: 'New Admissions Count', value: kpis.newAdmissionsCount },
          { metric: 'Pending Admissions Count', value: kpis.pendingApplicationsCount },
          { metric: 'Admissions Conversion Rate (%)', value: `${kpis.admissionsConversionRatePercent}%` },
          { metric: 'Active Published Courses', value: kpis.activeCoursesCount },
          { metric: 'Active Cohort Batches', value: kpis.activeBatchesCount },
          { metric: 'Batch Capacity Utilization (%)', value: `${kpis.overallBatchCapacityUtilizationPercent}%` },
          { metric: 'Average Live Classroom Attendance (%)', value: `${kpis.averageLiveAttendancePercent}%` },
          { metric: 'Assignment Submission Rate (%)', value: `${kpis.assignmentSubmissionRatePercent}%` },
          { metric: 'Assignment Grading Backlog', value: kpis.assignmentGradingBacklogCount },
          { metric: 'Formal HSE Examination Pass Rate (%)', value: `${kpis.formalExamPassRatePercent}%` },
          { metric: 'Pending Formal Exam Manual Evaluations', value: kpis.pendingExamEvaluationsCount },
          { metric: 'Overall Course Completion Rate (%)', value: `${kpis.overallCourseCompletionRatePercent}%` },
          { metric: 'Students Flagged for Attention', value: kpis.studentsRequiringAttentionCount },
        ];
        const csv = generateSanitizedCsv(
          [
            { key: 'metric', label: 'Institutional KPI Metric' },
            { key: 'value', label: 'Value' },
          ],
          rows
        );
        return { filename: `zealosh_executive_overview_${timestamp}.csv`, csv };
      }

      case 'batches':
      case 'enrollments': {
        const report = await this.getEnrollmentAnalytics(params);
        const csv = generateSanitizedCsv<BatchOccupancyItem>(
          [
            { key: 'batchName', label: 'Cohort Batch Name' },
            { key: 'courseTitle', label: 'Course Title' },
            { key: 'leadInstructorName', label: 'Lead Instructor' },
            { key: 'configuredCapacity', label: 'Capacity' },
            { key: 'activeEnrolledCount', label: 'Active Enrolled' },
            { key: 'availableSeats', label: 'Available Seats' },
            { key: 'occupancyPercent', label: 'Occupancy %', format: (val) => `${val}%` },
            { key: 'occupancyStatus', label: 'Occupancy Status' },
            { key: 'startDate', label: 'Start Date' },
            { key: 'endDate', label: 'End Date' },
          ],
          report.batches
        );
        return { filename: `zealosh_batch_occupancy_${timestamp}.csv`, csv };
      }

      case 'attendance': {
        const report = await this.getAttendanceAnalytics(params);
        const csv = generateSanitizedCsv<SessionAttendanceItem>(
          [
            { key: 'sessionTitle', label: 'Session Title' },
            { key: 'courseTitle', label: 'Course' },
            { key: 'batchName', label: 'Batch' },
            { key: 'instructorName', label: 'Instructor' },
            { key: 'scheduledStartTime', label: 'Scheduled Start' },
            { key: 'scheduledDurationMinutes', label: 'Scheduled Mins' },
            { key: 'eligibleStudentCount', label: 'Eligible Students' },
            { key: 'attendedStudentCount', label: 'Attended Students' },
            { key: 'attendanceRatePercent', label: 'Attendance %', format: (v) => `${v}%` },
            { key: 'averageAttendedMinutes', label: 'Avg Attended Mins' },
            { key: 'status', label: 'Status' },
          ],
          report.recentSessions
        );
        return { filename: `zealosh_session_attendance_${timestamp}.csv`, csv };
      }

      case 'progression': {
        const report = await this.getCourseProgressionAnalytics(params);
        const csv = generateSanitizedCsv<CourseProgressionItem>(
          [
            { key: 'courseTitle', label: 'Course Title' },
            { key: 'certificationType', label: 'Certification' },
            { key: 'enrolledStudentsCount', label: 'Enrolled Students' },
            { key: 'completedStudentsCount', label: 'Completed Students' },
            { key: 'completionRatePercent', label: 'Completion %', format: (v) => `${v}%` },
            { key: 'averageLessonProgressPercent', label: 'Avg Progress %', format: (v) => `${v}%` },
            { key: 'totalModulesCount', label: 'Modules Count' },
            { key: 'totalLessonsCount', label: 'Lessons Count' },
          ],
          report.courses
        );
        return { filename: `zealosh_course_progression_${timestamp}.csv`, csv };
      }

      case 'faculty': {
        const report = await this.getInstructorAnalytics(params);
        const csv = generateSanitizedCsv<InstructorWorkloadItem>(
          [
            { key: 'instructorName', label: 'Instructor Name' },
            { key: 'instructorEmail', label: 'Email' },
            { key: 'assignedCoursesCount', label: 'Courses' },
            { key: 'assignedBatchesCount', label: 'Batches' },
            { key: 'activeLearnersCount', label: 'Active Learners' },
            { key: 'liveSessionsConductedCount', label: 'Sessions Conducted' },
            { key: 'assignmentsPublishedCount', label: 'Assignments Published' },
            { key: 'submissionsAwaitingGradingCount', label: 'Grading Backlog' },
            { key: 'evaluationsCompletedCount', label: 'Evaluations Done' },
            { key: 'doubtsAnsweredCount', label: 'Doubts Answered' },
          ],
          report.faculty
        );
        return { filename: `zealosh_faculty_workload_${timestamp}.csv`, csv };
      }

      case 'attention': {
        const students = await this.getStudentsRequiringAttention(params);
        const rows = students.map((s) => ({
          studentName: s.studentName,
          studentEmail: s.studentEmail,
          courseTitle: s.courseTitle,
          batchName: s.batchName,
          lessonProgressPercent: `${s.lessonProgressPercent}%`,
          attendancePercent: `${s.attendancePercent}%`,
          reasons: s.flags.map((f) => `${f.reasonLabel}: ${f.detail}`).join('; '),
          severity: s.flags.some((f) => f.severity === 'HIGH') ? 'HIGH' : 'MEDIUM',
        }));

        const csv = generateSanitizedCsv(
          [
            { key: 'studentName', label: 'Student Name' },
            { key: 'studentEmail', label: 'Email' },
            { key: 'courseTitle', label: 'Course' },
            { key: 'batchName', label: 'Batch' },
            { key: 'lessonProgressPercent', label: 'Lesson Progress' },
            { key: 'attendancePercent', label: 'Attendance %' },
            { key: 'severity', label: 'Attention Severity' },
            { key: 'reasons', label: 'Factual Attention Indicators' },
          ],
          rows
        );
        return { filename: `zealosh_students_requiring_attention_${timestamp}.csv`, csv };
      }

      default:
        throw new Error(`Unsupported report export type: ${reportType}`);
    }
  }
}

export const reportingService = new ReportingService();
