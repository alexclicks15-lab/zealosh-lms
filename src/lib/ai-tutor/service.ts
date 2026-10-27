// Zealosh LMS — Server-Side AI Tutor Service Boundary
// Architecture: ADR-003 (Optional AI Tutor Feature Gate & Minimal Integration Boundary)
// Status: OPTIONAL / PROPOSED / NOT YET APPROVED

import { assertAiTutorEnabled } from './gate';
import {
  AiTutorContext,
  AiTutorResponse,
  AiTutorConfig,
  AiTutorProvider,
  AiTutorDisabledError,
} from './types';
import { db } from '@/lib/store/db';

export class AiTutorService {
  private provider: AiTutorProvider | null = null;
  private config: AiTutorConfig | null = null;

  constructor(provider?: AiTutorProvider, config?: AiTutorConfig) {
    if (provider) this.provider = provider;
    if (config) this.config = config;
  }

  /**
   * Authoritative entry point for future AI Tutor queries.
   * Strictly verifies capability enablement, student course enrollment, and privacy boundaries.
   */
  public async query(context: AiTutorContext): Promise<AiTutorResponse> {
    // 1. HARD GATE: Throws AiTutorDisabledError (403) before any outbound network or compute operations
    await assertAiTutorEnabled();

    // 2. Authorization Boundary: Student must be actively enrolled in the course (or be an instructor/admin)
    if (context.userRole === 'STUDENT') {
      const enrollments = await db.getUserEnrollments(context.userId);
      const activeEnrollment = enrollments.find(
        (e) => e.courseId === context.courseId && e.status === 'ACTIVE'
      );
      if (!activeEnrollment) {
        throw new Error('ACCESS DENIED: Candidate is not actively enrolled in this course.');
      }
    }

    // 3. Exam Integrity Boundary: Prohibit retrieval during active examinations
    const attempts = await db.getUserExamAttempts(context.userId);
    const hasActiveExam = attempts.some((att) => att.status === 'IN_PROGRESS');
    if (hasActiveExam) {
      throw new Error('SECURITY VIOLATION: AI Tutor access is suspended during active exam sessions.');
    }

    // 4. Provider Availability Guard: Ensure provider is configured
    if (!this.provider || !this.config) {
      throw new Error('CONFIGURATION ERROR: AI Tutor inference provider is not configured or approved.');
    }

    // 5. Delegate to authorized provider
    return await this.provider.generateResponse(context, this.config);
  }

  /**
   * Healthcheck boundary for future self-hosted inference service.
   */
  public async checkHealth(): Promise<{ ok: boolean; latencyMs: number; details?: string }> {
    await assertAiTutorEnabled();
    if (!this.provider) {
      return { ok: false, latencyMs: 0, details: 'No AI inference provider configured' };
    }
    return await this.provider.healthCheck();
  }
}

export const aiTutorService = new AiTutorService();
