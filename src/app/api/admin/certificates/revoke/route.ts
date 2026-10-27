import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { code, reason } = await request.json();
    if (!code) {
      return NextResponse.json({ success: false, error: 'Certificate code required' }, { status: 400 });
    }
    const revoked = await db.revokeCertificate(code, reason);
    return NextResponse.json({ success: true, certificate: revoked });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
