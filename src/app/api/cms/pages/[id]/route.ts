// Zealosh LMS — CMS Individual Page API
// GET /api/cms/pages/[id] — Fetch page metadata
// PUT /api/cms/pages/[id] — Update page metadata (title, slug, SEO)
// DELETE /api/cms/pages/[id] — Delete page

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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const pageId = params.id;
    let page = await cmsService.getPageById(pageId);
    if (!page) {
      page = await cmsService.getPageBySlug(pageId);
    }

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // If page is not published, require authenticated session
    if (page.status !== 'PUBLISHED') {
      const payload = extractUserToken(request);
      if (!payload || !payload.userId) {
        return NextResponse.json({ error: 'Authentication required to view draft page' }, { status: 401 });
      }
    }

    return NextResponse.json({ success: true, page });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to fetch page');
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
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
    const updated = await cmsService.updatePageMetadata(
      params.id,
      {
        title: body.title,
        slug: body.slug,
        pageType: body.pageType,
        seoMetadata: body.seoMetadata,
      },
      payload.userId
    );

    return NextResponse.json({ success: true, page: updated });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to update page');
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN'];
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await cmsService.deletePage(params.id, payload.userId);
    return NextResponse.json({ success: true, message: 'Page deleted successfully' });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to delete page');
  }
}

