import { NextResponse } from 'next/server';
import { testimonialService } from '@/lib/testimonials/testimonial-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await params;
    const body = await request.json();
    const { moderatorId, decision, notes, rejectionReason } = body;

    if (!moderatorId || !decision) {
      return NextResponse.json({ success: false, error: 'moderatorId and decision required' }, { status: 400 });
    }

    const review = testimonialService.moderateReview({
      reviewId,
      moderatorId,
      decision,
      notes,
      rejectionReason,
    });

    return NextResponse.json({ success: true, review });
  } catch (err: any) {
    const statusCode = err.message.includes('Conflict of interest') ? 403 : 400;
    return NextResponse.json({ success: false, error: err.message }, { status: statusCode });
  }
}

