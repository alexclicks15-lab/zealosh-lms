import { NextResponse } from 'next/server';
import { testimonialService } from '@/lib/testimonials/testimonial-service';

export async function GET() {
  try {
    const reviews = testimonialService.getAllReviewsForAdmin();
    return NextResponse.json({ success: true, count: reviews.length, reviews });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

