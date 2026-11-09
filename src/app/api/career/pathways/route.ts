import { NextResponse } from 'next/server';
import { careerPathwayService } from '@/lib/career/career-pathway-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') as any) || 'PUBLISHED';

    const pathways = careerPathwayService.getPathways(status);
    return NextResponse.json({ success: true, count: pathways.length, pathways });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pathway = careerPathwayService.createPathway(body);
    return NextResponse.json({ success: true, pathway }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

