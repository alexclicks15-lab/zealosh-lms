import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { decision, notes, reviewerId } = body;

    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'Valid decision ("APPROVED" or "REJECTED") is required' }, { status: 400 });
    }

    const reviewer = reviewerId || 'usr-admin-01';

    const result = await db.reviewAdmissionApplication(id, decision, reviewer, notes);

    return NextResponse.json({
      success: true,
      message: `Application ${id} has been ${decision.toLowerCase()} successfully.`,
      application: result.application,
      enrollment: result.enrollment,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('APPLICATION_NOT_FOUND')) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    if (err.message && err.message.includes('APPLICATION_ALREADY_REVIEWED')) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err.message && err.message.includes('BATCH_CAPACITY_EXCEEDED')) {
      return NextResponse.json({ error: 'BATCH_CAPACITY_EXCEEDED: Cohort has reached maximum seat capacity' }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || 'Application review failed' }, { status: 500 });
  }
}
