// Zealosh LMS — Course Orientation Configuration API
// GET /api/orientation/configs/[courseId] — Fetch course orientation settings
// POST /api/orientation/configs/[courseId] — Update orientation settings
// File: src/app/api/orientation/configs/[courseId]/route.ts

import { NextResponse } from 'next/server';
import { OrientationService } from '@/lib/orientation/orientation-service';
import { verifyToken } from '@/lib/auth/jwt';

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

export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const config = await OrientationService.getCourseOrientationConfig(params.courseId);
    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch orientation configuration' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (
      !payload?.userId ||
      (payload.role !== 'SUPER_ADMIN' &&
        payload.role !== 'ORG_ADMIN' &&
        payload.role !== 'COURSE_MANAGER')
    ) {
      return NextResponse.json(
        { error: 'Unauthorized: Administrative role required to configure course orientation' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updated = await OrientationService.saveCourseOrientationConfig({
      courseId: params.courseId,
      ...body,
    });

    return NextResponse.json({ success: true, config: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to save orientation configuration' },
      { status: 400 }
    );
  }
}

