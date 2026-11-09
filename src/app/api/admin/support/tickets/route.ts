// Zealosh LMS — Phase 5C.3 Support Triage Operations API
// GET /api/admin/support/tickets
// Provides triage queue listing with multi-parameter filtering, searching, and pagination.

import { NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { db } from '@/lib/store/db';
import { supportService } from '@/lib/support';
import { SupportTicketFilterParams, User } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const filter: SupportTicketFilterParams = {
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      assignedTeamId: searchParams.get('assignedTeamId') || undefined,
      assignedAgentUserId: searchParams.get('assignedAgentUserId') || undefined,
      requesterUserId: searchParams.get('requesterUserId') || undefined,
      courseId: searchParams.get('courseId') || undefined,
      batchId: searchParams.get('batchId') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
    };

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

    const result = await supportService.getTickets(filter, caller);

    return NextResponse.json({
      success: true,
      tickets: result.tickets,
      totalCount: result.totalCount,
    });
  } catch (err: any) {
    console.error('[AdminSupportTicketsGET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

