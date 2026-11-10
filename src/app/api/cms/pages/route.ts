// Zealosh LMS — CMS Pages Collection API
// GET /api/cms/pages — List pages (public for published, authenticated for all)
// POST /api/cms/pages — Create new page with initial draft

import { NextResponse } from 'next/server';
import { cmsService } from '@/lib/cms/cms-service';
import { authorizeCmsOperation, extractAuthToken } from '@/lib/auth/rbac';
import { handleCmsApiError } from '@/lib/cms/api-response';
import { isValidPageType } from '@/lib/cms/page-type-registry';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const publishedOnly = searchParams.get('published') === 'true';
    const pageType = searchParams.get('pageType') || undefined;
    const status = searchParams.get('status') || undefined;

    if (!publishedOnly) {
      const authResult = authorizeCmsOperation(request, 'VIEW');
      if ('errorResponse' in authResult) {
        return authResult.errorResponse;
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
    const authResult = authorizeCmsOperation(request, 'CREATE');
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { actor } = authResult;

    const body = await request.json();
    if (!body.title || !body.slug) {
      return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 });
    }

    if (body.pageType && !isValidPageType(body.pageType)) {
      return NextResponse.json(
        { error: `Invalid pageType "${body.pageType}". Must be one of the registered page types.` },
        { status: 400 }
      );
    }

    const result = await cmsService.createPage(
      {
        title: body.title,
        slug: body.slug,
        pageType: body.pageType,
        templateId: body.templateId,
        seoMetadata: body.seoMetadata,
      },
      actor.userId
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

