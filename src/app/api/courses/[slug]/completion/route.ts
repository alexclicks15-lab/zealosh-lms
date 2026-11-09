import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { CourseCompletionPolicy } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = user.role === 'STUDENT' ? user.userId : (searchParams.get('userId') || user.userId);

    const policy = await db.getCourseCompletionPolicy(course.id);

    // Find user's enrollment for this course
    const enrollments = await db.getEnrollments(targetUserId);
    const enrollment = enrollments.find((e) => e.courseId === course!.id);

    let evaluation = null;
    if (enrollment) {
      evaluation = await db.evaluateCourseCompletion(enrollment.id);
    }

    return NextResponse.json({
      success: true,
      policy,
      evaluation,
      enrollment: enrollment || null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = user.role === 'STUDENT' ? user.userId : (body.userId || user.userId);

    const enrollments = await db.getEnrollments(targetUserId);
    const enrollment = enrollments.find((e) => e.courseId === course!.id);

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'No enrollment found for this user and course' },
        { status: 404 }
      );
    }

    // Evaluate completion
    const evaluation = await db.evaluateCourseCompletion(enrollment.id);

    let certificate = null;
    if (evaluation.isCompleted) {
      // Automatic collision-safe certificate issuance
      certificate = await db.issueAutomaticCertificate(enrollment.id, 'COURSE_COMPLETION');
    }

    return NextResponse.json({
      success: true,
      evaluation,
      certificate,
      message: evaluation.isCompleted
        ? 'Course completion verified and certificate issued successfully'
        : 'Course completion requirements not yet satisfied',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin privileges required to update completion policies' },
        { status: 403 }
      );
    }

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const body = await request.json();
    const policy = await db.saveCourseCompletionPolicy({
      ...body,
      courseId: course.id,
    });

    return NextResponse.json({
      success: true,
      policy,
      message: 'Course completion policy updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

