// Zealosh LMS — CMS Scheduled Publication API
// POST /api/cms/pages/[id]/schedule — Schedule an approved version for future publishing
// DELETE /api/cms/pages/[id]/schedule — Cancel a pending scheduled publication

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
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.versionId) {
      return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
    }
    const scheduledTimestamp = body.scheduledPublishAt || body.scheduledAt;
    if (!scheduledTimestamp) {
      return NextResponse.json({ error: 'scheduledPublishAt ISO date is required' }, { status: 400 });
    }

    const result = await cmsService.schedulePagePublication(
      params.id,
      body.versionId,
      scheduledTimestamp,
      payload.userId,
      payload.role
    );

    return NextResponse.json({
      success: true,
      message: 'Page scheduled for publication successfully',
      job: result.job,
      page: result.page,
    });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to schedule page publication');
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'COURSE_MANAGER'];
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const result = await cmsService.cancelScheduledPublication(params.id, payload.userId);

    return NextResponse.json({
      success: true,
      message: 'Scheduled publication cancelled successfully',
      page: result.page,
    });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to cancel scheduled publication');
  }
}

