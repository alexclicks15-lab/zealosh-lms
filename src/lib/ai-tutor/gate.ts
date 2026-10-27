// Zealosh LMS — AI Tutor Capability Gate
// Architecture: ADR-003 (Optional AI Tutor Feature Gate & Minimal Integration Boundary)
// Status: OPTIONAL / PROPOSED / NOT YET APPROVED
// Enforces centralized capability verification across all server actions, API routes, and services.

import { db } from '@/lib/store/db';
import { AiTutorDisabledError } from './types';

/**
 * Checks whether the AI Tutor capability is explicitly enabled platform-wide.
 * Defaults strictly to false unless enabled by an authorized Superadmin.
 */
export async function isAiTutorEnabled(): Promise<boolean> {
  try {
    const flags = await db.getFeatureFlags();
    return Boolean(flags && flags.aiTutorEnabled === true);
  } catch {
    // Defense-in-depth: If feature flags cannot be resolved, fail safe (disabled)
    return false;
  }
}

/**
 * Asserts that the AI Tutor capability is active.
 * Throws a typed AiTutorDisabledError (HTTP 403) if disabled.
 */
export async function assertAiTutorEnabled(): Promise<void> {
  const enabled = await isAiTutorEnabled();
  if (!enabled) {
    throw new AiTutorDisabledError();
  }
}
