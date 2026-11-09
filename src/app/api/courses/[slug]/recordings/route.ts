// Zealosh LMS — Course Recordings API Route
// GET /api/courses/[slug]/recordings — Lists authorized recordings for the caller in course context

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { resolveCourseRecordings } from '@/lib/store/course-recording-resolver';

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

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tokenOrgId = (payload as { organizationId?: string }).organizationId;
    const result = await resolveCourseRecordings(payload.userId, params.slug, {
      tokenOrganizationId: tokenOrgId,
    });

    if (!result.success) {
      const status = result.statusCode || (result.error === 'COURSE_NOT_FOUND' ? 404 : 500);
      return NextResponse.json({ error: result.error || 'Failed to resolve course recordings' }, { status });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error resolving course recordings' },
      { status: 500 }
    );
  }
}

