// Zealosh LMS — Active Session Registry & Revocation Test Suite
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken, verifyToken } from '@/lib/auth/jwt';
import { sessionRegistry, hashSessionToken } from '@/lib/auth/session-registry';
import { GET as getSessions, POST as revokeOtherSessions } from '@/app/api/auth/sessions/route';
import { DELETE as revokeSingleSession } from '@/app/api/auth/sessions/[id]/route';
import { GET as meGet } from '@/app/api/auth/me/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { POST as loginPost } from '@/app/api/auth/login/route';

describe('Track 1: Active Session Registry & Revocation (ZM-IMPL-08B)', () => {
  beforeEach(async () => {
    await db.resetToSeed();
  });

  it('1. should register active session on successful user login', async () => {
    const loginReq = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'x-forwarded-for': '203.0.113.45',
      },
      body: JSON.stringify({
        email: 'student@zealosh.com',
        password: 'Zealosh@2026',
      }),
    });

    const res = await loginPost(loginReq);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sessionId).toBeDefined();
    expect(body.token).toBeDefined();

    // Verify session was registered in registry
    const session = await db.getSessionById(body.sessionId);
    expect(session).toBeDefined();
    expect(session?.userId).toBe('usr-std-01');
    expect(session?.deviceLabel).toContain('Chrome on Windows');
    expect(session?.ipAddress).toBe('203.0.***.***');
    expect(session?.revoked).toBe(false);
  });

  it('2. should list all active user sessions and identify current session', async () => {
    const student = await db.getUser('usr-std-01');
    expect(student).toBeDefined();

    // Create session 1 (current)
    const token1 = signToken({ ...student!, sessionId: 'sess-mac-01' });
    const sess1 = await sessionRegistry.registerSession({
      userId: student!.id,
      token: token1,
      ipAddress: '203.0.113.10',
      userAgent: 'Chrome on macOS',
    });

    // Create session 2 (mobile)
    const token2 = signToken({ ...student!, sessionId: 'sess-phone-02' });
    const sess2 = await sessionRegistry.registerSession({
      userId: student!.id,
      token: token2,
      ipAddress: '198.51.100.22',
      userAgent: 'Safari on iPhone',
    });

    const req = new Request('http://localhost:3000/api/auth/sessions', {
      headers: {
        Authorization: `Bearer ${token1}`,
      },
    });

    const res = await getSessions(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.sessions.length).toBeGreaterThanOrEqual(2);

    const current = data.sessions.find((s: any) => s.id === sess1.id);
    const other = data.sessions.find((s: any) => s.id === sess2.id);

    expect(current?.isCurrent).toBe(true);
    expect(other?.isCurrent).toBe(false);
    expect(current?.revoked).toBe(false);
  });

  it('3. should revoke an individual session and mark revocation timestamp', async () => {
    const student = await db.getUser('usr-std-01');
    const token = signToken({ ...student! });
    const sess = await sessionRegistry.registerSession({
      userId: student!.id,
      token,
      ipAddress: '203.0.113.10',
      userAgent: 'Firefox on Linux',
    });

    const req = new Request(`http://localhost:3000/api/auth/sessions/${sess.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await revokeSingleSession(req, { params: Promise.resolve({ id: sess.id }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.revokedSessionId).toBe(sess.id);

    // Verify session is marked revoked in database
    const updated = await db.getSessionById(sess.id);
    expect(updated?.revoked).toBe(true);
    expect(updated?.revokedAt).toBeDefined();

    // Verify session validation fails
    const validation = await sessionRegistry.validateSession(token);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe('REVOKED');
  });

  it('4. should reject requests to /api/auth/me when the session has been revoked', async () => {
    const student = await db.getUser('usr-std-01');
    const token = signToken({ ...student! });
    const sess = await sessionRegistry.registerSession({
      userId: student!.id,
      token,
      ipAddress: '203.0.113.10',
      userAgent: 'Chrome on Windows',
    });

    // Pre-revocation check: me endpoint should succeed
    const preReq = new Request('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const preRes = await meGet(preReq);
    expect(preRes.status).toBe(200);

    // Revoke the session
    await sessionRegistry.revokeSession(sess.id, student!.id, 'Security test revocation');

    // Post-revocation check: me endpoint MUST reject with 401
    const postReq = new Request('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const postRes = await meGet(postReq);
    expect(postRes.status).toBe(401);

    const postData = await postRes.json();
    expect(postData.code).toBe('SESSION_REVOKED');
  });

  it('5. should revoke all other active sessions while preserving the current active session', async () => {
    const student = await db.getUser('usr-std-01');
    const currentToken = signToken({ ...student!, sessionId: 'sess-current-01' });
    const currentSess = await sessionRegistry.registerSession({
      userId: student!.id,
      token: currentToken,
      userAgent: 'Current Chrome',
    });

    // Create 3 other sessions with unique tokens
    const otherTokens = [
      signToken({ ...student!, sessionId: 'sess-other-1' }),
      signToken({ ...student!, sessionId: 'sess-other-2' }),
      signToken({ ...student!, sessionId: 'sess-other-3' }),
    ];
    const otherSessions = await Promise.all(
      otherTokens.map((t, idx) =>
        sessionRegistry.registerSession({
          userId: student!.id,
          token: t,
          userAgent: `Device ${idx + 1}`,
        })
      )
    );

    // Call revoke-other-sessions endpoint
    const req = new Request('http://localhost:3000/api/auth/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    });

    const res = await revokeOtherSessions(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.revokedCount).toBe(3);

    // Verify current session is still valid
    const currentValidation = await sessionRegistry.validateSession(currentToken);
    expect(currentValidation.valid).toBe(true);

    // Verify other sessions are all revoked
    for (const t of otherTokens) {
      const v = await sessionRegistry.validateSession(t);
      expect(v.valid).toBe(false);
      expect(v.reason).toBe('REVOKED');
    }
  });

  it('6. should revoke session upon calling /api/auth/logout', async () => {
    const student = await db.getUser('usr-std-01');
    const token = signToken({ ...student! });
    const sess = await sessionRegistry.registerSession({
      userId: student!.id,
      token,
      userAgent: 'Chrome on Windows',
    });

    const logoutReq = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const logoutRes = await logoutPost(logoutReq);
    expect(logoutRes.status).toBe(200);

    // Verify session in registry is revoked
    const validation = await sessionRegistry.validateSession(token);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe('REVOKED');
  });
});
