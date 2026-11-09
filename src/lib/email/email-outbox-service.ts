// Zealosh LMS — Phase 5B Email Outbox Service
// Connects academic business events to the durable PostgreSQL email outbox
// Enforces recipient resolution, user preferences, composite idempotency, and non-blocking safety

import { db } from '@/lib/store/db';
import { renderEmailTemplate } from '@/lib/email/template-engine';
import {
  User,
  Course,
  ClassroomAnnouncement,
  Assignment,
  AssignmentSubmission,
  LiveSession,
  RecordingDoubt,
  ClassRecording,
  EmailOutboxJob,
  SupportTicket,
  SupportTicketMessage,
} from '@/types';

function isValidEmail(email?: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export class EmailOutboxService {
  /**
   * Queues announcement notification emails for eligible enrolled learners
   */
  public async queueAnnouncementEmails(
    announcement: ClassroomAnnouncement,
    courseTitle: string,
    recipients: User[],
    courseSlug?: string
  ): Promise<number> {
    try {
      const slug = courseSlug || announcement.courseId;
      const actionUrl = `/courses/${slug}/classroom?tab=stream`;
      const outboxJobs: Partial<EmailOutboxJob>[] = [];

      for (const recipient of recipients) {
        if (!isValidEmail(recipient.email)) continue;

        // Check user preferences
        const isEnabled = await db.isEmailNotificationEnabled(recipient.id, 'ANNOUNCEMENTS');
        if (!isEnabled) continue;

        const variables = {
          recipientName: recipient.name || 'Learner',
          authorName: announcement.authorName || 'Lead Mentor',
          courseTitle,
          title: announcement.title,
          content: announcement.content,
          actionUrl,
        };

        const rendered = renderEmailTemplate('tpl-announcement', variables, {
          actionText: 'View Announcement in Classroom',
          actionUrl,
        });

        outboxJobs.push({
          sourceEventId: announcement.id,
          eventType: 'ANNOUNCEMENT_NEW',
          recipientUserId: recipient.id,
          recipientEmail: recipient.email.trim(),
          recipientName: recipient.name || 'Learner',
          templateId: 'tpl-announcement',
          templateVersion: 'v1',
          templateVariables: variables,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          status: 'QUEUED',
          attemptCount: 0,
          maxAttempts: 3,
          idempotencyKey: `email_anc_${announcement.id}_${recipient.id}`,
          metadata: {
            courseId: announcement.courseId,
            batchId: announcement.batchId,
            audienceScope: announcement.audienceScope,
          },
        });
      }

      if (outboxJobs.length === 0) return 0;
      return await db.queueBatchEmailOutboxJobs(outboxJobs);
    } catch (err) {
      console.error('[EmailOutboxService] Failed to queue announcement emails:', err);
      return 0;
    }
  }

  /**
   * Queues assignment published notification emails for cohort students
   */
  public async queueAssignmentPublishedEmails(
    assignment: Assignment,
    courseTitle: string,
    recipients: User[],
    courseSlug?: string
  ): Promise<number> {
    try {
      const slug = courseSlug || assignment.courseId;
      const actionUrl = `/courses/${slug}/classroom?tab=classwork`;
      const formattedDate = new Date(assignment.dueDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const outboxJobs: Partial<EmailOutboxJob>[] = [];

      for (const recipient of recipients) {
        if (!isValidEmail(recipient.email)) continue;

        const isEnabled = await db.isEmailNotificationEnabled(recipient.id, 'ASSIGNMENTS');
        if (!isEnabled) continue;

        const variables = {
          recipientName: recipient.name || 'Learner',
          courseTitle,
          assignmentTitle: assignment.title,
          dueDate: formattedDate,
          maxScore: assignment.maxScore,
          description: assignment.description,
          actionUrl,
        };

        const rendered = renderEmailTemplate('tpl-assignment-published', variables, {
          actionText: 'Open Assignment in Classroom',
          actionUrl,
        });

        outboxJobs.push({
          sourceEventId: assignment.id,
          eventType: 'ASSIGNMENT_PUBLISHED',
          recipientUserId: recipient.id,
          recipientEmail: recipient.email.trim(),
          recipientName: recipient.name || 'Learner',
          templateId: 'tpl-assignment-published',
          templateVersion: 'v1',
          templateVariables: variables,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          status: 'QUEUED',
          attemptCount: 0,
          maxAttempts: 3,
          idempotencyKey: `email_asg_pub_${assignment.id}_${recipient.id}`,
          metadata: {
            courseId: assignment.courseId,
            batchId: assignment.batchId,
            points: assignment.maxScore,
          },
        });
      }

      if (outboxJobs.length === 0) return 0;
      return await db.queueBatchEmailOutboxJobs(outboxJobs);
    } catch (err) {
      console.error('[EmailOutboxService] Failed to queue assignment published emails:', err);
      return 0;
    }
  }

  /**
   * Queues submission alert emails to instructors and confirmation email to the submitting student
   */
  public async queueAssignmentSubmittedEmails(
    submission: AssignmentSubmission,
    assignment: Assignment,
    courseTitle: string,
    studentUser: User,
    instructors: User[],
    courseSlug?: string
  ): Promise<number> {
    try {
      const slug = courseSlug || assignment.courseId;
      const outboxJobs: Partial<EmailOutboxJob>[] = [];
      const submittedAtFormatted = new Date(submission.submittedAt).toLocaleString('en-IN');

      // 1. Instructor Alerts
      const instructorActionUrl = `/courses/${slug}/classroom?tab=grades`;
      for (const inst of instructors) {
        if (!isValidEmail(inst.email)) continue;

        const isEnabled = await db.isEmailNotificationEnabled(inst.id, 'ASSIGNMENTS');
        if (!isEnabled) continue;

        const variables = {
          studentName: studentUser.name || 'Candidate',
          assignmentTitle: assignment.title,
          courseTitle,
          actionUrl: instructorActionUrl,
        };

        const rendered = renderEmailTemplate('tpl-assignment-submitted', variables, {
          actionText: 'Open Grading Queue',
          actionUrl: instructorActionUrl,
        });

        outboxJobs.push({
          sourceEventId: submission.id,
          eventType: 'ASSIGNMENT_SUBMITTED',
          recipientUserId: inst.id,
          recipientEmail: inst.email.trim(),
          recipientName: inst.name || 'Faculty Member',
          templateId: 'tpl-assignment-submitted',
          templateVersion: 'v1',
          templateVariables: variables,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          status: 'QUEUED',
          attemptCount: 0,
          maxAttempts: 3,
          idempotencyKey: `email_asg_sub_${submission.id}_${inst.id}`,
          metadata: { assignmentId: assignment.id, courseId: assignment.courseId },
        });
      }

      // 2. Student Submission Confirmation
      if (isValidEmail(studentUser.email)) {
        const studentActionUrl = `/courses/${slug}/classroom?tab=grades`;
        const studentVariables = {
          studentName: studentUser.name || 'Learner',
          assignmentTitle: assignment.title,
          submittedAt: submittedAtFormatted,
          actionUrl: studentActionUrl,
        };

        const studentRendered = renderEmailTemplate('tpl-submission-confirmed', studentVariables, {
          actionText: 'Review Submission Details',
          actionUrl: studentActionUrl,
        });

        outboxJobs.push({
          sourceEventId: submission.id,
          eventType: 'SUBMISSION_CONFIRMATION',
          recipientUserId: studentUser.id,
          recipientEmail: studentUser.email.trim(),
          recipientName: studentUser.name || 'Learner',
          templateId: 'tpl-submission-confirmed',
          templateVersion: 'v1',
          templateVariables: studentVariables,
          subject: studentRendered.subject,
          htmlBody: studentRendered.html,
          textBody: studentRendered.text,
          status: 'QUEUED',
          attemptCount: 0,
          maxAttempts: 3,
          idempotencyKey: `email_sub_conf_${submission.id}_${studentUser.id}`,
          metadata: { assignmentId: assignment.id },
        });
      }

      if (outboxJobs.length === 0) return 0;
      return await db.queueBatchEmailOutboxJobs(outboxJobs);
    } catch (err) {
      console.error('[EmailOutboxService] Failed to queue assignment submitted emails:', err);
      return 0;
    }
  }

  /**
   * Queues grade publication email to student
   */
  public async queueAssignmentGradedEmail(
    submission: AssignmentSubmission,
    assignment: Assignment,
    studentUser: User,
    courseSlug?: string
  ): Promise<EmailOutboxJob | null> {
    try {
      if (!isValidEmail(studentUser.email)) return null;

      const isEnabled = await db.isEmailNotificationEnabled(studentUser.id, 'GRADES');
      if (!isEnabled) return null;

      const slug = courseSlug || assignment.courseId;
      const actionUrl = `/courses/${slug}/classroom?tab=grades`;
      const scoreText = submission.score !== undefined ? `${submission.score}/${assignment.maxScore}` : 'Evaluated';

      const variables = {
        recipientName: studentUser.name || 'Learner',
        assignmentTitle: assignment.title,
        scoreText,
        feedback: submission.feedback || '',
        actionUrl,
      };

      const rendered = renderEmailTemplate('tpl-assignment-graded', variables, {
        actionText: 'Inspect Rubric Evaluation',
        actionUrl,
      });

      return await db.queueEmailOutboxJob({
        sourceEventId: submission.id,
        eventType: 'ASSIGNMENT_GRADED',
        recipientUserId: studentUser.id,
        recipientEmail: studentUser.email.trim(),
        recipientName: studentUser.name || 'Learner',
        templateId: 'tpl-assignment-graded',
        templateVersion: 'v1',
        templateVariables: variables,
        subject: rendered.subject,
        htmlBody: rendered.html,
        textBody: rendered.text,
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        idempotencyKey: `email_grade_${submission.id}_${submission.updatedAt || submission.gradedAt || 'v1'}`,
        metadata: { assignmentId: assignment.id, score: submission.score },
      });
    } catch (err) {
      console.error('[EmailOutboxService] Failed to queue assignment graded email:', err);
      return null;
    }
  }

  /**
   * Queues resubmission request email to student
   */
  public async queueResubmissionRequestedEmail(
    submission: AssignmentSubmission,
    assignment: Assignment,
    studentUser: User,
    courseSlug?: string
  ): Promise<EmailOutboxJob | null> {
    try {
      if (!isValidEmail(studentUser.email)) return null;

      const isEnabled = await db.isEmailNotificationEnabled(studentUser.id, 'GRADES');
      if (!isEnabled) return null;

      const slug = courseSlug || assignment.courseId;
      const actionUrl = `/courses/${slug}/classroom?tab=grades`;

      const variables = {
        recipientName: studentUser.name || 'Learner',
        assignmentTitle: assignment.title,
        feedback: submission.feedback || 'Please review mentor instructions and resubmit.',
        actionUrl,
      };

      const rendered = renderEmailTemplate('tpl-resubmission-requested', variables, {
        actionText: 'Resubmit Coursework',
        actionUrl,
      });

      return await db.queueEmailOutboxJob({
        sourceEventId: submission.id,
        eventType: 'RESUBMISSION_REQUESTED',
        recipientUserId: studentUser.id,
        recipientEmail: studentUser.email.trim(),
        recipientName: studentUser.name || 'Learner',
        templateId: 'tpl-resubmission-requested',
        templateVersion: 'v1',
        templateVariables: variables,
        subject: rendered.subject,
        htmlBody: rendered.html,
        textBody: rendered.text,
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        idempotencyKey: `email_resub_${submission.id}_${submission.updatedAt || 'v1'}`,
        metadata: { assignmentId: assignment.id },
      });
    } catch (err) {
      console.error('[EmailOutboxService] Failed to queue resubmission requested email:', err);
      return null;
    }
  }

  /**
   * Queues doubt reply notification email to student author
   */
  public async queueDoubtRepliedEmail(params: {
    doubtId: string;
    recipientUser: User;
    replierName: string;
    recordingTitle: string;
    recordingId: string;
    answerText: string;
  }): Promise<EmailOutboxJob | null> {
    try {
      if (!isValidEmail(params.recipientUser.email)) return null;

      const isEnabled = await db.isEmailNotificationEnabled(params.recipientUser.id, 'DOUBTS');
      if (!isEnabled) return null;

      const actionUrl = `/recordings/${params.recordingId}`;
      const variables = {
        recipientName: params.recipientUser.name || 'Learner',
        replierName: params.replierName,
        recordingTitle: params.recordingTitle,
        answerText: params.answerText,
        actionUrl,
      };

      const rendered = renderEmailTemplate('tpl-doubt-replied', variables, {
        actionText: 'Open Recording Player',
        actionUrl,
      });

      return await db.queueEmailOutboxJob({
        sourceEventId: params.doubtId,
        eventType: 'DOUBT_REPLIED',
        recipientUserId: params.recipientUser.id,
        recipientEmail: params.recipientUser.email.trim(),
        recipientName: params.recipientUser.name || 'Learner',
        templateId: 'tpl-doubt-replied',
        templateVersion: 'v1',
        templateVariables: variables,
        subject: rendered.subject,
        htmlBody: rendered.html,
        textBody: rendered.text,
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        idempotencyKey: `email_doubt_${params.doubtId}_${Date.now()}`,
        metadata: { recordingId: params.recordingId },
      });
    } catch (err) {
      console.error('[EmailOutboxService] Failed to queue doubt replied email:', err);
      return null;
    }
  }

  /**
   * Queues live session scheduled notification emails for cohort students
   */
  public async queueLiveSessionScheduledEmails(
    session: LiveSession,
    courseTitle: string,
    recipients: User[]
  ): Promise<number> {
    try {
      const actionUrl = `/live/${session.id}`;
      const scheduledTime = new Date(session.scheduledStartTime).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const outboxJobs: Partial<EmailOutboxJob>[] = [];

      for (const recipient of recipients) {
        if (!isValidEmail(recipient.email)) continue;

        const isEnabled = await db.isEmailNotificationEnabled(recipient.id, 'LIVE_SESSIONS');
        if (!isEnabled) continue;

        const variables = {
          recipientName: recipient.name || 'Learner',
          sessionTitle: session.title,
          scheduledTime,
          courseTitle,
          actionUrl,
        };

        const rendered = renderEmailTemplate('tpl-live-scheduled', variables, {
          actionText: 'Join Live Classroom',
          actionUrl,
        });

        outboxJobs.push({
          sourceEventId: session.id,
          eventType: 'LIVE_SESSION_SCHEDULED',
          recipientUserId: recipient.id,
          recipientEmail: recipient.email.trim(),
          recipientName: recipient.name || 'Learner',
          templateId: 'tpl-live-scheduled',
          templateVersion: 'v1',
          templateVariables: variables,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          status: 'QUEUED',
          attemptCount: 0,
          maxAttempts: 3,
          idempotencyKey: `email_live_${session.id}_${recipient.id}`,
          metadata: { courseId: session.courseId, batchId: session.batchId },
        });
      }

      if (outboxJobs.length === 0) return 0;
      return await db.queueBatchEmailOutboxJobs(outboxJobs);
    } catch (err) {
      console.error('[EmailOutboxService] Failed to queue live session scheduled emails:', err);
      return 0;
    }
  }

  public async queueSupportTicketCreatedEmail(ticket: SupportTicket): Promise<boolean> {
    try {
      if (!isValidEmail(ticket.requesterEmail)) return false;
      const actionUrl = `/support/tickets/${ticket.id}`;
      const variables = {
        requesterName: ticket.requesterName || 'Learner',
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        categoryName: ticket.categoryName,
        actionUrl,
      };

      const rendered = renderEmailTemplate('tpl-support-ticket-created', variables, {
        actionText: 'View Support Ticket',
        actionUrl,
      });

      const job: Partial<EmailOutboxJob> = {
        sourceEventId: ticket.id,
        eventType: 'SUPPORT_TICKET_CREATED',
        recipientUserId: ticket.requesterUserId,
        recipientEmail: ticket.requesterEmail.trim(),
        recipientName: ticket.requesterName || 'Learner',
        templateId: 'tpl-support-ticket-created',
        templateVersion: 'v1',
        templateVariables: variables,
        subject: rendered.subject,
        htmlBody: rendered.html,
        textBody: rendered.text,
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        idempotencyKey: `email_ticket_created_${ticket.id}`,
        metadata: { ticketNumber: ticket.ticketNumber, categoryId: ticket.categoryId },
      };

      const count = await db.queueBatchEmailOutboxJobs([job]);
      return count > 0;
    } catch (err) {
      console.error('[EmailOutboxService] Failed to queue support ticket created email:', err);
      return false;
    }
  }

  public async queueSupportTicketReplyEmail(
    ticket: SupportTicket,
    message: SupportTicketMessage,
    recipientEmail: string,
    recipientName: string,
    recipientUserId: string
  ): Promise<boolean> {
    try {
      if (!isValidEmail(recipientEmail)) return false;
      if (message.visibility !== 'PUBLIC') return false; // Strictly never email internal notes

      const actionUrl = `/support/tickets/${ticket.id}`;
      const snippet = message.body.length > 200 ? message.body.substring(0, 200) + '...' : message.body;
      const variables = {
        requesterName: recipientName,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        authorName: message.authorName,
        messageSnippet: snippet,
        actionUrl,
      };

      const rendered = renderEmailTemplate('tpl-support-ticket-reply', variables, {
        actionText: 'View & Reply',
        actionUrl,
      });

      const job: Partial<EmailOutboxJob> = {
        sourceEventId: message.id,
        eventType: 'SUPPORT_TICKET_REPLY',
        recipientUserId: recipientUserId,
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName,
        templateId: 'tpl-support-ticket-reply',
        templateVersion: 'v1',
        templateVariables: variables,
        subject: rendered.subject,
        htmlBody: rendered.html,
        textBody: rendered.text,
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        idempotencyKey: `email_ticket_reply_${message.id}_${recipientUserId}`,
        metadata: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
      };

      const count = await db.queueBatchEmailOutboxJobs([job]);
      return count > 0;
    } catch (err) {
      console.error('[EmailOutboxService] Failed to queue support ticket reply email:', err);
      return false;
    }
  }
}

export const emailOutboxService = new EmailOutboxService();
