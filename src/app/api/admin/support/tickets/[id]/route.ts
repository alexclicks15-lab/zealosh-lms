// Zealosh LMS — Phase 5C.3 Support Ticket Detail API (Staff Scope)
// GET /api/admin/support/tickets/[id]
// Returns full ticket data, including internal notes, immutable events, and attachments.

import { NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { db } from '@/lib/store/db';
import { supportService } from '@/lib/support';
import { User } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const userRecord = await db.getUser(authResult.actor.userId);
    const caller: User = userRecord || ({
      id: authResult.actor.userId,
      email: authResult.actor.email,
      name: 'Support Staff',
      role: authResult.actor.role as any,
      organizationId: 'org-zealosh-main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as User);

    const ticket = await supportService.getTicketById(params.id, caller);
    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Support ticket not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ticket,
    });
  } catch (err: any) {
    console.error('[AdminSupportTicketDetailGET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

