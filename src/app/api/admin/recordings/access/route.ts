// Zealosh LMS — Administrator Previous-Batch Access Governance API
// POST /api/admin/recordings/access — Grants recording access to another batch
// DELETE /api/admin/recordings/access — Revokes an access grant
// GET /api/admin/recordings/access?recordingId=... — Lists grants

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { RecordingBatchAccess, UserRole } from '@/types';

function extractAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  const user = verifyToken(token);
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
    return null;
  }
  return user;
}

export async function GET(request: Request) {
  try {
    const admin = extractAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const recordingId = searchParams.get('recordingId') || undefined;

    const grants = await db.getRecordingBatchAccess(recordingId);
    return NextResponse.json({ success: true, grants });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list batch grants' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = extractAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }

    const body = await request.json();
    const { recordingId, sourceBatchId, targetBatchId, allowDownload, expiresAt } = body;

    if (!recordingId || !targetBatchId) {
      return NextResponse.json(
        { error: 'Missing required fields: recordingId, targetBatchId' },
        { status: 400 }
      );
    }

    const recording = await db.getClassRecording(recordingId);
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    const targetBatch = await db.getBatch(targetBatchId);
    if (!targetBatch) {
      return NextResponse.json({ error: 'Target batch not found' }, { status: 404 });
    }

    const grantId = body.id || `rba-${recordingId}-${targetBatchId}`;
    const newGrant: RecordingBatchAccess = {
      id: grantId,
      recordingId,
      sourceBatchId: sourceBatchId || recording.batchId,
      targetBatchId,
      allowDownload: Boolean(allowDownload),
      status: 'ACTIVE',
      grantedBy: admin.userId,
      grantedAt: new Date().toISOString(),
      expiresAt: expiresAt || undefined,
      createdAt: new Date().toISOString(),
    };

    const saved = await db.grantRecordingBatchAccess(newGrant);

    await db.recordAudit({
      actorUserId: admin.userId,
      actorEmail: admin.email || 'admin@zealosh.com',
      actorRole: admin.role as UserRole,
      action: 'RECORDING_ACCESS_GRANTED',
      entityType: 'RECORDING_BATCH_ACCESS',
      entityId: saved.id,
      details: {
        recordingId,
        sourceBatchId: saved.sourceBatchId,
        targetBatchId: saved.targetBatchId,
        allowDownload: saved.allowDownload,
        expiresAt: saved.expiresAt,
      },
    });

    return NextResponse.json({ success: true, grant: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to grant recording batch access' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = extractAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }

    const body = await request.json();
    const { grantId } = body;
    if (!grantId) {
      return NextResponse.json({ error: 'grantId required' }, { status: 400 });
    }

    await db.revokeRecordingBatchAccess(grantId);

    await db.recordAudit({
      actorUserId: admin.userId,
      actorEmail: admin.email || 'admin@zealosh.com',
      actorRole: admin.role as UserRole,
      action: 'RECORDING_ACCESS_REVOKED',
      entityType: 'RECORDING_BATCH_ACCESS',
      entityId: grantId,
      details: { revokedAt: new Date().toISOString() },
    });

    return NextResponse.json({ success: true, message: 'Recording batch access revoked' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to revoke batch access' }, { status: 500 });
  }
}
