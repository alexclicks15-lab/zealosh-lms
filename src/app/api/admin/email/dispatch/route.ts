// Zealosh LMS — Phase 5B Admin Email Dispatch Trigger API
// POST /api/admin/email/dispatch — Executes outbox lease recovery and dispatches pending jobs
// Enforces RBAC (SUPER_ADMIN, ADMIN) or valid CRON secret

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { emailDispatchWorker } from '@/lib/email/email-dispatch-worker';

export async function POST(request: Request) {
  try {
    // 1. Authorize via Admin Token or Cron Key
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    let isAuthorized = false;
    if (cronSecret && token === cronSecret) {
      isAuthorized = true;
    } else {
      const authResult = authorizeAdmin(request);
      if (!('errorResponse' in authResult)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized to trigger dispatch worker' }, { status: 401 });
    }

    // 2. Recover Stale Leases
    const recoveredLeases = await emailDispatchWorker.recoverStaleLeases();

    // 3. Dispatch Batch
    let limit = 20;
    try {
      const body = await request.json();
      if (body?.limit) limit = Math.min(100, Math.max(1, parseInt(body.limit, 10)));
    } catch {
      // Body is optional
    }

    const dispatchResult = await emailDispatchWorker.claimAndDispatchBatch({ limit });

    return NextResponse.json({
      success: true,
      recoveredLeases,
      dispatchResult,
    });
  } catch (err: any) {
    console.error('[AdminEmailDispatch] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
