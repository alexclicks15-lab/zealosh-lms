// Zealosh LMS — Phase 5C.3 Ticket Assignment API
// PATCH /api/admin/support/tickets/[id]/assign
// Assigns a ticket to a specialized team and/or specific support agent.

import { NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { db } from '@/lib/store/db';
import { supportService } from '@/lib/support';
import { AssignTicketInput, User } from '@/types';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const body: AssignTicketInput = await request.json();

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

    const ticket = await supportService.assignTicket(params.id, body, caller);

    return NextResponse.json({
      success: true,
      ticket,
    });
  } catch (err: any) {
    console.error('[AdminSupportTicketAssignPATCH] Error:', err);
    const status =
      err.message?.includes('FORBIDDEN') ? 403 :
      err.message?.includes('TICKET_NOT_FOUND') ? 404 :
      err.message?.includes('NOT_FOUND') ? 400 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

