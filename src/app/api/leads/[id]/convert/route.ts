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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await LeadService.convertLeadToApplication(params.id, body);

    return NextResponse.json({
      success: true,
      message: 'Lead successfully converted to formal admission application',
      lead: result.lead,
      application: result.application,
    });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

