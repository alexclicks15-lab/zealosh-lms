import { NextResponse } from 'next/server';
import { offlineQueueService } from '@/lib/pwa/offline-queue-service';

export async function GET() {
  try {
    const readiness = offlineQueueService.getPushReadinessStatus();
    return NextResponse.json({
      success: true,
      readiness,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

