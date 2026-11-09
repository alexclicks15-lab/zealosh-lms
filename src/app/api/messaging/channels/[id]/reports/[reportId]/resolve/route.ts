// Zealosh LMS — Channel Moderation Report Resolution API
// POST /api/messaging/channels/[id]/reports/[reportId]/resolve — Staff resolution with private notes
// File: src/app/api/messaging/channels/[id]/reports/[reportId]/resolve/route.ts

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
  { params }: { params: { id: string; reportId: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (
      payload.role !== 'SUPER_ADMIN' &&
      payload.role !== 'ORG_ADMIN' &&
      payload.role !== 'COURSE_MANAGER' &&
      payload.role !== 'INSTRUCTOR'
    ) {
      return NextResponse.json(
        { error: 'Unauthorized: Only faculty and administrators can resolve moderation reports' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { actionTaken = 'NONE', moderatorNotes } = body;

    const report = await ChannelService.resolveModerationReport({
      reportId: params.reportId,
      moderatorUserId: payload.userId,
      actionTaken,
      moderatorNotes,
    });

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to resolve moderation report' },
      { status: 400 }
    );
  }
}

