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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { documentId, action, rejectionReason, requestResubmission } = body;

    if (!documentId || !action) {
      return NextResponse.json(
        { error: 'documentId and action (VERIFY | REJECT) are required' },
        { status: 400 }
      );
    }

    if (action === 'VERIFY') {
      const verifiedDoc = await AdmissionsPipelineService.verifyDocument(documentId, user.userId);
      return NextResponse.json({
        success: true,
        message: 'Document successfully verified',
        document: verifiedDoc,
      });
    }

    if (action === 'REJECT') {
      if (!rejectionReason) {
        return NextResponse.json({ error: 'rejectionReason is required' }, { status: 400 });
      }
      const rejectedDoc = await AdmissionsPipelineService.rejectDocument({
        documentId,
        reviewerUserId: user.userId,
        rejectionReason,
        requestResubmission: Boolean(requestResubmission),
      });
      return NextResponse.json({
        success: true,
        message: requestResubmission ? 'Resubmission requested from applicant' : 'Document rejected',
        document: rejectedDoc,
      });
    }

    return NextResponse.json({ error: 'Invalid action. Must be VERIFY or REJECT' }, { status: 400 });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

