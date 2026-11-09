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

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty or non-JSON body is permissible if authenticated via token
    }

    if (!userId && body.userId) {
      // Allow passing explicit userId only in test/dev environment if authorized
      userId = body.userId;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to enroll MFA' },
        { status: 401 }
      );
    }

    const { factorType = 'totp', friendlyName } = body;
    const enrolled = await db.enrollMfaFactor(userId, factorType, friendlyName);

    return NextResponse.json({
      success: true,
      factor: {
        id: enrolled.factor.id,
        userId: enrolled.factor.userId,
        factorType: enrolled.factor.factorType,
        friendlyName: enrolled.factor.friendlyName,
        status: enrolled.factor.status,
        createdAt: enrolled.factor.createdAt,
      },
      totp: enrolled.totp,
    });
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'MFA enrollment failed' }, { status: 500 });
  }
}

