import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { comparePassword, signToken } from '@/lib/auth/jwt';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = Array.from(db.users.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase().trim()
    );

    if (!user || !comparePassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = signToken(user);

    db.recordAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_LOGIN_SUCCESS',
      entityType: 'AUTH',
      entityId: user.id,
      details: { role: user.role },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      token,
    });

    // Set httpOnly cookie for session security
    response.cookies.set('zealosh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication failed' }, { status: 500 });
  }
}
