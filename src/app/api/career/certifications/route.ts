import { NextResponse } from 'next/server';
import { careerPathwayService } from '@/lib/career/career-pathway-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get('category') as any) || undefined;
    const status = (searchParams.get('status') as any) || 'PUBLISHED';

    const certs = careerPathwayService.getCertifications(category, status);
    return NextResponse.json({ success: true, count: certs.length, certifications: certs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cert = careerPathwayService.createCertification(body);
    return NextResponse.json({ success: true, certification: cert }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

