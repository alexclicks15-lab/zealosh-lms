// Zealosh LMS — Student Quiz Attempt Trends API
// Workstream C: Historical attempt comparison and score trajectory tracking

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';

export async function GET(request: Request) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get('quizId') || undefined;
    const requestedStudentId = searchParams.get('studentId');

    let targetStudentId = user.userId;
    if (requestedStudentId && requestedStudentId !== user.userId) {
      if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Insufficient privileges to view peer student trends' },
          { status: 403 }
        );
      }
      targetStudentId = requestedStudentId;
    }

    const trends = await db.getStudentQuizAttemptTrends(targetStudentId, quizId);
    return NextResponse.json({ success: true, trends });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve quiz attempt trends' },
      { status: 500 }
    );
  }
}

