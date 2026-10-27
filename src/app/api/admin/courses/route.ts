import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { Course } from '@/types';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { course } = await request.json();
    if (!course || !course.title) {
      return NextResponse.json({ success: false, error: 'Course payload required' }, { status: 400 });
    }

    if (!course.id) {
      course.id = `crs-${Date.now().toString(36)}`;
    }

    const existing = await db.getCourseById(course.id);
    if (existing) {
      const updated = await db.updateCourse(course.id, course);
      return NextResponse.json({ success: true, course: updated });
    } else {
      const created = await db.addCourse(course);
      return NextResponse.json({ success: true, course: created });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { courseId } = await request.json();
    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId required' }, { status: 400 });
    }
    const success = await db.deleteCourse(courseId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
