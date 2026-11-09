// Zealosh LMS — Channel Member Addition API
// POST /api/messaging/channels/[id]/members — Add member to conversation
// File: src/app/api/messaging/channels/[id]/members/route.ts

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
    const { targetUserId, memberRole = 'MEMBER' } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
    }

    const member = await ChannelService.addMember({
      conversationId: params.id,
      targetUserId,
      actorUserId: payload.userId,
      actorRole: payload.role,
      memberRole,
    });

    return NextResponse.json({ success: true, member });
  } catch (err: any) {
    const isUnauthorized = err.message?.includes('UNAUTHORIZED');
    return NextResponse.json(
      { error: err.message || 'Failed to add member' },
      { status: isUnauthorized ? 403 : 400 }
    );
  }
}

