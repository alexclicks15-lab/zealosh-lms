import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import {
  DeliveryMode,
  LearningMaterial,
  Quiz,
  QuizQuestion,
  CourseCompletionPolicy,
} from '@/types';

describe('Zealosh LMS — Phase 2: Learning Delivery & Academic Engine', () => {
  beforeEach(async () => {
    // Reset database to ensure clean deterministic state
    db.resetToSeed();
  });

  // ==========================================================================
  // 1. Delivery Mode Inheritance Cascade
  // ==========================================================================
  describe('1. Delivery Mode Inheritance Cascade (Course -> Batch -> Student)', () => {
    it('should compute effective delivery configuration from course default when no overrides exist', async () => {
      // crs-asp-01 is configured as HYBRID in seed defaults
      const config = await db.getEffectiveDeliveryConfig('crs-asp-01');
      expect(config).toBeDefined();
      expect(config.effectiveMode).toBe('HYBRID');
      expect(config.allowLiveClassroom).toBe(true);
      expect(config.allowRecordedLessons).toBe(true);
      expect(config.inheritedFrom).toBe('COURSE');
    });

    it('should allow batch override to restrict delivery to ONLINE_ONLY and disable downloads', async () => {
      // btc-asp-weekday overrides crs-asp-01 to ONLINE_ONLY with downloads disabled
      const config = await db.getEffectiveDeliveryConfig('crs-asp-01', 'btc-asp-weekday');
      expect(config).toBeDefined();
      expect(config.effectiveMode).toBe('ONLINE_ONLY');
      expect(config.allowLiveClassroom).toBe(true);
      expect(config.allowRecordedLessons).toBe(false);
      expect(config.allowMaterialDownloads).toBe(false);
      expect(config.inheritedFrom).toBe('BATCH');
    });

    it('should allow batch override to RECORDED_ONLY and disable live classroom', async () => {
      // btc-asp-weekend overrides crs-asp-01 to RECORDED_ONLY
      const config = await db.getEffectiveDeliveryConfig('crs-asp-01', 'btc-asp-weekend');
      expect(config).toBeDefined();
      expect(config.effectiveMode).toBe('RECORDED_ONLY');
      expect(config.allowLiveClassroom).toBe(false);
      expect(config.allowRecordedLessons).toBe(true);
      expect(config.allowMaterialDownloads).toBe(true);
      expect(config.inheritedFrom).toBe('BATCH');
    });

    it('should prioritize student exception override over course and batch configurations', async () => {
      // Create student specific override
      await db.saveDeliveryConfig({
        entityType: 'STUDENT',
        entityId: 'usr-student-special',
        deliveryMode: 'ALL_MODES',
        settings: {
          allowLiveClassroom: true,
          allowRecordedLessons: true,
          allowMaterialDownloads: true,
        },
      });

      const config = await db.getEffectiveDeliveryConfig('crs-asp-01', 'btc-asp-weekday', 'usr-student-special');
      expect(config.effectiveMode).toBe('ALL_MODES');
      expect(config.allowRecordedLessons).toBe(true);
      expect(config.allowMaterialDownloads).toBe(true);
      expect(config.inheritedFrom).toBe('STUDENT');
    });
  });

  // ==========================================================================
  // 2. Learning Material Granular Permissions & Gating
  // ==========================================================================
  describe('2. Learning Material Granular Permissions & Access Control', () => {
    it('should respect granular material permissions (view vs download)', async () => {
      const material = await db.saveLearningMaterial({
        courseId: 'crs-asp-01',
        title: 'Confidential Exam Blueprint Reference',
        description: 'View only reference document',
        materialType: 'BLUEPRINT',
        fileUrl: '/materials/blueprint-v1.pdf',
        fileSizeBytes: 2048576,
        fileFormat: 'pdf',
        allowView: true,
        allowDownload: false,
        allowPrint: false,
        watermarkEnabled: true,
      });

      expect(material.id).toBeDefined();
      expect(material.allowView).toBe(true);
      expect(material.allowDownload).toBe(false);

      // Student in weekend batch (where downloads are allowed by delivery mode, but blocked on material level)
      const access = await db.checkMaterialAccess(material.id, 'usr-student-01', 'btc-asp-weekend');
      expect(access.canView).toBe(true);
      expect(access.canDownload).toBe(false);
      expect(access.reason).toContain('disabled on this material');
    });

    it('should block download if student batch delivery mode disables downloads even if material allows it', async () => {
      const material = await db.saveLearningMaterial({
        courseId: 'crs-asp-01',
        title: 'Weekly Lecture Handout',
        description: 'Open handout',
        materialType: 'HANDOUT',
        fileUrl: '/materials/handout-1.pdf',
        fileSizeBytes: 1048576,
        fileFormat: 'pdf',
        allowView: true,
        allowDownload: true, // Material permits download
      });

      // Student in weekday batch (where delivery mode explicitly disables material downloads)
      const access = await db.checkMaterialAccess(material.id, 'usr-student-01', 'btc-asp-weekday');
      expect(access.canView).toBe(true);
      expect(access.canDownload).toBe(false);
      expect(access.reason).toContain('batch delivery configuration');
    });

    it('should always permit instructor and admin full view and download access', async () => {
      const material = await db.saveLearningMaterial({
        courseId: 'crs-asp-01',
        title: 'Instructor Solution Manual',
        materialType: 'HANDOUT',
        fileUrl: '/materials/solutions.pdf',
        fileSizeBytes: 512000,
        fileFormat: 'pdf',
        allowView: false,
        allowDownload: false,
      });

      // Admin user
      const adminAccess = await db.checkMaterialAccess(material.id, 'usr-admin-01');
      expect(adminAccess.canView).toBe(true);
      expect(adminAccess.canDownload).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Formative Quizzes & Secret Answer Key Concealment
  // ==========================================================================
  describe('3. Unified Question Bank & Formative Quizzes', () => {
    it('should strictly conceal answer keys and explanations from student callers', async () => {
      const quiz = await db.saveQuiz({
        courseId: 'crs-asp-01',
        title: 'Safety Engineering Formative Assessment',
        quizType: 'TOPIC_QUIZ',
        passingScorePercent: 70,
      });

      await db.saveQuizQuestion({
        quizId: quiz.id,
        questionText: 'What is the permissible exposure limit for noise over an 8-hour TWA under OSHA standards?',
        questionType: 'SINGLE_CHOICE',
        options: [
          { id: 'opt-1', text: '85 dBA' },
          { id: 'opt-2', text: '90 dBA' },
          { id: 'opt-3', text: '95 dBA' },
          { id: 'opt-4', text: '100 dBA' },
        ],
        correctAnswer: 'opt-2',
        explanation: 'OSHA 1910.95 sets 90 dBA as the 8-hour TWA permissible exposure limit (PEL).',
        points: 2,
      });

      // Student access: includeAnswers = false
      const studentQuestions = await db.getQuizQuestions(quiz.id, false);
      expect(studentQuestions.length).toBe(1);
      expect(studentQuestions[0].correctAnswer).toBeUndefined();
      expect(studentQuestions[0].explanation).toBeUndefined();
      expect(studentQuestions[0].options.length).toBe(4);

      // Instructor access: includeAnswers = true
      const instructorQuestions = await db.getQuizQuestions(quiz.id, true);
      expect(instructorQuestions.length).toBe(1);
      expect(instructorQuestions[0].correctAnswer).toBe('opt-2');
      expect(instructorQuestions[0].explanation).toContain('OSHA 1910.95');
    });

    it('should execute quiz attempt lifecycle, autosave answers, and compute score accurately', async () => {
      const quiz = await db.saveQuiz({
        courseId: 'crs-asp-01',
        title: 'Industrial Hygiene Drill',
        quizType: 'PRACTICE_DRILL',
        passingScorePercent: 50,
      });

      const q1 = await db.saveQuizQuestion({
        quizId: quiz.id,
        questionText: 'Q1: Which hierarchy of control is most effective?',
        questionType: 'SINGLE_CHOICE',
        options: [
          { id: 'a', text: 'PPE' },
          { id: 'b', text: 'Elimination' },
        ],
        correctAnswer: 'b',
        points: 5,
      });

      const q2 = await db.saveQuizQuestion({
        quizId: quiz.id,
        questionText: 'Q2: Is ventilation an engineering control?',
        questionType: 'SINGLE_CHOICE',
        options: [
          { id: 'yes', text: 'Yes' },
          { id: 'no', text: 'No' },
        ],
        correctAnswer: 'yes',
        points: 5,
      });

      // 1. Start attempt
      const attempt = await db.startQuizAttempt(quiz.id, 'usr-student-01');
      expect(attempt.status).toBe('IN_PROGRESS');
      expect(attempt.attemptNumber).toBe(1);

      // 2. Autosave in-flight answers
      await db.saveQuizAttemptAnswer(attempt.id, q1.id, 'b'); // Correct
      await db.saveQuizAttemptAnswer(attempt.id, q2.id, 'no'); // Incorrect

      // 3. Submit attempt
      const completed = await db.submitQuizAttempt(attempt.id);
      expect(completed.status).toBe('SUBMITTED');
      expect(completed.score).toBe(5);
      expect(completed.maxScore).toBe(10);
      expect(completed.scorePercent).toBe(50);
      expect(completed.isPassed).toBe(true);
    });
  });

  // ==========================================================================
  // 4. BigBlueButton Live Quiz Integration & Real-Time Score Dashboard
  // ==========================================================================
  describe('4. BigBlueButton Live Quiz & Instructor Score Dashboard', () => {
    it('should activate live quiz, track multi-student participation, and compute real-time statistics', async () => {
      const quiz = await db.saveQuiz({
        courseId: 'crs-asp-01',
        title: 'Live Classroom Fire Protection Pop-Quiz',
        quizType: 'LIVE_CLASS_QUIZ',
        passingScorePercent: 70,
      });

      const q1 = await db.saveQuizQuestion({
        quizId: quiz.id,
        questionText: 'Which class of fire involves flammable liquids?',
        questionType: 'SINGLE_CHOICE',
        options: [
          { id: 'opt-a', text: 'Class A' },
          { id: 'opt-b', text: 'Class B' },
          { id: 'opt-c', text: 'Class C' },
        ],
        correctAnswer: 'opt-b',
        points: 10,
      });

      // 1. Instructor activates quiz for live session
      const activated = await db.activateLiveQuiz(quiz.id, 'sess-live-01');
      expect(activated.isLiveActive).toBe(true);
      expect(activated.liveSessionId).toBe('sess-live-01');

      // 2. Student 1 takes quiz and submits correct answer
      const att1 = await db.startQuizAttempt(quiz.id, 'usr-student-01');
      await db.saveQuizAttemptAnswer(att1.id, q1.id, 'opt-b');
      await db.submitQuizAttempt(att1.id);

      // 3. Student 2 takes quiz and submits incorrect answer
      const att2 = await db.startQuizAttempt(quiz.id, 'usr-student-02');
      await db.saveQuizAttemptAnswer(att2.id, q1.id, 'opt-a');
      await db.submitQuizAttempt(att2.id);

      // 4. Query live score dashboard for instructor
      const dashboard = await db.getLiveScoreDashboard(quiz.id, 'sess-live-01');
      expect(dashboard.participantCount).toBe(2);
      expect(dashboard.submittedCount).toBe(2);
      expect(dashboard.averageScorePercent).toBe(50); // (100 + 0) / 2 = 50%
      expect(dashboard.students?.length).toBe(2);

      // Check per-question statistics
      expect(dashboard.questionStats.length).toBe(1);
      const stat = dashboard.questionStats[0];
      expect(stat.percentCorrect).toBe(50);
      expect(stat.optionBreakdown?.['opt-b']).toBe(1);
      expect(stat.optionBreakdown?.['opt-a']).toBe(1);

      // 5. Deactivate live quiz
      const deactivated = await db.deactivateLiveQuiz(quiz.id);
      expect(deactivated.isLiveActive).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Video Playback Resume & Learning Progress Tracking
  // ==========================================================================
  describe('5. Video Playback Resume & Granular Progress Tracking', () => {
    it('should accurately store and retrieve video resume position and completion state', async () => {
      await db.updateLearningProgress({
        userId: 'usr-student-01',
        courseId: 'crs-asp-01',
        lessonId: 'les-asp-01',
        activityType: 'PRERECORDED_VIDEO',
        playbackPositionSeconds: 432,
        totalDurationSeconds: 1200,
        isCompleted: false,
        bookmarks: [{ timestampSeconds: 120, label: 'OSHA PEL Formula Discussion' }],
        notes: 'Review permissible noise limits before quiz.',
      });

      const progress = await db.getLessonProgress('usr-student-01', 'crs-asp-01', 'les-asp-01');
      expect(progress).toBeDefined();
      expect(progress?.playbackPositionSeconds).toBe(432);
      expect(progress?.totalDurationSeconds).toBe(1200);
      expect(progress?.isCompleted).toBe(false);
      expect(progress?.bookmarks?.length).toBe(1);
      expect(progress?.bookmarks?.[0].label).toBe('OSHA PEL Formula Discussion');
      expect(progress?.notes).toContain('Review permissible noise limits');

      // Update to completed when video finishes
      await db.updateLearningProgress({
        userId: 'usr-student-01',
        courseId: 'crs-asp-01',
        lessonId: 'les-asp-01',
        activityType: 'PRERECORDED_VIDEO',
        playbackPositionSeconds: 1200,
        totalDurationSeconds: 1200,
        isCompleted: true,
      });

      const updated = await db.getLessonProgress('usr-student-01', 'crs-asp-01', 'les-asp-01');
      expect(updated?.isCompleted).toBe(true);
      expect(updated?.completedAt).toBeDefined();
    });
  });

  // ==========================================================================
  // 6. Multi-Criteria Course Completion & Automatic Collision-Free Certificate Issuance
  // ==========================================================================
  describe('6. Multi-Criteria Course Completion & Collision-Free Certificate Issuance', () => {
    it('should evaluate course completion criteria and issue certificate ZEI/COURSE/YYYY/XXXXXX', async () => {
      // Find active enrollment
      const enrollments = await db.getEnrollments('usr-student-01');
      const enrollment = enrollments.find((e) => e.courseId === 'crs-asp-01');
      expect(enrollment).toBeDefined();

      // Configure course completion policy
      await db.saveCourseCompletionPolicy({
        courseId: 'crs-asp-01',
        minLessonsCompletedPercent: 50,
        minQuizAveragePercent: 60,
        minLiveAttendancePercent: 0,
        mandatoryAssignmentIds: [],
        requireFormalExamPass: false,
      });

      // Update enrollment progress to satisfy 50%
      await db.updateEnrollmentProgress(enrollment!.id, ['les-asp-01', 'les-asp-02'], 100);

      // Evaluate completion
      const evaluation = await db.evaluateCourseCompletion(enrollment!.id);
      expect(evaluation.isCompleted).toBe(true);
      expect(evaluation.criteriaBreakdown.lessonsPassed).toBe(true);

      // Automatic Certificate Issuance
      const cert = await db.issueAutomaticCertificate(enrollment!.id, 'COURSE_COMPLETION');
      expect(cert).toBeDefined();
      expect(cert.certificateCode).toMatch(/^ZEI\/COURSE\/\d{4}\/\d{6}$/);
      expect(cert.status).toBe('ISSUED');
      expect(cert.courseTitle).toContain('ASP');

      // Verify Idempotency: calling again returns the identical certificate
      const certAgain = await db.issueAutomaticCertificate(enrollment!.id, 'COURSE_COMPLETION');
      expect(certAgain.id).toBe(cert.id);
      expect(certAgain.certificateCode).toBe(cert.certificateCode);

      // Public verification
      const verified = await db.verifyCertificate(cert.certificateCode);
      expect(verified).toBeDefined();
      expect(verified?.id).toBe(cert.id);
      expect(verified?.status).toBe('ISSUED');
    });
  });

  // ==========================================================================
  // 7. Cross-Batch Recording Highlights & Doubt Knowledge Base Promotion
  // ==========================================================================
  describe('7. Highlights Course-Wide Sharing & Doubt Knowledge Base Promotion', () => {
    it('should aggregate highlights across all batches for a given course', async () => {
      const highlights = await db.getCourseHighlights('crs-asp-01');
      expect(Array.isArray(highlights)).toBe(true);
      // Highlights should be accessible to students from both weekday and weekend cohorts
    });

    it('should promote resolved doubt to public knowledge base with student identity anonymized', async () => {
      // Create seed doubt
      const doubt = await db.saveRecordingDoubt({
        recordingId: 'rec-asp-01',
        userId: 'usr-student-01',
        userName: 'John Doe Private Name',
        userRole: 'STUDENT',
        timestampSeconds: 154,
        question: 'How do you calculate the upper explosive limit for methane mixtures?',
        status: 'OPEN',
        isPublic: false,
      });

      expect(doubt.isPublic).toBe(false);

      // Instructor promotes to knowledge base
      const promoted = await db.promoteDoubtToKnowledgeBase(doubt.id, 'usr-instructor-01');
      expect(promoted.isPublic).toBe(true);
      expect(promoted.status).toBe('RESOLVED');
      expect(promoted.userName).toBe('Verified Student Question'); // Anonymized
    });
  });

  // ==========================================================================
  // 8. Error Logging & Student Problem Reporting Lifecycle
  // ==========================================================================
  describe('8. Central Error Logging & Student Problem Reporting Lifecycle', () => {
    it('should log application errors and allow administrators to resolve them', async () => {
      const log = await db.recordAppErrorLog({
        severity: 'CRITICAL',
        module: 'EXAM_PLAYER',
        errorMessage: 'Connection lost during final submit checkpoint',
        errorStack: 'Error: Connection lost at Socket.emit (/exam/socket.js:45)',
        userId: 'usr-student-01',
      });

      expect(log.id).toBeDefined();
      expect(log.status).toBe('NEW');
      expect(log.severity).toBe('CRITICAL');

      // Admin updates status to RESOLVED
      const updated = await db.updateAppErrorLogStatus(
        log.id,
        'RESOLVED',
        'Verified graceful retry mechanism in client player',
        'admin@zealosh.com'
      );

      expect(updated?.status).toBe('RESOLVED');
      expect(updated?.resolvedBy).toBe('admin@zealosh.com');
      expect(updated?.resolutionNotes).toContain('graceful retry mechanism');
    });

    it('should generate collision-free REP-YYYY-XXXX problem report tickets and track resolution', async () => {
      const currentYear = new Date().getFullYear();
      const report = await db.createStudentProblemReport({
        userId: 'usr-student-01',
        userEmail: 'student@zealosh.com',
        userName: 'Arjun Menon',
        category: 'VIDEO_PLAYBACK',
        title: 'Video stuttering at 14:30 in Module 1',
        description: 'Playback buffer stalls consistently on 1080p stream.',
        courseId: 'crs-asp-01',
      });

      expect(report.id).toBeDefined();
      expect(report.ticketNumber).toMatch(new RegExp(`^REP-${currentYear}-\\d{4}$`));
      expect(report.status).toBe('NEW');

      // Instructor/Admin assigns and resolves ticket
      const resolved = await db.updateStudentProblemReport(
        report.id,
        'RESOLVED',
        'Video transcode re-encoded with adaptive bitrate multi-resolution streams.',
        'instructor@zealosh.com'
      );

      expect(resolved?.status).toBe('RESOLVED');
      expect(resolved?.assignedTo).toBe('instructor@zealosh.com');
      expect(resolved?.resolutionNotes).toContain('adaptive bitrate');
    });
  });
});
