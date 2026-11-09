// Zealosh LMS — CMS Reusable Blocks API
// GET /api/cms/reusable-blocks — List reusable sections and blocks
// POST /api/cms/reusable-blocks — Save block

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { CmsReusableBlock } from '@/types/cms';

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
    const blocks = await db.getCmsReusableBlocks();
    return NextResponse.json({ success: true, blocks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list reusable blocks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.name || !body.nodesSnapshot) {
      return NextResponse.json({ error: 'Name and nodesSnapshot are required' }, { status: 400 });
    }

    const blockId = `blk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const block: CmsReusableBlock = {
      id: blockId,
      name: body.name.trim(),
      category: body.category || 'SECTIONS',
      nodesSnapshot: body.nodesSnapshot,
      createdBy: payload.userId,
      createdAt: new Date().toISOString(),
    };

    const saved = await db.saveCmsReusableBlock(block, payload.userId);
    return NextResponse.json({ success: true, block: saved }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save reusable block' }, { status: 400 });
  }
}

