// Zealosh LMS — Recording Resource Deletion API
// DELETE /api/recordings/[recordingId]/resources/[resourceId] (Staff)

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function DELETE(
  request: Request,
  { params }: { params: { recordingId: string; resourceId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/zealosh_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'INSTRUCTOR')) {
      return NextResponse.json({ error: 'Forbidden: Staff privileges required' }, { status: 403 });
    }

    const { resourceId } = params;
    await db.deleteRecordingResource(resourceId);

    return NextResponse.json({ success: true, message: 'Resource deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete resource' }, { status: 500 });
  }
}
