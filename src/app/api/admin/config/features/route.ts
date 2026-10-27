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

    const { flags, reason } = await request.json();
    if (!flags) {
      return NextResponse.json({ success: false, error: 'Flags payload required' }, { status: 400 });
    }

    // Strict capability gate: only SUPER_ADMIN can modify aiTutorEnabled
    if (flags.aiTutorEnabled !== undefined && actor.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only Superadmin can modify the AI Tutor capability' },
        { status: 403 }
      );
    }

    const updated = await db.updateFeatureFlags(flags, actor.email, actor.userId, reason);
    return NextResponse.json({ success: true, featureFlags: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
