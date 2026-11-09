// Zealosh LMS — Course & Cohort Announcements API Route
// GET: Lists announcements for course/batch context (authorized learners & staff)
// POST: Publishes announcement (course/batch instructors & administrators)
// Architecture: ZM-04.1 Audience Isolation, Instructor Assignment Authorization & Phase 5A Notifications

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { ClassroomAnnouncement } from '@/types';
import { notificationService } from '@/lib/notifications/notification-service';

function extractUserToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const batchIdParam = searchParams.get('batchId') || undefined;

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Role-based entitlement checks
    if (payload.role === 'STUDENT') {
      const enrollments = await db.getEnrollments(payload.userId);
      const activeEnrollments = enrollments.filter(
        (e) => e.courseId === course!.id && e.status === 'ACTIVE'
      );
      if (activeEnrollments.length === 0) {
        return NextResponse.json(
          { error: 'Forbidden: Active enrollment required to access classroom announcements' },
          { status: 403 }
        );
      }

      let targetBatchId: string | undefined;
      if (batchIdParam) {
        const isEnrolledInRequestedBatch = activeEnrollments.some((e) => e.batchId === batchIdParam);
        if (!isEnrolledInRequestedBatch) {
          return NextResponse.json(
            { error: 'Forbidden: Cannot access announcements for an unenrolled cohort batch' },
            { status: 403 }
          );
        }
        targetBatchId = batchIdParam;
      } else {
        // Default to student's enrolled batch
        targetBatchId = activeEnrollments[0].batchId;
      }

      const announcements = await db.getAnnouncements(course.id, targetBatchId);
      return NextResponse.json({ announcements });
    }

    if (payload.role === 'INSTRUCTOR') {
      const isLead = course.leadInstructorId === payload.userId;
      const isCo = course.coInstructorIds?.includes(payload.userId);
      let isBatchLead = false;

      if (batchIdParam) {
        const batch = await db.getBatch(batchIdParam);
        isBatchLead = batch?.courseId === course.id && batch?.leadInstructorId === payload.userId;
      }

      if (!isLead && !isCo && !isBatchLead) {
        return NextResponse.json(
          { error: 'Forbidden: You are not assigned to instruct this course or cohort' },
          { status: 403 }
        );
      }
    }

    const announcements = await db.getAnnouncements(course.id, batchIdParam);
    return NextResponse.json({ announcements });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve announcements' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (
      payload.role !== 'INSTRUCTOR' &&
      payload.role !== 'SUPER_ADMIN' &&
      payload.role !== 'ORG_ADMIN' &&
      payload.role !== 'COURSE_MANAGER'
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Instructor or Admin privileges required to post announcements' },
        { status: 403 }
      );
    }

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, content, batchId, attachments, isPinned } = body;

    if (!title || !title.trim() || !content || !content.trim()) {
      return NextResponse.json(
        { error: 'Announcement title and content are required' },
        { status: 400 }
      );
    }

    // Verify instructor assignment authorization
    if (payload.role === 'INSTRUCTOR') {
      const isLead = course.leadInstructorId === payload.userId;
      const isCo = course.coInstructorIds?.includes(payload.userId);

      if (batchId) {
        const batch = await db.getBatch(batchId);
        if (!batch || batch.courseId !== course.id) {
          return NextResponse.json(
            { error: 'Cohort batch does not exist or does not belong to this course' },
            { status: 400 }
          );
        }
        const isBatchLead = batch.leadInstructorId === payload.userId;
        if (!isLead && !isCo && !isBatchLead) {
          return NextResponse.json(
            { error: 'Forbidden: You are not assigned to instruct this cohort batch' },
            { status: 403 }
          );
        }
      } else {
        // Course-wide announcements require course lead or co-instructor privileges
        if (!isLead && !isCo) {
          return NextResponse.json(
            { error: 'Forbidden: Batch-level instructors cannot post course-wide announcements' },
            { status: 403 }
          );
        }
      }
    }

    const user = await db.getUser(payload.userId);
    const now = new Date().toISOString();
    const announcementId = `anc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const announcement: ClassroomAnnouncement = {
      id: announcementId,
      courseId: course.id,
      batchId: batchId || undefined,
      audienceScope: batchId ? 'BATCH_SPECIFIC' : 'COURSE_WIDE',
      status: 'PUBLISHED',
      authorId: payload.userId,
      authorName: user?.name || payload.name || 'Instructor',
      authorRole: payload.role as any,
      title: title.trim(),
      content: content.trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      isPinned: Boolean(isPinned),
      createdAt: now,
      updatedAt: now,
    };

    const saved = await db.saveAnnouncement(announcement, payload.email);

    // Phase 5A: Dispatch in-app notifications to eligible students
    await notificationService.notifyAnnouncementPublished(saved, course.slug);

    return NextResponse.json({ success: true, announcement: saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to post announcement' },
      { status: 500 }
    );
  }
}
