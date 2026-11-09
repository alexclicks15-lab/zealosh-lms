// Zealosh LMS — Channel Message Reporting API
// POST /api/messaging/channels/[id]/reports — Report a message for institutional moderation
// File: src/app/api/messaging/channels/[id]/reports/route.ts

import { NextResponse } from 'next/server';
import { ChannelService } from '@/lib/messaging/channel-service';
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
    const { messageId, reason } = body;

    if (!messageId || !reason) {
      return NextResponse.json(
        { error: 'messageId and reason are required' },
        { status: 400 }
      );
    }

    const report = await ChannelService.reportMessage({
      conversationId: params.id,
      messageId,
      reportedBy: payload.userId,
      reason,
    });

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to submit report' },
      { status: 400 }
    );
  }
}

