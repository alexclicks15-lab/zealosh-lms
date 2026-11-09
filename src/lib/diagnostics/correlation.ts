// Zealosh LMS — Correlation ID Generation & Extraction Utility
// Path: src/lib/diagnostics/correlation.ts
// Provides unified tracing across Frontend -> API Route -> Database -> Background Workers

import crypto from 'crypto';

/**
 * Generates a collision-resistant correlation ID formatted with date prefix for rapid indexing.
 * Example: corr-20261101-a1b2c3d4e5f6
 */
export function generateCorrelationId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(6).toString('hex');
  return `corr-${dateStr}-${randomHex}`;
}

/**
 * Extracts correlation ID from incoming request headers or fallback parameters.
 * Checks 'x-correlation-id', 'x-request-id', 'correlation-id', 'x-trace-id'.
 */
export function extractCorrelationId(headers?: Headers | Record<string, string | string[] | undefined> | null): string {
  if (!headers) {
    return generateCorrelationId();
  }

  if (typeof (headers as Headers).get === 'function') {
    const h = headers as Headers;
    const val = h.get('x-correlation-id') || h.get('x-request-id') || h.get('correlation-id') || h.get('x-trace-id');
    if (val && typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  } else {
    const raw = headers as Record<string, string | string[] | undefined>;
    const val = raw['x-correlation-id'] || raw['x-request-id'] || raw['correlation-id'] || raw['x-trace-id'];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
    if (Array.isArray(val) && val[0] && typeof val[0] === 'string' && val[0].trim().length > 0) {
      return val[0].trim();
    }
  }

  return generateCorrelationId();
}

