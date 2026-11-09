import { NextResponse } from 'next/server';
import { EnterpriseTelemetryService } from '@/lib/telemetry/enterprise-telemetry';

export async function GET() {
  try {
    const metrics = await EnterpriseTelemetryService.getDashboardMetrics();
    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

