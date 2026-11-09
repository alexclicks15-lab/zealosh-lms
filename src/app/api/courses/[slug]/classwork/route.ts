// Zealosh LMS — Unified Classwork Organization Hub API Route
// GET /api/courses/[slug]/classwork — Returns aggregated coursework (Assignments, Quizzes, Materials, Live Classes)

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

function extractUserToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const batchIdParam = searchParams.get('batchId') || undefined;

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    let activeEnrollment: any = null;
    if (payload.role === 'STUDENT') {
      const enrollments = await db.getEnrollments(payload.userId);
      activeEnrollment = enrollments.find(
        (e) => e.courseId === course!.id && e.status === 'ACTIVE'
      );
      if (!activeEnrollment) {
        return NextResponse.json(
          { error: 'Forbidden: Active enrollment required to access classwork' },
          { status: 403 }
        );
      }
    }

    if (payload.role === 'INSTRUCTOR') {
      const isLead = course.leadInstructorId === payload.userId;
      const isCo = course.coInstructorIds?.includes(payload.userId);
      const isBatchLead = batchIdParam
        ? (await db.getBatch(batchIdParam))?.leadInstructorId === payload.userId
        : false;

      if (!isLead && !isCo && !isBatchLead) {
        return NextResponse.json(
          { error: 'Forbidden: You are not assigned to instruct this course or cohort' },
          { status: 403 }
        );
      }
    }

    const targetBatchId = batchIdParam || (activeEnrollment ? activeEnrollment.batchId : undefined);

    // 1. Assignments
    const allAssignments = await db.getAssignments(course.id, targetBatchId);
    let enrichedAssignments: any[] = [];

    if (payload.role === 'STUDENT') {
      const userSubmissions = await db.getSubmissions(undefined, payload.userId);
      enrichedAssignments = allAssignments
        .filter((a) => a.status === 'PUBLISHED')
        .map((a) => {
          const sub = userSubmissions.find((s) => s.assignmentId === a.id);
          return {
            ...a,
            submission: sub
              ? {
                  id: sub.id,
                  status: sub.status,
                  score: sub.score,
                  feedback: sub.feedback,
                  submittedAt: sub.submittedAt,
                  rubricScores: sub.rubricScores,
                  aiReviewSuggestions: sub.aiReviewSuggestions,
                }
              : null,
          };
        });
    } else {
      const allSubmissions = await db.getSubmissions();
      enrichedAssignments = allAssignments.map((a) => {
        const matching = allSubmissions.filter((s) => s.assignmentId === a.id);
        const graded = matching.filter((s) => s.status === 'GRADED');
        const pending = matching.filter((s) => s.status === 'SUBMITTED');
        return {
          ...a,
          totalSubmissions: matching.length,
          gradedSubmissions: graded.length,
          pendingSubmissions: pending.length,
        };
      });
    }

    // 2. Quizzes
    const allQuizzes = Array.from(db.quizzes.values()).filter(
      (q) => q.courseId === course!.id && (!targetBatchId || !q.batchId || q.batchId === targetBatchId)
    );
    let enrichedQuizzes: any[] = [];

    if (payload.role === 'STUDENT') {
      const userAttempts = Array.from(db.quizAttempts.values()).filter(
        (a) => a.userId === payload.userId
      );
      enrichedQuizzes = allQuizzes
        .filter((q) => q.status === 'PUBLISHED' || !q.status)
        .map((q) => {
          const attempts = userAttempts.filter((a) => a.quizId === q.id);
          const bestScore = attempts.reduce(
            (max, a) => (a.score !== undefined && a.score > max ? a.score : max),
            0
          );
          const hasPassed = attempts.some((a) => a.passed || a.isPassed);
          return {
            id: q.id,
            title: q.title,
            description: q.description,
            quizType: q.quizType,
            durationMinutes: q.durationMinutes || q.timeLimitMinutes || 30,
            passingScorePercentage: q.passingScorePercentage || q.passingScorePercent || 70,
            totalMarks: q.totalMarks || 100,
            questionsCount: q.questionsCount || 10,
            attemptsCount: attempts.length,
            bestScore: attempts.length > 0 ? bestScore : null,
            hasPassed,
          };
        });
    } else {
      enrichedQuizzes = allQuizzes.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        quizType: q.quizType,
        durationMinutes: q.durationMinutes || q.timeLimitMinutes || 30,
        passingScorePercentage: q.passingScorePercentage || q.passingScorePercent || 70,
        totalMarks: q.totalMarks || 100,
        questionsCount: q.questionsCount || 10,
        status: q.status || 'PUBLISHED',
      }));
    }

    // 3. Learning Materials
    const allMaterials = Array.from(db.learningMaterials.values())
      .filter((m) => m.courseId === course!.id && (!targetBatchId || !m.batchId || m.batchId === targetBatchId))
      .map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        materialType: m.materialType,
        allowDownload: m.allowDownload !== false,
        allowView: m.allowView !== false,
        fileUrl: m.fileUrl || `/materials/${m.id}`,
        fileSizeBytes: m.fileSizeBytes,
        createdAt: m.createdAt,
      }));

    // 4. Live Sessions
    const allLiveSessions = Array.from(db.liveSessions.values())
      .filter((s) => s.courseId === course!.id || (targetBatchId && s.batchId === targetBatchId))
      .map((s) => ({
        id: s.id,
        title: s.title,
        scheduledStartTime: s.scheduledStartTime,
        durationMinutes: s.durationMinutes,
        status: s.status,
        recordingUrl: s.recordingUrl,
      }));

    // 5. Deadlines Timeline
    const upcomingDeadlines: any[] = [];
    enrichedAssignments.forEach((a) => {
      if (a.dueDate) {
        upcomingDeadlines.push({
          id: a.id,
          title: a.title,
          type: 'ASSIGNMENT',
          date: a.dueDate,
          isCompleted: Boolean(a.submission && a.submission.status === 'GRADED'),
          status: a.submission ? a.submission.status : 'PENDING',
        });
      }
    });

    allLiveSessions.forEach((s) => {
      if (s.scheduledStartTime && (s.status === 'SCHEDULED' || s.status === 'LIVE')) {
        upcomingDeadlines.push({
          id: s.id,
          title: s.title,
          type: 'LIVE_CLASS',
          date: s.scheduledStartTime,
          isCompleted: false,
          status: s.status,
        });
      }
    });

    upcomingDeadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        headline: course.headline,
        leadInstructorId: course.leadInstructorId,
      },
      batchId: targetBatchId,
      assignments: enrichedAssignments,
      quizzes: enrichedQuizzes,
      materials: allMaterials,
      liveSessions: allLiveSessions,
      upcomingDeadlines,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve classwork' },
      { status: 500 }
    );
  }
}

