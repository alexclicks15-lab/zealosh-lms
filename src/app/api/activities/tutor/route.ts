import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { ActivityCategory } from '@/types';

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

export async function GET(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await db.getUser(payload.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const isStaff = user.role === 'INSTRUCTOR' || user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';
    if (!isStaff) {
      return NextResponse.json({ error: 'Instructor privileges required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || undefined;
    const batchId = searchParams.get('batchId') || undefined;
    const category = (searchParams.get('category') as ActivityCategory) || undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20;

    const result = await db.getTutorActivityView(user.id, {
      courseId,
      batchId,
      category,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch tutor cohort activity' },
      { status: 500 }
    );
  }
}

