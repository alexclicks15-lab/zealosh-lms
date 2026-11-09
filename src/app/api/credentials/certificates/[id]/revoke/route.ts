import { NextResponse } from 'next/server';
import { certificateService } from '@/lib/credentials/certificate-service';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const certCode = decodeURIComponent(params.id);
    const body = await request.json();

    if (!body.reason) {
      return NextResponse.json({ success: false, error: 'Revocation reason is mandatory.' }, { status: 400 });
    }

    await certificateService.revokeCertificate({
      certificateCode: certCode,
      reason: body.reason,
      revokedBy: body.revokedBy || 'admin',
    });

    return NextResponse.json({ success: true, message: `Certificate ${certCode} has been revoked.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

