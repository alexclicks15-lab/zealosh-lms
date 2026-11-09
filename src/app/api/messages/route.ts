// Zealosh LMS — In-App Messaging & Cohort Conversations API
// GET /api/messages — Fetch conversation history for authenticated student or instructor
// POST /api/messages — Send direct or cohort broadcast message
// PATCH /api/messages — Mark message as read

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
    const courseId = searchParams.get('courseId') || undefined;
    const batchId = searchParams.get('batchId') || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const messages = await db.getDirectMessages(payload.userId, courseId, batchId, limit, offset);

    return NextResponse.json({
      success: true,
      messages,
      unreadCount: messages.filter((m) => !m.read && m.recipientId === payload.userId).length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch messages' },
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

    const body = await request.json().catch(() => ({}));
    const { courseId, batchId, recipientId, subject, content, clientMessageId } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (content.trim().length > 5000) {
      return NextResponse.json({ error: 'content exceeds maximum length of 5000 characters' }, { status: 400 });
    }
    if (recipientId && recipientId === payload.userId) {
      return NextResponse.json({ error: 'Cannot send message to yourself' }, { status: 400 });
    }

    const sender = await db.getUser(payload.userId);
    const senderName = sender ? sender.name : payload.name || 'User';

    const message = await db.sendDirectMessage({
      senderId: payload.userId,
      senderName,
      senderRole: payload.role,
      recipientId: recipientId || undefined,
      courseId,
      batchId: batchId || undefined,
      subject: subject ? subject.trim() : undefined,
      content: content.trim(),
      clientMessageId: clientMessageId ? String(clientMessageId).trim() : undefined,
    });

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    const success = await db.markDirectMessageRead(messageId, payload.userId);
    if (!success) {
      return NextResponse.json(
        { error: 'Message not found or user is not authorized to mark this message as read' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update message' },
      { status: 500 }
    );
  }
}

