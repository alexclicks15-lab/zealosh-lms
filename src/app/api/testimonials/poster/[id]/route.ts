import { NextResponse } from 'next/server';
import { testimonialService } from '@/lib/testimonials/testimonial-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'studentId required' }, { status: 400 });
    }

    const showcase = testimonialService.generateAchievementShowcase({
      studentId,
      courseId,
    });

    return NextResponse.json({ success: true, showcase });
  } catch (err: any) {
    const statusCode = err.message.includes('consent') ? 403 : 400;
    return NextResponse.json({ success: false, error: err.message }, { status: statusCode });
  }
}

