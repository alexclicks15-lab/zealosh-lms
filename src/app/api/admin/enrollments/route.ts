import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId') || undefined;
    const userId = searchParams.get('userId') || undefined;

    const [enrollments, courses, batches, users] = await Promise.all([
      db.getEnrollments(userId, batchId),
      db.getCourses(),
      db.getBatches(),
      db.getUsers(),
    ]);

    const enriched = enrollments.map((enr) => {
      const course = courses.find((c) => c.id === enr.courseId);
      const batch = batches.find((b) => b.id === enr.batchId);
      const user = users.find((u) => u.id === enr.userId);
      return {
        ...enr,
        courseTitle: course?.title || 'Unknown Course',
        batchName: batch?.name || 'Unknown Batch',
        studentName: user?.name || 'Unknown Student',
        studentEmail: user?.email || 'unknown@zealosh.com',
      };
    });

    return NextResponse.json({ success: true, enrollments: enriched });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const body = await request.json();
    const { enrollmentId, status } = body;

    if (!enrollmentId || !status) {
      return NextResponse.json(
        { success: false, error: 'enrollmentId and status (ACTIVE, EXPIRED, REVOKED) are required' },
        { status: 400 }
      );
    }

    if (!['ACTIVE', 'EXPIRED', 'REVOKED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be ACTIVE, EXPIRED, or REVOKED' },
        { status: 400 }
      );
    }

    const updated = await db.updateEnrollmentStatus(enrollmentId, status, authResult.actor.email);
    return NextResponse.json({ success: true, enrollment: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
