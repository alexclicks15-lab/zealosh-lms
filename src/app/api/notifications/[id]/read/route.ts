// Zealosh LMS — Phase 5A Mark Notification Read API
// PATCH /api/notifications/[id]/read — Marks a single notification as read

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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const success = await db.markNotificationRead(params.id, payload.userId);
    if (!success) {
      return NextResponse.json(
        { error: 'Notification not found or access denied' },
        { status: 404 }
      );
    }

    const unreadCount = await db.getUnreadNotificationCount(payload.userId);

    return NextResponse.json({ success: true, unreadCount });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}

