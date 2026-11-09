import { verifyToken } from './jwt';
import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export interface AdminActor {
  userId: string;
  email: string;
  role: string;
}

const ALLOWED_ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN']);

/**
 * Server-side administrator authorization guard.
 * Validates session JWT from Authorization Bearer header or zealosh_token cookie.
 * Enforces institutional administrator roles (SUPER_ADMIN or ADMIN).
 * Validates tokenVersion to ensure revoked or outdated credentials are rejected.
 * Enforces Multi-Factor Authentication (MFA / AAL2) if enabled on administrator profile.
 * Aliases legacy ORG_ADMIN to canonical institutional ADMIN role.
 * Strictly forbids unauthenticated access across all environments (zero dev bypass).
 */
export function authorizeAdmin(request: Request): { actor: AdminActor } | { errorResponse: NextResponse } {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid or expired session token' },
        { status: 401 }
      ),
    };
  }

  if (!ALLOWED_ADMIN_ROLES.has(payload.role)) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Forbidden: Administrative privileges required' },
        { status: 403 }
      ),
    };
  }

  // Token versioning check: If profile/user has a higher tokenVersion, reject token
  if (payload.userId) {
    const user = db.users.get(payload.userId);
    const profile = db.profiles.get(payload.userId);
    const currentVersion = profile?.tokenVersion ?? user?.tokenVersion ?? 1;
    const tokenVersion = payload.tokenVersion ?? 1;

    if (tokenVersion < currentVersion) {
      return {
        errorResponse: NextResponse.json(
          { success: false, error: 'Unauthorized: Session invalidated due to credential update. Please log in again.' },
          { status: 401 }
        ),
      };
    }

    // MFA enforcement for administrators with MFA configured (must be verified server-side from signed JWT claims)
    if (profile?.mfaEnabled) {
      const isMfaVerified = payload.mfaVerified === true || payload.aal === 'aal2';
      if (!isMfaVerified) {
        return {
          errorResponse: NextResponse.json(
            { success: false, error: 'Forbidden: Multi-factor authentication (MFA) required', code: 'MFA_REQUIRED' },
            { status: 403 }
          ),
        };
      }
    }
  }

  return {
    actor: {
      userId: payload.userId,
      email: payload.email,
      // Map legacy ORG_ADMIN to canonical single-institution ADMIN role
      role: payload.role === 'ORG_ADMIN' ? 'ADMIN' : payload.role,
    },
  };
}

/**
 * Server-side user authorization guard for general authenticated endpoints.
 * Validates session JWT from Authorization Bearer header or zealosh_token cookie.
 * Validates tokenVersion to ensure revoked or outdated credentials are rejected.
 */
export function authorizeUser(request: Request): { user: { userId: string; email: string; role: string; name: string } } | { errorResponse: NextResponse } {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid or expired session token' },
        { status: 401 }
      ),
    };
  }

  // Token versioning check
  if (payload.userId) {
    const user = db.users.get(payload.userId);
    const profile = db.profiles.get(payload.userId);
    const currentVersion = profile?.tokenVersion ?? user?.tokenVersion ?? 1;
    const tokenVersion = payload.tokenVersion ?? 1;

    if (tokenVersion < currentVersion) {
      return {
        errorResponse: NextResponse.json(
          { success: false, error: 'Unauthorized: Session invalidated due to credential update. Please log in again.' },
          { status: 401 }
        ),
      };
    }
  }

  return {
    user: {
      userId: payload.userId,
      email: payload.email,
      role: payload.role === 'ORG_ADMIN' ? 'ADMIN' : payload.role,
      name: payload.name || payload.email,
    },
  };
}
