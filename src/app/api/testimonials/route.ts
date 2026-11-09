import { NextResponse } from 'next/server';
import { testimonialService } from '@/lib/testimonials/testimonial-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const review = testimonialService.submitReview(body);
    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (err: any) {
    const statusCode = err.message.includes('Ineligible') ? 403 : 400;
    return NextResponse.json({ success: false, error: err.message }, { status: statusCode });
  }
}

