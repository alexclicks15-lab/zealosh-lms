import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { notificationService } from '@/lib/notifications/notification-service';

export async function POST(
  request: Request,
  { params }: { params: { assignmentId: string } }
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
    if (!payload || (payload.role !== 'INSTRUCTOR' && payload.role !== 'SUPER_ADMIN' && payload.role !== 'COURSE_MANAGER')) {
      return NextResponse.json(
        { error: 'Forbidden: Instructor or Admin privileges required to evaluate submissions' },
        { status: 403 }
      );
    }

    const assignment = await db.getAssignmentById(params.assignmentId);
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Verify instructor is specifically assigned to this course or cohort
    if (payload.role === 'INSTRUCTOR') {
      const course = await db.getCourseById(assignment.courseId);
      const isLead = course?.leadInstructorId === payload.userId;
      const isCo = course?.coInstructorIds?.includes(payload.userId);
      const isBatchLead = assignment.batchId
        ? (await db.getBatch(assignment.batchId))?.leadInstructorId === payload.userId
        : false;

      if (!isLead && !isCo && !isBatchLead) {
        return NextResponse.json(
          { error: 'Forbidden: You are not assigned to evaluate submissions for this course or cohort' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { submissionId, score, feedback, rubricScores, status, aiReviewDecision } = body;

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 });
    }

    const targetStatus = status === 'RESUBMISSION_REQUESTED' ? 'RESUBMISSION_REQUESTED' : 'GRADED';

    let numericScore: number | undefined = undefined;
    if (score !== undefined && score !== null && score !== '') {
      numericScore = Number(score);
      if (isNaN(numericScore) || numericScore < 0 || numericScore > assignment.maxScore) {
        return NextResponse.json(
          { error: `Score must be a number between 0 and maximum possible (${assignment.maxScore})` },
          { status: 400 }
        );
      }
    } else if (targetStatus === 'GRADED') {
      return NextResponse.json(
        { error: `Score is required to finalize grade (0 to ${assignment.maxScore})` },
        { status: 400 }
      );
    }

    const existingSubmission = await db.getSubmissionById(submissionId);
    let aiSuggestions = existingSubmission?.aiReviewSuggestions;
    if (aiSuggestions && aiReviewDecision) {
      aiSuggestions = {
        ...aiSuggestions,
        status: aiReviewDecision,
      };
    }

    const graded = await db.gradeSubmission(submissionId, {
      score: numericScore,
      feedback: feedback || '',
      rubricScores: Array.isArray(rubricScores) ? rubricScores : undefined,
      aiReviewSuggestions: aiSuggestions,
      status: targetStatus,
      gradedBy: payload.userId,
      actorEmail: payload.email,
    });

    // Phase 5A: Dispatch in-app notification to student
    const course = await db.getCourseById(assignment.courseId);
    if (targetStatus === 'RESUBMISSION_REQUESTED') {
      await notificationService.notifyResubmissionRequested(graded, assignment, course?.slug);
    } else if (targetStatus === 'GRADED') {
      await notificationService.notifyAssignmentGraded(graded, assignment, course?.slug);
    }

    return NextResponse.json({
      success: true,
      message: targetStatus === 'RESUBMISSION_REQUESTED'
        ? 'Resubmission requested from student with feedback'
        : 'Submission graded successfully',
      submission: graded,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to grade submission' }, { status: 500 });
  }
}
