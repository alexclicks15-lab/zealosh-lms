// Zealosh LMS — Phase 5A In-App Notifications API
// GET /api/notifications — Lists authenticated user's notifications with pagination & status filters

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

export async function GET(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const status = searchParams.get('status') || 'all';
    const type = searchParams.get('type') || undefined;

    const offset = (page - 1) * limit;
    const isReadFilter = status === 'unread' ? false : status === 'read' ? true : undefined;

    const result = await db.getNotifications(payload.userId, {
      isRead: isReadFilter,
      limit,
      offset,
      type,
    });

    const totalPages = Math.ceil(result.totalCount / limit) || 1;

    return NextResponse.json({
      notifications: result.notifications,
      unreadCount: result.unreadCount,
      totalCount: result.totalCount,
      page,
      limit,
      totalPages,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve notifications' },
      { status: 500 }
    );
  }
}

