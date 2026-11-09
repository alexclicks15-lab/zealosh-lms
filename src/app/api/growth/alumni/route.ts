import { NextResponse } from 'next/server';
import { referralGrowthService } from '@/lib/growth/referral-growth-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerUserId = searchParams.get('viewerUserId') || 'guest';
    const industry = searchParams.get('industry') || undefined;
    const programme = searchParams.get('programme') || undefined;

    const directory = referralGrowthService.getAlumniDirectory(viewerUserId, {
      industry,
      programme,
    });

    return NextResponse.json({ success: true, count: directory.length, directory });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

