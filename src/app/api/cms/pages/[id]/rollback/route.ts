// Zealosh LMS — CMS Version Rollback API
// POST /api/cms/pages/[id]/rollback — Create a new draft restored from an immutable historical version

import { NextResponse } from 'next/server';
import { cmsService } from '@/lib/cms/cms-service';
import { verifyToken } from '@/lib/auth/jwt';
import { handleCmsApiError } from '@/lib/cms/api-response';

function extractUserToken(request: Request) {
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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'COURSE_MANAGER'];
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.targetVersionId) {
      return NextResponse.json({ error: 'targetVersionId is required for rollback' }, { status: 400 });
    }

    const newDraftVersion = await cmsService.rollbackVersion(
      params.id,
      body.targetVersionId,
      payload.userId
    );

    return NextResponse.json({
      success: true,
      message: `Successfully rolled back. New draft version ${newDraftVersion.versionNumber} created.`,
      newVersion: newDraftVersion,
    });
  } catch (error: any) {
    return handleCmsApiError(error, 'Rollback failed');
  }
}

