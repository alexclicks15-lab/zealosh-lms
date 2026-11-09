// Zealosh LMS — Channel Details & Member Roster API
// GET /api/messaging/channels/[id] — Retrieve channel details and members
// File: src/app/api/messaging/channels/[id]/route.ts

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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const conv = await ChannelService.getConversationById(params.id, payload.userId, payload.role);
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const members = await ChannelService.getConversationMembers(params.id, payload.userId, payload.role);

    return NextResponse.json({
      success: true,
      conversation: conv,
      members,
    });
  } catch (err: any) {
    const isAccessDenied = err.message?.includes('ACCESS_DENIED');
    return NextResponse.json(
      { error: err.message || 'Failed to fetch channel' },
      { status: isAccessDenied ? 403 : 500 }
    );
  }
}

