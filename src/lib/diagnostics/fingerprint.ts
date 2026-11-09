// Zealosh LMS — Deterministic Error Fingerprinting
// Path: src/lib/diagnostics/fingerprint.ts
// Aggregates recurring duplicate errors into cohesive issues by normalizing variable parameters

import crypto from 'crypto';
import { DiagnosticCategory } from '@/types';

/**
 * Normalizes dynamic path parameters (UUIDs, timestamps, numeric IDs, mongo-like IDs)
 * so that /api/courses/crs-123 and /api/courses/crs-456 map to the same route pattern.
 */
export function normalizeRoute(route?: string): string {
  if (!route) return 'global';

  return route
    .split('?')[0] // Drop query strings
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
    .replace(/\b(crs|batch|usr|user|sub|assign|outbox|notif|sess|exam|atm)-[a-zA-Z0-9_-]+\b/gi, ':$1id')
    .replace(/\b\d+\b/g, ':id')
    .toLowerCase()
    .trim();
}

/**
 * Normalizes error messages by scrubbing dynamic timestamps, UUIDs, IDs, and numbers.
 */
export function normalizeErrorMessage(message: string): string {
  if (!message) return 'Unknown Error';

  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\bcorr-[a-zA-Z0-9_-]+\b/gi, '<corr-id>')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, '<timestamp>')
    .replace(/0x[0-9a-fA-F]+/g, '<hex>')
    .replace(/\b\d+\b/g, '<num>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Generates a deterministic, collision-resistant fingerprint for grouping errors into issues.
 * Returns a 32-character hexadecimal hash.
 */
export function generateFingerprint(params: {
  category: DiagnosticCategory;
  errorCode?: string;
  route?: string;
  service?: string;
  message: string;
}): string {
  const normCategory = params.category || 'API_FAILURE';
  const normCode = (params.errorCode || 'NO_CODE').toUpperCase().trim();
  const normPath = normalizeRoute(params.route || params.service || 'system');
  const normMsg = normalizeErrorMessage(params.message);

  const rawKey = `${normCategory}|${normCode}|${normPath}|${normMsg}`;

  return crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 32);
}
