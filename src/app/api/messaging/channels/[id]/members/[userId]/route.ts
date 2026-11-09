// Zealosh LMS — Channel Member Removal API
// DELETE /api/messaging/channels/[id]/members/[userId] — Remove member or leave conversation
// File: src/app/api/messaging/channels/[id]/members/[userId]/route.ts

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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const success = await ChannelService.removeMember({
      conversationId: params.id,
      targetUserId: params.userId,
      actorUserId: payload.userId,
      actorRole: payload.role,
    });

    return NextResponse.json({ success });
  } catch (err: any) {
    const isUnauthorized = err.message?.includes('UNAUTHORIZED');
    return NextResponse.json(
      { error: err.message || 'Failed to remove member' },
      { status: isUnauthorized ? 403 : 400 }
    );
  }
}

