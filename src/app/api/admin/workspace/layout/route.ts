import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { WorkspaceLayout } from '@/types';

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

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const layout = await db.getWorkspaceLayout(user.userId, user.role);
    return NextResponse.json(layout);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to retrieve workspace layout' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Layout customization requires administrative privileges' }, { status: 403 });
    }

    const body = await request.json();
    const { widgetsConfig, layoutName } = body;
    if (!Array.isArray(widgetsConfig)) {
      return NextResponse.json({ error: 'widgetsConfig array is required' }, { status: 400 });
    }

    // Validate widget configs
    for (const w of widgetsConfig) {
      if (!w.id || !w.component || typeof w.order !== 'number' || typeof w.colSpan !== 'number') {
        return NextResponse.json({ error: 'Each widget must have id, component, numeric order and numeric colSpan' }, { status: 400 });
      }
      if (w.colSpan < 1 || w.colSpan > 12) {
        return NextResponse.json({ error: 'Widget colSpan must be between 1 and 12' }, { status: 400 });
      }
    }

    const layout: WorkspaceLayout = {
      id: `lay-${user.userId}-${Date.now()}`,
      userId: user.userId,
      role: user.role,
      layoutName: layoutName || 'DEFAULT',
      widgetsConfig,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.saveWorkspaceLayout(layout);
    return NextResponse.json(saved, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save workspace layout' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const resetLayout = await db.resetWorkspaceLayout(user.userId, user.role);
    return NextResponse.json({ success: true, layout: resetLayout });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reset workspace layout' }, { status: 500 });
  }
}
