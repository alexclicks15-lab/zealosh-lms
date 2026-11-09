// Zealosh LMS — CMS Page Versions API
// GET /api/cms/pages/[id]/versions — List versions for a page
// POST /api/cms/pages/[id]/versions — Create new version draft

import { NextResponse } from 'next/server';
import { cmsService } from '@/lib/cms/cms-service';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { CmsPageVersion, CmsPageNode } from '@/types/cms';

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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const versions = await cmsService.getVersions(params.id);
    return NextResponse.json({ success: true, versions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list versions' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const page = await cmsService.getPageById(params.id);
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const existingVersions = await cmsService.getVersions(params.id);
    const nextVersionNum = Math.max(...existingVersions.map((v) => v.versionNumber), 0) + 1;

    const newVersionId = `ver-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newVersion: CmsPageVersion = {
      id: newVersionId,
      pageId: params.id,
      versionNumber: nextVersionNum,
      status: 'DRAFT',
      changeSummary: body.changeSummary || `Draft Version ${nextVersionNum}`,
      createdBy: payload.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveCmsPageVersion(newVersion, payload.userId);

    // If sourceVersionId is provided, copy nodes from source version with remapped parentIds
    if (body.sourceVersionId) {
      const sourceNodes = await db.getCmsPageNodes(body.sourceVersionId);
      const idMap = new Map<string, string>();
      sourceNodes.forEach((n) => {
        idMap.set(n.id, `node-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`);
      });

      const clonedNodes: CmsPageNode[] = sourceNodes.map((n) => ({
        ...n,
        id: idMap.get(n.id)!,
        parentId: n.parentId ? idMap.get(n.parentId) || null : null,
        pageVersionId: newVersionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      await db.saveCmsPageNodes(newVersionId, clonedNodes, payload.userId);
    }

    page.currentDraftVersionId = newVersionId;
    page.updatedBy = payload.userId;
    page.updatedAt = new Date().toISOString();
    await db.saveCmsPage(page, payload.userId);

    return NextResponse.json({ success: true, version: newVersion }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create version' }, { status: 400 });
  }
}

