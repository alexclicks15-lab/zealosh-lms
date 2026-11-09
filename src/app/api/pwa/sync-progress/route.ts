import { NextRequest, NextResponse } from 'next/server';
import { offlineQueueService } from '@/lib/pwa/offline-queue-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, items } = body;

    if (!studentId || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: 'studentId and an array of items are required.' },
        { status: 400 }
      );
    }

    const outcome = await offlineQueueService.syncOfflineProgress(studentId, items);

    return NextResponse.json({
      success: true,
      outcome,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

