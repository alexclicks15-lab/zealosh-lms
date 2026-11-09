import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> | { quizId: string } }
) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;
    const resolvedParams = await params;
    const quizId = resolvedParams.quizId;

    const { searchParams } = new URL(request.url);
    const targetUserId = user.role === 'STUDENT' ? user.userId : (searchParams.get('userId') || user.userId);

    const attempts = await db.getQuizAttempts(quizId, targetUserId);
    return NextResponse.json({ success: true, attempts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> | { quizId: string } }
) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;
    const resolvedParams = await params;
    const quizId = resolvedParams.quizId;

    const body = await request.json().catch(() => ({}));
    const { batchId } = body;

    const attempt = await db.startQuizAttempt(quizId, user.userId, batchId);
    return NextResponse.json({ success: true, attempt });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> | { quizId: string } }
) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    await params;

    const body = await request.json();
    const { attemptId, questionId, selectedAnswer } = body;

    if (!attemptId || !questionId || selectedAnswer === undefined) {
      return NextResponse.json(
        { success: false, error: 'attemptId, questionId, and selectedAnswer are required' },
        { status: 400 }
      );
    }

    const updated = await db.saveQuizAttemptAnswer(attemptId, questionId, selectedAnswer);
    return NextResponse.json({ success: true, attempt: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> | { quizId: string } }
) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    await params;

    const body = await request.json();
    const { attemptId } = body;

    if (!attemptId) {
      return NextResponse.json({ success: false, error: 'attemptId is required' }, { status: 400 });
    }

    const submitted = await db.submitQuizAttempt(attemptId);
    return NextResponse.json({
      success: true,
      attempt: submitted,
      message: 'Quiz attempt evaluated and submitted successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

