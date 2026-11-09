// Zealosh LMS — Administrative Recording Reconciliation API
// POST /api/admin/recordings/reconcile — Triggers bounded session-recording reconciliation

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { recordingIngestionService } from '@/lib/storage/recording-ingestion-service';
import { UserRole } from '@/types';

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

export async function POST(request: Request) {
  try {
    const admin = extractAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }

    let body: any = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const { sessionId, batchId, courseId, maxScanLimit } = body;

    const report = await recordingIngestionService.reconcileSessionRecordings({
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
      batchId: typeof batchId === 'string' ? batchId : undefined,
      courseId: typeof courseId === 'string' ? courseId : undefined,
      maxScanLimit: typeof maxScanLimit === 'number' ? maxScanLimit : undefined,
    });

    await db.recordAudit({
      actorUserId: admin.userId,
      actorEmail: admin.email || 'admin@zealosh.com',
      actorRole: admin.role as UserRole,
      action: 'RECORDINGS_RECONCILED',
      entityType: 'RECORDING_RECONCILIATION',
      entityId: `recon-${Date.now()}`,
      details: {
        filter: { sessionId, batchId, courseId, maxScanLimit },
        reportSummary: {
          scannedSessions: report.scannedSessions,
          recordingsDiscovered: report.recordingsDiscovered,
          recordingsCreated: report.recordingsCreated,
          recordingsUpdated: report.recordingsUpdated,
          recordingsIgnored: report.recordingsIgnored,
          failuresCount: report.failures.length,
        },
      },
    });

    return NextResponse.json({ success: true, report }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error during reconciliation' },
      { status: 500 }
    );
  }
}

