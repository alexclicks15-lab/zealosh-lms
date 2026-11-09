// Zealosh LMS — Assessment Performance Intelligence API
// Workstream C: Question difficulty index, discrimination index, common distractors, and topic mastery

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> | { quizId: string } }
) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { user } = authResult;

    if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Faculty or administrative credentials required to view assessment analytics' },
        { status: 403 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const quizId = resolvedParams.quizId;

    if (!quizId) {
      return NextResponse.json({ success: false, error: 'quizId is required' }, { status: 400 });
    }

    const analytics = await db.getQuizPerformanceAnalytics(quizId, user.userId);
    return NextResponse.json({ success: true, analytics });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to compute assessment performance analytics' },
      { status: 500 }
    );
  }
}

