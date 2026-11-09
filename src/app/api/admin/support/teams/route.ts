// Zealosh LMS — Phase 5C.3 Support Teams API
// GET /api/admin/support/teams
// Returns support teams and team members for routing and assignment.

import { NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { db } from '@/lib/store/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const teams = await db.getSupportTeams(true);

    return NextResponse.json({
      success: true,
      teams,
    });
  } catch (err: any) {
    console.error('[AdminSupportTeamsGET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

