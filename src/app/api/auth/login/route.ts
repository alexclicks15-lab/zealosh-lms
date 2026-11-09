import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { comparePassword, signToken } from '@/lib/auth/jwt';
import {
  isLockoutBypassAllowed,
  evaluateAccountLockout,
  recordFailedLogin,
  resetAccountLockout,
} from '@/lib/auth/lockout';
import { lockoutService } from '@/lib/auth/lockout-service';
import { sessionRegistry } from '@/lib/auth/session-registry';
import { isSupabaseConfigured, createUserAuthClient } from '@/lib/supabase';
import { syncGoTrueUserToProfile } from '@/lib/auth/gotrue-sync';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const clientIp = request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const user = await db.getUserByEmail(normalizedEmail);
    const profile = user ? await db.getProfile(user.id) : await db.getProfile(normalizedEmail);

    // Check email verification requirement
    if (profile && (profile.status === 'PENDING_VERIFICATION' || profile.emailVerified === false)) {
      await db.recordAuthAuditEvent({
        actorUserId: user?.id,
        actorEmail: normalizedEmail,
        action: 'LOGIN_REJECTED_UNVERIFIED_EMAIL',
        entityType: 'AUTH',
        entityId: user?.id,
      });
      return NextResponse.json(
        {
          error: 'Email verification required. Please verify your email before logging in.',
          code: 'EMAIL_VERIFICATION_REQUIRED',
        },
        { status: 403 }
      );
    }

    // Check database-backed concurrency-safe account lockout
    const dbLockoutStatus = await lockoutService.checkLockout(normalizedEmail);
    const isLockoutBypassed = isLockoutBypassAllowed();
    const memoryLockoutStatus = evaluateAccountLockout(profile, isLockoutBypassed);

    const isLocked = !isLockoutBypassed && (dbLockoutStatus.isLocked || memoryLockoutStatus.isLocked);
    const remainingMinutes = Math.max(dbLockoutStatus.remainingMinutes, memoryLockoutStatus.remainingMinutes, 1);

    if (isLocked) {
      await db.recordAuthAuditEvent({
        actorUserId: user?.id,
        actorEmail: normalizedEmail,
        action: 'LOGIN_REJECTED_LOCKED_ACCOUNT',
        entityType: 'AUTH',
        entityId: user?.id,
        details: { remainingMinutes },
      });
      return NextResponse.json(
        { error: `Account is temporarily locked due to excessive failed attempts. Please try again in ${remainingMinutes} minutes.` },
        { status: 423 }
      );
    } else if (profile && !profile.lockedUntil && profile.failedLoginCount === 0) {
      await db.saveProfile(profile);
    }

    // Check account status
    if (profile && profile.status === 'SUSPENDED') {
      await db.recordAuthAuditEvent({
        actorUserId: user?.id,
        actorEmail: normalizedEmail,
        action: 'LOGIN_REJECTED_SUSPENDED_ACCOUNT',
        entityType: 'AUTH',
        entityId: user?.id,
      });
      return NextResponse.json(
        { error: 'Account has been suspended. Please contact institutional administration.' },
        { status: 403 }
      );
    }

    // In production Supabase environment, authenticate via request-isolated user auth client
    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      const userAuthClient = createUserAuthClient();
      if (userAuthClient) {
        const { data: authData, error: authErr } = await userAuthClient.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (authErr) {
          // If database user exists and password hash matches (e.g. pre-seeded institutional accounts), permit fallback
          const isFallbackValid = user ? comparePassword(password, user.passwordHash) : false;
          if (!isFallbackValid) {
            const dbAttempt = await lockoutService.recordFailedAttempt(normalizedEmail, clientIp);
            if (profile) {
              const memAttempt = recordFailedLogin(profile, isLockoutBypassed);
              await db.saveProfile(profile);
            }

            if (dbAttempt.isLocked) {
              await db.recordAuthAuditEvent({
                actorUserId: user?.id,
                actorEmail: normalizedEmail,
                action: 'LOGIN_REJECTED_LOCKED_ACCOUNT',
                entityType: 'AUTH',
                entityId: user?.id,
                details: { remainingMinutes: dbAttempt.remainingMinutes },
              });

              return NextResponse.json(
                { error: `Account is temporarily locked due to excessive failed attempts. Please try again in ${dbAttempt.remainingMinutes} minutes.` },
                { status: 423 }
              );
            }

            await db.recordAuthAuditEvent({
              actorUserId: user?.id,
              actorEmail: normalizedEmail,
              action: 'USER_LOGIN_FAILED',
              entityType: 'AUTH',
              entityId: user?.id,
              details: { failedAttempts: dbAttempt.failedAttempts, reason: authErr.message },
            });

            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
          }
        } else if (authData?.user) {
          // Sync GoTrue user to application profile
          await syncGoTrueUserToProfile({
            id: authData.user.id,
            email: authData.user.email || normalizedEmail,
            user_metadata: authData.user.user_metadata,
            created_at: authData.user.created_at,
            updated_at: authData.user.updated_at,
          });
        }
      }
    }

    // Local / In-memory credential verification
    const passwordValid = user ? comparePassword(password, user.passwordHash) : false;

    if (!user || !passwordValid) {
      const dbAttempt = await lockoutService.recordFailedAttempt(normalizedEmail, clientIp);
      if (profile) {
        recordFailedLogin(profile, isLockoutBypassed);
        await db.saveProfile(profile);
      }

      if (dbAttempt.isLocked) {
        await db.recordAuthAuditEvent({
          actorUserId: user?.id,
          actorEmail: normalizedEmail,
          action: 'LOGIN_REJECTED_LOCKED_ACCOUNT',
          entityType: 'AUTH',
          entityId: user?.id,
          details: { remainingMinutes: dbAttempt.remainingMinutes },
        });

        return NextResponse.json(
          { error: `Account is temporarily locked due to excessive failed attempts. Please try again in ${dbAttempt.remainingMinutes} minutes.` },
          { status: 423 }
        );
      }

      await db.recordAuthAuditEvent({
        actorUserId: user?.id,
        actorEmail: normalizedEmail,
        action: 'USER_LOGIN_FAILED',
        entityType: 'AUTH',
        entityId: user?.id,
        details: { failedAttempts: dbAttempt.failedAttempts },
      });

      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Successful login: reset failed attempt counters across database and memory
    await lockoutService.recordSuccessfulLogin(normalizedEmail, clientIp);
    if (profile) {
      resetAccountLockout(profile);
      await db.saveProfile(profile);
    }

    const tokenVersion = profile?.tokenVersion ?? user.tokenVersion ?? 1;

    // Pre-create token to register with session registry
    const rawToken = signToken({
      ...user,
      tokenVersion,
    });

    // Register active session in registry
    const registeredSession = await sessionRegistry.registerSession({
      userId: user.id,
      token: rawToken,
      ipAddress: clientIp,
      userAgent,
    });

    // Sign final token embedding sessionId
    const token = signToken({
      ...user,
      sessionId: registeredSession.id,
      tokenVersion,
    });

    await db.recordAuthAuditEvent({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_LOGIN_SUCCESS',
      entityType: 'AUTH',
      entityId: user.id,
      details: { sessionId: registeredSession.id, role: user.role, tokenVersion },
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
      sessionId: registeredSession.id,
    });

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
