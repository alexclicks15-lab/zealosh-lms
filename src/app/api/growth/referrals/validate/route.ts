import { NextResponse } from 'next/server';
import { referralGrowthService } from '@/lib/growth/referral-growth-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ success: false, error: 'code required' }, { status: 400 });
    }

    const validation = referralGrowthService.validateReferralCode(code);
    return NextResponse.json({ success: true, ...validation });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

