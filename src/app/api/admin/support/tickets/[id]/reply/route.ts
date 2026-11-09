// Zealosh LMS — Phase 5C.3 Support Ticket Reply API (Staff Scope)
// POST /api/admin/support/tickets/[id]/reply
// Authorized staff can post public responses or private internal notes.

import { NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { db } from '@/lib/store/db';
import { supportService } from '@/lib/support';
import { AddTicketMessageInput, User } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const body: AddTicketMessageInput = await request.json();

    const userRecord = await db.getUser(authResult.actor.userId);
    const caller: User = userRecord || ({
      id: authResult.actor.userId,
      email: authResult.actor.email,
      name: 'Support Agent',
      role: authResult.actor.role as any,
      organizationId: 'org-zealosh-main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as User);

    const message = await supportService.addMessage(params.id, body, caller);

    return NextResponse.json({
      success: true,
      message,
    }, { status: 201 });
  } catch (err: any) {
    console.error('[AdminSupportTicketReplyPOST] Error:', err);
    const status =
      err.message?.includes('FORBIDDEN') ? 403 :
      err.message?.includes('TICKET_NOT_FOUND') ? 404 :
      err.message?.includes('INVALID_') ? 400 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

