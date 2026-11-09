// Zealosh LMS — Channel Messages & Threading API
// GET /api/messaging/channels/[id]/messages — Retrieve messages or thread replies
// POST /api/messaging/channels/[id]/messages — Send message or reply in thread
// File: src/app/api/messaging/channels/[id]/messages/route.ts

import { NextResponse } from 'next/server';
import { ChannelService } from '@/lib/messaging/channel-service';
import { verifyToken } from '@/lib/auth/jwt';
import { db } from '@/lib/store/db';

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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentMessageId = searchParams.get('parentMessageId') || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const messages = await ChannelService.getChannelMessages({
      conversationId: params.id,
      userId: payload.userId,
      userRole: payload.role,
      parentMessageId,
      limit,
      offset,
    });

    return NextResponse.json({ success: true, count: messages.length, messages });
  } catch (err: any) {
    const isAccessDenied = err.message?.includes('ACCESS_DENIED');
    return NextResponse.json(
      { error: err.message || 'Failed to fetch messages' },
      { status: isAccessDenied ? 403 : 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { content, parentMessageId, attachments, clientMessageId } = body;

    const user = await db.getUser(payload.userId);
    const senderName = user?.name || payload.name || 'User';

    const message = await ChannelService.sendChannelMessage({
      conversationId: params.id,
      senderId: payload.userId,
      senderName,
      senderRole: payload.role,
      content,
      parentMessageId,
      attachments,
      clientMessageId,
    });

    return NextResponse.json({ success: true, message });
  } catch (err: any) {
    const isAccessDenied = err.message?.includes('ACCESS_DENIED');
    return NextResponse.json(
      { error: err.message || 'Failed to send message' },
      { status: isAccessDenied ? 403 : 400 }
    );
  }
}

