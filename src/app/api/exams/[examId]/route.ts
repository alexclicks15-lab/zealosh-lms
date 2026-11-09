import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(
  request: Request,
  { params }: { params: { examId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/zealosh_token=([^;]+)/);
      if (match) token = match[1];
    }

    const payload = token ? verifyToken(token) : null;
    const blueprint = await db.getExamBlueprint(params.examId);

    if (!blueprint) {
      return NextResponse.json({ error: 'Exam blueprint not found' }, { status: 404 });
    }

    if (!payload) {
      return NextResponse.json({
        blueprint: {
          id: blueprint.id,
          title: blueprint.title,
          certificationType: blueprint.certificationType,
          totalQuestions: blueprint.totalQuestions,
          durationMinutes: blueprint.durationMinutes,
          passingScorePercent: blueprint.passingScorePercent,
          domains: blueprint.domains,
        },
        attempt: null,
      });
    }

    // Check for candidate's active in-progress attempt for reconnect recovery
    const attempts = await db.getUserExamAttempts(payload.userId);
    const activeAttempt = attempts.find(
      (a) => a.blueprintId === params.examId && a.status === 'IN_PROGRESS'
    );

    if (activeAttempt) {
      const isExpired = Date.now() >= new Date(activeAttempt.deadlineTime).getTime();
      if (isExpired) {
        activeAttempt.status = 'EXPIRED';
        await db.persistToDisk();
      } else {
        const clientQuestions = await db.getQuestionsForAttempt(activeAttempt.id);
        return NextResponse.json({
          blueprint: {
            id: blueprint.id,
            title: blueprint.title,
            durationMinutes: blueprint.durationMinutes,
            passingScorePercent: blueprint.passingScorePercent,
          },
          attempt: {
            id: activeAttempt.id,
            startTime: activeAttempt.startTime,
            deadlineTime: activeAttempt.deadlineTime,
            answers: activeAttempt.answers,
            bookmarks: activeAttempt.bookmarkedQuestionIds,
            autosavedAt: activeAttempt.autosavedAt,
          },
          questions: clientQuestions.map((q, idx) => ({ ...q, index: idx + 1 })),
        });
      }
    }

    return NextResponse.json({
      blueprint: {
        id: blueprint.id,
        title: blueprint.title,
        certificationType: blueprint.certificationType,
        totalQuestions: blueprint.totalQuestions,
        durationMinutes: blueprint.durationMinutes,
        passingScorePercent: blueprint.passingScorePercent,
        domains: blueprint.domains,
      },
      attempt: null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch exam details' }, { status: 500 });
  }
}

