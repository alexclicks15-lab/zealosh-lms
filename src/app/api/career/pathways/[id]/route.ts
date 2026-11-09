import { NextResponse } from 'next/server';
import { careerPathwayService } from '@/lib/career/career-pathway-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pathway = careerPathwayService.getPathway(id);
    if (!pathway) {
      return NextResponse.json({ success: false, error: 'Pathway not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, pathway });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

