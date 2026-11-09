import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { ReportDataset, ReportFormat } from '@/types';
import { sanitizeCsvCell } from '@/lib/reporting/csv-sanitizer';

function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  return verifyToken(token);
}

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const headerRow = headers.map((h) => sanitizeCsvCell(h)).join(',');

  const rows = data.map((row) =>
    headers
      .map((header) => sanitizeCsvCell(row[header]))
      .join(',')
  );

  return [headerRow, ...rows].join('\r\n');
}

export async function GET(request: Request) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (userPayload.role !== 'SUPER_ADMIN' && userPayload.role !== 'ORG_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Compliance report export requires administrative privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dataset = (searchParams.get('dataset') || 'enrollments') as ReportDataset;
    const format = (searchParams.get('format') || 'json') as ReportFormat;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const validDatasets: ReportDataset[] = ['enrollments', 'exams', 'certificates', 'revenue'];
    if (!validDatasets.includes(dataset)) {
      return NextResponse.json(
        { error: `Invalid dataset requested. Valid options: ${validDatasets.join(', ')}` },
        { status: 400 }
      );
    }

    let rows = await db.generateComplianceReport(dataset);

    // Filter by date range if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Infinity;

      rows = rows.filter((r) => {
        const recordDateStr = (r.enrolledAt || r.completedTime || r.issueDate || r.issuedAt) as string;
        if (!recordDateStr) return true;
        const time = new Date(recordDateStr).getTime();
        return time >= start && time <= end;
      });
    }

    // Record audit entry for administrative data export
    await db.recordAudit({
      actorUserId: userPayload.userId,
      actorEmail: userPayload.email,
      actorRole: userPayload.role,
      action: 'COMPLIANCE_REPORT_EXPORTED',
      entityType: 'REPORT',
      entityId: dataset,
      details: {
        dataset,
        format,
        rowCount: rows.length,
        startDate: startDate || 'ALL',
        endDate: endDate || 'ALL',
      },
    });

    if (format === 'csv') {
      const csv = convertToCSV(rows);
      const filename = `zealosh_${dataset}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      dataset,
      format: 'json',
      rowCount: rows.length,
      generatedAt: new Date().toISOString(),
      data: rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
