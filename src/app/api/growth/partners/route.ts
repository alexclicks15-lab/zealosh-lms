import { NextResponse } from 'next/server';
import { referralGrowthService } from '@/lib/growth/referral-growth-service';

export async function GET() {
  try {
    const partners = referralGrowthService.getPartners();
    return NextResponse.json({ success: true, count: partners.length, partners });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const partner = referralGrowthService.registerPartner(body);
    return NextResponse.json({ success: true, partner }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

