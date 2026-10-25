import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function POST(
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

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // Start authoritative attempt
    const attempt = db.startExamAttempt(payload.userId, params.examId);
    const blueprint = db.examBlueprints.get(params.examId);

    // Securely project questions without correctOptionIds or explanations
    const clientQuestions = attempt.assignedQuestionIds.map((qId, index) => {
      const q = db.examQuestions.get(qId)!;
      return {
        id: q.id,
        index: index + 1,
        domain: q.domain,
        topic: q.topic,
        stem: q.stem,
        type: q.type,
        difficulty: q.difficulty,
        options: q.options,
      };
    });

    return NextResponse.json({
      attemptId: attempt.id,
      blueprint: {
        id: blueprint?.id,
        title: blueprint?.title,
        durationMinutes: blueprint?.durationMinutes,
        passingScorePercent: blueprint?.passingScorePercent,
      },
      startTime: attempt.startTime,
      deadlineTime: attempt.deadlineTime,
      questions: clientQuestions,
      savedAnswers: attempt.answers,
      bookmarks: attempt.bookmarkedQuestionIds,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to start exam' }, { status: 400 });
  }
}
