// Zealosh LMS — CMS Publication API
// POST /api/cms/pages/[id]/publish — Atomically publish approved or draft version

import { NextResponse } from 'next/server';
import { cmsService } from '@/lib/cms/cms-service';
import { authorizeCmsOperation } from '@/lib/auth/rbac';
import { handleCmsApiError } from '@/lib/cms/api-response';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const authResult = authorizeCmsOperation(request, 'PUBLISH');
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { actor } = authResult;

    const body = await request.json();
    if (!body.versionId) {
      return NextResponse.json({ error: 'versionId is required for publishing' }, { status: 400 });
    }

    const result = await cmsService.publishVersion(params.id, body.versionId, actor.userId, actor.role);

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

