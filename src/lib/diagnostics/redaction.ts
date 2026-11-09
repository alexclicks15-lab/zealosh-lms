// Zealosh LMS — Sensitive Data Redaction Utility
// Path: src/lib/diagnostics/redaction.ts
// Enforces zero leakage of credentials, tokens, candidate answers, and payment cards

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /auth(orization)?/i,
  /cookie/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /card[_-]?num(ber)?/i,
  /credit[_-]?card/i,
  /cvv/i,
  /cvc/i,
  /ssn/i,
  /answer[_-]?key/i,
  /solution[_-]?text/i,
  /correct[_-]?option/i,
  /candidate[_-]?response/i,
];

// Regex for Bearer tokens: Bearer <base64/jwt/hex>
const BEARER_REGEX = /Bearer\s+([A-Za-z0-9\-_.~+/]+=*)/gi;

// Regex for potential 13-19 digit credit cards with or without spaces/dashes
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;

// Regex for Basic auth: Basic <base64>
const BASIC_AUTH_REGEX = /Basic\s+([A-Za-z0-9+/=]+)/gi;

// Regex for JWT tokens: eyJ...
const JWT_REGEX = /eyJ[A-Za-z0-9\-_=]+\.eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_.+/=]*/g;

/**
 * Sanitizes a string message or stack trace, stripping credentials and sensitive patterns.
 */
export function sanitizeString(val: string): string {
  if (!val || typeof val !== 'string') return '';

  let sanitized = val
    .replace(BEARER_REGEX, 'Bearer [REDACTED]')
    .replace(BASIC_AUTH_REGEX, 'Basic [REDACTED]')
    .replace(JWT_REGEX, '[JWT_REDACTED]');

  // Check if string matches credit card pattern and redact if passes basic Luhn check
  sanitized = sanitized.replace(CREDIT_CARD_REGEX, (match) => {
    const cleaned = match.replace(/[\s-]/g, '');
    if (cleaned.length >= 13 && cleaned.length <= 19 && /^\d+$/.test(cleaned)) {
      return '[CARD_REDACTED]';
    }
    return match;
  });

  return sanitized;
}

/**
 * Recursively deep-redacts sensitive fields in any object, array, or primitive.
 * Employs a WeakSet to safeguard against circular references.
 */
export function redactSensitiveData<T = any>(data: T, seen = new WeakSet()): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeString(data) as unknown as T;
  }

  if (typeof data !== 'object') {
    return data;
  }

  // Handle circular references safely
  if (seen.has(data as object)) {
    return '[CIRCULAR_REF]' as unknown as T;
  }
  seen.add(data as object);

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, seen)) as unknown as T;
  }

  // Check if it's an Error instance
  if (data instanceof Error) {
    const serializedError: Record<string, any> = {
      name: data.name,
      message: sanitizeString(data.message),
      stack: data.stack ? sanitizeString(data.stack) : undefined,
    };
    for (const [key, value] of Object.entries(data)) {
      if (isKeySensitive(key)) {
        serializedError[key] = '[REDACTED]';
      } else {
        serializedError[key] = redactSensitiveData(value, seen);
      }
    }
    return serializedError as unknown as T;
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isKeySensitive(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSensitiveData(value, seen);
    }
  }

  return result as unknown as T;
}

/**
 * Checks if an object property key is sensitive.
 */
export function isKeySensitive(key: string): boolean {
  if (!key) return false;
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

