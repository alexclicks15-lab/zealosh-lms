// Zealosh LMS — Phase 5A Unread Notification Count API
// GET /api/notifications/unread-count — Returns current unread notification count

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

    const unreadCount = await db.getUnreadNotificationCount(payload.userId);
    return NextResponse.json({ unreadCount });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve unread notification count' },
      { status: 500 }
    );
  }
}

