import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId') || undefined;

    const highlights = await db.getCourseHighlights(course.id, batchId);

    return NextResponse.json({
      success: true,
      highlights,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

