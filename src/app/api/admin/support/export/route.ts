// Zealosh LMS — Phase 5C.3 Support Tickets CSV Export API
// GET /api/admin/support/export
// Streams sanitized RFC 4180 CSV export of support tickets with formula injection protection.

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
      search: searchParams.get('search') || undefined,
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

    const csvContent = await supportService.exportTicketsCsv(filter, caller);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `zealosh-support-tickets-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('[AdminSupportExportGET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

