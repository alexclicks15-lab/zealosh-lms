import { NextResponse } from 'next/server';
import { AdmissionsPipelineService } from '@/lib/admissions/admissions-pipeline';
import { verifyToken } from '@/lib/auth/jwt';
import { AdmissionsPipelineStage } from '@/types';

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
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'FORBIDDEN: Manual admission overrides strictly require SUPER_ADMIN authority' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetStage, reason } = body;

    if (!targetStage || !reason) {
      return NextResponse.json(
        { error: 'targetStage and a detailed reason are strictly required for administrative overrides' },
        { status: 400 }
      );
    }

    const updated = await AdmissionsPipelineService.transitionStage({
      applicationId: params.id,
      targetStage: targetStage as AdmissionsPipelineStage,
      actorUserId: user.userId,
      reason,
      isOverride: true,
    });

    return NextResponse.json({
      success: true,
      message: `Administrative override executed: Application forced to ${targetStage}`,
      application: updated,
    });
  } catch (err: any) {
    const status = err.message.includes('not found')
      ? 404
      : err.message.includes('OVERRIDE_REASON_MANDATORY')
      ? 400
      : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

