// Zealosh LMS — Phase 5A Mark All Notifications Read API
// POST /api/notifications/mark-all-read — Marks all unread notifications of the current user as read

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

export async function POST(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const markedCount = await db.markAllNotificationsRead(payload.userId);
    return NextResponse.json({ success: true, markedCount, unreadCount: 0 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}

