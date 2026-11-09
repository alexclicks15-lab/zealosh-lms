import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: enrollmentId } = await params;
    const body = await request.json();
    const { reason, approvedBy, refundAmount } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'A justification reason for the withdrawal is required' }, { status: 400 });
    }

    const withdrawal = await db.withdrawStudentEnrollment({
      enrollmentId,
      reason: reason.trim(),
      approvedBy: approvedBy || 'usr-admin-01',
      refundAmount: typeof refundAmount === 'number' ? refundAmount : undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Student enrollment withdrawal processed successfully.',
      withdrawal,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('ENROLLMENT_NOT_FOUND')) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }
    if (err.message && err.message.includes('ENROLLMENT_ALREADY_TERMINATED')) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || 'Enrollment withdrawal failed' }, { status: 500 });
  }
}

