// Zealosh LMS — CMS Version Nodes & Autosave API
// GET /api/cms/pages/[id]/versions/[versionId] — Get version metadata and component nodes
// PUT /api/cms/pages/[id]/versions/[versionId] — Save updated draft component nodes

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

export async function GET(
  request: Request,
  { params }: { params: { id: string; versionId: string } }
) {
  try {
    const details = await cmsService.getVersionDetails(params.versionId);
    if (!details) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // If version is not published, verify authentication
    if (details.version.status !== 'PUBLISHED') {
      const payload = extractUserToken(request);
      if (!payload || !payload.userId) {
        return NextResponse.json({ error: 'Authentication required to inspect draft version' }, { status: 401 });
      }
    }

    return NextResponse.json({
      success: true,
      version: details.version,
      nodes: details.nodes,
    });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to fetch version details');
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string; versionId: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    if (!Array.isArray(body.nodes)) {
      return NextResponse.json({ error: 'Invalid payload: "nodes" must be an array' }, { status: 400 });
    }

    const result = await cmsService.saveDraftNodes(
      params.versionId,
      body.nodes,
      payload.userId,
      body.expectedUpdatedAt
    );

    return NextResponse.json({
      success: true,
      nodes: result.nodes,
      savedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to save nodes');
  }
}

