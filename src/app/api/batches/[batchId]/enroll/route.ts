import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function POST(
  request: Request,
  { params }: { params: { batchId: string } }
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
      return NextResponse.json({ error: 'Authentication required to enroll' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const batch = await db.getBatch(params.batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Batch is not accepting enrollments' }, { status: 400 });
    }

    if (new Date() > new Date(batch.endDate)) {
      return NextResponse.json({ error: 'This cohort schedule has already completed' }, { status: 400 });
    }

    // Prerequisite & Eligibility Validation
    const course = await db.getCourseById(batch.courseId);
    if (course && course.certificationType === 'CSP') {
      // Check if student has completed ASP or holds an ASP certificate
      const userEnrollments = await db.getEnrollments(payload.userId);
      const userCerts = await db.getCertificates(payload.userId);

      const hasAspCert = userCerts.some((c) => c.certificationType === 'ASP');
      const hasAspCompleted = userEnrollments.some(
        (e) => (e.courseId === 'crs-asp-01' || e.courseId === 'crs-asp-prep') && e.progressPercent >= 100
      );

      // Check for admin override flag if request is from an administrator
      let body: any = {};
      try {
        body = await request.clone().json();
      } catch {
        // empty body is fine
      }

      const isAdminOverride = body.bypassPrerequisites && (payload.role === 'SUPER_ADMIN' || payload.role === 'ORG_ADMIN');

      if (!hasAspCert && !hasAspCompleted && !isAdminOverride) {
        return NextResponse.json(
          {
            error: 'Prerequisite requirement unmet: Candidate must hold an ASP credential or complete ASP coursework before enrolling in CSP Masterclass.',
            prerequisiteRequired: 'ASP',
          },
          { status: 400 }
        );
      }
    }

    // Call transactional enrollment method with capacity lock
    const result = await db.enrollStudent({
      userId: payload.userId,
      courseId: batch.courseId,
      batchId: batch.id,
    });

    return NextResponse.json({
      success: true,
      message: `Enrolled successfully into batch "${batch.name}"`,
      enrollment: result.enrollment,
    });
  } catch (err: any) {
    const status = err.message.includes('BATCH_CAPACITY_EXCEEDED') ? 409 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
