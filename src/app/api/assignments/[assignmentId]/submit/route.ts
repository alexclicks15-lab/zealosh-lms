import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { AssignmentSubmission } from '@/types';

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
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const assignment = await db.getAssignmentById(params.assignmentId);
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    if (assignment.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Assignment is not currently open for submissions' }, { status: 400 });
    }

    // Verify student is actively enrolled in the course and matching cohort
    const enrollments = await db.getEnrollments(payload.userId);
    const activeEnrollment = enrollments.find(
      (e) =>
        e.courseId === assignment.courseId &&
        e.status === 'ACTIVE' &&
        (!assignment.batchId || e.batchId === assignment.batchId)
    );

    if (!activeEnrollment && payload.role === 'STUDENT') {
      return NextResponse.json(
        { error: 'Forbidden: Active enrollment in this course and cohort required to submit coursework' },
        { status: 403 }
      );
    }

    // Check existing submission
    const existingSubmissions = await db.getSubmissions(assignment.id, payload.userId);
    const existing = existingSubmissions[0];

    if (existing && existing.status === 'GRADED') {
      return NextResponse.json(
        { error: 'Cannot resubmit an assignment that has already been evaluated and graded' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { submissionText, attachmentUrl, attachmentFilename } = body;

    if (!submissionText && !attachmentUrl) {
      return NextResponse.json(
        { error: 'Please provide submission notes or an attachment file' },
        { status: 400 }
      );
    }

    const user = await db.getUser(payload.userId);
    const now = new Date().toISOString();
    const submissionId = existing?.id || `sub-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const submission: AssignmentSubmission = {
      id: submissionId,
      assignmentId: assignment.id,
      courseId: assignment.courseId,
      batchId: activeEnrollment?.batchId || assignment.batchId,
      userId: payload.userId,
      studentName: user?.name || payload.name,
      studentEmail: user?.email || payload.email,
      submissionText: submissionText || '',
      attachmentUrl: attachmentUrl || undefined,
      attachmentFilename: attachmentFilename || undefined,
      submittedAt: now,
      status: 'SUBMITTED',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const saved = await db.submitAssignment(submission, payload.email);

    return NextResponse.json({
      success: true,
      message: 'Assignment submitted successfully for instructor review',
      submission: saved,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit assignment' }, { status: 500 });
  }
}
