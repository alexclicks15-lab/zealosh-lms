// Zealosh LMS — Slug Validation API
// GET /api/cms/validate-slug?slug=...&excludePageId=...

import { NextResponse } from 'next/server';
import { cmsService } from '@/lib/cms/cms-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || '';
    const excludePageId = searchParams.get('excludePageId') || undefined;

    const result = await cmsService.validateSlug(slug, excludePageId);
    return NextResponse.json({
      valid: result.valid,
      reason: result.reason,
    });
  } catch (error: any) {
    return NextResponse.json({ valid: false, reason: error.message }, { status: 400 });
  }
}

