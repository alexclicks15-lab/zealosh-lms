import { NextRequest, NextResponse } from 'next/server';
import { reconciliationEngine } from '@/lib/events/reconciliation-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const ruleName = body.ruleName || undefined;

    const runs = await reconciliationEngine.runReconciliation({ ruleName });

    return NextResponse.json({
      success: true,
      runsCount: runs.length,
      runs,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

