import { NextResponse } from 'next/server';
import { testimonialService } from '@/lib/testimonials/testimonial-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || undefined;
    const category = (searchParams.get('category') as any) || undefined;

    const testimonials = testimonialService.getPublicTestimonials(courseId, category);
    return NextResponse.json({ success: true, count: testimonials.length, testimonials });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

