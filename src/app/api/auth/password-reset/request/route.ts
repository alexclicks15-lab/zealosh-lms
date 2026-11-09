import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const reset = await db.requestPasswordReset(email.trim());

    // In non-production or for testing, return token in response; in prod, keep quiet for privacy
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, password reset instructions have been dispatched.',
      token: process.env.NODE_ENV !== 'production' && reset ? reset.token : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Password reset request failed' }, { status: 500 });
  }
}

