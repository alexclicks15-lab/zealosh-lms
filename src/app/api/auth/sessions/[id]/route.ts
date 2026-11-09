// Zealosh LMS — Individual Session Revocation API Handler
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: No session token provided' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session token' }, { status: 401 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Revoke the requested session
    await sessionRegistry.revokeSession(sessionId, payload.userId, 'Individual user revocation');

    // Check if the revoked session was the current caller's session
    const currentValidation = await sessionRegistry.validateSession(token);
    const isCurrentRevoked = currentValidation.session?.id === sessionId || currentValidation.reason === 'REVOKED';

    const response = NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
      revokedSessionId: sessionId,
      isCurrentSession: isCurrentRevoked,
    });

    if (isCurrentRevoked) {
      response.cookies.set('zealosh_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      });
    }

    return response;
  } catch (err: any) {
    const status = err.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: err.message || 'Failed to revoke session' }, { status });
  }
}

