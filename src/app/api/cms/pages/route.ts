// Zealosh LMS — CMS Pages Collection API
// GET /api/cms/pages — List pages (public for published, authenticated for all)
// POST /api/cms/pages — Create new page with initial draft

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const publishedOnly = searchParams.get('published') === 'true';
    const pageType = searchParams.get('pageType') || undefined;
    const status = searchParams.get('status') || undefined;

    if (!publishedOnly) {
      const payload = extractUserToken(request);
      if (!payload || !payload.userId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
    }

    const pages = await cmsService.getPages({
      pageType: pageType as any,
      status: publishedOnly ? 'PUBLISHED' : (status as any),
    });

    return NextResponse.json({
      success: true,
      pages,
      total: pages.length,
    });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to list pages');
  }
}

export async function POST(request: Request) {
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
    if (!body.title || !body.slug) {
      return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 });
    }

    const result = await cmsService.createPage(
      {
        title: body.title,
        slug: body.slug,
        pageType: body.pageType,
        templateId: body.templateId,
        seoMetadata: body.seoMetadata,
      },
      payload.userId
    );

    return NextResponse.json(
      {
        success: true,
        page: result.page,
        version: result.version,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to create page');
  }
}

