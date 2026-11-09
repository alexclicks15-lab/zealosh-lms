// Zealosh LMS — CMS Publication API
// POST /api/cms/pages/[id]/publish — Atomically publish approved or draft version

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
      return NextResponse.json({ error: 'Forbidden: Insufficient publishing privileges' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.versionId) {
      return NextResponse.json({ error: 'versionId is required for publishing' }, { status: 400 });
    }

    const result = await cmsService.publishVersion(params.id, body.versionId, payload.userId, payload.role);

    return NextResponse.json({
      success: true,
      message: 'Page version published successfully to live platform',
      checksum: result.checksum,
      publishedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to publish page');
  }
}

