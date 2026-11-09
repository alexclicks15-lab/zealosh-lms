// Zealosh LMS — CMS Approval Workflow API
// POST /api/cms/pages/[id]/workflow — Submit for review, approve, or reject draft version

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

    const body = await request.json();
    const action = body.action; // 'submit' | 'approve' | 'reject'
    const versionId = body.versionId;

    if (!versionId) {
      return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
    }

    if (action === 'submit') {
      const updated = await cmsService.submitForReview(
        params.id,
        versionId,
        body.changeSummary,
        payload.userId
      );
      return NextResponse.json({ success: true, version: updated, message: 'Submitted for review' });
    } else if (action === 'approve') {
      const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'COURSE_MANAGER'];
      if (!allowedRoles.includes(payload.role)) {
        return NextResponse.json({ error: 'Forbidden: Reviewer privilege required' }, { status: 403 });
      }
      const updated = await cmsService.approveVersion(params.id, versionId, payload.userId, payload.role);
      return NextResponse.json({ success: true, version: updated, message: 'Version approved' });
    } else if (action === 'reject') {
      const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'COURSE_MANAGER'];
      if (!allowedRoles.includes(payload.role)) {
        return NextResponse.json({ error: 'Forbidden: Reviewer privilege required' }, { status: 403 });
      }
      if (!body.rejectionReason) {
        return NextResponse.json({ error: 'rejectionReason is mandatory for rejection' }, { status: 400 });
      }
      const updated = await cmsService.rejectVersion(
        params.id,
        versionId,
        body.rejectionReason,
        payload.userId
      );
      return NextResponse.json({ success: true, version: updated, message: 'Version rejected' });
    }

    return NextResponse.json({ error: `Unknown workflow action: "${action}"` }, { status: 400 });
  } catch (error: any) {
    return handleCmsApiError(error, 'Workflow transition failed');
  }
}

