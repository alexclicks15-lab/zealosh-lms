import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: Request) {
  try {
    const userPayload = getAuthenticatedUser(request);
    let userId = userPayload?.userId;

    const body = await request.json();
    const { factorId } = body;

    if (!factorId || typeof factorId !== 'string') {
      return NextResponse.json({ error: 'factorId is required' }, { status: 400 });
    }

    if (!userId && body.userId) {
      userId = body.userId;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to unenroll MFA factor' },
        { status: 401 }
      );
    }

    await db.unenrollMfaFactor(userId, factorId.trim());

    return NextResponse.json({
      success: true,
      message: 'MFA factor successfully unenrolled.',
    });
  } catch (err: any) {
    if (err.message === 'FACTOR_NOT_FOUND') {
      return NextResponse.json({ error: 'MFA factor not found or unauthorized' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'MFA unenrollment failed' }, { status: 500 });
  }
}

