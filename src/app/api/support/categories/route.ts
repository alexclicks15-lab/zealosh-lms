// Zealosh LMS — Phase 5C.3 Support Categories API
// GET /api/support/categories
// Returns active support categories for ticket creation forms

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await db.getSupportCategories(true);
    return NextResponse.json({
      success: true,
      categories,
    });
  } catch (err: any) {
    console.error('[ApiSupportCategories] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

