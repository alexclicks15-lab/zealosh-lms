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

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized to view provisioning jobs' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') as any) || undefined;
    const courseId = searchParams.get('courseId') || undefined;

    const jobs = await ProvisioningOrchestrator.listJobs({ status, courseId });

    // Fetch step details for each job
    const jobsWithSteps = await Promise.all(
      jobs.map(async (job) => {
        const steps = await ProvisioningOrchestrator.getJobSteps(job.id);
        return {
          ...job,
          steps,
        };
      })
    );

    return NextResponse.json({
      success: true,
      jobs: jobsWithSteps,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

