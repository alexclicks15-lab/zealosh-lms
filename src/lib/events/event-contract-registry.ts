// Zealosh LMS — Central Event Contract Registry & Validation Engine
// Path: src/lib/events/event-contract-registry.ts
// Enforces event schema contracts, payload validation, and strict data minimization.

import { DomainIdentifier, EventContract, EventDataClassification, DomainEventEnvelope } from '@/types';

export const CANONICAL_EVENT_CONTRACTS: Record<string, EventContract> = {
  // Identity
  'identity.user.created': {
    eventType: 'identity.user.created',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'IDENTITY',
    requiredFields: ['userId', 'email', 'name', 'role'],
    permittedConsumers: ['ACADEMIC', 'ADMISSIONS', 'COMMERCE', 'NOTIFICATIONS', 'AUDIT'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when a new user account profile is established.',
  },
  'identity.user.updated': {
    eventType: 'identity.user.updated',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'IDENTITY',
    requiredFields: ['userId', 'updatedFields'],
    permittedConsumers: ['ACADEMIC', 'ADMISSIONS', 'NOTIFICATIONS', 'AUDIT'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when trusted profile attributes are modified.',
  },
  'identity.role.changed': {
    eventType: 'identity.role.changed',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'IDENTITY',
    requiredFields: ['userId', 'previousRole', 'newRole', 'changedBy'],
    permittedConsumers: ['ACADEMIC', 'COMMERCE', 'AUDIT'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when institutional role is modified.',
  },
  'identity.session.revoked': {
    eventType: 'identity.session.revoked',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'IDENTITY',
    requiredFields: ['userId', 'sessionId', 'revocationType'],
    permittedConsumers: ['AUDIT'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when an active device session is explicitly revoked.',
  },

  // Academic
  'academic.course.published': {
    eventType: 'academic.course.published',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'ACADEMIC',
    requiredFields: ['courseId', 'courseSlug', 'title'],
    permittedConsumers: ['COMMERCE', 'ADMISSIONS', 'CMS', 'NOTIFICATIONS'],
    dataClassification: 'PUBLIC',
    description: 'Emitted when an approved academic course is published.',
  },
  'academic.lesson.completed': {
    eventType: 'academic.lesson.completed',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'ACADEMIC',
    requiredFields: ['studentId', 'courseId', 'lessonId', 'progressPercent'],
    permittedConsumers: ['GAMIFICATION', 'NOTIFICATIONS', 'ASSESSMENT'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when a learner successfully completes an academic lesson.',
  },

  // Admissions
  'admissions.lead.captured': {
    eventType: 'admissions.lead.captured',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'ADMISSIONS',
    requiredFields: ['leadId', 'courseId', 'name', 'source'],
    permittedConsumers: ['GROWTH', 'NOTIFICATIONS', 'AUDIT'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when a prospective candidate submits an admissions enquiry.',
  },
  'admissions.student.admitted': {
    eventType: 'admissions.student.admitted',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'ADMISSIONS',
    requiredFields: ['studentId', 'courseId', 'batchId', 'admissionId'],
    permittedConsumers: ['ACADEMIC', 'ENTITLEMENTS', 'COMMERCE', 'NOTIFICATIONS', 'GROWTH', 'AUDIT'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when a candidate completes the 14-stage admissions pipeline.',
  },

  // Commerce
  'commerce.order.created': {
    eventType: 'commerce.order.created',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'COMMERCE',
    requiredFields: ['orderId', 'userId', 'courseId', 'offeringId', 'amount'],
    permittedConsumers: ['ADMISSIONS', 'AUDIT'],
    dataClassification: 'CONFIDENTIAL',
    description: 'Emitted when a checkout order is initiated.',
  },
  'commerce.order.paid': {
    eventType: 'commerce.order.paid',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'COMMERCE',
    requiredFields: ['orderId', 'userId', 'courseId', 'offeringId', 'amount', 'currency', 'gatewayPaymentId'],
    permittedConsumers: ['ENTITLEMENTS', 'ADMISSIONS', 'ACADEMIC', 'GROWTH', 'NOTIFICATIONS', 'AUDIT'],
    dataClassification: 'CONFIDENTIAL',
    description: 'Emitted when order payment is verified with gateway signature.',
  },

  // Entitlements
  'entitlements.access.granted': {
    eventType: 'entitlements.access.granted',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'ENTITLEMENTS',
    requiredFields: ['entitlementId', 'userId', 'courseId', 'featureScope', 'validUntil'],
    permittedConsumers: ['ACADEMIC', 'MEDIA', 'CLASSROOM', 'ASSESSMENT'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when server-authoritative feature entitlement is granted.',
  },

  // Assessment
  'assessment.quiz.completed': {
    eventType: 'assessment.quiz.completed',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'ASSESSMENT',
    requiredFields: ['studentId', 'quizId', 'courseId', 'scorePercent', 'passed'],
    permittedConsumers: ['GAMIFICATION', 'NOTIFICATIONS'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when a topic quiz attempt is graded.',
  },
  'assessment.exam.passed': {
    eventType: 'assessment.exam.passed',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'ASSESSMENT',
    requiredFields: ['studentId', 'examId', 'courseId', 'scorePercent', 'attemptId'],
    permittedConsumers: ['CREDENTIALS', 'CAREER', 'GAMIFICATION', 'NOTIFICATIONS', 'AUDIT'],
    dataClassification: 'CONFIDENTIAL',
    description: 'Emitted when high-stakes certification examination passing threshold is met.',
  },

  // Credentials
  'credentials.certificate.issued': {
    eventType: 'credentials.certificate.issued',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'CREDENTIALS',
    requiredFields: ['certificateCode', 'studentId', 'studentName', 'courseId', 'issueDate'],
    permittedConsumers: ['CAREER', 'TESTIMONIALS', 'GAMIFICATION', 'NOTIFICATIONS', 'AUDIT'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when tamper-evident signed certificate is issued.',
  },

  // Gamification
  'gamification.xp.awarded': {
    eventType: 'gamification.xp.awarded',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'GAMIFICATION',
    requiredFields: ['studentId', 'activityType', 'pointsAwarded', 'totalBalance'],
    permittedConsumers: ['NOTIFICATIONS'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when academic XP is credited to points ledger.',
  },

  // Growth
  'growth.referral.converted': {
    eventType: 'growth.referral.converted',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'GROWTH',
    requiredFields: ['attributionId', 'referralCode', 'referrerUserId', 'referredUserId'],
    permittedConsumers: ['ADMISSIONS', 'AUDIT'],
    dataClassification: 'INTERNAL',
    description: 'Emitted when a referred student completes enrollment.',
  },

  // Audit
  'audit.archive.generated': {
    eventType: 'audit.archive.generated',
    schemaVersion: 'v1.0.0',
    sourceDomain: 'AUDIT',
    requiredFields: ['archiveId', 'archivePeriod', 'sourceRecordCount', 'contentChecksum'],
    permittedConsumers: [],
    dataClassification: 'RESTRICTED',
    description: 'Emitted when an institutional audit archive is compiled.',
  },
};

const FORBIDDEN_PAYLOAD_KEYS = [
  'password',
  'token',
  'secret',
  'jwt',
  'privateKey',
  'private_key',
  'signatureKey',
  'answerKey',
  'answer_key',
  'correctOptions',
  'correct_options',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
];

export class EventContractRegistry {
  public static getContract(eventType: string): EventContract | undefined {
    return CANONICAL_EVENT_CONTRACTS[eventType];
  }

  public static getAllContracts(): EventContract[] {
    return Object.values(CANONICAL_EVENT_CONTRACTS);
  }

  public static validatePayload(
    eventType: string,
    payload: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const contract = this.getContract(eventType);
    const errors: string[] = [];

    if (!contract) {
      errors.push(`Unknown event type '${eventType}' not registered in contract catalogue.`);
      return { valid: false, errors };
    }

    if (!payload || typeof payload !== 'object') {
      errors.push('Event payload must be a non-null object.');
      return { valid: false, errors };
    }

    // 1. Verify all required fields
    for (const reqField of contract.requiredFields) {
      if (payload[reqField] === undefined || payload[reqField] === null) {
        errors.push(`Missing required field '${reqField}' for event '${eventType}'.`);
      }
    }

    // 2. Data Minimization & Secret Leakage Inspection
    const payloadStr = JSON.stringify(payload).toLowerCase();
    for (const forbidden of FORBIDDEN_PAYLOAD_KEYS) {
      if (Object.keys(payload).some((k) => k.toLowerCase() === forbidden.toLowerCase())) {
        errors.push(`Data minimization violation: forbidden credential or sensitive key '${forbidden}' detected in payload.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public static isConsumerAuthorized(eventType: string, consumerDomain: DomainIdentifier): boolean {
    const contract = this.getContract(eventType);
    if (!contract) return false;
    return contract.permittedConsumers.includes(consumerDomain);
  }
}

