import { NextResponse } from 'next/server';
import { referralGrowthService } from '@/lib/growth/referral-growth-service';

export async function GET() {
  try {
    const campaigns = referralGrowthService.getCampaigns();
    return NextResponse.json({ success: true, count: campaigns.length, campaigns });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const campaign = referralGrowthService.createCampaign(body);
    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

