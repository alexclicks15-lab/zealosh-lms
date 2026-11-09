// Zealosh LMS — AI Assignment Formative Review Suggestion API
// Workstream B: Formative evaluation suggestions strictly pending human instructor review

import { NextResponse } from 'next/server';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { aiAssignmentReviewer } from '@/lib/ai/assignment-reviewer';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> | { submissionId: string } }
) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { user } = authResult;

    if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Faculty or administrative credentials required' },
        { status: 403 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const submissionId = resolvedParams.submissionId;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: 'submissionId is required' },
        { status: 400 }
      );
    }

    const suggestion = await aiAssignmentReviewer.generateReviewSuggestion(
      submissionId,
      user.userId
    );

    return NextResponse.json({ success: true, suggestion });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to generate formative review suggestion' },
      { status: 500 }
    );
  }
}

