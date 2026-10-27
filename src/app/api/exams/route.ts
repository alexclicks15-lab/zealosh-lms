import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }

  const payload = token ? verifyToken(token) : null;
  const blueprints = await db.getExamBlueprints();
  const courses = await db.getCourses();

  let userAttempts: any[] = [];
  let userEnrollments: any[] = [];
  let userCerts: any[] = [];

  if (payload) {
    const [attempts, enrollments, certs] = await Promise.all([
      db.getUserExamAttempts(payload.userId),
      db.getUserEnrollments(payload.userId),
      db.getCertificates(payload.userId),
    ]);
    userAttempts = attempts.map((a) => ({
      id: a.id,
      blueprintId: a.blueprintId,
      certificationType: a.certificationType,
      status: a.status,
      startTime: a.startTime,
      completedTime: a.completedTime,
      totalScore: a.totalScore,
      passed: a.passed,
    }));
    userEnrollments = enrollments;
    userCerts = certs;
  }

  const enrichedBlueprints = blueprints.map((bp) => {
    const relatedCourse = courses.find((c) => c.certificationType === bp.certificationType);
    const activeEnrollment = userEnrollments.find(
      (e) =>
        relatedCourse &&
        (e.courseId === relatedCourse.id || e.courseId === relatedCourse.slug) &&
        e.status === 'ACTIVE'
    );
    const progressPercent = activeEnrollment?.progressPercent || 0;
    const requiredProgressPercent = 80;

    let isUnlocked = false;
    let lockReason: 'UNAUTHENTICATED' | 'UNENROLLED' | 'PROGRESS_INSUFFICIENT' | null = null;

    if (!payload) {
      isUnlocked = false;
      lockReason = 'UNAUTHENTICATED';
    } else if (payload.role === 'SUPER_ADMIN' || payload.role === 'ORG_ADMIN' || payload.role === 'INSTRUCTOR') {
      isUnlocked = true;
      lockReason = null;
    } else if (!activeEnrollment) {
      isUnlocked = false;
      lockReason = 'UNENROLLED';
    } else if (progressPercent < requiredProgressPercent) {
      isUnlocked = false;
      lockReason = 'PROGRESS_INSUFFICIENT';
    } else {
      isUnlocked = true;
      lockReason = null;
    }

    const passedAttempt = userAttempts.find((a) => a.blueprintId === bp.id && a.passed);
    const certificate = userCerts.find(
      (c) => c.certificationType === bp.certificationType && c.status === 'ISSUED'
    );

    return {
      ...bp,
      courseId: relatedCourse?.id || null,
      courseSlug: relatedCourse?.slug || null,
      courseTitle: relatedCourse?.title || null,
      isUnlocked,
      lockReason,
      requiredProgressPercent,
      currentProgressPercent: progressPercent,
      passedAttempt: passedAttempt || null,
      certificate: certificate
        ? {
            id: certificate.id,
            certificateCode: certificate.certificateCode,
            issueDate: certificate.issueDate,
          }
        : null,
    };
  });

  return NextResponse.json({
    blueprints: enrichedBlueprints,
    attempts: userAttempts,
  });
}
