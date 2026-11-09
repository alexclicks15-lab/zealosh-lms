// Zealosh LMS — Phase 5B Admin Email Statistics & Diagnostics API
// GET /api/admin/email/stats — Aggregates outbox queue counts and provider configuration status
// Enforces RBAC (SUPER_ADMIN, ADMIN)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { getEmailProviderAdapter } from '@/lib/email/provider-adapter';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const stats = await db.getEmailOutboxStats();
    const adapter = getEmailProviderAdapter();

    return NextResponse.json({
      success: true,
      stats: {
        total: stats.total,
        queued: stats.queued,
        processing: stats.processing,
        sent: stats.sent,
        delivered: stats.delivered,
        failed: stats.failed,
        retryPending: stats.retryPending,
        bounced: stats.bounced,
        suppressed: stats.suppressed,
        cancelled: stats.cancelled,
      },
      provider: {
        name: adapter.name,
        isConfigured: adapter.isConfigured(),
        status: adapter.isConfigured() ? 'CONFIGURED' : 'EMAIL_PROVIDER_UNCONFIGURED',
      },
    });
  } catch (err: any) {
    console.error('[AdminEmailStats] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
