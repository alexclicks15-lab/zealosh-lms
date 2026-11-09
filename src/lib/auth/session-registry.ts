// Zealosh LMS — Active Session Registry & Revocation Service
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import crypto from 'crypto';
import { UserSession } from '@/types';
import { db } from '@/lib/store/db';
import { isSupabaseConfigured, getSupabaseAdminClient } from '@/lib/supabase';

export interface CreateSessionParams {
  userId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresInDays?: number;
}

export interface SessionValidationResult {
  valid: boolean;
  reason?: 'NOT_FOUND' | 'REVOKED' | 'EXPIRED';
  session?: UserSession;
}

/**
 * Computes deterministic SHA-256 hash of a session JWT/token.
 * Plaintext tokens are NEVER stored in persistent storage.
 */
export function hashSessionToken(token: string): string {
  if (!token) return '';
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Parses user-agent header to extract browser and operating system details.
 */
export function parseUserAgentDetails(ua?: string): { browser: string; os: string; deviceLabel: string } {
  if (!ua || typeof ua !== 'string') {
    return { browser: 'Unknown Browser', os: 'Unknown OS', deviceLabel: 'Web Session' };
  }

  let os = 'Unknown OS';
  if (/windows phone/i.test(ua)) os = 'Windows Phone';
  else if (/win/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  const isMobile = /mobile|iphone|ipod|android.*mobile/i.test(ua);
  const isTablet = /ipad|tablet|android(?!.*mobile)/i.test(ua);
  const deviceType = isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop';

  const deviceLabel = `${browser} on ${os} (${deviceType})`;
  return { browser, os, deviceLabel };
}

/**
 * Masks IP address to preserve privacy while providing diagnostic utility.
 */
export function maskIpAddress(ip?: string): string {
  if (!ip) return 'Unknown IP';
  const trimmed = ip.trim();
  // Handle IPv4
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
  }
  // Handle IPv6
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    return `${parts.slice(0, 2).join(':')}:****:****`;
  }
  return trimmed;
}

export class SessionRegistry {
  /**
   * Registers a newly authenticated user session.
   */
  public async registerSession(params: CreateSessionParams): Promise<UserSession> {
    const { userId, token, ipAddress, userAgent, expiresInDays = 7 } = params;
    const tokenHash = hashSessionToken(token);
    const { browser, os, deviceLabel } = parseUserAgentDetails(userAgent);
    const maskedIp = maskIpAddress(ipAddress);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    const sessionId = `sess-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

    const session: UserSession = {
      id: sessionId,
      userId,
      tokenHash,
      deviceLabel,
      browser,
      os,
      ipAddress: maskedIp,
      userAgent: userAgent ? userAgent.substring(0, 255) : undefined,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt,
      revoked: false,
      isCurrent: true,
    };

    // Store in unified in-memory store
    await db.saveSessionRecord(session);

    // If Supabase persistence is enabled, store in public.user_sessions
    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      try {
        const admin = getSupabaseAdminClient();
        if (admin) {
          await admin.from('user_sessions').insert({
            id: session.id,
            user_id: session.userId,
            session_token_hash: session.tokenHash,
            device_label: session.deviceLabel,
            browser: session.browser,
            os: session.os,
            ip_address: session.ipAddress,
            created_at: session.createdAt,
            last_active_at: session.lastActiveAt,
            expires_at: session.expiresAt,
            revoked_at: null,
          });
        }
      } catch (err) {
        // Fallback to local store on transient error
      }
    }

    return session;
  }

  /**
   * Validates a session token against active session records.
   * Checks expiration and explicit revocation.
   */
  public async validateSession(token: string): Promise<SessionValidationResult> {
    if (!token) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    const tokenHash = hashSessionToken(token);
    const session = await db.getSessionByTokenHash(tokenHash);

    if (!session) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    if (session.revoked || session.revokedAt) {
      return { valid: false, reason: 'REVOKED', session };
    }

    const isExpired = new Date(session.expiresAt).getTime() <= Date.now();
    if (isExpired) {
      return { valid: false, reason: 'EXPIRED', session };
    }

    // Update last_active_at throttled to once every 5 minutes
    const lastActive = new Date(session.lastActiveAt).getTime();
    if (Date.now() - lastActive > 5 * 60 * 1000) {
      session.lastActiveAt = new Date().toISOString();
      await db.saveSessionRecord(session);
    }

    return { valid: true, session };
  }

  /**
   * Revokes a single session by its unique ID.
   */
  public async revokeSession(
    sessionId: string,
    actorUserId: string,
    reason: string = 'User initiated revocation'
  ): Promise<boolean> {
    const session = await db.getSessionById(sessionId);
    if (!session) return false;

    // Security check: actor must own the session or have administrative access
    if (session.userId !== actorUserId && actorUserId !== 'admin' && actorUserId !== 'system') {
      const actorUser = await db.getUser(actorUserId);
      if (!actorUser || (actorUser.role !== 'SUPER_ADMIN' && actorUser.role !== 'ORG_ADMIN')) {
        throw new Error('Unauthorized to revoke session belonging to another user');
      }
    }

    session.revoked = true;
    session.revokedAt = new Date().toISOString();
    session.revokedByUserId = actorUserId;
    session.revocationReason = reason;

    await db.saveSessionRecord(session);

    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      try {
        const admin = getSupabaseAdminClient();
        if (admin) {
          await admin
            .from('user_sessions')
            .update({
              revoked_at: session.revokedAt,
              revoked_by_user_id: actorUserId,
              revocation_reason: reason,
            })
            .eq('id', sessionId);
        }
      } catch (err) {
        // Log or handle
      }
    }

    await db.recordAuthAuditEvent({
      actorUserId,
      action: 'SESSION_REVOKED',
      entityType: 'AUTH',
      entityId: sessionId,
      details: { targetUserId: session.userId, reason },
    });

    return true;
  }

  /**
   * Revokes a session identified by its token string (used during logout).
   */
  public async revokeSessionByToken(
    token: string,
    actorUserId?: string,
    reason: string = 'User logged out'
  ): Promise<boolean> {
    if (!token) return false;
    const tokenHash = hashSessionToken(token);
    const session = await db.getSessionByTokenHash(tokenHash);
    if (!session) return false;

    return this.revokeSession(session.id, actorUserId || session.userId, reason);
  }

  /**
   * Revokes all active sessions for a user EXCEPT the current session.
   */
  public async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
    actorUserId: string,
    reason: string = 'User revoked all other active sessions'
  ): Promise<{ revokedCount: number }> {
    const sessions = await db.getUserSessions(userId);
    let count = 0;

    for (const session of sessions) {
      if (session.id !== currentSessionId && !session.revoked && !session.revokedAt) {
        session.revoked = true;
        session.revokedAt = new Date().toISOString();
        session.revokedByUserId = actorUserId;
        session.revocationReason = reason;
        await db.saveSessionRecord(session);
        count++;

        if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
          try {
            const admin = getSupabaseAdminClient();
            if (admin) {
              await admin
                .from('user_sessions')
                .update({
                  revoked_at: session.revokedAt,
                  revoked_by_user_id: actorUserId,
                  revocation_reason: reason,
                })
                .eq('id', session.id);
            }
          } catch {
            // Keep going
          }
        }
      }
    }

    await db.recordAuthAuditEvent({
      actorUserId,
      action: 'ALL_OTHER_SESSIONS_REVOKED',
      entityType: 'AUTH',
      entityId: userId,
      details: { preservedSessionId: currentSessionId, revokedCount: count },
    });

    return { revokedCount: count };
  }

  /**
   * Lists all sessions for a user, indicating which is currently active.
   */
  public async listUserSessions(userId: string, currentSessionToken?: string): Promise<UserSession[]> {
    const currentHash = currentSessionToken ? hashSessionToken(currentSessionToken) : undefined;
    const sessions = await db.getUserSessions(userId);

    return sessions
      .map((s) => ({
        ...s,
        isCurrent: Boolean(currentHash && s.tokenHash === currentHash),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const sessionRegistry = new SessionRegistry();

