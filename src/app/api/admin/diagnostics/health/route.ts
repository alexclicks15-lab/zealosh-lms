// Zealosh LMS — Phase 5C.1 Admin System Health Telemetry API
// GET /api/admin/diagnostics/health — Executes live health checks and aggregates issue counts
// Enforces RBAC (SUPER_ADMIN, ADMIN)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { diagnosticsService } from '@/lib/diagnostics/diagnostics-service';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const overview = await diagnosticsService.getHealthOverview();

    return NextResponse.json({
      success: true,
      health: overview,
    });
  } catch (err: any) {
    console.error('[AdminDiagnosticsHealth] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

