// Zealosh LMS — Phase 5C.2 Executive Overview Reporting API
// GET /api/admin/reports/overview
// Enforces RBAC (SUPER_ADMIN, ADMIN, ORG_ADMIN)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { reportingService } from '@/lib/reporting';
import { ReportingDateRangePreset, ReportingFilterParams } from '@/types/reporting';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const filters: ReportingFilterParams = {
      dateRangePreset: (searchParams.get('preset') as ReportingDateRangePreset) || 'last_30_days',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      courseId: searchParams.get('courseId') || undefined,
      batchId: searchParams.get('batchId') || undefined,
      instructorId: searchParams.get('instructorId') || undefined,
      enrolmentStatus: searchParams.get('enrolmentStatus') || undefined,
    };

    const overview = await reportingService.getExecutiveOverview(filters);

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (err: any) {
    console.error('[AdminReportsOverview] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

