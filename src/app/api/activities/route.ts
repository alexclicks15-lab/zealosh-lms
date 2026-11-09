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

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || undefined;
    const category = (searchParams.get('category') as ActivityCategory) || undefined;
    const isUnreadOnly = searchParams.get('unreadOnly') === 'true';
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20;

    const result = await db.getStudentActivityFeed(payload.userId, {
      courseId,
      category,
      isUnreadOnly,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch academic activity feed' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { activityId } = body;
    if (!activityId) {
      return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
    }

    const marked = await db.markActivityAsRead(activityId, payload.userId);
    return NextResponse.json({ success: true, marked });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to mark activity read' },
      { status: 500 }
    );
  }
}

