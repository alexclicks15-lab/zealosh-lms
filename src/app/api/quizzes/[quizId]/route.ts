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

    const quiz = await db.getQuiz(quizId);
    if (!quiz) {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 });
    }

    const isPrivileged = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'INSTRUCTOR';
    const questions = await db.getQuizQuestions(quiz.id, isPrivileged);

    return NextResponse.json({
      success: true,
      quiz,
      questions,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> | { quizId: string } }
) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;
    const resolvedParams = await params;
    const quizId = resolvedParams.quizId;

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Instructor or Admin privileges required' },
        { status: 403 }
      );
    }

    const deleted = await db.deleteQuiz(quizId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Quiz not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

