import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { isSupabaseConfigured, getSupabaseAdminClient } from '@/lib/supabase';

async function handleVerification(token: string | null) {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
  }

  try {
    const result = await db.verifyStudentEmail(token.trim());

    // In production Supabase environment, synchronize email_confirm status in Supabase Auth
    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      const adminClient = getSupabaseAdminClient();
      if (adminClient) {
        await adminClient.auth.admin.updateUserById(result.userId, {
          email_confirm: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Email address verified successfully. You may now log in to your account.',
      userId: result.userId,
      email: result.email,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Invalid or expired email verification token' },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return await handleVerification(body.token);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  return await handleVerification(token);
}

