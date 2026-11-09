import { NextResponse } from 'next/server';
import { careerPathwayService } from '@/lib/career/career-pathway-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ success: false, error: 'studentId query parameter required' }, { status: 400 });
    }

    const plan = careerPathwayService.getStudentPlan(studentId);
    return NextResponse.json({ success: true, plan });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, pathwayId, targetCompletionDate, notes } = body;

    if (!studentId || !pathwayId || !targetCompletionDate) {
      return NextResponse.json(
        { success: false, error: 'studentId, pathwayId, and targetCompletionDate are required' },
        { status: 400 }
      );
    }

    const plan = careerPathwayService.createOrUpdatePlan({
      studentId,
      pathwayId,
      targetCompletionDate,
      notes,
    });

    return NextResponse.json({ success: true, plan }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

