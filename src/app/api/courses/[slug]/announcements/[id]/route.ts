// Zealosh LMS — Delete & Update Announcement API Route
// DELETE /api/courses/[slug]/announcements/[id]
// PATCH /api/courses/[slug]/announcements/[id]
// Architecture: ZM-04.1 Instructor & Author Ownership Enforcement & Archival Lifecycle

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

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

export async function DELETE(
  request: Request,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const announcement = await db.getAnnouncementById(params.id);
    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }

    // Authorization: Author, Course Lead Instructor, or Admin
    const isAuthor = announcement.authorId === payload.userId;
    const isLead = course ? course.leadInstructorId === payload.userId : false;
    const isAdmin =
      payload.role === 'SUPER_ADMIN' ||
      payload.role === 'ORG_ADMIN' ||
      payload.role === 'COURSE_MANAGER';

    if (!isAuthor && !isLead && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to delete this announcement' },
        { status: 403 }
      );
    }

    const success = await db.deleteAnnouncement(params.id, payload.email);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete announcement' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const announcement = await db.getAnnouncementById(params.id);
    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }

    // Authorization: Author, Course Lead Instructor, or Admin
    const isAuthor = announcement.authorId === payload.userId;
    const isLead = course ? course.leadInstructorId === payload.userId : false;
    const isAdmin =
      payload.role === 'SUPER_ADMIN' ||
      payload.role === 'ORG_ADMIN' ||
      payload.role === 'COURSE_MANAGER';

    if (!isAuthor && !isLead && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to update this announcement' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, content, isPinned, attachments, status } = body;

    const updated = {
      ...announcement,
      title: title !== undefined ? String(title).trim() : announcement.title,
      content: content !== undefined ? String(content).trim() : announcement.content,
      isPinned: isPinned !== undefined ? Boolean(isPinned) : announcement.isPinned,
      attachments: Array.isArray(attachments) ? attachments : announcement.attachments,
      status: status === 'ARCHIVED' || status === 'PUBLISHED' ? status : announcement.status,
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.saveAnnouncement(updated, payload.email);
    return NextResponse.json({ success: true, announcement: saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update announcement' },
      { status: 500 }
    );
  }
}
