// Zealosh LMS — Phase 5B Admin Email Job Manual Retry API
// POST /api/admin/email/[id]/retry — Resets job to QUEUED for immediate reprocessing
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
    const success = await emailDispatchWorker.retryJob(id);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Job ${id} reset to QUEUED for immediate reprocessing`,
    });
  } catch (err: any) {
    console.error('[AdminEmailRetry] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
