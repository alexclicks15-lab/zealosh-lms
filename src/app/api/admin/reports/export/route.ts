// Zealosh LMS — Phase 5C.2 Sanitized CSV Reporting Export API
// GET /api/admin/reports/export?type=overview|batches|attendance|progression|faculty|attention
// Enforces RBAC (SUPER_ADMIN, ADMIN, ORG_ADMIN) and OWASP CSV formula injection sanitization

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { reportingService } from '@/lib/reporting';
import { ReportingDateRangePreset, ReportingFilterParams } from '@/types/reporting';
import { db } from '@/lib/store/db';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const filters: ReportingFilterParams = {
      dateRangePreset: (searchParams.get('preset') as ReportingDateRangePreset) || 'last_30_days',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      courseId: searchParams.get('courseId') || undefined,
      batchId: searchParams.get('batchId') || undefined,
      instructorId: searchParams.get('instructorId') || undefined,
      enrolmentStatus: searchParams.get('enrolmentStatus') || undefined,
    };

    const { filename, csv } = await reportingService.exportReportCsv(type, filters);

    // Record audit trail entry for compliance and data sovereignty
    await db.recordAudit({
      actorUserId: authResult.actor.userId,
      actorEmail: authResult.actor.email,
      actorRole: authResult.actor.role as any,
      action: 'COMPLIANCE_REPORT_EXPORTED',
      entityType: 'REPORT',
      entityId: type,
      details: {
        reportType: type,
        filters,
        format: 'csv',
        filename,
      },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[AdminReportsExport] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

