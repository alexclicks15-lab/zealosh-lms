// Zealosh LMS — Phase 5C.3 Support Ticket Detail API (Learner Scope)
// GET /api/support/tickets/[id]
// Strict internal note confidentiality: only PUBLIC messages/events are included.

import { NextResponse } from 'next/server';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { db } from '@/lib/store/db';
import { supportService } from '@/lib/support';
import { User } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

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

    const ticket = await supportService.getTicketById(params.id, caller);
    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Support ticket not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ticket,
    });
  } catch (err: any) {
    console.error('[ApiSupportTicketDetailGET] Error:', err);
    const status = err.message?.includes('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

