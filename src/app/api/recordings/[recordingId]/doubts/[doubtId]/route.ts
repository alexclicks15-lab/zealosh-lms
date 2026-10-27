// Zealosh LMS — Recording Doubt Resolution & Status API
// PATCH /api/recordings/[recordingId]/doubts/[doubtId] (Resolution & Privacy toggles)

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { DoubtStatus } from '@/types';

function extractUser(request: Request) {
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

const VALID_DOUBT_STATUSES: DoubtStatus[] = ['OPEN', 'RESOLVED', 'CLARIFICATION_REQUESTED'];

export async function PATCH(
  request: Request,
  { params }: { params: { recordingId: string; doubtId: string } }
) {
  try {
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { recordingId, doubtId } = params;
    const isStaff = user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN' || user.role === 'INSTRUCTOR';

    const doubts = await db.getRecordingDoubts(recordingId, user.userId, isStaff);
    const existing = doubts.find((d) => d.id === doubtId);

    if (!existing) {
      return NextResponse.json({ error: 'Doubt not found or access denied' }, { status: 404 });
    }

    const body = await request.json();
    const { status, isPublic, question } = body;

    // Learners can only edit their own question if still OPEN
    if (!isStaff) {
      if (existing.userId !== user.userId) {
        return NextResponse.json({ error: 'Forbidden: You cannot modify another learner’s doubt' }, { status: 403 });
      }
      if (question && existing.status === 'OPEN') {
        existing.question = question.trim();
        await db.saveRecordingDoubt(existing);
      }
      return NextResponse.json({ success: true, doubt: existing });
    }

    // Staff can change status and toggle public sharing
    let newStatus = existing.status;
    if (status && VALID_DOUBT_STATUSES.includes(status)) {
      newStatus = status;
    }

    let newPublic = existing.isPublic;
    if (typeof isPublic === 'boolean') {
      newPublic = isPublic;
    }

    await db.resolveRecordingDoubt(doubtId, newStatus, newPublic);
    existing.status = newStatus;
    existing.isPublic = newPublic;

    return NextResponse.json({ success: true, doubt: existing });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update doubt' }, { status: 500 });
  }
}
