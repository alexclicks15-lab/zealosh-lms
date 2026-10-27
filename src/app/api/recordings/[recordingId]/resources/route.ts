// Zealosh LMS — Recording Study Resources & Topic References API
// GET /api/recordings/[recordingId]/resources — Lists resources
// POST /api/recordings/[recordingId]/resources — Adds reference (Staff)

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { RecordingResource, ResourceType } from '@/types';

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

const VALID_RESOURCE_TYPES: ResourceType[] = ['PDF', 'SLIDES', 'URL', 'CODE', 'NOTES'];

export async function GET(request: Request, { params }: { params: { recordingId: string } }) {
  try {
    const { recordingId } = params;
    const resources = await db.getRecordingResources(recordingId);
    return NextResponse.json({ success: true, resources });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch resources' }, { status: 500 });
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
    const { title, description, resourceType, url, fileSizeBytes, timestampSeconds, highlightId } = body;

    if (!title || !resourceType || !url) {
      return NextResponse.json(
        { error: 'Missing required resource fields: title, resourceType, url' },
        { status: 400 }
      );
    }

    if (!VALID_RESOURCE_TYPES.includes(resourceType)) {
      return NextResponse.json(
        { error: `Invalid resourceType. Allowed: ${VALID_RESOURCE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // URL safety validation
    const trimmedUrl = String(url).trim();
    if (trimmedUrl.toLowerCase().startsWith('javascript:') || trimmedUrl.toLowerCase().startsWith('data:')) {
      return NextResponse.json({ error: 'Unsafe resource URL protocol rejected' }, { status: 400 });
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('/')) {
      return NextResponse.json({ error: 'Resource URL must be an HTTP/HTTPS link or local path' }, { status: 400 });
    }

    const resourceId = body.id || `res-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const resource: RecordingResource = {
      id: resourceId,
      recordingId,
      highlightId: highlightId || undefined,
      title,
      description: description || undefined,
      resourceType,
      url: trimmedUrl,
      fileSizeBytes: fileSizeBytes ? Number(fileSizeBytes) : undefined,
      timestampSeconds: timestampSeconds !== undefined ? Number(timestampSeconds) : undefined,
      uploadedBy: user.userId,
      createdAt: new Date().toISOString(),
    };

    const saved = await db.saveRecordingResource(resource);
    return NextResponse.json({ success: true, resource: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save resource' }, { status: 500 });
  }
}
