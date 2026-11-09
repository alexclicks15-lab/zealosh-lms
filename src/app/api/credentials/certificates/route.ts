import { NextResponse } from 'next/server';
import { certificateService, inMemoryIssuedCertificates } from '@/lib/credentials/certificate-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const courseId = searchParams.get('courseId');

    let certs = Array.from(inMemoryIssuedCertificates.values());
    if (studentId) {
      certs = certs.filter((c) => c.studentId === studentId);
    }
    if (courseId) {
      certs = certs.filter((c) => c.courseId === courseId);
    }

    // Clean certificates for listing
    const sanitized = certs.map((c) => ({
      id: c.id,
      certificateCode: c.certificateCode,
      studentName: c.studentName,
      courseTitle: c.courseTitle,
      certificationType: c.certificationType,
      issueDate: c.issueDate,
      completionDate: c.completionDate,
      scorePercent: c.scorePercent,
      status: c.status,
      keyId: c.keyId,
    }));

    return NextResponse.json({ success: true, count: sanitized.length, certificates: sanitized });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'ISSUE';

    if (action === 'EVALUATE_ELIGIBILITY') {
      const evaluation = await certificateService.evaluateEligibility(body.studentId, body.courseId);
      return NextResponse.json({ success: true, evaluation });
    }

    if (action === 'ISSUE') {
      const result = await certificateService.issueCertificate({
        studentId: body.studentId,
        studentName: body.studentName,
        courseId: body.courseId,
        courseTitle: body.courseTitle,
        certificationType: body.certificationType,
        scorePercent: body.scorePercent,
        completionDate: body.completionDate,
        issuedBy: body.issuedBy,
      });

      return NextResponse.json({
        success: true,
        manifest: result.manifest,
        verificationUrl: result.verificationUrl,
      }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

