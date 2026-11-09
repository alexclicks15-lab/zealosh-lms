// Zealosh LMS — AI Assignment Review Finalization API
// Workstream B: Faculty acceptance, modification, or discard of AI suggestions

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

    const body = await request.json();
    const { action, score, feedback, rubricScores } = body;

    if (!action || !['ACCEPT', 'MODIFY', 'DISCARD'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid action (ACCEPT, MODIFY, or DISCARD) is required' },
        { status: 400 }
      );
    }

    const submission = await aiAssignmentReviewer.finalizeSuggestion(
      submissionId,
      action,
      user.userId,
      { score, feedback, rubricScores }
    );

    return NextResponse.json({ success: true, submission });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to finalize assignment review action' },
      { status: 500 }
    );
  }
}

