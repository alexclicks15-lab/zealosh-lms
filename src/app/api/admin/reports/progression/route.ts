// Zealosh LMS — Phase 5C.2 Course Progression Reporting API
// GET /api/admin/reports/progression
// Enforces RBAC (SUPER_ADMIN, ADMIN, ORG_ADMIN)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { reportingService } from '@/lib/reporting';
import { ReportingFilterParams } from '@/types/reporting';

export async function GET(request: Request) {
  try {
    const authResult =  authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const filters: ReportingFilterParams = {
      courseId: searchParams.get('courseId') || undefined,
    };

    const report = await reportingService.getCourseProgressionAnalytics(filters);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (err: any) {
    console.error('[AdminReportsProgression] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

