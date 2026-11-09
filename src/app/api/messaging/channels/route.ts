// Zealosh LMS — Messaging Channels API
// GET /api/messaging/channels — Lists authorized conversations for user
// POST /api/messaging/channels — Creates conversation with cross-batch governance checks
// File: src/app/api/messaging/channels/route.ts

import { NextResponse } from 'next/server';
import { ChannelService } from '@/lib/messaging/channel-service';
import { verifyToken } from '@/lib/auth/jwt';
import { ConversationType } from '@/types';

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
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || undefined;

    const channels = await ChannelService.getConversationsForUser(
      payload.userId,
      payload.role,
      courseId
    );

    return NextResponse.json({ success: true, count: channels.length, channels });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to list channels' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      type = 'GROUP',
      title,
      description,
      courseId,
      batchId,
      isCrossBatch = false,
      initialMemberIds = [],
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const conv = await ChannelService.createConversation({
      type: type as ConversationType,
      title,
      description,
      courseId,
      batchId,
      creatorUserId: payload.userId,
      creatorRole: payload.role,
      isCrossBatch,
      initialMemberIds,
    });

    return NextResponse.json({ success: true, conversation: conv });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to create channel' },
      { status: 400 }
    );
  }
}

