import { NextResponse } from 'next/server';
import { careerPathwayService } from '@/lib/career/career-pathway-service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { milestoneId } = await params;
    const body = await request.json();
    const { studentId, targetDate, status, externalExamPlan } = body;

    if (!studentId) {
      return NextResponse.json({ success: false, error: 'studentId required' }, { status: 400 });
    }

    const milestone = careerPathwayService.updateMilestone(studentId, milestoneId, {
      targetDate,
      status,
      externalExamPlan,
    });

    return NextResponse.json({ success: true, milestone });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

