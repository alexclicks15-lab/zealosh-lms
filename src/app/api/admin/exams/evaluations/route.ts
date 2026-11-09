import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

function getStaffFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR', 'COURSE_MANAGER'];
  if (!allowedRoles.includes(payload.role)) return null;
  return payload;
}

export async function GET(request: Request) {
  try {
    const staff = getStaffFromRequest(request);
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized: Faculty or Admin permissions required' }, { status: 403 });
    }

    const queue = await db.getManualEvaluationQueue(staff.userId);
    return NextResponse.json({
      success: true,
      count: queue.length,
      queue: queue.map((item) => ({
        attemptId: item.attempt.id,
        userId: item.attempt.userId,
        certificationType: item.attempt.certificationType,
        questionId: item.question.id,
        domain: item.question.domain,
        topic: item.question.topic,
        stem: item.question.stem,
        rubricCriteria: item.question.rubricCriteria,
        candidateAnswer: item.attempt.answers[item.question.id] || [],
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const staff = getStaffFromRequest(request);
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized: Faculty or Admin permissions required' }, { status: 403 });
    }

    const body = await request.json();
    const { attemptId, questionId, awardedPoints, maxPoints = 1, feedback, rubricCriterionId } = body;

    if (!attemptId || !questionId || awardedPoints === undefined) {
      return NextResponse.json(
        { error: 'Missing required evaluation fields: attemptId, questionId, awardedPoints' },
        { status: 400 }
      );
    }

    const evalRecord = await db.submitManualEvaluation({
      attemptId,
      questionId,
      evaluatorId: staff.userId,
      evaluatorName: staff.email,
      rubricCriterionId,
      awardedPoints: Number(awardedPoints),
      maxPoints: Number(maxPoints),
      feedback,
    });

    return NextResponse.json({
      success: true,
      evaluation: evalRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const staff = getStaffFromRequest(request);
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorized: Faculty or Admin permissions required' }, { status: 403 });
    }

    const body = await request.json();
    const { attemptId, publish } = body;

    if (!attemptId || !publish) {
      return NextResponse.json({ error: 'attemptId and publish=true are required' }, { status: 400 });
    }

    const publishedAttempt = await db.publishExamResults(attemptId, staff.userId);

    return NextResponse.json({
      success: true,
      result: {
        attemptId: publishedAttempt.id,
        status: publishedAttempt.status,
        totalScore: publishedAttempt.totalScore,
        passed: publishedAttempt.passed,
        certificateCode: publishedAttempt.certificateCode,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

