// Zealosh LMS — Phase 5C.1 Admin Resolve Issue API
// POST /api/admin/diagnostics/issues/[id]/resolve — Transitions issue status to RESOLVED with notes
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
    const body = await request.json().catch(() => ({}));
    const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;

    const updated = await diagnosticsService.resolveIssue(issueId, actor.userId, notes);
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
    console.error('[AdminResolveIssue] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

