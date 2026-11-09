import { NextResponse } from 'next/server';
import { careerPathwayService } from '@/lib/career/career-pathway-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const body = await request.json();
    const { action, studentId, tutorId, guidanceNotes } = body;

    if (action === 'SHARE') {
      if (!studentId || !tutorId) {
        return NextResponse.json({ success: false, error: 'studentId and tutorId required' }, { status: 400 });
      }
      const plan = careerPathwayService.sharePlanWithTutor(studentId, tutorId);
      return NextResponse.json({ success: true, plan });
    } else if (action === 'REVOKE') {
      if (!studentId) {
        return NextResponse.json({ success: false, error: 'studentId required' }, { status: 400 });
      }
      const plan = careerPathwayService.revokeTutorSharing(studentId);
      return NextResponse.json({ success: true, plan });
    } else if (action === 'GUIDANCE') {
      if (!tutorId || !guidanceNotes) {
        return NextResponse.json({ success: false, error: 'tutorId and guidanceNotes required' }, { status: 400 });
      }
      const plan = careerPathwayService.addTutorGuidance(tutorId, planId, guidanceNotes);
      return NextResponse.json({ success: true, plan });
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Supported: SHARE, REVOKE, GUIDANCE' }, { status: 400 });
  } catch (err: any) {
    const statusCode = err.message.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: err.message }, { status: statusCode });
  }
}

