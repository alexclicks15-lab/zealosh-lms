// Zealosh LMS — Phase 5C.3 Ticket Priority API
// PATCH /api/admin/support/tickets/[id]/priority
// Updates ticket priority with reason tracking and immutable audit logging.

import { NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { db } from '@/lib/store/db';
import { supportService } from '@/lib/support';
import { SupportTicketPriority, User } from '@/types';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { priority, reason }: { priority: SupportTicketPriority; reason?: string } = await request.json();

    if (!['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) {
      return NextResponse.json({ success: false, error: 'Invalid priority level' }, { status: 400 });
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

    const ticket = await supportService.updatePriority(params.id, priority, caller, reason);

    return NextResponse.json({
      success: true,
      ticket,
    });
  } catch (err: any) {
    console.error('[AdminSupportTicketPriorityPATCH] Error:', err);
    const status =
      err.message?.includes('FORBIDDEN') ? 403 :
      err.message?.includes('TICKET_NOT_FOUND') ? 404 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

