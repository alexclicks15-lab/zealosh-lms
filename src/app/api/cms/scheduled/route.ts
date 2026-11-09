// Zealosh LMS — CMS Scheduled Publications Collection & Operational Trigger API
// GET /api/cms/scheduled — List scheduled publication jobs
// POST /api/cms/scheduled — Trigger an immediate scheduled publisher worker tick

import { NextResponse } from 'next/server';
import { cmsService } from '@/lib/cms/cms-service';
import { cmsScheduledPublisherWorker } from '@/lib/cms/scheduled-publisher-worker';
import { verifyToken } from '@/lib/auth/jwt';
import { handleCmsApiError } from '@/lib/cms/api-response';
import { CmsPublicationJobStatus } from '@/types/cms';

function extractUserToken(request: Request) {
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
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'COURSE_MANAGER'];
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId') || undefined;
    const status = (searchParams.get('status') as CmsPublicationJobStatus) || undefined;

    const jobs = await cmsService.getScheduledPublications({ pageId, status });

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
    });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to list scheduled publications');
  }
}

export async function POST(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const allowedRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'COURSE_MANAGER'];
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const tickResult = await cmsScheduledPublisherWorker.executeTick();

    return NextResponse.json({
      success: true,
      workerId: cmsScheduledPublisherWorker.getWorkerId(),
      result: tickResult,
    });
  } catch (error: any) {
    return handleCmsApiError(error, 'Failed to execute scheduled publisher worker tick');
  }
}

