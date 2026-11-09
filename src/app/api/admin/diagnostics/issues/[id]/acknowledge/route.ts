// Zealosh LMS — Phase 5C.1 Admin Acknowledge Issue API
// POST /api/admin/diagnostics/issues/[id]/acknowledge — Transitions issue status to ACKNOWLEDGED
// Enforces RBAC (SUPER_ADMIN, ADMIN)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { diagnosticsService } from '@/lib/diagnostics/diagnostics-service';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const actor = authResult.actor;
    const issueId = params.id;

    const updated = await diagnosticsService.acknowledgeIssue(issueId, actor.userId);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Issue not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      issue: updated,
    });
  } catch (err: any) {
    console.error('[AdminAcknowledgeIssue] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

