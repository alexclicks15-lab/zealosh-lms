import { NextResponse } from 'next/server';
import { certificateService } from '@/lib/credentials/certificate-service';

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const code = decodeURIComponent(params.code);
    const result = await certificateService.verifyOnline(code);

    if (!result.certificate || result.status === 'NOT_FOUND') {
      return NextResponse.json({
        verified: false,
        status: 'NOT_FOUND',
        error: 'Certificate record not found in authoritative Zealosh registry.',
      }, { status: 404 });
    }

    // STRICT ZERO PII LEAKAGE: return strictly public verification metadata
    return NextResponse.json({
      verified: true,
      status: result.status,
      issuedTo: result.certificate.studentName,
      course: result.certificate.courseTitle,
      certificationType: result.certificate.certificationType,
      date: result.certificate.issueDate,
      completionDate: result.certificate.completionDate,
      score: result.certificate.scorePercent,
      cryptographicValidation: result.cryptographicValidation,
      certificate: {
        certificateCode: result.certificate.certificateCode,
        studentName: result.certificate.studentName,
        userName: result.certificate.studentName,
        courseTitle: result.certificate.courseTitle,
        certificationType: result.certificate.certificationType,
        issueDate: result.certificate.issueDate,
        scorePercent: result.certificate.scorePercent,
        status: result.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ verified: false, error: err.message }, { status: 500 });
  }
}

