import { NextResponse } from 'next/server';
import { testimonialService } from '@/lib/testimonials/testimonial-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await params;
    const body = await request.json();
    const { studentId, reason } = body;

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'studentId required' }, { status: 400 });
    }

    const review = testimonialService.revokeConsent(reviewId, studentId, reason);
    return NextResponse.json({ success: true, review });
  } catch (err: any) {
    const statusCode = err.message.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: err.message }, { status: statusCode });
  }
}

