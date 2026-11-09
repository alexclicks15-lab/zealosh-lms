import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId') || undefined;

    const runs = await db.getReconciliationRuns();
    const results = await db.getReconciliationResults(runId);

    return NextResponse.json({
      success: true,
      runsCount: runs.length,
      resultsCount: results.length,
      runs,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

