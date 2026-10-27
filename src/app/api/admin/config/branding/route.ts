import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function PUT(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { actor } = authResult;

    const { theme, reason } = await request.json();
    if (!theme) {
      return NextResponse.json({ success: false, error: 'Theme payload required' }, { status: 400 });
    }

    const updated = await db.updateBrandingTheme(theme, actor.email, actor.userId, reason);
    return NextResponse.json({ success: true, theme: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
