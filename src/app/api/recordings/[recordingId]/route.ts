// Zealosh LMS — Recording Details & Lifecycle API
// GET /api/recordings/[recordingId] — Retrieves recording with highlights, resources, doubts
// PATCH /api/recordings/[recordingId] — Updates status, download policy, expiry (Staff/Admin)
// DELETE /api/recordings/[recordingId] — Revokes or removes recording (Admin)

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { recordingStorage } from '@/lib/storage/recording-storage';
import { UserRole } from '@/types';

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
    if (!access.allowed || !access.recording) {
      return NextResponse.json({ error: access.reason || 'Forbidden: You do not have access to this recording' }, { status: 403 });
    }

    const recording = access.recording;
    const isStaff = user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN' || user.role === 'INSTRUCTOR';

    // Enrich relations
    const [highlights, resources, batchGrants, doubts] = await Promise.all([
      db.getRecordingHighlights(recordingId),
      db.getRecordingResources(recordingId),
      isStaff ? db.getRecordingBatchAccess(recordingId) : Promise.resolve([]),
      db.getRecordingDoubts(recordingId, user.userId, isStaff),
    ]);

    const playbackUrls = await recordingStorage.getPlaybackUrls(recording, user, access.canDownload);

    return NextResponse.json({
      success: true,
      recording: {
        ...recording,
        highlights,
        resources,
        batchAccessGrants: batchGrants,
        doubts,
        streamUrl: playbackUrls.streamUrl,
        downloadUrl: playbackUrls.downloadUrl,
        canDownload: access.canDownload,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch recording details' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { recordingId: string } }) {
  try {
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Forbidden: Staff privileges required' }, { status: 403 });
    }

    const { recordingId } = params;
    const existing = await db.getClassRecording(recordingId);
    if (!existing) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, status, isDownloadable, expiresAt } = body;

    if (title) existing.title = title;
    if (description !== undefined) existing.description = description;
    if (status) existing.status = status;
    if (isDownloadable !== undefined) existing.isDownloadable = Boolean(isDownloadable);
    if (expiresAt !== undefined) existing.expiresAt = expiresAt;
    existing.updatedAt = new Date().toISOString();

    const updated = await db.saveClassRecording(existing);

    await db.recordAudit({
      actorUserId: user.userId,
      actorEmail: user.email || 'staff@zealosh.com',
      actorRole: user.role as UserRole,
      action: 'RECORDING_UPDATED',
      entityType: 'RECORDING',
      entityId: recordingId,
      details: { status: updated.status, isDownloadable: updated.isDownloadable, expiresAt: updated.expiresAt },
    });

    return NextResponse.json({ success: true, recording: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update recording' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { recordingId: string } }) {
  try {
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }

    const { recordingId } = params;
    await db.deleteClassRecording(recordingId);

    await db.recordAudit({
      actorUserId: user.userId,
      actorEmail: user.email || 'admin@zealosh.com',
      actorRole: user.role as UserRole,
      action: 'RECORDING_DELETED',
      entityType: 'RECORDING',
      entityId: recordingId,
      details: { deletedAt: new Date().toISOString() },
    });

    return NextResponse.json({ success: true, message: 'Recording deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete recording' }, { status: 500 });
  }
}
