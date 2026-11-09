import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
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

const ALL_14_STAGES: AdmissionsPipelineStage[] = [
  'NEW',
  'CONTACTED',
  'APPLICATION_STARTED',
  'SUBMITTED',
  'DOCUMENT_REVIEW',
  'ELIGIBILITY_REVIEW',
  'ORIENTATION_PENDING',
  'APPROVED',
  'OFFER_PAYMENT_PENDING',
  'ADMITTED',
  'WAITLISTED',
  'REJECTED',
  'WITHDRAWN',
  'CLOSED',
];

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'INSTRUCTOR')) {
      return NextResponse.json({ error: 'Unauthorized to access admissions pipeline' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || undefined;
    const stage = searchParams.get('stage') || undefined;
    const search = searchParams.get('search') || undefined;

    const allApplications = await db.getAdmissionApplications({ courseId, search });

    // Group counts by the 14 stages
    const stageCounts: Record<string, number> = {};
    for (const s of ALL_14_STAGES) {
      stageCounts[s] = 0;
    }

    const grouped: Record<string, any[]> = {};
    for (const s of ALL_14_STAGES) {
      grouped[s] = [];
    }

    for (const app of allApplications) {
      const appStage = (app.pipelineStage || app.status) as AdmissionsPipelineStage;
      const normalizedStage = ALL_14_STAGES.includes(appStage) ? appStage : 'SUBMITTED';
      stageCounts[normalizedStage] = (stageCounts[normalizedStage] || 0) + 1;

      if (!stage || stage === normalizedStage) {
        grouped[normalizedStage].push(app);
      }
    }

    return NextResponse.json({
      success: true,
      stages: ALL_14_STAGES,
      stageCounts,
      totalApplications: allApplications.length,
      applications: stage ? grouped[stage] : allApplications,
      groupedByStage: grouped,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
