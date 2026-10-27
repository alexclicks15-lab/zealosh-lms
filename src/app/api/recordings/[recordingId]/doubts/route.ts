// Zealosh LMS — Timestamp-Linked Doubts API
// GET /api/recordings/[recordingId]/doubts — Retrieves contextual doubts (enforcing privacy)
// POST /api/recordings/[recordingId]/doubts — Submits a doubt linked to a playback timestamp

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { RecordingDoubt } from '@/types';
import { recordingStorage } from '@/lib/storage/recording-storage';

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

export async function GET(request: Request, { params }: { params: { recordingId: string } }) {
  try {
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { recordingId } = params;
    const access = await recordingStorage.verifyAccess(recordingId, user, 'stream');
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden: Access to recording denied' }, { status: 403 });
    }

    const isStaff = user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN' || user.role === 'INSTRUCTOR';
    const doubts = await db.getRecordingDoubts(recordingId, user.userId, isStaff);

    return NextResponse.json({ success: true, doubts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch doubts' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { recordingId: string } }) {
  try {
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { recordingId } = params;
    const access = await recordingStorage.verifyAccess(recordingId, user, 'stream');
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden: Access to recording denied' }, { status: 403 });
    }

    const body = await request.json();
    const { timestampSeconds, question, highlightId, isPublic } = body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'Question text is required and cannot be blank' }, { status: 400 });
    }

    const ts = Number(timestampSeconds || 0);
    if (isNaN(ts) || ts < 0) {
      return NextResponse.json({ error: 'Timestamp must be a non-negative number' }, { status: 400 });
    }

    const doubtId = body.id || `dbt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const doubt: RecordingDoubt = {
      id: doubtId,
      recordingId,
      userId: user.userId,
      userName: user.email || 'Student',
      timestampSeconds: Math.floor(ts),
      highlightId: highlightId || undefined,
      question: question.trim(),
      status: 'OPEN',
      isPublic: Boolean(isPublic), // Defaults to private
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.saveRecordingDoubt(doubt);
    return NextResponse.json({ success: true, doubt: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit doubt' }, { status: 500 });
  }
}
