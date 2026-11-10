// Zealosh LMS — Website Studio Overview API
// GET /api/cms/studio/overview — Comprehensive operational metrics, page distribution, and publishing status

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeCmsOperation } from '@/lib/auth/rbac';
import { CANONICAL_PAGE_TYPE_REGISTRY, getAllPageTypes } from '@/lib/cms/page-type-registry';

export async function GET(request: Request) {
  try {
    const authResult = authorizeCmsOperation(request, 'VIEW');
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const pages = await db.getCmsPages();
    const templates = await db.getCmsTemplates();
    const scheduled = await db.getCmsScheduledPublications({ status: 'QUEUED' });

    // Metric Calculations
    const totalPages = pages.length;
    const publishedCount = pages.filter((p) => p.status === 'PUBLISHED').length;
    const draftCount = pages.filter((p) => p.status === 'DRAFT').length;
    const pendingReviewCount = pages.filter((p) => p.status === 'PENDING_REVIEW').length;
    const scheduledCount = scheduled.length;
    const archivedCount = pages.filter((p) => p.status === 'ARCHIVED').length;

    // Distribution by Page Type
    const byPageType: Record<string, number> = {};
    for (const page of pages) {
      byPageType[page.pageType] = (byPageType[page.pageType] || 0) + 1;
    }

    // Distribution by Category
    const byCategory: Record<string, number> = {
      MARKETING: 0,
      ACADEMIC: 0,
      INFORMATIONAL: 0,
      LEGAL: 0,
      COMMUNITY: 0,
      SYSTEM: 0,
    };

    for (const page of pages) {
      const def = CANONICAL_PAGE_TYPE_REGISTRY[page.pageType];
      const cat = def ? def.category : 'SYSTEM';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    // System vs Custom Templates
    const systemTemplatesCount = templates.filter((t) => t.isSystem).length;
    const customTemplatesCount = templates.filter((t) => !t.isSystem).length;

    return NextResponse.json({
      success: true,
      metrics: {
        totalPages,
        publishedCount,
        draftCount,
        pendingReviewCount,
        scheduledCount,
        archivedCount,
        systemTemplatesCount,
        customTemplatesCount,
        totalTemplates: templates.length,
      },
      distribution: {
        byPageType,
        byCategory,
      },
      pageTypes: getAllPageTypes(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch Website Studio overview' },
      { status: 500 }
    );
  }
}
