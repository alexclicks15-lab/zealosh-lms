// Zealosh LMS — Recording Topic Highlights & Chapters API
// GET /api/recordings/[recordingId]/highlights — Retrieves chapters
// POST /api/recordings/[recordingId]/highlights — Adds a topic highlight (Instructor/Admin)

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { RecordingHighlight } from '@/types';

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
    const { recordingId } = params;
    const highlights = await db.getRecordingHighlights(recordingId);
    return NextResponse.json({ success: true, highlights });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch highlights' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { recordingId: string } }) {
  try {
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Forbidden: Staff privileges required' }, { status: 403 });
    }

    const { recordingId } = params;
    const recording = await db.getClassRecording(recordingId);
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, startTimestampSeconds, endTimestampSeconds, topicId } = body;

    if (!title || startTimestampSeconds === undefined || endTimestampSeconds === undefined) {
      return NextResponse.json(
        { error: 'Missing required highlight fields: title, startTimestampSeconds, endTimestampSeconds' },
        { status: 400 }
      );
    }

    const start = Number(startTimestampSeconds);
    const end = Number(endTimestampSeconds);

    if (isNaN(start) || start < 0) {
      return NextResponse.json({ error: 'Start timestamp must be a non-negative number' }, { status: 400 });
    }

    if (isNaN(end) || end <= start) {
      return NextResponse.json({ error: 'End timestamp must be strictly greater than start timestamp' }, { status: 400 });
    }

    if (recording.durationSeconds > 0 && end > recording.durationSeconds) {
      return NextResponse.json(
        { error: `End timestamp (${end}s) exceeds recording duration (${recording.durationSeconds}s)` },
        { status: 400 }
      );
    }

    const highlightId = body.id || `hl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const highlight: RecordingHighlight = {
      id: highlightId,
      recordingId,
      title,
      description: description || undefined,
      startTimestampSeconds: start,
      endTimestampSeconds: end,
      topicId: topicId || undefined,
      createdBy: user.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.saveRecordingHighlight(highlight);
    return NextResponse.json({ success: true, highlight: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save highlight' }, { status: 500 });
  }
}
