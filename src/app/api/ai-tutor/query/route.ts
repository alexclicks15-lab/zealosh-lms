// Zealosh LMS — AI Tutor Query API Route Seam
// Architecture: ADR-003 (Optional AI Tutor Feature Gate & Minimal Integration Boundary)
// Status: OPTIONAL / PROPOSED / NOT YET APPROVED
// Rejects all requests with HTTP 403 AI_TUTOR_DISABLED while capability is disabled.

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { isAiTutorEnabled } from '@/lib/ai-tutor/gate';
import { aiTutorService } from '@/lib/ai-tutor/service';
import { UserRole } from '@/types';

export async function POST(request: Request) {
  try {
    // 1. Session Authentication
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/zealosh_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'INVALID_SESSION', message: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // 2. Authoritative Feature Gate: Reject if disabled
    const enabled = await isAiTutorEnabled();
    if (!enabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI_TUTOR_DISABLED',
          message: 'The Zealosh AI Tutor is an optional proposed capability that is currently disabled and not approved for platform use.',
        },
        { status: 403 }
      );
    }

    // 3. Request Payload Validation
    const body = await request.json();
    const { courseId, query, batchId, lessonId } = body;

    if (!courseId || !query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'INVALID_REQUEST', message: 'courseId and non-empty query are required' },
        { status: 400 }
      );
    }

    // 4. Server-Side Execution (when approved in future)
    const response = await aiTutorService.query({
      userId: payload.userId,
      userRole: payload.role as UserRole,
      courseId,
      batchId,
      lessonId,
      query: query.trim(),
    });

    return NextResponse.json({ success: true, response });
  } catch (err: any) {
    if (err?.code === 'AI_TUTOR_DISABLED' || err?.name === 'AiTutorDisabledError') {
      return NextResponse.json(
        { success: false, error: 'AI_TUTOR_DISABLED', message: err.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'SERVER_ERROR', message: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
