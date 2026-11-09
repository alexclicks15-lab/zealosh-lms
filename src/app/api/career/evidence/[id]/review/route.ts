import { NextResponse } from 'next/server';
import { careerPathwayService } from '@/lib/career/career-pathway-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: evidenceId } = await params;
    const body = await request.json();
    const { reviewerId, decision, rejectionReason, auditNotes } = body;

    if (!reviewerId || !decision) {
      return NextResponse.json({ success: false, error: 'reviewerId and decision required' }, { status: 400 });
    }

    const evidence = careerPathwayService.reviewEvidence({
      evidenceId,
      reviewerId,
      decision,
      rejectionReason,
      auditNotes,
    });

    return NextResponse.json({ success: true, evidence });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

