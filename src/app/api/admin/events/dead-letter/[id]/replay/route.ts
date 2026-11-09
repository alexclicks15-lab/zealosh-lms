import { NextRequest, NextResponse } from 'next/server';
import { eventDispatcherWorker } from '@/lib/events/event-dispatcher-worker';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const actorUserId = body.actorUserId || 'admin';
    const reason = body.reason;

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Mandatory audit reason (at least 5 characters) required for replay.' },
        { status: 400 }
      );
    }

    const outcome = await eventDispatcherWorker.replayDeadLetter(id, actorUserId, reason);
    if (!outcome.success) {
      return NextResponse.json({ success: false, error: outcome.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Dead-letter event '${id}' queued for replay.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

