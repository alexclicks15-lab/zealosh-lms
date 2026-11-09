// Zealosh LMS — Phase 5B Admin Email Job Manual Cancellation API
// POST /api/admin/email/[id]/cancel — Cancels a queued or pending email outbox job
// Enforces RBAC (SUPER_ADMIN, ADMIN)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { emailDispatchWorker } from '@/lib/email/email-dispatch-worker';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { id } = params;
    let reason = 'Cancelled by administrator';
    try {
      const body = await request.json();
      if (body?.reason) reason = body.reason;
    } catch {
      // Body is optional
    }

    const success = await emailDispatchWorker.cancelJob(id, reason);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Job ${id} cancelled successfully`,
    });
  } catch (err: any) {
    console.error('[AdminEmailCancel] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
