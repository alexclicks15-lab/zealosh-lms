import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { isSupabaseConfigured, createUserAuthClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, phone, role, studentDetails } = body;

    // Institutional registration mode check
    const platformSettings = await db.getPlatformSettings();
    if (platformSettings?.registrationMode === 'DISABLED') {
      return NextResponse.json(
        { error: 'Public registration is currently disabled by institutional policy.' },
        { status: 403 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 10) {
      return NextResponse.json(
        { error: 'Password must be at least 10 characters long and include uppercase, lowercase, number, and special character' },
        { status: 400 }
      );
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return NextResponse.json(
        { error: 'Password does not meet complexity criteria (must include uppercase, lowercase, number, and special character)' },
        { status: 400 }
      );
    }

    // Server-enforced role boundary: Self-registration NEVER grants privileged roles
    if (role && role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'Self-registration is restricted to STUDENT role only. Administrative and instructor roles require administrative invitation.' },
        { status: 403 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await db.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // In production Supabase environment, synchronize user identity via standard client signUp (unconfirmed)
    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      const userAuthClient = createUserAuthClient();
      if (userAuthClient) {
        const { data: authData, error: authErr } = await userAuthClient.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name: name.trim(),
              role: 'STUDENT',
            },
          },
        });
        if (authErr) {
          if (authErr.message?.toLowerCase().includes('already registered')) {
            return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
          }
          return NextResponse.json({ error: authErr.message }, { status: 500 });
        }
      }
    }

    // Register student with autoVerify: false — generates verification token and sets PENDING_VERIFICATION
    const registered = await db.registerStudent({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone ? String(phone).trim() : undefined,
      studentDetails,
      autoVerify: false,
    });

    // Unverified registrations do not issue session cookies or active tokens
    return NextResponse.json(
      {
        success: true,
        pendingVerification: true,
        emailVerified: false,
        message: 'Student account registered successfully. Please verify your email before logging in.',
        user: {
          id: registered.user.id,
          name: registered.user.name,
          email: registered.user.email,
          role: registered.user.role,
        },
        profile: registered.profile,
        studentProfile: registered.studentProfile,
        verificationToken: registered.profile?.emailVerificationToken,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.message && err.message.includes('already exists')) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status: 500 });
  }
}
