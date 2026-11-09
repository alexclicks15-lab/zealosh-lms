// Zealosh LMS — Student Orientation Booking API
// POST /api/orientation/sessions/[id]/book — Atomically books an orientation session
// File: src/app/api/orientation/sessions/[id]/book/route.ts

import { NextResponse } from 'next/server';
import { OrientationService } from '@/lib/orientation/orientation-service';
import { verifyToken } from '@/lib/auth/jwt';
import { db } from '@/lib/store/db';

function extractUserToken(request: Request) {
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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { applicationId, notes, idempotencyKey } = body;

    const user = await db.getUser(payload.userId);
    const userEmail = user?.email || payload.email || 'student@zealosh.com';
    const userName = user?.name || payload.name || 'Candidate';

    // Resolve or find application if not passed
    let resolvedAppId = applicationId;
    if (!resolvedAppId) {
      const allApps = await db.getAdmissionApplications();
      const userApps = allApps.filter((a) => a.userId === payload.userId);
      if (userApps.length > 0) {
        resolvedAppId = userApps[0].id;
      } else {
        resolvedAppId = `app-direct-${payload.userId}`;
      }
    }

    const result = await OrientationService.bookOrientationSession({
      sessionId: params.id,
      applicationId: resolvedAppId,
      userId: payload.userId,
      userEmail,
      userName,
      notes,
      idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      booking: result.booking,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to book orientation session' },
      { status: 400 }
    );
  }
}
