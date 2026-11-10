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

export async function GET() {
  try {
    const tree = await db.getAcademicTree();
    return NextResponse.json({
      success: true,
      tree: tree.departments,
      departments: tree.departments,
      academicYears: tree.academicYears,
      academicTree: tree,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve academic hierarchy tree' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const body = await request.json();
    const { action, items } = body;

    if (action === 'REORDER' && Array.isArray(items)) {
      // Validate acyclic hierarchy structure
      const seen = new Set<string>();
      for (const item of items) {
        if (!item.id || typeof item.sortOrder !== 'number') {
          return NextResponse.json({ error: 'Each item must have an id and numeric sortOrder' }, { status: 400 });
        }
        if (seen.has(item.id)) {
          return NextResponse.json({ error: `Cyclic or duplicate node reference detected: ${item.id}` }, { status: 400 });
        }
        seen.add(item.id);
      }

      for (const item of items) {
        // Try updating module, topic, or subtopic
        const mod = await db.getModule(item.id);
        if (mod) {
          mod.displayOrder = item.sortOrder;
          continue;
        }
        const top = await db.getTopic(item.id);
        if (top) {
          top.displayOrder = item.sortOrder;
          continue;
        }
        const sub = await db.getSubtopic(item.id);
        if (sub) {
          sub.displayOrder = item.sortOrder;
          continue;
        }
      }

      return NextResponse.json({ success: true, reorderedCount: items.length });
    }

    return NextResponse.json({ error: 'Invalid action. Supported: REORDER' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update academic tree' }, { status: 500 });
  }
}
