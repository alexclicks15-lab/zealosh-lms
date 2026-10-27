import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/zealosh_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');

    // Students may only view their own certificates; Admins may view any user's
    const isAdmin =
      payload.role === 'SUPER_ADMIN' ||
      payload.role === 'ORG_ADMIN';

    const targetUserId = isAdmin ? (requestedUserId || undefined) : payload.userId;

    const certs = await db.getCertificates(targetUserId);

    return NextResponse.json({
      success: true,
      certificates: certs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}
