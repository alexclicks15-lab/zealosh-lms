import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { Assignment } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || undefined;
    const batchId = searchParams.get('batchId') || undefined;

    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/zealosh_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required to view coursework assignments' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const allAssignments = await db.getAssignments(courseId, batchId);

    // 1. Student view: Strictly scoped to published assignments in courses/batches where active enrollment exists
    if (payload.role === 'STUDENT') {
      const enrollments = await db.getEnrollments(payload.userId);
      const activeCourseIds = new Set(
        enrollments.filter((e) => e.status === 'ACTIVE').map((e) => e.courseId)
      );
      const activeBatchIds = new Set(
        enrollments.filter((e) => e.status === 'ACTIVE').map((e) => e.batchId)
      );

      const eligibleAssignments = allAssignments.filter(
        (a) =>
          a.status === 'PUBLISHED' &&
          activeCourseIds.has(a.courseId) &&
          (!a.batchId || activeBatchIds.has(a.batchId))
      );

      const userSubmissions = await db.getSubmissions(undefined, payload.userId);
      const enriched = eligibleAssignments.map((a) => {
        const submission = userSubmissions.find((s) => s.assignmentId === a.id);
        return {
          ...a,
          submission: submission
            ? {
                id: submission.id,
                status: submission.status,
                score: submission.score,
                feedback: submission.feedback,
                submittedAt: submission.submittedAt,
              }
            : null,
        };
      });
      return NextResponse.json({ assignments: enriched });
    }

    // 2. Instructor view: Scoped to assigned courses/cohorts (unless super admin or course manager)
    if (payload.role === 'INSTRUCTOR') {
      const allCourses = await db.getCourses();
      const taughtCourseIds = new Set(
        allCourses
          .filter(
            (c) =>
              c.leadInstructorId === payload.userId ||
              c.coInstructorIds?.includes(payload.userId)
          )
          .map((c) => c.id)
      );
      const allBatches = await db.getBatches();
      const taughtBatchIds = new Set(
        allBatches
          .filter((b) => b.leadInstructorId === payload.userId)
          .map((b) => b.id)
      );

      const scopedAssignments = allAssignments.filter(
        (a) =>
          taughtCourseIds.has(a.courseId) ||
          (a.batchId && taughtBatchIds.has(a.batchId))
      );

      const allSubmissions = await db.getSubmissions();
      const enriched = scopedAssignments.map((a) => {
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
      return NextResponse.json({ assignments: enriched });
    }

    // 3. Admin / Course Manager view: full organization visibility
    if (payload.role === 'SUPER_ADMIN' || payload.role === 'ORG_ADMIN' || payload.role === 'COURSE_MANAGER') {
      const allSubmissions = await db.getSubmissions();
      const enriched = allAssignments.map((a) => {
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
      return NextResponse.json({ assignments: enriched });
    }

    return NextResponse.json({ error: 'Unauthorized role for coursework access' }, { status: 403 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ORG_ADMIN' && payload.role !== 'INSTRUCTOR' && payload.role !== 'COURSE_MANAGER')) {
      return NextResponse.json({ error: 'Forbidden: Instructor or Admin privileges required' }, { status: 403 });
    }

    const body = await request.json();
    const { assignment } = body;

    if (!assignment || !assignment.title || !assignment.courseId || !assignment.dueDate) {
      return NextResponse.json(
        { error: 'Missing required assignment fields: title, courseId, dueDate' },
        { status: 400 }
      );
    }

    // Course-specific instructor authorization: instructor can only create assignments for assigned courses
    if (payload.role === 'INSTRUCTOR') {
      const course = await db.getCourseById(assignment.courseId);
      const isLead = course?.leadInstructorId === payload.userId;
      const isCo = course?.coInstructorIds?.includes(payload.userId);
      const isBatchLead = assignment.batchId
        ? (await db.getBatch(assignment.batchId))?.leadInstructorId === payload.userId
        : false;

      if (!isLead && !isCo && !isBatchLead) {
        return NextResponse.json(
          { error: 'Forbidden: You can only author assignments for courses or cohorts you are assigned to teach' },
          { status: 403 }
        );
      }
    }

    const assignmentId = assignment.id || `asg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const toSave: Assignment = {
      id: assignmentId,
      courseId: assignment.courseId,
      batchId: assignment.batchId || undefined,
      title: assignment.title,
      description: assignment.description || '',
      instructionsHtml: assignment.instructionsHtml || undefined,
      dueDate: assignment.dueDate,
      maxScore: Number(assignment.maxScore || 100),
      rubric: assignment.rubric || undefined,
      status: assignment.status || 'PUBLISHED',
      createdAt: assignment.createdAt || now,
      updatedAt: now,
    };

    const saved = await db.saveAssignment(toSave, payload.email);
    return NextResponse.json({ success: true, assignment: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save assignment' }, { status: 500 });
  }
}
