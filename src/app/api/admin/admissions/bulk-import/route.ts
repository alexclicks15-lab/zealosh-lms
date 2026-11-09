import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { BulkImportOptions } from '@/types';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let csvData = '';
    const options: BulkImportOptions = { mode: 'PENDING_REVIEW' };

    if (contentType.includes('application/json')) {
      const body = await request.json();
      csvData = body.csvContent || body.csvData || body.csv || '';
      if (body.mode) options.mode = body.mode;
      if (body.autoApprove !== undefined) options.autoApprove = Boolean(body.autoApprove);
      if (body.authorizedBy) options.authorizedBy = body.authorizedBy;
      if (body.defaultCourseId) options.defaultCourseId = body.defaultCourseId;
    } else {
      csvData = await request.text();
    }

    if (!csvData || csvData.trim().length === 0) {
      return NextResponse.json({ error: 'CSV data payload is required' }, { status: 400 });
    }

    const result = await db.bulkImportAdmissions(csvData, options);

    return NextResponse.json({
      success: true,
      message: `Bulk import completed: ${result.importedCount} imported (${result.pendingReviewCount || 0} pending review, ${result.createdEnrollmentIds.length} auto-enrolled), ${result.failedCount} failed.`,
      ...result,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bulk admissions import failed' }, { status: 500 });
  }
}
