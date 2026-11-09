import { NextRequest, NextResponse } from 'next/server';
import { offlineQueueService } from '@/lib/pwa/offline-queue-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, subscription } = body;

    if (!userId || !subscription?.endpoint || !subscription?.p256dh || !subscription?.auth) {
      return NextResponse.json(
        { success: false, error: 'userId and complete push subscription keys are required.' },
        { status: 400 }
      );
    }

    const saved = await offlineQueueService.registerPushSubscription(userId, subscription);
    return NextResponse.json({
      success: true,
      subscription: saved,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

