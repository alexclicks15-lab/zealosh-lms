import { NextRequest, NextResponse } from 'next/server';
import { eventDispatcherWorker } from '@/lib/events/event-dispatcher-worker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const workerId = body.workerId || `api-worker-${Date.now()}`;
    const limit = body.limit ? parseInt(body.limit, 10) : 20;

    const result = await eventDispatcherWorker.claimAndDispatchBatch({
      workerId,
      limit,
    });

    return NextResponse.json({
      success: true,
      batchResult: result,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

