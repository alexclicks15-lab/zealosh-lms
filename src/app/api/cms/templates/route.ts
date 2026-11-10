// Zealosh LMS — CMS Templates API
// GET /api/cms/templates — List templates (supports ?pageType= and ?category= filters)
// POST /api/cms/templates — Save new page/section template

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeCmsOperation } from '@/lib/auth/rbac';
import { CmsTemplate } from '@/types/cms';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageType = searchParams.get('pageType');
    const category = searchParams.get('category');
    const systemOnly = searchParams.get('system') === 'true';

    let templates = await db.getCmsTemplates();

    if (pageType) {
      templates = templates.filter((t) => t.pageType === pageType);
    }
    if (category) {
      templates = templates.filter((t) => t.category.toUpperCase() === category.toUpperCase());
    }
    if (systemOnly) {
      templates = templates.filter((t) => t.isSystem);
    }

    return NextResponse.json({ success: true, templates, total: templates.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = authorizeCmsOperation(request, 'MANAGE_TEMPLATES');
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { actor } = authResult;

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
      pageType: body.pageType || 'STANDARD',
      isSystem: body.isSystem && actor.role === 'SUPER_ADMIN' ? true : false,
      previewImageUrl: body.previewImageUrl,
      nodesSnapshot: body.nodesSnapshot,
      createdBy: actor.userId,
      createdAt: new Date().toISOString(),
    };

    const saved = await db.saveCmsTemplate(template, actor.userId);
    return NextResponse.json({ success: true, template: saved }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save template' }, { status: 400 });
  }
}

