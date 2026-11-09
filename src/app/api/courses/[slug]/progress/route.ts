import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
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

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const enrollments = await db.getEnrollments(payload.userId);
    const activeEnrollment = enrollments.find(
      (e) => e.courseId === course!.id && e.status === 'ACTIVE'
    );

    if (!activeEnrollment) {
      return NextResponse.json(
        { error: 'Forbidden: Active course enrollment required to view progress' },
        { status: 403 }
      );
    }

    const granularProgress = await db.getLearningProgress(payload.userId, course.id);

    return NextResponse.json({
      success: true,
      enrollment: activeEnrollment,
      progressPercent: activeEnrollment.progressPercent,
      completedLessonIds: activeEnrollment.completedLessonIds || [],
      granularProgress,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch progress' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
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

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Retrieve student's active enrollment in this course
    const enrollments = await db.getEnrollments(payload.userId);
    const activeEnrollment = enrollments.find(
      (e) => e.courseId === course!.id && e.status === 'ACTIVE'
    );

    if (!activeEnrollment) {
      return NextResponse.json(
        { error: 'Forbidden: Active course enrollment required to update lesson progress' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      lessonId,
      completed,
      playbackPositionSeconds,
      totalDurationSeconds,
      activityType,
      bookmarks,
      notes,
    } = body;

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 });
    }

    // Update granular progress record
    const granular = await db.updateLearningProgress({
      userId: payload.userId,
      courseId: course.id,
      batchId: activeEnrollment.batchId || undefined,
      lessonId,
      activityType: activityType || 'PRERECORDED_VIDEO',
      playbackPositionSeconds,
      totalDurationSeconds,
      isCompleted: completed !== undefined ? Boolean(completed) : undefined,
      bookmarks,
      notes,
    });

    const lessons = await db.getLessons(course.id);
    const totalLessons = lessons.length > 0 ? lessons.length : (course.totalLessons || 1);

    let completedLessonIds = [...(activeEnrollment.completedLessonIds || [])];

    if (completed === false) {
      completedLessonIds = completedLessonIds.filter((id) => id !== lessonId);
    } else if (completed === true || granular.isCompleted) {
      if (!completedLessonIds.includes(lessonId)) {
        completedLessonIds.push(lessonId);
      }
    }

    const progressPercent = Math.min(
      100,
      Math.round((completedLessonIds.length / totalLessons) * 100)
    );

    const updated = await db.updateEnrollmentProgress(
      activeEnrollment.id,
      completedLessonIds,
      progressPercent,
      payload.email
    );

    return NextResponse.json({
      success: true,
      enrollmentId: updated.id,
      progressPercent: updated.progressPercent,
      completedLessonIds: updated.completedLessonIds,
      isFullyCompleted: updated.progressPercent >= 100,
      granularProgress: granular,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update lesson progress' }, { status: 500 });
  }
}
