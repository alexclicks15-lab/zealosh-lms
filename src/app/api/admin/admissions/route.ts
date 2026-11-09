import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const courseId = url.searchParams.get('courseId') || undefined;
    const search = url.searchParams.get('search') || undefined;

    const applications = await db.getAdmissionApplications({ status, courseId, search });
    return NextResponse.json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list admission applications' }, { status: 500 });
  }
}

