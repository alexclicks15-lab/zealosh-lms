/**
 * Zealosh Platform — OpenID Connect & OAuth2 Helper Functions
 * Provides RFC 6749 / RFC 7636 / RFC 8414 validation routines,
 * canonical issuer resolution, and strict environment isolation gates.
 */

export interface CanonicalHostResolution {
  baseUrl: string;
  environment: 'staging' | 'production' | 'test';
  canonicalHost: string;
}

/**
 * Resolves the canonical base URL for the active environment.
 * Strictly ignores hostile, unapproved, or cross-environment client-supplied headers.
 */
export function getCanonicalBaseUrl(request?: Request): string {
  const explicitEnv = process.env.ZEALOSH_ENVIRONMENT;
  let resolvedEnv: 'staging' | 'production' | 'test' = 'staging';

  if (explicitEnv === 'production') {
    resolvedEnv = 'production';
  } else if (explicitEnv === 'staging') {
    resolvedEnv = 'staging';
  } else if (process.env.NODE_ENV === 'test') {
    resolvedEnv = 'test';
  } else if (process.env.APP_BASE_URL?.includes('lms.zealosh.com')) {
    resolvedEnv = 'production';
  } else {
    resolvedEnv = 'staging';
  }

  // Canonical base URLs by environment
  const canonicalProductionBase = 'https://lms.zealosh.com';
  const canonicalStagingBase = 'https://lms.staging.zealosh.com';

  // In test mode: allow testing against local base or explicit test env variables
  if (resolvedEnv === 'test') {
    if (process.env.APP_BASE_URL) {
      const cleanAppBase = process.env.APP_BASE_URL.replace(/\/$/, '');
      try {
        const parsedBase = new URL(cleanAppBase);
        // Ensure no userinfo in configured base
        if (!parsedBase.username && !parsedBase.password) {
          // If explicit ZEALOSH_ENVIRONMENT was set to staging or production, guard against cross-env mismatch
          if (explicitEnv === 'staging' && parsedBase.hostname === 'lms.zealosh.com') {
            return canonicalStagingBase;
          }
          if (explicitEnv === 'production' && parsedBase.hostname === 'lms.staging.zealosh.com') {
            return canonicalProductionBase;
          }
          return cleanAppBase;
        }
      } catch {
        // Fall through on malformed base URL
      }
    }

    // Inspect request in test mode (for unit testing local loops)
    if (request) {
      let hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
      if (!hostHeader) {
        try {
          hostHeader = new URL(request.url).host;
        } catch {
          hostHeader = '';
        }
      }

      // Reject any userinfo tricks in forwarded host
      if (hostHeader && !hostHeader.includes('@')) {
        const cleanHost = hostHeader.trim().toLowerCase();
        if (cleanHost === 'localhost:3000' || cleanHost === '127.0.0.1:3000' || cleanHost === 'localhost') {
          return 'http://localhost:3000';
        }
        if (cleanHost === 'lms.staging.zealosh.com') {
          return canonicalStagingBase;
        }
        if (cleanHost === 'lms.zealosh.com') {
          // If ZEALOSH_ENVIRONMENT was explicitly staging, do not allow crossover
          if (explicitEnv === 'staging') {
            return canonicalStagingBase;
          }
          return canonicalProductionBase;
        }
      }
    }

    return canonicalStagingBase;
  }

  // In production: Strictly enforce canonical production base
  if (resolvedEnv === 'production') {
    return canonicalProductionBase;
  }

  // In staging: Strictly enforce canonical staging base
  return canonicalStagingBase;
}

/**
 * Validates OAuth2 / OIDC redirect URIs against strict environment allowlists.
 * Enforces HTTPS, approved paths, exact host matches, rejects userinfo tricks,
 * unapproved ports, and cross-environment crossover.
 */
export function isRedirectUriAllowed(uri: string): boolean {
  if (!uri || typeof uri !== 'string') {
    return false;
  }

  // Reject URL userinfo tricks, directory traversal, backslashes, or null bytes on raw string
  if (uri.includes('@') || uri.includes('/../') || uri.includes('/..') || uri.includes('\\') || uri.includes('%00')) {
    return false;
  }

  try {
    const parsed = new URL(uri);

    // Reject userinfo parsed fields
    if (parsed.username || parsed.password) {
      return false;
    }

    // 1. Strict protocol validation: HTTPS required except for local/internal container development
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }

    const isLocalOrInternal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === 'zealosh-moodle';

    if (parsed.protocol === 'http:' && !isLocalOrInternal) {
      return false;
    }

    // 2. Port restrictions: public hostnames must use default port (no non-standard ports like :8080)
    if (!isLocalOrInternal && parsed.port && parsed.port !== '443' && parsed.port !== '') {
      return false;
    }

    // 3. Strict environment domain separation
    const explicitEnv = process.env.ZEALOSH_ENVIRONMENT;
    let resolvedEnv = explicitEnv;

    if (!resolvedEnv) {
      if (process.env.APP_BASE_URL?.includes('staging')) {
        resolvedEnv = 'staging';
      } else if (process.env.APP_BASE_URL?.includes('lms.zealosh.com')) {
        resolvedEnv = 'production';
      } else if (process.env.NODE_ENV === 'test') {
        resolvedEnv = 'test';
      } else {
        // Safe default: staging, never allow production hostnames silently
        resolvedEnv = 'staging';
      }
    }

    if (resolvedEnv === 'staging') {
      const allowedStagingHosts = ['lms.staging.zealosh.com', 'moodle.internal.zealosh.com', 'zealosh-moodle', 'localhost', '127.0.0.1'];
      if (!allowedStagingHosts.includes(parsed.hostname)) {
        return false;
      }
      // Explicitly reject production hostname crossover in staging
      if (parsed.hostname === 'lms.zealosh.com') {
        return false;
      }
    } else if (resolvedEnv === 'production') {
      const allowedProductionHosts = ['lms.zealosh.com', 'moodle.internal.zealosh.com', 'zealosh-moodle', 'localhost', '127.0.0.1'];
      if (!allowedProductionHosts.includes(parsed.hostname)) {
        return false;
      }
      // Explicitly reject staging hostname crossover in production
      if (parsed.hostname === 'lms.staging.zealosh.com') {
        return false;
      }
    } else if (resolvedEnv === 'test') {
      // In test environment, enforce strict separation if explicit environment flag is active
      if (explicitEnv === 'staging' && parsed.hostname === 'lms.zealosh.com') {
        return false;
      }
      if (explicitEnv === 'production' && parsed.hostname === 'lms.staging.zealosh.com') {
        return false;
      }

      const approvedHosts = ['lms.staging.zealosh.com', 'lms.zealosh.com', 'moodle.internal.zealosh.com', 'zealosh-moodle', 'localhost', '127.0.0.1'];
      if (!approvedHosts.includes(parsed.hostname)) {
        return false;
      }
    } else {
      return false;
    }

    // 4. Path traversal and malformed path rejection
    if (parsed.pathname.includes('..') || parsed.pathname.includes('%00')) {
      return false;
    }

    // 5. Approved callback paths (Moodle core oauth2callback, auth plugin, or subpath)
    const isApprovedPath =
      parsed.pathname.includes('/admin/oauth2callback.php') ||
      parsed.pathname.includes('/auth/oidc/') ||
      parsed.pathname.startsWith('/learn-engine/') ||
      parsed.pathname === '/';

    return isApprovedPath;
  } catch {
    return false;
  }
}

