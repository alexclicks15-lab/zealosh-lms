import { NextResponse } from 'next/server';
import { referralGrowthService } from '@/lib/growth/referral-growth-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName') || 'Learner';

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }

    const referralCode = referralGrowthService.getOrCreateReferralCode(userId, userName);
    return NextResponse.json({ success: true, referralCode });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

