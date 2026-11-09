// Zealosh LMS — Course-Grounded AI Tutor Chat API
// Workstream B: Course-grounded RAG context, active exam lockout enforcement, and honest offline reporting

import { NextResponse } from 'next/server';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { executeTutorQuery } from '@/lib/ai/rag-context';

export async function POST(request: Request) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { user } = authResult;

    const body = await request.json();
    const { courseId, query, sessionId } = body;

    if (!courseId || !query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'courseId and non-empty query are required' },
        { status: 400 }
      );
    }

    const response = await executeTutorQuery({
      userId: user.userId,
      courseId,
      query: query.trim(),
      userRole: user.role,
      sessionId,
    });

    return NextResponse.json({ success: true, response });
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('AI_EXAM_LOCKOUT_ACTIVE')) {
      return NextResponse.json(
        {
          success: false,
          code: 'AI_EXAM_LOCKOUT_ACTIVE',
          error: 'AI Tutor access is automatically suspended while a formal certification examination is active.',
        },
        { status: 403 }
      );
    }

    if (msg.includes('AI_FORBIDDEN')) {
      return NextResponse.json(
        {
          success: false,
          code: 'AI_FORBIDDEN',
          error: msg,
        },
        { status: 403 }
      );
    }

    if (msg.includes('COURSE_NOT_FOUND')) {
      return NextResponse.json(
        {
          success: false,
          code: 'COURSE_NOT_FOUND',
          error: msg,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: 'AI_QUERY_ERROR',
        error: msg || 'An error occurred while processing the tutor query',
      },
      { status: 500 }
    );
  }
}

