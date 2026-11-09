// Zealosh LMS — Phase 5A In-App Notification Service
// Orchestrates trusted, server-authoritative event notifications across academic workflows
// Enforces audience resolution, idempotency protection, and ADR-004 PostgreSQL persistence

import { db } from '@/lib/store/db';
import { emailOutboxService } from '@/lib/email/email-outbox-service';
import {
  InAppNotification,
  ClassroomAnnouncement,
  Assignment,
  AssignmentSubmission,
  LiveSession,
  User,
} from '@/types';

class NotificationService {
  /**
   * Dispatches notifications when an announcement is published
   * Audience: Enrolled students in the specific batch (if batch-specific) or all enrolled students in the course
   */
  public async notifyAnnouncementPublished(
    announcement: ClassroomAnnouncement,
    courseSlug?: string
  ): Promise<number> {
    try {
      let recipientStudentIds: string[] = [];

      if (announcement.audienceScope === 'BATCH_SPECIFIC' && announcement.batchId) {
        // Only active students in this exact batch
        const batchEnrollments = Array.from(db.enrollments.values()).filter(
          (e) => e.courseId === announcement.courseId && e.batchId === announcement.batchId && e.status === 'ACTIVE'
        );
        recipientStudentIds = Array.from(new Set(batchEnrollments.map((e) => e.userId)));
      } else {
        // Course-wide: all active students in the course
        const courseEnrollments = Array.from(db.enrollments.values()).filter(
          (e) => e.courseId === announcement.courseId && e.status === 'ACTIVE'
        );
        recipientStudentIds = Array.from(new Set(courseEnrollments.map((e) => e.userId)));
      }

      // Filter out author if author is somehow enrolled
      recipientStudentIds = recipientStudentIds.filter((uid) => uid !== announcement.authorId);
      if (recipientStudentIds.length === 0) return 0;

      const slug = courseSlug || announcement.courseId;
      const notifications = recipientStudentIds.map((userId) => ({
        recipientUserId: userId,
        type: 'ANNOUNCEMENT_NEW' as const,
        title: `New Announcement: ${announcement.title}`,
        description:
          announcement.content.length > 140
            ? announcement.content.substring(0, 137) + '...'
            : announcement.content,
        entityType: 'ANNOUNCEMENT' as const,
        entityId: announcement.id,
        courseId: announcement.courseId,
        batchId: announcement.batchId,
        actionUrl: `/courses/${slug}/classroom?tab=stream`,
        idempotencyKey: `notif_anc_${announcement.id}_${userId}`,
      }));

      const count = await db.createBatchNotifications(notifications);

      // Phase 5B: Asynchronously queue transactional emails for outbox dispatch
      try {
        const course = await db.getCourseById(announcement.courseId);
        const courseTitle = course?.title || 'Zealosh HSE Course';
        const recipientUsers = (await Promise.all(recipientStudentIds.map((id) => db.getUser(id)))).filter(Boolean) as User[];
        await emailOutboxService.queueAnnouncementEmails(announcement, courseTitle, recipientUsers, slug);
      } catch (emailErr) {
        console.error('[NotificationService] Non-blocking email outbox queue error (announcement):', emailErr);
      }

      return count;
    } catch (err) {
      console.error('[NotificationService] Failed to dispatch announcement notifications:', err);
      return 0;
    }
  }

  /**
   * Dispatches notifications when a new coursework assignment is published
   */
  public async notifyAssignmentPublished(
    assignment: Assignment,
    courseSlug?: string
  ): Promise<number> {
    try {
      let recipientStudentIds: string[] = [];

      if (assignment.batchId) {
        const batchEnrollments = Array.from(db.enrollments.values()).filter(
          (e) => e.courseId === assignment.courseId && e.batchId === assignment.batchId && e.status === 'ACTIVE'
        );
        recipientStudentIds = Array.from(new Set(batchEnrollments.map((e) => e.userId)));
      } else {
        const courseEnrollments = Array.from(db.enrollments.values()).filter(
          (e) => e.courseId === assignment.courseId && e.status === 'ACTIVE'
        );
        recipientStudentIds = Array.from(new Set(courseEnrollments.map((e) => e.userId)));
      }

      if (recipientStudentIds.length === 0) return 0;

      const slug = courseSlug || assignment.courseId;
      const formattedDate = new Date(assignment.dueDate).toLocaleDateString();

      const notifications = recipientStudentIds.map((userId) => ({
        recipientUserId: userId,
        type: 'ASSIGNMENT_PUBLISHED' as const,
        title: `New Assignment: ${assignment.title}`,
        description: `Coursework assignment posted. Due date: ${formattedDate}. Max score: ${assignment.maxScore} pts.`,
        entityType: 'ASSIGNMENT' as const,
        entityId: assignment.id,
        courseId: assignment.courseId,
        batchId: assignment.batchId,
        actionUrl: `/courses/${slug}/classroom?tab=classwork`,
        idempotencyKey: `notif_asg_pub_${assignment.id}_${userId}`,
      }));

      const count = await db.createBatchNotifications(notifications);

      // Phase 5B: Asynchronously queue transactional emails for outbox dispatch
      try {
        const course = await db.getCourseById(assignment.courseId);
        const courseTitle = course?.title || 'Zealosh HSE Course';
        const recipientUsers = (await Promise.all(recipientStudentIds.map((id) => db.getUser(id)))).filter(Boolean) as User[];
        await emailOutboxService.queueAssignmentPublishedEmails(assignment, courseTitle, recipientUsers, slug);
      } catch (emailErr) {
        console.error('[NotificationService] Non-blocking email outbox queue error (assignment published):', emailErr);
      }

      return count;
    } catch (err) {
      console.error('[NotificationService] Failed to dispatch assignment published notifications:', err);
      return 0;
    }
  }

  /**
   * Dispatches notifications upon student coursework submission (to instructors & student confirmation)
   */
  public async notifyAssignmentSubmitted(
    submission: AssignmentSubmission,
    assignment: Assignment,
    studentName: string,
    courseSlug?: string
  ): Promise<number> {
    try {
      const course = await db.getCourseById(assignment.courseId);
      const instructorIds = new Set<string>();

      if (course?.leadInstructorId) instructorIds.add(course.leadInstructorId);
      if (course?.coInstructorIds) {
        course.coInstructorIds.forEach((id) => instructorIds.add(id));
      }
      if (assignment.batchId) {
        const batch = await db.getBatch(assignment.batchId);
        if (batch?.leadInstructorId) instructorIds.add(batch.leadInstructorId);
      }

      const slug = courseSlug || assignment.courseId;
      const notifications: Array<any> = [];

      // Instructor notifications
      for (const instId of instructorIds) {
        notifications.push({
          recipientUserId: instId,
          type: 'ASSIGNMENT_SUBMITTED' as const,
          title: `Coursework Submitted: ${assignment.title}`,
          description: `${studentName} has submitted coursework for ${assignment.title}. Pending rubric evaluation.`,
          entityType: 'SUBMISSION' as const,
          entityId: submission.id,
          courseId: assignment.courseId,
          batchId: assignment.batchId,
          actionUrl: `/courses/${slug}/classroom?tab=grades`,
          idempotencyKey: `notif_asg_sub_${submission.id}_${instId}`,
        });
      }

      // Submitting student confirmation notification
      notifications.push({
        recipientUserId: submission.userId,
        type: 'ASSIGNMENT_SUBMITTED' as const,
        title: `Submission Received: ${assignment.title}`,
        description: `Your coursework for ${assignment.title} was successfully recorded and queued for grading.`,
        entityType: 'SUBMISSION' as const,
        entityId: submission.id,
        courseId: assignment.courseId,
        batchId: assignment.batchId,
        actionUrl: `/courses/${slug}/classroom?tab=grades`,
        idempotencyKey: `notif_sub_conf_${submission.id}_${submission.userId}`,
      });

      const count = await db.createBatchNotifications(notifications);

      // Phase 5B: Asynchronously queue transactional emails for outbox dispatch
      try {
        const studentUser = (await db.getUser(submission.userId)) || ({
          id: submission.userId,
          name: studentName,
          email: 'student@zealosh.com',
          role: 'STUDENT',
          createdAt: new Date().toISOString(),
        } as User);
        const instructors = (await Promise.all(Array.from(instructorIds).map((id) => db.getUser(id)))).filter(Boolean) as User[];
        const courseTitle = course?.title || 'Zealosh HSE Course';
        await emailOutboxService.queueAssignmentSubmittedEmails(submission, assignment, courseTitle, studentUser, instructors, slug);
      } catch (emailErr) {
        console.error('[NotificationService] Non-blocking email outbox queue error (assignment submitted):', emailErr);
      }

      return count;
    } catch (err) {
      console.error('[NotificationService] Failed to dispatch assignment submission notifications:', err);
      return 0;
    }
  }

  /**
   * Dispatches notification to student when faculty grades their submission
   */
  public async notifyAssignmentGraded(
    submission: AssignmentSubmission,
    assignment: Assignment,
    courseSlug?: string
  ): Promise<boolean> {
    try {
      const slug = courseSlug || assignment.courseId;
      const scoreText = submission.score !== undefined ? `${submission.score}/${assignment.maxScore}` : 'Evaluated';
      const feedbackSnippet = submission.feedback ? ` Feedback: ${submission.feedback.substring(0, 80)}` : '';

      const created = await db.createNotification({
        recipientUserId: submission.userId,
        type: 'ASSIGNMENT_GRADED',
        title: `Assignment Graded: ${assignment.title}`,
        description: `Your submission for ${assignment.title} has been evaluated: ${scoreText}.${feedbackSnippet}`,
        entityType: 'SUBMISSION',
        entityId: submission.id,
        courseId: assignment.courseId,
        batchId: assignment.batchId,
        actionUrl: `/courses/${slug}/classroom?tab=grades`,
        idempotencyKey: `notif_grade_${submission.id}_${submission.updatedAt || submission.gradedAt || 'v1'}`,
      });

      // Phase 5B: Asynchronously queue transactional emails for outbox dispatch
      try {
        const studentUser = (await db.getUser(submission.userId)) || ({
          id: submission.userId,
          name: 'Student',
          email: 'student@zealosh.com',
          role: 'STUDENT',
          createdAt: new Date().toISOString(),
        } as User);
        await emailOutboxService.queueAssignmentGradedEmail(submission, assignment, studentUser, slug);
      } catch (emailErr) {
        console.error('[NotificationService] Non-blocking email outbox queue error (assignment graded):', emailErr);
      }

      return Boolean(created);
    } catch (err) {
      console.error('[NotificationService] Failed to dispatch assignment graded notification:', err);
      return false;
    }
  }

  /**
   * Dispatches notification to student when faculty requests resubmission
   */
  public async notifyResubmissionRequested(
    submission: AssignmentSubmission,
    assignment: Assignment,
    courseSlug?: string
  ): Promise<boolean> {
    try {
      const slug = courseSlug || assignment.courseId;
      const feedbackSnippet = submission.feedback ? ` Feedback: ${submission.feedback.substring(0, 100)}` : '';

      const created = await db.createNotification({
        recipientUserId: submission.userId,
        type: 'RESUBMISSION_REQUESTED',
        title: `Revisions Requested: ${assignment.title}`,
        description: `Your instructor has requested revisions on ${assignment.title}.${feedbackSnippet}`,
        entityType: 'SUBMISSION',
        entityId: submission.id,
        courseId: assignment.courseId,
        batchId: assignment.batchId,
        actionUrl: `/courses/${slug}/classroom?tab=grades`,
        idempotencyKey: `notif_resub_${submission.id}_${submission.updatedAt || 'v1'}`,
      });

      // Phase 5B: Asynchronously queue transactional emails for outbox dispatch
      try {
        const studentUser = (await db.getUser(submission.userId)) || ({
          id: submission.userId,
          name: 'Student',
          email: 'student@zealosh.com',
          role: 'STUDENT',
          createdAt: new Date().toISOString(),
        } as User);
        await emailOutboxService.queueResubmissionRequestedEmail(submission, assignment, studentUser, slug);
      } catch (emailErr) {
        console.error('[NotificationService] Non-blocking email outbox queue error (resubmission requested):', emailErr);
      }

      return Boolean(created);
    } catch (err) {
      console.error('[NotificationService] Failed to dispatch resubmission notification:', err);
      return false;
    }
  }

  /**
   * Dispatches notification when an instructor replies to an interactive video doubt
   */
  public async notifyDoubtReplied(params: {
    doubtId: string;
    recipientUserId: string;
    replierName: string;
    recordingTitle: string;
    recordingId: string;
    answerSnippet?: string;
  }): Promise<boolean> {
    try {
      const snippet = params.answerSnippet ? ` "${params.answerSnippet.substring(0, 80)}..."` : '';
      const created = await db.createNotification({
        recipientUserId: params.recipientUserId,
        type: 'DOUBT_REPLIED',
        title: `Faculty Replied to Your Question`,
        description: `${params.replierName} answered your doubt on "${params.recordingTitle}".${snippet}`,
        entityType: 'DOUBT',
        entityId: params.doubtId,
        actionUrl: `/recordings/${params.recordingId}`,
        idempotencyKey: `notif_doubt_${params.doubtId}_${Date.now()}`,
      });

      // Phase 5B: Asynchronously queue transactional emails for outbox dispatch
      try {
        const recipientUser = (await db.getUser(params.recipientUserId)) || ({
          id: params.recipientUserId,
          name: 'Student',
          email: 'student@zealosh.com',
          role: 'STUDENT',
          createdAt: new Date().toISOString(),
        } as User);
        await emailOutboxService.queueDoubtRepliedEmail({
          doubtId: params.doubtId,
          recipientUser,
          replierName: params.replierName,
          recordingTitle: params.recordingTitle,
          recordingId: params.recordingId,
          answerText: params.answerSnippet || '',
        });
      } catch (emailErr) {
        console.error('[NotificationService] Non-blocking email outbox queue error (doubt replied):', emailErr);
      }

      return Boolean(created);
    } catch (err) {
      console.error('[NotificationService] Failed to dispatch doubt reply notification:', err);
      return false;
    }
  }

  /**
   * Dispatches notification when a live classroom session is scheduled
   */
  public async notifyLiveSessionScheduled(
    session: LiveSession,
    courseSlug?: string
  ): Promise<number> {
    try {
      let recipientStudentIds: string[] = [];

      if (session.batchId) {
        const batchEnrollments = Array.from(db.enrollments.values()).filter(
          (e) => e.courseId === session.courseId && e.batchId === session.batchId && e.status === 'ACTIVE'
        );
        recipientStudentIds = Array.from(new Set(batchEnrollments.map((e) => e.userId)));
      } else {
        const courseEnrollments = Array.from(db.enrollments.values()).filter(
          (e) => e.courseId === session.courseId && e.status === 'ACTIVE'
        );
        recipientStudentIds = Array.from(new Set(courseEnrollments.map((e) => e.userId)));
      }

      if (recipientStudentIds.length === 0) return 0;

      const formattedTime = new Date(session.scheduledStartTime).toLocaleString();

      const notifications = recipientStudentIds.map((userId) => ({
        recipientUserId: userId,
        type: 'LIVE_SESSION_SCHEDULED' as const,
        title: `Live Class Scheduled: ${session.title}`,
        description: `Live interactive classroom session scheduled for ${formattedTime}.`,
        entityType: 'LIVE_SESSION' as const,
        entityId: session.id,
        courseId: session.courseId,
        batchId: session.batchId,
        actionUrl: `/live/${session.id}`,
        idempotencyKey: `notif_live_${session.id}_${userId}`,
      }));

      const count = await db.createBatchNotifications(notifications);

      // Phase 5B: Asynchronously queue transactional emails for outbox dispatch
      try {
        const course = await db.getCourseById(session.courseId);
        const courseTitle = course?.title || 'Zealosh HSE Course';
        const recipientUsers = (await Promise.all(recipientStudentIds.map((id) => db.getUser(id)))).filter(Boolean) as User[];
        await emailOutboxService.queueLiveSessionScheduledEmails(session, courseTitle, recipientUsers);
      } catch (emailErr) {
        console.error('[NotificationService] Non-blocking email outbox queue error (live session):', emailErr);
      }

      return count;
    } catch (err) {
      console.error('[NotificationService] Failed to dispatch live session notification:', err);
      return 0;
    }
  }
}

export const notificationService = new NotificationService();

