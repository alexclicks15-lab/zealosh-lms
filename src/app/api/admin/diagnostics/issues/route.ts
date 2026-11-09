// Zealosh LMS — Phase 5C.1 Admin Diagnostic Issues List API
// GET /api/admin/diagnostics/issues — Query filterable diagnostic issues
// Enforces RBAC (SUPER_ADMIN, ADMIN)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { diagnosticsService } from '@/lib/diagnostics/diagnostics-service';
import { DiagnosticCategory, DiagnosticIssueStatus, DiagnosticSeverity } from '@/types';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as DiagnosticIssueStatus | null;
    const severity = searchParams.get('severity') as DiagnosticSeverity | null;
    const category = searchParams.get('category') as DiagnosticCategory | null;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const filter: any = { limit, offset };
    if (status && status !== ('all' as any)) filter.status = status;
    if (severity && severity !== ('all' as any)) filter.severity = severity;
    if (category && category !== ('all' as any)) filter.category = category;
    if (search) filter.search = search;

    const result = await diagnosticsService.getIssues(filter);

    return NextResponse.json({
      success: true,
      issues: result.issues,
      total: result.total,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error('[AdminDiagnosticIssues] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

