import { NextResponse } from 'next/server';
import { inMemoryIssuedCertificates, certificateService } from '@/lib/credentials/certificate-service';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const certCode = decodeURIComponent(params.id);
    let cert = inMemoryIssuedCertificates.get(certCode);

    if (!cert) {
      // Also try finding by id
      cert = Array.from(inMemoryIssuedCertificates.values()).find((c) => c.id === params.id);
    }

    if (!cert) {
      return NextResponse.json({ success: false, error: 'Certificate not found' }, { status: 404 });
    }

    let pdfBuffer = cert.pdfBuffer;
    if (!pdfBuffer) {
      const verificationUrl = `https://zealosh.com/verify/${encodeURIComponent(cert.certificateCode)}`;
      pdfBuffer = certificateService.renderCertificatePdf(cert, verificationUrl);
    }

    const safeFilename = `${cert.certificateCode.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

