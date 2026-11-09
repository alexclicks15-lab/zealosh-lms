import { NextResponse } from 'next/server';
import { referralGrowthService } from '@/lib/growth/referral-growth-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ success: false, error: 'studentId required' }, { status: 400 });
    }

    const eligibility = referralGrowthService.checkAlumniEligibility(studentId);
    return NextResponse.json({ success: true, eligibility });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, profileData } = body;

    if (!studentId || !profileData) {
      return NextResponse.json({ success: false, error: 'studentId and profileData required' }, { status: 400 });
    }

    const profile = referralGrowthService.createOrUpdateAlumniProfile(studentId, profileData);
    return NextResponse.json({ success: true, profile }, { status: 201 });
  } catch (err: any) {
    const statusCode = err.message.includes('Ineligible') ? 403 : 400;
    return NextResponse.json({ success: false, error: err.message }, { status: statusCode });
  }
}

