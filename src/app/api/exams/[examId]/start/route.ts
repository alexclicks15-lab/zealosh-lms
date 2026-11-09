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

    // Prerequisite & Lesson Progression Gating (Milestone 5)
    const blueprint = await db.getExamBlueprint(params.examId);
    if (!blueprint) {
      return NextResponse.json({ error: 'Exam blueprint not found' }, { status: 404 });
    }

    let requestBody: any = {};
    try {
      requestBody = await request.clone().json();
    } catch {
      // empty body is expected for standard start requests
    }

    const isAdmin = payload.role === 'SUPER_ADMIN' || payload.role === 'ORG_ADMIN';
    const isOverride = isAdmin && requestBody.bypassPrerequisites === true;

    if (!isAdmin && !isOverride) {
      const courses = await db.getCourses();
      const relatedCourse = courses.find((c) => c.certificationType === blueprint.certificationType);
      if (relatedCourse) {
        const enrollments = await db.getUserEnrollments(payload.userId);
        const activeEnrollment = enrollments.find(
          (e) =>
            (e.courseId === relatedCourse.id || e.courseId === relatedCourse.slug) &&
            e.status === 'ACTIVE'
        );

        if (!activeEnrollment) {
          return NextResponse.json(
            {
              error: `Enrollment Required: You must be actively enrolled in "${relatedCourse.title}" before attempting this official certification simulation.`,
              code: 'EXAM_UNENROLLED',
              courseId: relatedCourse.id,
              courseSlug: relatedCourse.slug,
            },
            { status: 403 }
          );
        }

        const requiredProgress = 80;
        const currentProgress = activeEnrollment.progressPercent || 0;
        if (currentProgress < requiredProgress) {
          return NextResponse.json(
            {
              error: `Coursework Prerequisite Incomplete: You must complete at least ${requiredProgress}% of course lessons (Current: ${currentProgress}%) before unlocking this official examination simulation.`,
              code: 'EXAM_PROGRESS_INSUFFICIENT',
              currentProgressPercent: currentProgress,
              requiredProgressPercent: requiredProgress,
              courseSlug: relatedCourse.slug,
            },
            { status: 403 }
          );
        }
      }
    }

    // Start authoritative attempt
    const attempt = await db.startExamAttempt(payload.userId, params.examId);

    // Securely project questions without correctOptionIds or explanations (projected from frozen snapshot)
    const rawQuestions = await db.getQuestionsForAttempt(attempt.id);
    const clientQuestions = rawQuestions.map((q, index) => ({
      ...q,
      index: index + 1,
    }));

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
