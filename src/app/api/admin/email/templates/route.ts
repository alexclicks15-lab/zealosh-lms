// Zealosh LMS — Phase 5B Admin Email Templates Catalogue API
// GET /api/admin/email/templates — Lists institutional email templates and variables
// Enforces RBAC (SUPER_ADMIN, ADMIN)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { CANONICAL_EMAIL_TEMPLATES } from '@/lib/email/template-engine';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const templates = Object.values(CANONICAL_EMAIL_TEMPLATES);

    return NextResponse.json({
      success: true,
      templates,
      totalCount: templates.length,
    });
  } catch (err: any) {
    console.error('[AdminEmailTemplates] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
