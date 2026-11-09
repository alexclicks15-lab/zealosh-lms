// Zealosh LMS — Phase 5C.1 Admin Diagnostic Issue Details API
// GET /api/admin/diagnostics/issues/[id] — Fetch specific issue details & event timeline
// Enforces RBAC (SUPER_ADMIN, ADMIN)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { diagnosticsService } from '@/lib/diagnostics/diagnostics-service';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const issueId = params.id;
    const { issue, events } = await diagnosticsService.getIssueById(issueId);

    if (!issue) {
      return NextResponse.json(
        { success: false, error: 'Diagnostic issue not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      issue,
      events,
    });
  } catch (err: any) {
    console.error('[AdminDiagnosticIssueDetail] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

