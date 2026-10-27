// Zealosh LMS — Recording Streaming & Download Delivery Route
// GET /api/recordings/[recordingId]/stream?token=...&download=1
// Enforces signed token verification, explicit download policy, and non-cached streaming delivery

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { recordingStorage } from '@/lib/storage/recording-storage';

export async function GET(request: Request, { params }: { params: { recordingId: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const isDownload = searchParams.get('download') === '1';
    const { recordingId } = params;

    let userId: string | null = null;
    let authorizedAction: 'stream' | 'download' = isDownload ? 'download' : 'stream';

    if (token) {
      // 1. Verify tamper-proof HMAC streaming token
      const tokenResult = recordingStorage.verifyToken(token);
      if (!tokenResult.valid || !tokenResult.payload) {
        return NextResponse.json({ error: tokenResult.error || 'Invalid or expired stream token' }, { status: 403 });
      }

      if (tokenResult.payload.recordingId !== recordingId) {
        return NextResponse.json({ error: 'Stream token does not match requested recording' }, { status: 403 });
      }

      if (isDownload && tokenResult.payload.action !== 'download') {
        return NextResponse.json({ error: 'Download permission not granted by this stream token' }, { status: 403 });
      }

      userId = tokenResult.payload.userId;
      authorizedAction = tokenResult.payload.action;
    } else {
      // 2. Direct session bearer or cookie fallback
      const authHeader = request.headers.get('authorization');
      let sessionToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      if (!sessionToken) {
        const cookieHeader = request.headers.get('cookie') || '';
        const match = cookieHeader.match(/zealosh_token=([^;]+)/);
        if (match) sessionToken = match[1];
      }

      if (!sessionToken) {
        return NextResponse.json({ error: 'Authentication token required' }, { status: 401 });
      }

      const sessionPayload = verifyToken(sessionToken);
      if (!sessionPayload) {
        return NextResponse.json({ error: 'Invalid authentication session' }, { status: 401 });
      }

      userId = sessionPayload.userId;

      // Authoritative access check
      const access = await recordingStorage.verifyAccess(recordingId, sessionPayload, authorizedAction);
      if (!access.allowed) {
        return NextResponse.json({ error: access.reason || 'Forbidden: Access denied' }, { status: 403 });
      }
    }

    const recording = await db.getClassRecording(recordingId);
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    // Set streaming & delivery headers
    const safeFilename = `${recording.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Recording-Id', recording.id);
    headers.set('X-Recording-Duration', String(recording.durationSeconds));

    if (authorizedAction === 'download') {
      headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
    } else {
      headers.set('Content-Disposition', `inline; filename="${safeFilename}"`);
    }

    // If media URL is external (e.g. S3 CDN or Supabase Storage direct signed URL), redirect safely
    if (recording.mediaUrl && recording.mediaUrl.startsWith('http')) {
      return NextResponse.redirect(recording.mediaUrl, { status: 307, headers });
    }

    // Otherwise, return metadata streaming response
    return new NextResponse(null, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Streaming delivery failed' }, { status: 500 });
  }
}
