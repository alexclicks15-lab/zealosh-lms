// Zealosh LMS — Phase 5B Admin Email Outbox Management API
// GET /api/admin/email/outbox — Query, filter, and inspect email outbox queue
// Enforces RBAC (SUPER_ADMIN, ADMIN)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { EmailOutboxStatus } from '@/types';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') as EmailOutboxStatus) || undefined;
    const recipientUserId = searchParams.get('recipientUserId') || searchParams.get('userId') || undefined;
    const search = searchParams.get('search') || searchParams.get('recipient') || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const result = await db.getEmailOutboxJobs({
      status,
      recipientUserId,
      search,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      totalCount: result.totalCount,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error('[AdminEmailOutbox] Query error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
