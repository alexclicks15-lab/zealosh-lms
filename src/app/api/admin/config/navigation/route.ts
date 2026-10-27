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

    const { navigation, reason } = await request.json();
    if (!navigation || !Array.isArray(navigation)) {
      return NextResponse.json({ success: false, error: 'Valid navigation array required' }, { status: 400 });
    }

    const updated = await db.updateNavigationConfig(navigation, actor.email, actor.userId, reason);
    return NextResponse.json({ success: true, navigationConfig: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
