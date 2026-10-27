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

    const { attemptId } = await request.json();
    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID is required' }, { status: 400 });
    }

    // Submit and score authoritative attempt
    const completedAttempt = await db.submitExamAttempt(attemptId, payload.userId);

    // Build comprehensive review breakdown with official explanations
    const allQuestions = await db.getExamQuestions(completedAttempt.certificationType);
    const questionsMap = new Map(allQuestions.map((q) => [q.id, q]));

    // If any assigned question wasn't found in filtered bank, load full question bank asynchronously
    const hasMissing = completedAttempt.assignedQuestionIds.some((qId) => !questionsMap.has(qId));
    if (hasMissing) {
      const fullBank = await db.getExamQuestions();
      fullBank.forEach((q) => questionsMap.set(q.id, q));
    }

    const questionReviews = completedAttempt.assignedQuestionIds.map((qId) => {
      const q = questionsMap.get(qId);
      if (!q) return null;
      const userSelected = completedAttempt.answers[qId] || [];
      const isCorrect =
        userSelected.length === q.correctOptionIds.length &&
        userSelected.every((opt) => q.correctOptionIds.includes(opt));

      return {
        id: q.id,
        domain: q.domain,
        topic: q.topic,
        stem: q.stem,
        options: q.options,
        userSelected,
        correctOptionIds: q.correctOptionIds,
        isCorrect,
        explanation: q.explanation,
        referenceSource: q.referenceSource,
      };
    }).filter(Boolean);

    let certificate: any = null;
    if (completedAttempt.passed) {
      const userCerts = await db.getCertificates(payload.userId);
      certificate =
        userCerts.find(
          (c) => c.certificationType === completedAttempt.certificationType && c.status === 'ISSUED'
        ) || null;
    }

    return NextResponse.json({
      success: true,
      result: {
        attemptId: completedAttempt.id,
        totalScore: completedAttempt.totalScore,
        passingScorePercent: completedAttempt.passingScorePercent,
        passed: completedAttempt.passed,
        domainBreakdown: completedAttempt.domainBreakdown,
        completedTime: completedAttempt.completedTime,
        questions: questionReviews,
        certificate: certificate
          ? {
              id: certificate.id,
              certificateCode: certificate.certificateCode,
              courseTitle: certificate.courseTitle,
              certificationType: certificate.certificationType,
              scorePercent: certificate.scorePercent,
              issueDate: certificate.issueDate,
              verificationUrl: `/verify/${encodeURIComponent(certificate.certificateCode)}`,
            }
          : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit exam' }, { status: 400 });
  }
}
