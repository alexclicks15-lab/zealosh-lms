// Zealosh LMS — Authoritative Service and Domain Ownership Registry
// Path: src/lib/events/domain-registry.ts
// Single-institution canonical domain registry defining ownership, authoritative tables,
// permitted event publishers, and authorized event consumers.

import { DomainIdentifier, DomainHealthStatus, DomainRegistryEntry } from '@/types';

export const AUTHORITATIVE_DOMAINS: Record<DomainIdentifier, DomainRegistryEntry> = {
  IDENTITY: {
    id: 'IDENTITY',
    displayName: 'GoTrue Identity & Profiles',
    owner: 'Security & Directory Services',
    authoritativeTables: ['profiles', 'user_sessions'],
    permittedPublishers: ['IDENTITY'],
    permittedConsumers: ['ACADEMIC', 'ADMISSIONS', 'COMMERCE', 'NOTIFICATIONS', 'AUDIT'],
    supportedEventTypes: ['identity.user.created', 'identity.user.updated', 'identity.role.changed', 'identity.session.revoked'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  ACADEMIC: {
    id: 'ACADEMIC',
    displayName: 'Academic Core & Curriculum',
    owner: 'Academic Directorate',
    authoritativeTables: ['courses', 'batches', 'modules', 'topics', 'lessons'],
    permittedPublishers: ['ACADEMIC'],
    permittedConsumers: ['CLASSROOM', 'ADMISSIONS', 'COMMERCE', 'ASSESSMENT', 'NOTIFICATIONS'],
    supportedEventTypes: ['academic.course.published', 'academic.batch.created', 'academic.lesson.completed'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  ADMISSIONS: {
    id: 'ADMISSIONS',
    displayName: '14-Stage Admissions Pipeline',
    owner: 'Admissions Directorate',
    authoritativeTables: ['leads', 'applicant_documents', 'admission_offers', 'admissions_pipeline'],
    permittedPublishers: ['ADMISSIONS'],
    permittedConsumers: ['ACADEMIC', 'ENTITLEMENTS', 'COMMERCE', 'NOTIFICATIONS', 'AUDIT'],
    supportedEventTypes: ['admissions.lead.captured', 'admissions.stage.changed', 'admissions.student.admitted'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  COMMERCE: {
    id: 'COMMERCE',
    displayName: 'Decoupled Products & Orders',
    owner: 'Finance & Bursary',
    authoritativeTables: ['products', 'product_offerings', 'payment_orders', 'invoices'],
    permittedPublishers: ['COMMERCE'],
    permittedConsumers: ['ENTITLEMENTS', 'ADMISSIONS', 'GROWTH', 'NOTIFICATIONS', 'AUDIT'],
    supportedEventTypes: ['commerce.order.created', 'commerce.order.paid', 'commerce.order.refunded'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  ENTITLEMENTS: {
    id: 'ENTITLEMENTS',
    displayName: 'Server-Authoritative Entitlements',
    owner: 'Registrar & Access Control',
    authoritativeTables: ['user_entitlements'],
    permittedPublishers: ['COMMERCE', 'ADMISSIONS', 'ENTITLEMENTS'],
    permittedConsumers: ['ACADEMIC', 'MEDIA', 'CLASSROOM', 'ASSESSMENT'],
    supportedEventTypes: ['entitlements.access.granted', 'entitlements.access.revoked', 'entitlements.access.suspended'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  SCHEDULING: {
    id: 'SCHEDULING',
    displayName: 'Institutional Master Calendar',
    owner: 'Academic Operations & Scheduling',
    authoritativeTables: ['institutional_holidays', 'course_orientation_configs', 'orientation_sessions', 'orientation_bookings'],
    permittedPublishers: ['SCHEDULING'],
    permittedConsumers: ['CLASSROOM', 'ADMISSIONS', 'NOTIFICATIONS'],
    supportedEventTypes: ['scheduling.session.created', 'scheduling.session.rescheduled', 'scheduling.orientation.booked'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  CLASSROOM: {
    id: 'CLASSROOM',
    displayName: 'Live Academic Classroom Sync',
    owner: 'Live Teaching Faculty',
    authoritativeTables: ['live_sessions', 'attendance_records'],
    permittedPublishers: ['CLASSROOM'],
    permittedConsumers: ['SCHEDULING', 'NOTIFICATIONS', 'GAMIFICATION', 'AUDIT'],
    supportedEventTypes: ['classroom.session.started', 'classroom.session.ended', 'classroom.attendance.marked'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  ZEALOSH_VC: {
    id: 'ZEALOSH_VC',
    displayName: 'Virtual Conferencing Engine',
    owner: 'WebRTC Infrastructure',
    authoritativeTables: ['recording_batch_access'],
    permittedPublishers: ['ZEALOSH_VC'],
    permittedConsumers: ['CLASSROOM', 'MEDIA', 'AUDIT'],
    supportedEventTypes: ['vc.meeting.provisioned', 'vc.recording.ready'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  MESSAGING: {
    id: 'MESSAGING',
    displayName: 'Isolated Institutional Channels',
    owner: 'Communication & Moderation',
    authoritativeTables: ['conversations', 'conversation_members', 'channel_messages', 'channel_moderation_reports'],
    permittedPublishers: ['MESSAGING'],
    permittedConsumers: ['NOTIFICATIONS', 'AUDIT'],
    supportedEventTypes: ['messaging.channel.created', 'messaging.message.posted', 'messaging.report.filed'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  MEDIA: {
    id: 'MEDIA',
    displayName: 'Secure Object Storage Registry',
    owner: 'Media & Content Infrastructure',
    authoritativeTables: ['media_assets', 'class_recordings'],
    permittedPublishers: ['MEDIA'],
    permittedConsumers: ['ACADEMIC', 'CLASSROOM', 'AUDIT'],
    supportedEventTypes: ['media.asset.uploaded', 'media.recording.ingested', 'media.asset.deleted'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  CMS: {
    id: 'CMS',
    displayName: 'Public Content & PageBuilder',
    owner: 'Communications & Editorial',
    authoritativeTables: ['cms_pages', 'cms_page_revisions', 'cms_scheduled_jobs'],
    permittedPublishers: ['CMS'],
    permittedConsumers: ['GROWTH', 'AUDIT'],
    supportedEventTypes: ['cms.page.published', 'cms.page.unpublished'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  ASSESSMENT: {
    id: 'ASSESSMENT',
    displayName: 'Question Bank & High-Stakes Exams',
    owner: 'Examination Board',
    authoritativeTables: ['question_bank_items', 'question_versions', 'exams', 'exam_attempts', 'assignments', 'assignment_submissions'],
    permittedPublishers: ['ASSESSMENT'],
    permittedConsumers: ['CREDENTIALS', 'CAREER', 'GAMIFICATION', 'NOTIFICATIONS', 'AUDIT'],
    supportedEventTypes: ['assessment.quiz.completed', 'assessment.assignment.submitted', 'assessment.exam.passed'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  CREDENTIALS: {
    id: 'CREDENTIALS',
    displayName: 'Tamper-Evident Ed25519 Certificates',
    owner: 'Institutional Registrar',
    authoritativeTables: ['certificates', 'certificate_signers'],
    permittedPublishers: ['CREDENTIALS'],
    permittedConsumers: ['CAREER', 'TESTIMONIALS', 'GAMIFICATION', 'NOTIFICATIONS', 'AUDIT'],
    supportedEventTypes: ['credentials.certificate.issued', 'credentials.certificate.revoked'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  CAREER: {
    id: 'CAREER',
    displayName: 'HSE Career Roadmap & Milestones',
    owner: 'Career Development Centre',
    authoritativeTables: ['certifications', 'career_pathways', 'career_pathway_stages', 'student_career_plans', 'external_credential_evidence'],
    permittedPublishers: ['CAREER'],
    permittedConsumers: ['NOTIFICATIONS', 'AUDIT'],
    supportedEventTypes: ['career.plan.created', 'career.milestone.completed', 'career.evidence.verified'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  TESTIMONIALS: {
    id: 'TESTIMONIALS',
    displayName: 'Verified Reviews & Granular Consent',
    owner: 'Quality Assurance & Marketing',
    authoritativeTables: ['student_reviews', 'testimonial_consents', 'achievement_showcases'],
    permittedPublishers: ['TESTIMONIALS'],
    permittedConsumers: ['CMS', 'GROWTH', 'AUDIT'],
    supportedEventTypes: ['testimonials.review.submitted', 'testimonials.review.published', 'testimonials.consent.revoked'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  GAMIFICATION: {
    id: 'GAMIFICATION',
    displayName: 'Academic XP Ledger & Streaks',
    owner: 'Student Engagement & Motivation',
    authoritativeTables: ['gamification_rules', 'points_ledger', 'student_streaks', 'badge_definitions', 'user_badge_awards'],
    permittedPublishers: ['GAMIFICATION'],
    permittedConsumers: ['NOTIFICATIONS'],
    supportedEventTypes: ['gamification.xp.awarded', 'gamification.streak.incremented', 'gamification.badge.awarded'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  GROWTH: {
    id: 'GROWTH',
    displayName: 'Referrals, Partners & Alumni',
    owner: 'Institutional Relations & Advancement',
    authoritativeTables: ['referral_codes', 'referral_attributions', 'institutional_partners', 'institutional_campaigns', 'alumni_profiles'],
    permittedPublishers: ['GROWTH'],
    permittedConsumers: ['ADMISSIONS', 'COMMERCE', 'AUDIT'],
    supportedEventTypes: ['growth.referral.created', 'growth.referral.converted', 'growth.partner.registered'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  NOTIFICATIONS: {
    id: 'NOTIFICATIONS',
    displayName: 'Multi-Channel Alert Outbox',
    owner: 'Operations & Communications',
    authoritativeTables: ['notifications', 'email_outbox', 'email_delivery_events'],
    permittedPublishers: ['NOTIFICATIONS'],
    permittedConsumers: ['AUDIT'],
    supportedEventTypes: ['notifications.in_app.queued', 'notifications.email.dispatched'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  SUPPORT: {
    id: 'SUPPORT',
    displayName: 'Service Desk & Helpdesk Tickets',
    owner: 'Student & Faculty Support Services',
    authoritativeTables: ['support_tickets', 'support_ticket_messages'],
    permittedPublishers: ['SUPPORT'],
    permittedConsumers: ['NOTIFICATIONS', 'AUDIT'],
    supportedEventTypes: ['support.ticket.opened', 'support.ticket.resolved'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
  AUDIT: {
    id: 'AUDIT',
    displayName: 'Institutional Compliance Audit',
    owner: 'Internal Audit & Governance',
    authoritativeTables: ['audit_logs', 'institutional_audit_archives'],
    permittedPublishers: ['AUDIT'],
    permittedConsumers: [],
    supportedEventTypes: ['audit.archive.generated', 'audit.security.alert'],
    contractVersions: ['v1.0.0'],
    enabled: true,
    operationalHealth: 'HEALTHY',
  },
};

export class DomainRegistryService {
  private static domains: Map<DomainIdentifier, DomainRegistryEntry> = new Map(
    Object.entries(AUTHORITATIVE_DOMAINS) as [DomainIdentifier, DomainRegistryEntry][]
  );

  public static getRegisteredDomains(): DomainRegistryEntry[] {
    return Array.from(this.domains.values());
  }

  public static getDomain(domainId: DomainIdentifier): DomainRegistryEntry | undefined {
    return this.domains.get(domainId);
  }

  public static updateDomainHealth(
    domainId: DomainIdentifier,
    health: DomainHealthStatus,
    lastError?: string
  ): DomainRegistryEntry | undefined {
    const entry = this.domains.get(domainId);
    if (!entry) return undefined;

    entry.operationalHealth = health;
    if (lastError !== undefined) entry.lastError = lastError;
    if (health === 'HEALTHY') {
      entry.lastSuccessfulProcessingTime = new Date().toISOString();
      entry.lastError = undefined;
    }
    this.domains.set(domainId, entry);
    return entry;
  }

  public static isPublisherPermitted(domainId: DomainIdentifier, eventType: string): boolean {
    const entry = this.domains.get(domainId);
    if (!entry || !entry.enabled) return false;
    return entry.supportedEventTypes.includes(eventType);
  }

  public static isConsumerPermitted(consumerDomain: DomainIdentifier, eventType: string): boolean {
    const consumer = this.domains.get(consumerDomain);
    if (!consumer || !consumer.enabled) return false;

    // Check if any domain publishing this event permits this consumer
    for (const publisher of this.domains.values()) {
      if (publisher.supportedEventTypes.includes(eventType)) {
        if (publisher.permittedConsumers.includes(consumerDomain)) {
          return true;
        }
      }
    }
    return false;
  }

  public static getPermittedConsumersForEvent(eventType: string): DomainIdentifier[] {
    const consumers: Set<DomainIdentifier> = new Set();
    for (const publisher of this.domains.values()) {
      if (publisher.supportedEventTypes.includes(eventType)) {
        publisher.permittedConsumers.forEach((c) => consumers.add(c));
      }
    }
    return Array.from(consumers);
  }
}

