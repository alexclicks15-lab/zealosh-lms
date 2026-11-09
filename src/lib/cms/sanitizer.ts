// Zealosh LMS — CMS Sanitizer & URL Protocol Guard
// Defenses: OWASP Top 10 A03 (Injection), A05 (Security Misconfiguration), Open Redirects

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export const RESERVED_APPLICATION_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'login',
  'logout',
  'register',
  'courses',
  'batches',
  'classroom',
  'vc',
  'exams',
  'student',
  'instructor',
  'reports',
  'certificates',
  'settings',
  'profile',
  'notifications',
  'support',
  'cart',
  'checkout',
  'p',
  '_next',
  'favicon.ico',
]);

/**
 * Validates whether a given slug is reserved by the application routing system
 */
export function isReservedSlug(slug: string): boolean {
  if (!slug) return true;
  const normalized = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  const rootSegment = normalized.split('/')[0];
  return RESERVED_APPLICATION_SLUGS.has(rootSegment) || RESERVED_APPLICATION_SLUGS.has(normalized);
}

/**
 * Normalizes and validates a CMS page slug
 */
export function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9\-/]/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Validates a hyperlink target URL to strictly prevent javascript:, data:, vbscript: injection
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '#';
  const trimmed = url.trim();

  // Safe relative paths or anchors
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    // Prevent protocol-relative URL bypass (//evil.com)
    if (trimmed.startsWith('//')) {
      return '#';
    }
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return parsed.toString();
    }
    return '#';
  } catch {
    // If not a valid URL or relative path, return fallback anchor
    return '#';
  }
}

/**
 * Sanitizes rich-text HTML string by removing harmful script, iframe, object, and event handlers
 */
export function sanitizeHtml(html: string | undefined | null): string {
  if (!html) return '';

  return html
    // Remove script tags and contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe, object, embed, frame tags
    .replace(/<(iframe|object|embed|frame|applet|base|form|input|button)\b[^>]*>/gi, '')
    .replace(/<\/(iframe|object|embed|frame|applet|base|form|input|button)>/gi, '')
    // Remove inline event handlers (onload, onerror, onclick, etc.)
    .replace(/\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: or vbscript: or data: in href/src
    .replace(/(href|src)\s*=\s*["']?\s*(javascript|vbscript|data):[^"'>\s]*/gi, '$1="#"');
}

