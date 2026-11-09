// Zealosh LMS — Administrative Progression Reopening API
// Workstream A: Reopen lesson/module progression with immutable audit trail

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { user } = authResult;

    if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Faculty or administrative credentials required to reopen progression' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { studentId, courseId, lessonId, reason } = body;

    if (!studentId || !courseId || !lessonId || !reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'studentId, courseId, lessonId, and a detailed non-empty reason are required' },
        { status: 400 }
      );
    }

    const audit = await db.reopenLessonCompletion(
      studentId,
      courseId,
      lessonId,
      reason.trim(),
      user.userId
    );

    return NextResponse.json({ success: true, audit });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to reopen student progression record' },
      { status: 500 }
    );
  }
}

