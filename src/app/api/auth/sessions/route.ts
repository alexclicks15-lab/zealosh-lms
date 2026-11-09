// Zealosh LMS — Active Sessions API Handler
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { sessionRegistry } from '@/lib/auth/session-registry';

function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/zealosh_token=([^;]+)/);
  if (match) return match[1];
  return null;
}

export async function GET(request: Request) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: No session token provided' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session token' }, { status: 401 });
    }

    const sessions = await sessionRegistry.listUserSessions(payload.userId, token);

    return NextResponse.json({
      success: true,
      sessions,
      totalActive: sessions.filter((s) => !s.revoked && !s.revokedAt).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list user sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: No session token provided' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session token' }, { status: 401 });
    }

    // Determine current session ID
    const validation = await sessionRegistry.validateSession(token);
    const currentSessionId = validation.session?.id || payload.sessionId || '';

    const result = await sessionRegistry.revokeAllOtherSessions(
      payload.userId,
      currentSessionId,
      payload.userId,
      'User revoked all other active sessions'
    );

    return NextResponse.json({
      success: true,
      message: `Successfully revoked ${result.revokedCount} other active sessions`,
      revokedCount: result.revokedCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to revoke other sessions' }, { status: 500 });
  }
}

