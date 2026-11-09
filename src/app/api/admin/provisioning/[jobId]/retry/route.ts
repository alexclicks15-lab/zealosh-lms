import { NextResponse } from 'next/server';
import { ProvisioningOrchestrator } from '@/lib/admissions/provisioning-orchestrator';
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
  { params }: { params: { jobId: string } }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized to retry provisioning jobs' }, { status: 403 });
    }

    const result = await ProvisioningOrchestrator.retryProvisioningJob(params.jobId);

    return NextResponse.json({
      success: true,
      message: `Provisioning job ${params.jobId} retry initiated`,
      job: result.job,
      steps: result.steps,
    });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

