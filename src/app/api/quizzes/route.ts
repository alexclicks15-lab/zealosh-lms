import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { QuizType } from '@/types';

export async function GET(request: Request) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const batchId = searchParams.get('batchId') || undefined;
    const lessonId = searchParams.get('lessonId') || undefined;
    const quizType = searchParams.get('quizType') as QuizType | undefined;

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });
    }

    const quizzes = await db.getQuizzes(courseId, batchId, lessonId, quizType);
    return NextResponse.json({ success: true, quizzes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Instructor or Admin privileges required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      courseId,
      batchId,
      lessonId,
      title,
      description,
      quizType,
      timeLimitMinutes,
      durationMinutes,
      passingScorePercent,
      shuffleQuestions,
      allowReview,
      scheduledStartTime,
      scheduledEndTime,
      timezone,
      scoreSelection,
      maxAttempts,
      questions,
    } = body;

    if (!courseId || !title || !quizType) {
      return NextResponse.json(
        { success: false, error: 'courseId, title, and quizType are required' },
        { status: 400 }
      );
    }

    const savedQuiz = await db.saveQuiz({
      courseId,
      batchId: batchId || null,
      lessonId: lessonId || null,
      title,
      description: description || '',
      quizType,
      timeLimitMinutes: timeLimitMinutes || durationMinutes || null,
      durationMinutes: durationMinutes || timeLimitMinutes || null,
      passingScorePercent: passingScorePercent ?? 70,
      shuffleQuestions: shuffleQuestions !== undefined ? Boolean(shuffleQuestions) : true,
      allowReview: allowReview !== undefined ? Boolean(allowReview) : true,
      scheduledStartTime: scheduledStartTime || undefined,
      scheduledEndTime: scheduledEndTime || undefined,
      timezone: timezone || 'Asia/Kolkata',
      scoreSelection: scoreSelection || 'HIGHEST',
      maxAttempts: maxAttempts !== undefined ? Number(maxAttempts) : 3,
      isLiveActive: false,
    });

    if (Array.isArray(questions) && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await db.saveQuizQuestion({
          quizId: savedQuiz.id,
          questionText: q.questionText,
          questionType: q.questionType || 'SINGLE_CHOICE',
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || '',
          points: q.points || 1,
          sortOrder: q.sortOrder || i,
        });
      }
    }

    const fullQuiz = await db.getQuiz(savedQuiz.id);
    return NextResponse.json({
      success: true,
      quiz: fullQuiz,
      message: 'Quiz created successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

