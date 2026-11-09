import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { ProblemReportCategory, BugResolutionStatus } from '@/types';

export async function GET(request: Request) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as BugResolutionStatus | undefined;
    const category = searchParams.get('category') as ProblemReportCategory | undefined;

    const targetUserId = user.role === 'STUDENT' ? user.userId : (searchParams.get('userId') || undefined);

    const reports = await db.getStudentProblemReports(targetUserId, status, category);
    return NextResponse.json({ success: true, reports });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    const body = await request.json();
    const {
      category,
      title,
      description,
      courseId,
      batchId,
      lessonId,
      deviceInfo,
      attachments,
    } = body;

    if (!category || !title || !description) {
      return NextResponse.json(
        { success: false, error: 'category, title, and description are required' },
        { status: 400 }
      );
    }

    const report = await db.createStudentProblemReport({
      userId: user.userId,
      userEmail: user.email,
      userName: user.name,
      category: category as ProblemReportCategory,
      title,
      description,
      courseId,
      batchId,
      lessonId,
      deviceInfo,
      attachments,
    });

    return NextResponse.json({
      success: true,
      report,
      message: `Problem report filed successfully with tracking ID: ${report.ticketNumber}`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Instructor or Admin privileges required to update problem reports' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reportId, status, resolutionNotes, assignedTo } = body;

    if (!reportId || !status) {
      return NextResponse.json(
        { success: false, error: 'reportId and status are required' },
        { status: 400 }
      );
    }

    const updated = await db.updateStudentProblemReport(
      reportId,
      status as BugResolutionStatus,
      resolutionNotes,
      assignedTo || user.email
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Problem report not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      report: updated,
      message: 'Problem report updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

