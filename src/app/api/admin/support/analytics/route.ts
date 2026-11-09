// Zealosh LMS — Phase 5C.3 Support Operations Analytics API
// GET /api/admin/support/analytics
// Returns comprehensive queue metrics, response times, SLA compliance, and categorizations.

import { NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { db } from '@/lib/store/db';
import { supportService } from '@/lib/support';
import { User } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const userRecord = await db.getUser(authResult.actor.userId);
    const caller: User = userRecord || ({
      id: authResult.actor.userId,
      email: authResult.actor.email,
      name: 'Support Admin',
      role: authResult.actor.role as any,
      organizationId: 'org-zealosh-main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as User);

    const analytics = await supportService.getSupportAnalytics(caller);

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (err: any) {
    console.error('[AdminSupportAnalyticsGET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

