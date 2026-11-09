// Zealosh LMS — Student Detailed Progression Breakdown API
// Workstream A: Multi-Level Student Progression Engine
// Provides verified lesson, topic, module completion diagnostics and exam eligibility.

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> | { courseId: string } }
) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { user } = authResult;

    // Resolve courseId from params
    const resolvedParams = await Promise.resolve(params);
    const courseId = resolvedParams.courseId;

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'courseId is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedStudentId = searchParams.get('studentId');

    let targetStudentId = user.userId;
    if (requestedStudentId && requestedStudentId !== user.userId) {
      // Only instructor or admin can view other students' detailed progression
      if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Insufficient privileges to view peer student progression' },
          { status: 403 }
        );
      }
      targetStudentId = requestedStudentId;
    }

    const progression = await db.getStudentProgression(targetStudentId, courseId);
    return NextResponse.json({ success: true, progression });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while resolving progression' },
      { status: 500 }
    );
  }
}

