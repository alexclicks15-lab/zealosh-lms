// Zealosh LMS — Canonical Page Types Registry API
// GET /api/cms/studio/page-types — Provides frontend with single-source-of-truth page definitions

import { NextResponse } from 'next/server';
import {
  getAllPageTypes,
  getCanonicalPublicPageTypes,
  CANONICAL_PAGE_TYPE_REGISTRY,
} from '@/lib/cms/page-type-registry';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const publicOnly = searchParams.get('publicOnly') === 'true';

  const canonicalPageTypes = getCanonicalPublicPageTypes();
  const allPageTypes = getAllPageTypes();
  const types = publicOnly ? canonicalPageTypes : allPageTypes;

  const categories = Array.from(new Set(allPageTypes.map((p) => p.category)));

  return NextResponse.json({
    success: true,
    total: types.length,
    pageTypes: types,
    canonicalPageTypes,
    allPageTypes,
    categories,
    registry: CANONICAL_PAGE_TYPE_REGISTRY,
  });
}
