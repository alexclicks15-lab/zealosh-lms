import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { Batch } from '@/types';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { batch } = await request.json();
    if (!batch || !batch.name || !batch.courseId) {
      return NextResponse.json({ success: false, error: 'Batch payload with name and courseId required' }, { status: 400 });
    }

    if (!batch.id) {
      batch.id = `btc-${Date.now().toString(36)}`;
    }
    if (batch.enrolledCount === undefined) {
      batch.enrolledCount = 0;
    }

    const existing = await db.getBatch(batch.id);
    if (existing) {
      const updated = await db.updateBatch(batch.id, batch);
      return NextResponse.json({ success: true, batch: updated });
    } else {
      const created = await db.addBatch(batch);
      return NextResponse.json({ success: true, batch: created });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { batchId } = await request.json();
    if (!batchId) {
      return NextResponse.json({ success: false, error: 'batchId required' }, { status: 400 });
    }
    const success = await db.deleteBatch(batchId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
