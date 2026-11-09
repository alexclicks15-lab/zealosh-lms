import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { isSupabaseConfigured, getSupabaseAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Valid password reset token is required' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 10) {
      return NextResponse.json(
        { error: 'Password must be at least 10 characters long and include uppercase, lowercase, number, and special character' },
        { status: 400 }
      );
    }

    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return NextResponse.json(
        { error: 'Password does not meet complexity criteria (must include uppercase, lowercase, number, and special character)' },
        { status: 400 }
      );
    }

    const resetResult = await db.confirmPasswordReset(token, newPassword);

    // In production Supabase environment, synchronize new credentials with Supabase Auth
    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      const adminClient = getSupabaseAdminClient();
      if (adminClient && resetResult?.userId) {
        await adminClient.auth.admin.updateUserById(resetResult.userId, { password: newPassword });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Password has been updated successfully. Please log in with your new credentials.',
    });
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes('Invalid or already used') ||
        err.message.includes('expired') ||
        err.message.includes('not found'))
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Password reset confirmation failed' }, { status: 500 });
  }
}
