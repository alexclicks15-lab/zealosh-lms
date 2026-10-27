// Zealosh LMS — Proposed AI Tutor Module Architecture & Integration Boundary
// Architecture: ADR-003 (Optional AI Tutor Feature Gate & Minimal Integration Boundary)
// Status: OPTIONAL / PROPOSED / NOT YET APPROVED
// Non-negotiable constraint: Zero unapproved inference spend, zero background jobs, zero exposure when disabled.

import { UserRole } from '@/types';

export class AiTutorDisabledError extends Error {
  public readonly code = 'AI_TUTOR_DISABLED';
  public readonly status = 403;

  constructor(message: string = 'Zealosh AI Tutor is proposed, unapproved, and currently disabled platform-wide.') {
    super(message);
    this.name = 'AiTutorDisabledError';
  }
}

export interface AiTutorCitation {
  sourceId: string;
  courseId: string;
  lessonId?: string;
  title: string;
  section?: string;
  pageNumber?: number;
}

export interface AiTutorContext {
  userId: string;
  userRole: UserRole;
  courseId: string;
  batchId?: string;
  lessonId?: string;
  query: string;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface AiTutorResponse {
  answer: string;
  citations: AiTutorCitation[];
  disclaimer: string;
  model: string;
  timestamp: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AiTutorConfig {
  provider: 'self_hosted_ollama' | 'enterprise_api';
  providerUrl: string;
  modelName: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
  systemPromptTemplate?: string;
  allowedCourseIds?: string[];
}

export interface AiTutorValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates candidate configuration for a future AI inference service.
 * Enforces server-only URLs, non-empty model names, and sensible bounded parameters.
 */
export function validateAiTutorConfig(config: unknown): AiTutorValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration must be a non-null object'] };
  }

  const c = config as Record<string, any>;

  if (c.provider !== 'self_hosted_ollama' && c.provider !== 'enterprise_api') {
    errors.push('Provider must be either "self_hosted_ollama" or "enterprise_api"');
  }

  if (!c.providerUrl || typeof c.providerUrl !== 'string') {
    errors.push('providerUrl is required and must be a valid URL string');
  } else {
    try {
      const parsed = new URL(c.providerUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push('providerUrl must use http: or https: protocol');
      }
      if (parsed.hostname.toLowerCase() === 'localhost' && process.env.NODE_ENV === 'production') {
        errors.push('providerUrl cannot point to localhost in production environments');
      }
    } catch {
      errors.push('providerUrl must be a well-formed URL');
    }
  }

  if (!c.modelName || typeof c.modelName !== 'string' || c.modelName.trim().length === 0) {
    errors.push('modelName is required and cannot be empty');
  }

  if (typeof c.timeoutMs !== 'number' || c.timeoutMs < 1000 || c.timeoutMs > 60000) {
    errors.push('timeoutMs must be a number between 1000 and 60000 milliseconds');
  }

  if (typeof c.maxTokens !== 'number' || c.maxTokens < 64 || c.maxTokens > 4096) {
    errors.push('maxTokens must be an integer between 64 and 4096');
  }

  if (typeof c.temperature !== 'number' || c.temperature < 0 || c.temperature > 1.0) {
    errors.push('temperature must be a number between 0.0 and 1.0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface AiTutorProvider {
  readonly providerName: string;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; details?: string }>;
  generateResponse(context: AiTutorContext, config: AiTutorConfig): Promise<AiTutorResponse>;
}
