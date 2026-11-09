// Zealosh LMS — Phase 5C.2 Attendance Analytics Reporting API
// GET /api/admin/reports/attendance
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
    };

    const report = await reportingService.getAttendanceAnalytics(filters);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (err: any) {
    console.error('[AdminReportsAttendance] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

