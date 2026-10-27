import { NextResponse } from 'next/server';
import { db, PERMISSION_REGISTRY } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { actor } = authResult;

    const config = await db.getAdminOverview(actor.email);

    return NextResponse.json({ success: true, data: config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
