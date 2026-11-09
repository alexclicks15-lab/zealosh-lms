import { NextResponse } from 'next/server';
import { certificateService } from '@/lib/credentials/certificate-service';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const manifest = body.manifest;
      const trustedPublicKey = body.trustedPublicKeyPem;

      const result = certificateService.verifyOffline(manifest, trustedPublicKey);
      return NextResponse.json({ success: true, ...result });
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/pdf')) {
      const arrayBuffer = await request.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      const result = certificateService.verifyOffline(pdfBuffer);
      return NextResponse.json({ success: true, ...result });
    } else {
      return NextResponse.json({ success: false, error: 'Unsupported Content-Type' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

