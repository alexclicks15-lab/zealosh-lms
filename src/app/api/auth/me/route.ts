import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { sessionRegistry } from '@/lib/auth/session-registry';

export async function GET(request: Request) {
  try {
    let token: string | undefined;

    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Check cookies
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/zealosh_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
    }

    // Check active session registry for revocation
    const sessionValidation = await sessionRegistry.validateSession(token);
    if (sessionValidation.reason === 'REVOKED') {
      const resp = NextResponse.json(
        { error: 'Unauthorized: Session has been revoked', code: 'SESSION_REVOKED' },
        { status: 401 }
      );
      resp.cookies.set('zealosh_token', '', { maxAge: 0, path: '/' });
      return resp;
    }

    const user = await db.getUser(payload.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user active enrollments
    const enrollments = await db.getUserEnrollments(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      sessionId: sessionValidation.session?.id || payload.sessionId,
      enrollments,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Session verification failed' }, { status: 500 });
  }
}
