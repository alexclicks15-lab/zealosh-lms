import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { serviceName } = await request.json();
    if (!serviceName) {
      return NextResponse.json({ success: false, error: 'serviceName required' }, { status: 400 });
    }

    const result = db.testIntegrationConnection(serviceName);
    return NextResponse.json({ success: result.success, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
