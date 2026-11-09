import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { EntitlementService } from '@/lib/commerce/entitlement-service';

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

export async function GET(request: Request) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId =
      (userPayload.role === 'SUPER_ADMIN' || userPayload.role === 'ORG_ADMIN') &&
      searchParams.get('userId')
        ? searchParams.get('userId')!
        : userPayload.userId;

    const courseId = searchParams.get('courseId') || undefined;

    const entitlements = await EntitlementService.getUserEntitlements(targetUserId, {
      courseId,
    });

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      entitlements,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

