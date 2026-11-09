import { NextResponse } from 'next/server';
import { LeadService } from '@/lib/admissions/lead-service';
import { verifyToken } from '@/lib/auth/jwt';

function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, email, phone, courseInterest, offeringInterest, source, campaign, notes } = body;

    if (!fullName || !email) {
      return NextResponse.json(
        { error: 'Full name and email are required for lead inquiry' },
        { status: 400 }
      );
    }

    const lead = await LeadService.createLead({
      fullName,
      email,
      phone,
      courseInterest,
      offeringInterest,
      source: source || 'WEBSITE',
      campaign,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: 'Inquiry received. A Zealosh academic advisor will connect with you shortly.',
      lead,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'INSTRUCTOR')) {
      return NextResponse.json({ error: 'Unauthorized to access admissions leads' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') as any) || undefined;
    const courseInterest = searchParams.get('courseInterest') || undefined;
    const search = searchParams.get('search') || undefined;

    const leads = await LeadService.getLeads({ status, courseInterest, search });

    return NextResponse.json({
      success: true,
      leads,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
