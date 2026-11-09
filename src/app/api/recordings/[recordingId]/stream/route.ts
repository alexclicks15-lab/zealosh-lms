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

    const format = searchParams.get('format');
    const isHls = format === 'hls' || format === 'm3u8' || request.url.includes('.m3u8');
    const quality = searchParams.get('quality');

    // RFC 8216 Compliant HLS Manifest Generation
    if (isHls) {
      if (quality) {
        // Media segment playlist for specific quality variant
        const segmentDuration = 10;
        const totalDuration = recording.durationSeconds || 3600;
        const totalSegments = Math.max(1, Math.ceil(totalDuration / segmentDuration));
        const lines: string[] = [
          '#EXTM3U',
          '#EXT-X-VERSION:4',
          `#EXT-X-TARGETDURATION:${segmentDuration}`,
          '#EXT-X-MEDIA-SEQUENCE:0',
          '#EXT-X-PLAYLIST-TYPE:VOD',
        ];
        for (let i = 0; i < totalSegments; i++) {
          const isLast = i === totalSegments - 1;
          const dur = isLast ? ((totalDuration % segmentDuration) || segmentDuration).toFixed(3) : '10.000';
          lines.push(`#EXTINF:${dur},`);
          lines.push(`/api/recordings/${recording.id}/segments/${quality}/seg-${i}.ts${token ? `?token=${encodeURIComponent(token)}` : ''}`);
        }
        lines.push('#EXT-X-ENDLIST');

        return new NextResponse(lines.join('\n'), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'X-Recording-Id': recording.id,
            'X-Recording-Quality': quality,
          },
        });
      }

      // Master Playlist with multi-bitrate variant streams
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const masterManifest = [
        '#EXTM3U',
        '#EXT-X-VERSION:4',
        '#EXT-X-INDEPENDENT-SEGMENTS',
        '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,FRAME-RATE=30.000,NAME="720p",CODECS="avc1.4d401f,mp4a.40.2"',
        `/api/recordings/${recording.id}/stream?format=hls&quality=720p${tokenParam}`,
        '#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480,FRAME-RATE=30.000,NAME="480p",CODECS="avc1.4d401f,mp4a.40.2"',
        `/api/recordings/${recording.id}/stream?format=hls&quality=480p${tokenParam}`,
        '#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=640x360,FRAME-RATE=30.000,NAME="360p",CODECS="avc1.4d401f,mp4a.40.2"',
        `/api/recordings/${recording.id}/stream?format=hls&quality=360p${tokenParam}`,
      ].join('\n');

      return new NextResponse(masterManifest, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'X-Recording-Id': recording.id,
        },
      });
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
