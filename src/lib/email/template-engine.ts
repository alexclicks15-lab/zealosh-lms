// Zealosh LMS — Phase 5B Email Template Engine & Institutional Templates
// Generates responsive, WCAG 2.1 AA compliant HTML and Plain-Text emails
// Enforces Zealosh green-led visual identity (#4f8c4c, #1e481c, #3a7536) and strict XSS escaping

import { EmailTemplate } from '@/types';

/**
 * Escapes untrusted text to prevent HTML injection and stored XSS in email clients
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Base Responsive HTML Wrapper for all Zealosh Institutional Emails
 */
export function wrapInZealoshHtmlLayout(params: {
  title: string;
  preheader?: string;
  contentHtml: string;
  actionText?: string;
  actionUrl?: string;
  footerNote?: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zealosh.com';
  const actionButtonHtml =
    params.actionText && params.actionUrl
      ? `
      <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0;">
        <tr>
          <td align="center" style="border-radius: 8px; background-color: #4f8c4c;">
            <a href="${escapeHtml(params.actionUrl.startsWith('http') ? params.actionUrl : `${appUrl}${params.actionUrl}`)}" 
               target="_blank" 
               style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px;">
              ${escapeHtml(params.actionText)}
            </a>
          </td>
        </tr>
      </table>
    `
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.title)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f9f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased; }
    table { border-collapse: separate; }
    a { color: #4f8c4c; text-decoration: underline; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; padding: 12px !important; }
      .header-title { font-size: 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f4f9f3;">
  ${params.preheader ? `<div style="display: none; max-height: 0px; overflow: hidden;">${escapeHtml(params.preheader)}</div>` : ''}
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2efe1; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #1e481c; padding: 20px 32px; border-bottom: 3px solid #4f8c4c;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #ffffff; background-color: #4f8c4c; padding: 3px 8px; border-radius: 4px; margin-bottom: 6px;">
                      ZEALOSH HSE ACADEMY
                    </span>
                    <h1 class="header-title" style="margin: 4px 0 0 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      Zealosh Training &amp; Consultants
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content Area -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                ${escapeHtml(params.title)}
              </h2>
              <div style="font-size: 14px; line-height: 1.6; color: #4a5568;">
                ${params.contentHtml}
              </div>
              ${actionButtonHtml}
              ${params.footerNote ? `<p style="margin: 20px 0 0 0; font-size: 12px; line-height: 1.5; color: #718096; border-top: 1px solid #e2efe1; padding-top: 16px;">${escapeHtml(params.footerNote)}</p>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f4f9f3; padding: 20px 32px; border-top: 1px solid #e2efe1; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #718096; line-height: 1.5;">
                This is an official transactional message from <strong>Zealosh Training &amp; Consultants</strong>.<br>
                Kollam, Kerala, India &bull; ASP, CSP, CRSP, CIT &amp; NEBOSH Mentorship Institute
              </p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #a0aec0;">
                To manage your notification settings, visit your <a href="${appUrl}/student" style="color: #4f8c4c; text-decoration: underline;">Student Hub</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Standard Canonical Institutional Templates Catalogue
 */
export const CANONICAL_EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  'tpl-announcement': {
    id: 'tpl-announcement',
    name: 'Classroom Announcement Broadcast',
    eventType: 'ANNOUNCEMENT_NEW',
    version: 'v1',
    subjectTemplate: 'New Announcement: {{title}} — {{courseTitle}}',
    htmlTemplate: `
      <p>Hello <strong>{{recipientName}}</strong>,</p>
      <p>A new announcement was posted by <strong>{{authorName}}</strong> for your cohort:</p>
      <div style="background-color: #f7f9fc; border-left: 4px solid #4f8c4c; padding: 14px 18px; margin: 16px 0; border-radius: 4px; font-size: 14px; color: #2d3748;">
        <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #0f172a;">{{title}}</h3>
        <p style="margin: 0; white-space: pre-wrap;">{{content}}</p>
      </div>
      <p>Review full class notes and discussions in your Digital Classroom workspace.</p>
    `,
    textTemplate: `Hello {{recipientName}},

A new announcement was posted by {{authorName}} for {{courseTitle}}:

{{title}}
--------------------------------------------------
{{content}}

View online at: {{actionUrl}}

--
Zealosh Training & Consultants
Kollam, Kerala, India`,
    requiredVariables: ['recipientName', 'authorName', 'courseTitle', 'title', 'content', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-assignment-published': {
    id: 'tpl-assignment-published',
    name: 'New Coursework Assignment Posted',
    eventType: 'ASSIGNMENT_PUBLISHED',
    version: 'v1',
    subjectTemplate: 'New Coursework: {{assignmentTitle}} (Due: {{dueDate}})',
    htmlTemplate: `
      <p>Hello <strong>{{recipientName}}</strong>,</p>
      <p>A new coursework assignment has been assigned for <strong>{{courseTitle}}</strong>:</p>
      <table style="width: 100%; border: 1px solid #e2efe1; border-radius: 8px; margin: 16px 0; border-collapse: collapse;">
        <tr style="background-color: #f7f9fc;">
          <td style="padding: 10px 14px; font-weight: 700; font-size: 13px; color: #4a5568; border-bottom: 1px solid #e2efe1;">Assignment:</td>
          <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2efe1;"><strong>{{assignmentTitle}}</strong></td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-weight: 700; font-size: 13px; color: #4a5568; border-bottom: 1px solid #e2efe1;">Submission Deadline:</td>
          <td style="padding: 10px 14px; font-size: 13px; color: #e53e3e; font-weight: 700; border-bottom: 1px solid #e2efe1;">{{dueDate}}</td>
        </tr>
        <tr style="background-color: #f7f9fc;">
          <td style="padding: 10px 14px; font-weight: 700; font-size: 13px; color: #4a5568;">Maximum Score:</td>
          <td style="padding: 10px 14px; font-size: 13px; color: #0f172a;">{{maxScore}} pts</td>
        </tr>
      </table>
      <p>{{description}}</p>
    `,
    textTemplate: `Hello {{recipientName}},

A new coursework assignment has been assigned for {{courseTitle}}:

Assignment: {{assignmentTitle}}
Due Date: {{dueDate}}
Max Score: {{maxScore}} pts

Description:
{{description}}

Submit online at: {{actionUrl}}

--
Zealosh Training & Consultants`,
    requiredVariables: ['recipientName', 'courseTitle', 'assignmentTitle', 'dueDate', 'maxScore', 'description', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-assignment-submitted': {
    id: 'tpl-assignment-submitted',
    name: 'Instructor Coursework Submission Alert',
    eventType: 'ASSIGNMENT_SUBMITTED',
    version: 'v1',
    subjectTemplate: 'Submission Received: {{assignmentTitle}} by {{studentName}}',
    htmlTemplate: `
      <p>Dear Faculty,</p>
      <p>Candidate <strong>{{studentName}}</strong> has submitted coursework for <strong>{{assignmentTitle}}</strong> in <strong>{{courseTitle}}</strong>.</p>
      <p>The submission has been queued for rubric evaluation in your Instructor Operations Console.</p>
    `,
    textTemplate: `Dear Faculty,

Candidate {{studentName}} has submitted coursework for {{assignmentTitle}} ({{courseTitle}}).

Please review and evaluate in the Instructor Console: {{actionUrl}}

--
Zealosh Training & Consultants`,
    requiredVariables: ['studentName', 'assignmentTitle', 'courseTitle', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-submission-confirmed': {
    id: 'tpl-submission-confirmed',
    name: 'Student Coursework Submission Confirmation',
    eventType: 'SUBMISSION_CONFIRMATION',
    version: 'v1',
    subjectTemplate: 'Coursework Received: {{assignmentTitle}}',
    htmlTemplate: `
      <p>Hello <strong>{{studentName}}</strong>,</p>
      <p>Your submission for <strong>{{assignmentTitle}}</strong> was successfully recorded on <strong>{{submittedAt}}</strong>.</p>
      <p>Your work has been submitted to your lead mentor for rubric evaluation. You will receive an alert once your feedback is published.</p>
    `,
    textTemplate: `Hello {{studentName}},

Your submission for {{assignmentTitle}} was successfully recorded on {{submittedAt}}.

Your work is now queued for evaluation. Track status at: {{actionUrl}}

--
Zealosh Training & Consultants`,
    requiredVariables: ['studentName', 'assignmentTitle', 'submittedAt', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-assignment-graded': {
    id: 'tpl-assignment-graded',
    name: 'Coursework Evaluation & Score Feedback',
    eventType: 'ASSIGNMENT_GRADED',
    version: 'v1',
    subjectTemplate: 'Grade Published: {{assignmentTitle}} (Score: {{scoreText}})',
    htmlTemplate: `
      <p>Hello <strong>{{recipientName}}</strong>,</p>
      <p>Your coursework submission for <strong>{{assignmentTitle}}</strong> has been evaluated.</p>
      <div style="background-color: #f7f9fc; border: 1px solid #e2efe1; border-radius: 8px; padding: 18px; margin: 16px 0;">
        <div style="font-size: 13px; color: #718096; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Official Score</div>
        <div style="font-size: 24px; font-weight: 800; color: #4f8c4c; margin: 4px 0 10px 0;">{{scoreText}}</div>
        {{#if feedback}}
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">Faculty Feedback:</div>
        <p style="margin: 0; font-size: 14px; color: #4a5568; font-style: italic;">"{{feedback}}"</p>
        {{/if}}
      </div>
      <p>Log in to your Digital Classroom workspace to inspect individual rubric criteria scores.</p>
    `,
    textTemplate: `Hello {{recipientName}},

Your coursework for {{assignmentTitle}} has been evaluated:

Official Score: {{scoreText}}
Feedback: {{feedback}}

Review full rubric criteria at: {{actionUrl}}

--
Zealosh Training & Consultants`,
    requiredVariables: ['recipientName', 'assignmentTitle', 'scoreText', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-resubmission-requested': {
    id: 'tpl-resubmission-requested',
    name: 'Coursework Revisions Requested',
    eventType: 'RESUBMISSION_REQUESTED',
    version: 'v1',
    subjectTemplate: 'Action Required: Revisions Requested on {{assignmentTitle}}',
    htmlTemplate: `
      <p>Hello <strong>{{recipientName}}</strong>,</p>
      <p>Your instructor has reviewed your submission for <strong>{{assignmentTitle}}</strong> and requested revisions before final grading.</p>
      <div style="background-color: #fffaf0; border-left: 4px solid #dd6b20; padding: 14px 18px; margin: 16px 0; border-radius: 4px; font-size: 14px; color: #7b341e;">
        <strong>Requested Revisions:</strong><br>
        {{feedback}}
      </div>
      <p>Please update your calculations or solution document and resubmit through the student portal.</p>
    `,
    textTemplate: `Hello {{recipientName}},

Your instructor has requested revisions on {{assignmentTitle}}:

Requested Revisions:
{{feedback}}

Resubmit your work at: {{actionUrl}}

--
Zealosh Training & Consultants`,
    requiredVariables: ['recipientName', 'assignmentTitle', 'feedback', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-doubt-replied': {
    id: 'tpl-doubt-replied',
    name: 'Faculty Response to Interactive Doubt',
    eventType: 'DOUBT_REPLIED',
    version: 'v1',
    subjectTemplate: 'Faculty Replied to Your Question on {{recordingTitle}}',
    htmlTemplate: `
      <p>Hello <strong>{{recipientName}}</strong>,</p>
      <p>Instructor <strong>{{replierName}}</strong> answered your interactive doubt on <strong>"{{recordingTitle}}"</strong>:</p>
      <div style="background-color: #f7f9fc; border-left: 4px solid #4f8c4c; padding: 14px 18px; margin: 16px 0; border-radius: 4px; font-size: 14px; color: #2d3748;">
        <p style="margin: 0; font-style: italic;">"{{answerText}}"</p>
      </div>
      <p>Open the recording player to review the timestamp explanation and any supplementary formulas.</p>
    `,
    textTemplate: `Hello {{recipientName}},

Instructor {{replierName}} answered your question on "{{recordingTitle}}":

"{{answerText}}"

View recording playback at: {{actionUrl}}

--
Zealosh Training & Consultants`,
    requiredVariables: ['recipientName', 'replierName', 'recordingTitle', 'answerText', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-live-scheduled': {
    id: 'tpl-live-scheduled',
    name: 'Live Classroom Session Scheduled',
    eventType: 'LIVE_SESSION_SCHEDULED',
    version: 'v1',
    subjectTemplate: 'Live Class Scheduled: {{sessionTitle}} — {{scheduledTime}}',
    htmlTemplate: `
      <p>Hello <strong>{{recipientName}}</strong>,</p>
      <p>A live interactive WebRTC classroom session has been scheduled for your cohort:</p>
      <div style="background-color: #f7f9fc; border: 1px solid #e2efe1; border-radius: 8px; padding: 18px; margin: 16px 0;">
        <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #0f172a;">{{sessionTitle}}</h3>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #4f8c4c; font-weight: 700;">Scheduled Start: {{scheduledTime}}</p>
        <p style="margin: 0; font-size: 13px; color: #718096;">Course: {{courseTitle}}</p>
      </div>
      <p>Please connect using a stable internet connection and headset. The meeting room opens 10 minutes prior to session start.</p>
    `,
    textTemplate: `Hello {{recipientName}},

A live interactive classroom session has been scheduled:

Session: {{sessionTitle}}
Scheduled Time: {{scheduledTime}}
Course: {{courseTitle}}

Join room at: {{actionUrl}}

--
Zealosh Training & Consultants`,
    requiredVariables: ['recipientName', 'sessionTitle', 'scheduledTime', 'courseTitle', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-account-verification': {
    id: 'tpl-account-verification',
    name: 'Account Email Verification',
    eventType: 'ACCOUNT_VERIFICATION',
    version: 'v1',
    subjectTemplate: 'Verify your Zealosh Academy account',
    htmlTemplate: `
      <p>Hello <strong>{{recipientName}}</strong>,</p>
      <p>Welcome to Zealosh Training &amp; Consultants. Please verify your email address to activate your access to the HSE Certification Examination Platform and Student Hub.</p>
      <p>This verification link is valid for 24 hours.</p>
    `,
    textTemplate: `Hello {{recipientName}},

Welcome to Zealosh Training & Consultants.

Please verify your account by visiting the link below:
{{actionUrl}}

This link expires in 24 hours.

--
Zealosh Training & Consultants`,
    requiredVariables: ['recipientName', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-password-reset': {
    id: 'tpl-password-reset',
    name: 'Password Reset Security Notice',
    eventType: 'PASSWORD_RESET',
    version: 'v1',
    subjectTemplate: 'Reset your Zealosh account password',
    htmlTemplate: `
      <p>Hello <strong>{{recipientName}}</strong>,</p>
      <p>We received a request to reset your password for your Zealosh Academy account. Click the button below to establish a new secure password.</p>
      <p>If you did not request this change, please ignore this email or notify administrative security immediately.</p>
    `,
    textTemplate: `Hello {{recipientName}},

We received a request to reset your password.

Reset your password at:
{{actionUrl}}

If you did not request this change, please contact support.

--
Zealosh Training & Consultants`,
    requiredVariables: ['recipientName', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-support-ticket-created': {
    id: 'tpl-support-ticket-created',
    name: 'Support Ticket Received Confirmation',
    eventType: 'SUPPORT_TICKET_CREATED',
    version: 'v1',
    subjectTemplate: '[{{ticketNumber}}] Support Request Received: {{subject}}',
    htmlTemplate: `
      <p>Hello <strong>{{requesterName}}</strong>,</p>
      <p>Thank you for reaching out to Zealosh Student Services. We have received your request regarding <strong>{{subject}}</strong>.</p>
      <div style="background: #f7f9fc; border: 1px solid #e2efe1; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px;"><strong>Ticket Number:</strong> {{ticketNumber}}</p>
        <p style="margin: 4px 0 0; font-size: 14px;"><strong>Category:</strong> {{categoryName}}</p>
      </div>
      <p>Our operations team will review your ticket and reply as soon as possible.</p>
    `,
    textTemplate: `Hello {{requesterName}},

Thank you for reaching out to Zealosh Student Services. We have received your request regarding "{{subject}}".

Ticket Number: {{ticketNumber}}
Category: {{categoryName}}

View and track your ticket at: {{actionUrl}}

--
Zealosh Training & Consultants`,
    requiredVariables: ['requesterName', 'ticketNumber', 'subject', 'categoryName', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },

  'tpl-support-ticket-reply': {
    id: 'tpl-support-ticket-reply',
    name: 'Support Ticket Update Notice',
    eventType: 'SUPPORT_TICKET_REPLY',
    version: 'v1',
    subjectTemplate: '[{{ticketNumber}}] Update on your support ticket: {{subject}}',
    htmlTemplate: `
      <p>Hello <strong>{{requesterName}}</strong>,</p>
      <p>A new public response has been posted on your ticket <strong>{{ticketNumber}}</strong> by <strong>{{authorName}}</strong>:</p>
      <div style="background: #ffffff; border-left: 4px solid #4f8c4c; padding: 12px 16px; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px; color: #374151;">{{messageSnippet}}</p>
      </div>
      <p>Please log in to your Zealosh Helpdesk to view the complete conversation or reply.</p>
    `,
    textTemplate: `Hello {{requesterName}},

A new public response has been posted on your ticket {{ticketNumber}} by {{authorName}}:

"{{messageSnippet}}"

View ticket and reply at: {{actionUrl}}

--
Zealosh Training & Consultants`,
    requiredVariables: ['requesterName', 'ticketNumber', 'subject', 'authorName', 'messageSnippet', 'actionUrl'],
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
};

/**
 * Renders an email template with validated variables and returns subject, HTML body, and Plain-Text body
 */
export function renderEmailTemplate(
  templateId: string,
  variables: Record<string, any>,
  options?: { actionText?: string; actionUrl?: string; footerNote?: string }
): { subject: string; html: string; text: string } {
  const template = CANONICAL_EMAIL_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Email template not found: ${templateId}`);
  }

  // Validate required variables
  for (const reqVar of template.requiredVariables) {
    if (variables[reqVar] === undefined || variables[reqVar] === null) {
      // Allow fallback if actionUrl is passed in options
      if (reqVar === 'actionUrl' && options?.actionUrl) {
        variables.actionUrl = options.actionUrl;
      } else {
        throw new Error(`Missing required template variable '${reqVar}' for template '${templateId}'`);
      }
    }
  }

  // Interpolate subject
  let subject = template.subjectTemplate;
  for (const [key, val] of Object.entries(variables)) {
    subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), String(val ?? ''));
  }

  // Interpolate content HTML
  let contentHtml = template.htmlTemplate;
  // Handle simple conditionals like {{#if feedback}} ... {{/if}}
  contentHtml = contentHtml.replace(/{{#if\s+([a-zA-Z0-9_]+)}}(.*?){{\/if}}/gs, (match, varName, innerHtml) => {
    return variables[varName] ? innerHtml : '';
  });

  for (const [key, val] of Object.entries(variables)) {
    contentHtml = contentHtml.replace(new RegExp(`{{${key}}}`, 'g'), escapeHtml(String(val ?? '')));
  }

  // Wrap in institutional Zealosh brand layout
  const fullHtml = wrapInZealoshHtmlLayout({
    title: subject,
    contentHtml,
    actionText: options?.actionText || 'Open in Platform',
    actionUrl: options?.actionUrl || variables.actionUrl,
    footerNote: options?.footerNote,
  });

  // Interpolate plain text body
  let text = template.textTemplate;
  for (const [key, val] of Object.entries(variables)) {
    text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(val ?? ''));
  }

  return { subject, html: fullHtml, text };
}
