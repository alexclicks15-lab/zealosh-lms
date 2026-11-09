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

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Instructor or Admin privileges required for live score dashboard' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId') || undefined;

    const dashboard = await db.getLiveScoreDashboard(quizId, sessionId);
    return NextResponse.json({ success: true, dashboard });
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

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Instructor or Admin privileges required to launch live quizzes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, sessionId } = body;

    if (!action || (action !== 'activate' && action !== 'deactivate')) {
      return NextResponse.json(
        { success: false, error: 'action must be either "activate" or "deactivate"' },
        { status: 400 }
      );
    }

    if (action === 'activate') {
      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: 'sessionId is required to activate a live quiz' },
          { status: 400 }
        );
      }
      const quiz = await db.activateLiveQuiz(quizId, sessionId);
      return NextResponse.json({
        success: true,
        quiz,
        message: 'Live quiz launched in session successfully',
      });
    } else {
      const quiz = await db.deactivateLiveQuiz(quizId);
      return NextResponse.json({
        success: true,
        quiz,
        message: 'Live quiz ended successfully',
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

