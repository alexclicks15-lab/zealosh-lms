import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { CourseModule } from '@/types';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseId') || undefined;
    const modules = await db.getModules(courseId);
    return NextResponse.json({ success: true, modules });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list modules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { courseId, title, code, description, deliveryMode, orderIndex, status } = body;

    if (!courseId || !title) {
      return NextResponse.json({ error: 'courseId and title are required' }, { status: 400 });
    }

    const course = await db.getCourseById(courseId);
    if (!course) {
      return NextResponse.json({ error: `Course ${courseId} does not exist` }, { status: 404 });
    }

    const id = body.id || `mod-${courseId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date().toISOString();

    const order = typeof orderIndex === 'number' ? orderIndex : 1;
    const courseModule: CourseModule = {
      id,
      courseId,
      title: title.trim(),
      code: code ? code.trim() : undefined,
      description: description ? description.trim() : undefined,
      deliveryMode: deliveryMode || 'HYBRID',
      displayOrder: order,
      orderIndex: order,
      status: status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const saved = await db.saveModule(courseModule);
    return NextResponse.json({ success: true, module: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create module' }, { status: 500 });
  }
}

