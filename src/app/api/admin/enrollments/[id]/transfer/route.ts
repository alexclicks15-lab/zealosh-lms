import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: enrollmentId } = await params;
    const body = await request.json();
    const { targetBatchId, reason, approvedBy } = body;

    if (!targetBatchId) {
      return NextResponse.json({ error: 'targetBatchId is required' }, { status: 400 });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'A justification reason for the transfer is required' }, { status: 400 });
    }

    const transfer = await db.transferStudentBatch({
      enrollmentId,
      targetBatchId,
      reason: reason.trim(),
      approvedBy: approvedBy || 'usr-admin-01',
    });

    return NextResponse.json({
      success: true,
      message: 'Student cohort transfer completed successfully.',
      transfer,
    });
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes('ENROLLMENT_NOT_FOUND') ||
        err.message.includes('SOURCE_BATCH_NOT_FOUND') ||
        err.message.includes('TARGET_BATCH_NOT_FOUND'))
    ) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (
      err.message &&
      (err.message.includes('TARGET_BATCH_CAPACITY_EXCEEDED') ||
        err.message.includes('SOURCE_AND_TARGET_BATCH_IDENTICAL') ||
        err.message.includes('ENROLLMENT_NOT_ACTIVE') ||
        err.message.includes('TARGET_BATCH_NOT_ACCEPTING'))
    ) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || 'Cohort transfer failed' }, { status: 500 });
  }
}

