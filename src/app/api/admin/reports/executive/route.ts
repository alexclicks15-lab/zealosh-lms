import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { sanitizeCsvCell } from '@/lib/reporting/csv-sanitizer';

function getAuthUser(request: Request) {
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

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Executive reports require leadership privileges' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const courseId = searchParams.get('courseId') || undefined;
    const format = searchParams.get('format') || 'json';

    const kpiSummary = await db.getExecutiveKpiSummary(startDate, endDate, courseId);
    const funnelReport = await db.getConversionFunnelReport(startDate, endDate, courseId);

    if (format === 'csv') {
      // Return safe CSV with formula injection sanitization
      const headers = ['Stage Name', 'Stage ID', 'Learners Count', 'Conversion Rate %', 'Drop-off Count', 'Drop-off %'];
      const headerRow = headers.map((h) => sanitizeCsvCell(h)).join(',');

      const rows = funnelReport.stages.map((st) => [
        sanitizeCsvCell(st.stageName),
        sanitizeCsvCell(st.stageId),
        sanitizeCsvCell(st.count),
        sanitizeCsvCell(`${st.conversionPercentFromTop}%`),
        sanitizeCsvCell(st.dropOffCount),
        sanitizeCsvCell(`${st.dropOffPercent}%`),
      ].join(','));

      const csvContent = [
        sanitizeCsvCell('# Zealosh LMS — Executive Conversion Funnel Report'),
        headerRow,
        ...rows,
        '',
        sanitizeCsvCell('Metric,Value'),
        `${sanitizeCsvCell('Active Learners')},${sanitizeCsvCell(kpiSummary.activeLearnersCount)}`,
        `${sanitizeCsvCell('Gross Revenue (INR)')},${sanitizeCsvCell(kpiSummary.grossRevenueINR)}`,
        `${sanitizeCsvCell('Course Completion Rate')},${sanitizeCsvCell(`${kpiSummary.courseCompletionRatePercent}%`)}`,
        `${sanitizeCsvCell('Admissions Conversion Rate')},${sanitizeCsvCell(`${kpiSummary.admissionsConversionRatePercent}%`)}`,
      ].join('\r\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="zealosh-executive-funnel.csv"',
        },
      });
    }

    return NextResponse.json({
      kpiSummary,
      funnelReport,
      filter: { startDate, endDate, courseId },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to generate executive report' }, { status: 500 });
  }
}
