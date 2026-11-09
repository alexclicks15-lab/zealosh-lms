// Zealosh LMS — Class Recordings API
// GET /api/recordings — Lists accessible recordings for caller
// POST /api/recordings — Registers/publishes a class recording (Instructors/Admins)

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { ClassRecording, UserRole } from '@/types';
import { recordingStorage } from '@/lib/storage/recording-storage';
import { isAuthorizedPlatformTenant } from '@/lib/store/live-session-resolver';
import { resolveCourseRecordings } from '@/lib/store/course-recording-resolver';

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

export async function GET(request: Request) {
  try {
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tokenOrgId = (user as { organizationId?: string }).organizationId;
    if (!isAuthorizedPlatformTenant(tokenOrgId)) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized tenant organization' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || undefined;
    const batchId = searchParams.get('batchId') || undefined;
    const sessionId = searchParams.get('sessionId') || undefined;

    // When courseId is provided, delegate to authoritative course recording resolver
    if (courseId && !batchId && !sessionId) {
      const courseResult = await resolveCourseRecordings(user.userId, courseId, {
        tokenOrganizationId: tokenOrgId,
      });

      if (!courseResult.success) {
        const status = courseResult.statusCode || (courseResult.error === 'COURSE_NOT_FOUND' ? 404 : 400);
        return NextResponse.json({ error: courseResult.error || 'Failed to resolve course recordings' }, { status });
      }

      return NextResponse.json({
        success: true,
        count: courseResult.count,
        courseId: courseResult.courseId,
        courseTitle: courseResult.courseTitle,
        entitlementStatus: courseResult.entitlementStatus,
        recordings: courseResult.recordings,
      });
    }

    // Retrieve recordings matching filter
    const allRecordings = await db.getClassRecordings({ courseId, batchId, sessionId });

    // Filter recordings authorized for this specific user
    const authorizedRecordings: Array<ClassRecording & { streamUrl?: string; downloadUrl?: string; canDownload: boolean }> = [];

    for (const recording of allRecordings) {
      const access = await recordingStorage.verifyAccess(recording.id, user, 'stream');
      if (access.allowed) {
        const urls = await recordingStorage.getPlaybackUrls(recording, user, access.canDownload);
        authorizedRecordings.push({
          ...recording,
          streamUrl: urls.streamUrl,
          downloadUrl: urls.downloadUrl,
          canDownload: access.canDownload,
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: authorizedRecordings.length,
      recordings: authorizedRecordings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch recordings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Forbidden: Instructor or Admin privileges required' }, { status: 403 });
    }

    const body = await request.json();
    const { sessionId, courseId, batchId, title, description, storageProvider, storagePath, mediaUrl, durationSeconds, fileSizeBytes, isDownloadable, availableFrom, expiresAt } = body;

    if (!sessionId || !courseId || !batchId || !title) {
      return NextResponse.json(
        { error: 'Missing required recording fields: sessionId, courseId, batchId, title' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await db.getLiveSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Associated live session not found' }, { status: 404 });
    }

    const recordingId = body.id || `rec-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newRecording: ClassRecording = {
      id: recordingId,
      sessionId,
      courseId,
      batchId,
      title,
      description: description || undefined,
      storageProvider: storageProvider || 'SUPABASE_STORAGE',
      storagePath: storagePath || `recordings/${courseId}/${recordingId}.mp4`,
      mediaUrl: mediaUrl || `https://media.staging.zealosh.com/recordings/${courseId}/${recordingId}.mp4`,
      durationSeconds: Number(durationSeconds || session.durationMinutes * 60 || 7200),
      fileSizeBytes: Number(fileSizeBytes || 524288000), // Default ~500MB
      status: 'AVAILABLE',
      isDownloadable: Boolean(isDownloadable),
      availableFrom: availableFrom || new Date().toISOString(),
      expiresAt: expiresAt || undefined,
      createdBy: user.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.saveClassRecording(newRecording);

    // Update live session status to RECORDING_READY
    session.status = 'RECORDING_READY';
    session.recordingUrl = saved.mediaUrl;
    session.recordingDurationMinutes = Math.round(saved.durationSeconds / 60);
    await db.saveLiveSession(session);

    // Audit log
    await db.recordAudit({
      actorUserId: user.userId,
      actorEmail: user.email || 'unknown@zealosh.com',
      actorRole: user.role as UserRole,
      action: 'RECORDING_PUBLISHED',
      entityType: 'RECORDING',
      entityId: saved.id,
      details: {
        sessionId: saved.sessionId,
        courseId: saved.courseId,
        batchId: saved.batchId,
        title: saved.title,
        isDownloadable: saved.isDownloadable,
      },
    });

    return NextResponse.json({ success: true, recording: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create recording' }, { status: 500 });
  }
}
