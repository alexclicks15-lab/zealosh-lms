// Zealosh LMS — CMS Templates API
// GET /api/cms/templates — List templates
// POST /api/cms/templates — Save new page/section template

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { CmsTemplate } from '@/types/cms';

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
    const templates = await db.getCmsTemplates();
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list templates' }, { status: 500 });
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

    const templateId = `tpl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const template: CmsTemplate = {
      id: templateId,
      name: body.name.trim(),
      description: body.description || '',
      category: body.category || 'GENERAL',
      templateType: body.templateType || 'PAGE',
      previewImageUrl: body.previewImageUrl,
      nodesSnapshot: body.nodesSnapshot,
      createdBy: payload.userId,
      createdAt: new Date().toISOString(),
    };

    const saved = await db.saveCmsTemplate(template, payload.userId);
    return NextResponse.json({ success: true, template: saved }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save template' }, { status: 400 });
  }
}

