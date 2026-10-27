import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { template } = await request.json();
    if (!template || !template.channel || !template.trigger) {
      return NextResponse.json({ success: false, error: 'Valid template payload required' }, { status: 400 });
    }
    if (!template.id) template.id = `tpl-${Date.now().toString(36)}`;
    const saved = await db.saveNotificationTemplate(template);
    return NextResponse.json({ success: true, template: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
