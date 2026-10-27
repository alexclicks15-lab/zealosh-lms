// Zealosh LMS — Recording Doubt Answers API
// POST /api/recordings/[recordingId]/doubts/[doubtId]/answers (Instructor/Admin)

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { RecordingDoubtAnswer } from '@/types';

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

export async function POST(
  request: Request,
  { params }: { params: { recordingId: string; doubtId: string } }
) {
  try {
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Forbidden: Staff privileges required to answer doubts' }, { status: 403 });
    }

    const { recordingId, doubtId } = params;
    const body = await request.json();
    const { answerText, referenceUrl } = body;

    if (!answerText || typeof answerText !== 'string' || !answerText.trim()) {
      return NextResponse.json({ error: 'Answer text is required' }, { status: 400 });
    }

    const answerId = body.id || `ans-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const answer: RecordingDoubtAnswer = {
      id: answerId,
      doubtId,
      instructorId: user.userId,
      instructorName: user.email || 'Instructor',
      answerText: answerText.trim(),
      referenceUrl: referenceUrl ? String(referenceUrl).trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    const saved = await db.saveRecordingDoubtAnswer(answer);

    // Auto-mark doubt as RESOLVED if it was OPEN
    await db.resolveRecordingDoubt(doubtId, 'RESOLVED');

    return NextResponse.json({ success: true, answer: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit answer' }, { status: 500 });
  }
}
