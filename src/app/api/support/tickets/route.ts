// Zealosh LMS — Phase 5C.3 Support Tickets API (Learner/Requester Scope)
// GET /api/support/tickets — Lists authenticated user's submitted support tickets
// POST /api/support/tickets — Creates a new support ticket

import { NextResponse } from 'next/server';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { db } from '@/lib/store/db';
import { supportService } from '@/lib/support';
import { CreateSupportTicketInput, SupportTicketFilterParams, User } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const filter: SupportTicketFilterParams = {
      status: searchParams.get('status') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
    };

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

    const result = await supportService.getTickets(filter, caller);

    return NextResponse.json({
      success: true,
      tickets: result.tickets,
      totalCount: result.totalCount,
    });
  } catch (err: any) {
    console.error('[ApiSupportTicketsGET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const body: CreateSupportTicketInput = await request.json();

    const userRecord = await db.getUser(authResult.user.userId);
    const requester: User = userRecord || ({
      id: authResult.user.userId,
      email: authResult.user.email,
      name: authResult.user.name,
      role: authResult.user.role as any,
      organizationId: 'org-zealosh-main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as User);

    const ticket = await supportService.createTicket(body, requester);

    return NextResponse.json({
      success: true,
      ticket,
    }, { status: 201 });
  } catch (err: any) {
    console.error('[ApiSupportTicketsPOST] Error:', err);
    const status = err.message?.includes('INVALID_') || err.message?.includes('ACADEMIC_CONTEXT_REQUIRED') ? 400 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

