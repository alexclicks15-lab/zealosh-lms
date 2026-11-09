import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { EntitlementService } from '@/lib/commerce/entitlement-service';
import { EntitlementFeatureScope } from '@/types';

function getUserFromRequest(request: Request) {
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
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, featureScope, atTime } = body;

    if (!courseId || !featureScope) {
      return NextResponse.json(
        { error: 'courseId and featureScope are required' },
        { status: 400 }
      );
    }

    const targetUserId =
      (userPayload.role === 'SUPER_ADMIN' || userPayload.role === 'ORG_ADMIN') && body.userId
        ? body.userId
        : userPayload.userId;

    const evaluation = await EntitlementService.evaluateEntitlement(
      targetUserId,
      courseId,
      featureScope as EntitlementFeatureScope,
      atTime
    );

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

