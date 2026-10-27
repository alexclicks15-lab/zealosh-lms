import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(
  request: Request,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const assignment = await db.getAssignmentById(params.assignmentId);
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

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

    // 1. Admin / Course Manager access
    if (payload.role === 'SUPER_ADMIN' || payload.role === 'ORG_ADMIN' || payload.role === 'COURSE_MANAGER') {
      const submissions = await db.getSubmissions(assignment.id);
      return NextResponse.json({
        assignment,
        submissions,
      });
    }

    // 2. Instructor access: must be assigned to this course or cohort
    if (payload.role === 'INSTRUCTOR') {
      const course = await db.getCourseById(assignment.courseId);
      const isLead = course?.leadInstructorId === payload.userId;
      const isCo = course?.coInstructorIds?.includes(payload.userId);
      const isBatchLead = assignment.batchId
        ? (await db.getBatch(assignment.batchId))?.leadInstructorId === payload.userId
        : false;

      if (!isLead && !isCo && !isBatchLead) {
        return NextResponse.json(
          { error: 'Forbidden: You are not assigned to instruct this course or cohort' },
          { status: 403 }
        );
      }

      const submissions = await db.getSubmissions(assignment.id);
      return NextResponse.json({
        assignment,
        submissions,
      });
    }

    // 3. Student access: must be actively enrolled in this course / cohort
    if (payload.role === 'STUDENT') {
      if (assignment.status !== 'PUBLISHED') {
        return NextResponse.json({ error: 'Assignment is not currently published' }, { status: 403 });
      }

      const enrollments = await db.getEnrollments(payload.userId);
      const activeEnrollment = enrollments.find(
        (e) =>
          e.courseId === assignment.courseId &&
          e.status === 'ACTIVE' &&
          (!assignment.batchId || e.batchId === assignment.batchId)
      );

      if (!activeEnrollment) {
        return NextResponse.json(
          { error: 'Forbidden: Active enrollment required to access this assignment' },
          { status: 403 }
        );
      }

      const submissions = await db.getSubmissions(assignment.id, payload.userId);
      return NextResponse.json({
        assignment,
        userSubmission: submissions[0] || null,
      });
    }

    return NextResponse.json({ error: 'Unauthorized role for coursework access' }, { status: 403 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve assignment' }, { status: 500 });
  }
}

export async function DELETE(
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
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ORG_ADMIN' && payload.role !== 'INSTRUCTOR')) {
      return NextResponse.json({ error: 'Forbidden: Instructor or Admin privileges required' }, { status: 403 });
    }

    const assignment = await db.getAssignmentById(params.assignmentId);
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Course-specific instructor authorization: verify instructor is assigned to this course
    if (payload.role === 'INSTRUCTOR') {
      const course = await db.getCourseById(assignment.courseId);
      const isLead = course?.leadInstructorId === payload.userId;
      const isCo = course?.coInstructorIds?.includes(payload.userId);
      const isBatchLead = assignment.batchId
        ? (await db.getBatch(assignment.batchId))?.leadInstructorId === payload.userId
        : false;

      if (!isLead && !isCo && !isBatchLead) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete assignments for courses or cohorts you are assigned to teach' },
          { status: 403 }
        );
      }
    }

    const success = await db.deleteAssignment(params.assignmentId, payload.email);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete assignment' }, { status: 500 });
  }
}
