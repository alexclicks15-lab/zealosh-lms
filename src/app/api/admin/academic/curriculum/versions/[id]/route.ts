import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

function getAuthUser(request: Request) {
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const version = await db.getSyllabusVersion(id);
    if (!version) {
      return NextResponse.json({ error: 'Syllabus version not found' }, { status: 404 });
    }

    return NextResponse.json(version);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to retrieve syllabus version' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'PUBLISH') {
      const updated = await db.publishSyllabusVersion(id, user.userId);
      if (!updated) {
        return NextResponse.json({ error: 'Syllabus version not found' }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid action. Supported: PUBLISH' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update syllabus version' }, { status: 500 });
  }
}
