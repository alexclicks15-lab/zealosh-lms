import { NextResponse } from 'next/server';
import { AdmissionsPipelineService } from '@/lib/admissions/admissions-pipeline';
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
      return NextResponse.json({ error: 'Unauthorized to issue admission offers' }, { status: 403 });
    }

    const body = await request.json();
    const { courseId, offeringId, offeredPriceInr, currency, validityDays } = body;

    if (!courseId || !offeringId || offeredPriceInr === undefined) {
      return NextResponse.json(
        { error: 'courseId, offeringId, and offeredPriceInr are required' },
        { status: 400 }
      );
    }

    const offer = await AdmissionsPipelineService.issueAdmissionOffer({
      applicationId: params.id,
      courseId,
      offeringId,
      offeredPriceInr: Number(offeredPriceInr),
      currency: currency || 'INR',
      validityDays,
      issuedBy: user.userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Admission offer issued successfully',
      offer,
    });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

