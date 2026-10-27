import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const cert = await db.verifyCertificate(params.code);
    if (!cert) {
      return NextResponse.json({
        verified: false,
        error: 'Certificate record not found in authoritative Zealosh registry.',
      }, { status: 404 });
    }

    return NextResponse.json({
      verified: true,
      certificate: cert,
      status: cert.status,
      issuedTo: cert.userName,
      course: cert.courseTitle,
      date: cert.issueDate,
      score: cert.scorePercent,
    });
  } catch (err: any) {
    return NextResponse.json({ verified: false, error: err.message }, { status: 500 });
  }
}
