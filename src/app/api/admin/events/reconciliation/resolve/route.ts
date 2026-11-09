import { NextRequest, NextResponse } from 'next/server';
import { reconciliationEngine } from '@/lib/events/reconciliation-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resultId, actorUserId, action, notes } = body;

    if (!resultId) {
      return NextResponse.json({ success: false, error: 'resultId is required.' }, { status: 400 });
    }

    const outcome = await reconciliationEngine.resolveResult(
      resultId,
      actorUserId || 'admin',
      action || 'MANUAL_REVIEW',
      notes || 'Resolved via admin console'
    );

    if (!outcome.success) {
      return NextResponse.json({ success: false, error: outcome.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Reconciliation result '${resultId}' resolved.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

