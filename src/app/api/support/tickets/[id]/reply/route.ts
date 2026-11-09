// Zealosh LMS — Phase 5C.3 Support Ticket Reply API (Learner Scope)
// POST /api/support/tickets/[id]/reply
// Learners can post public responses to their tickets. Internal notes are rejected.

import { NextResponse } from 'next/server';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { db } from '@/lib/store/db';
import { supportService } from '@/lib/support';
import { AddTicketMessageInput, User } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const body: AddTicketMessageInput = await request.json();

    const userRecord = await db.getUser(authResult.user.userId);
    const caller: User = userRecord || ({
      id: authResult.user.userId,
      email: authResult.user.email,
      name: authResult.user.name,
      role: authResult.user.role as any,
      organizationId: 'org-zealosh-main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as User);

    // Force public visibility for requester endpoint
    body.visibility = 'PUBLIC';

    const message = await supportService.addMessage(params.id, body, caller);

    return NextResponse.json({
      success: true,
      message,
    }, { status: 201 });
  } catch (err: any) {
    console.error('[ApiSupportTicketReplyPOST] Error:', err);
    const status =
      err.message?.includes('FORBIDDEN') ? 403 :
      err.message?.includes('TICKET_NOT_FOUND') ? 404 :
      err.message?.includes('INVALID_') ? 400 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

