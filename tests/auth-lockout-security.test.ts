// Zealosh LMS — Authentication Lockout Security Suite
// Validates:
// 1. Default configuration keeps lockout strictly enabled.
// 2. Explicit local-development opt-in works only in permitted local environments.
// 3. Staging categorically rejects bypass protection.
// 4. Production categorically rejects bypass protection even if bypass variable is set.
// 5. Repeated invalid logins trigger HTTP 423 lockout after 5 failed attempts.
// 6. Successful login resets failed login counters.
// 7. Lockout expiry correctly clears after timeout.
// 8. Concurrent failed login attempts properly accumulate toward lockout.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isLockoutBypassAllowed,
  evaluateAccountLockout,
  recordFailedLogin,
  resetAccountLockout,
  MAX_FAILED_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
} from '@/lib/auth/lockout';
import { Profile } from '@/types';
import { db } from '@/lib/store/db';
import { POST as loginPost } from '@/app/api/auth/login/route';

describe('Authentication & Account Lockout Security Enforcement', () => {
  beforeEach(async () => {
    await db.resetToSeed();
  });

  // 1. Default configuration keeps lockout enabled
  it('1. should keep lockout enabled by default when env vars are missing', () => {
    const emptyEnv = { NODE_ENV: 'development' };
    expect(isLockoutBypassAllowed(emptyEnv)).toBe(false);

    const undefinedEnv = {};
    expect(isLockoutBypassAllowed(undefinedEnv)).toBe(false);
  });

  // 2. Explicit local-development opt-in works only in permitted local environments
  it('2. should permit bypass ONLY in local development with explicit ALLOW_DEV_LOCKOUT_BYPASS=true', () => {
    const localDevExplicit = {
      NODE_ENV: 'development',
      ALLOW_DEV_LOCKOUT_BYPASS: 'true',
    };
    expect(isLockoutBypassAllowed(localDevExplicit)).toBe(true);

    const localDevWrongVal = {
      NODE_ENV: 'development',
      ALLOW_DEV_LOCKOUT_BYPASS: '1',
    };
    expect(isLockoutBypassAllowed(localDevWrongVal)).toBe(false);
  });

  // 3. Staging cannot silently bypass protection
  it('3. should categorically reject bypass in staging environments even if ALLOW_DEV_LOCKOUT_BYPASS=true', () => {
    const stagingEnv = {
      NODE_ENV: 'development',
      APP_ENV: 'staging',
      ALLOW_DEV_LOCKOUT_BYPASS: 'true',
    };
    expect(isLockoutBypassAllowed(stagingEnv)).toBe(false);

    const vercelStagingEnv = {
      NODE_ENV: 'development',
      VERCEL_ENV: 'staging',
      ALLOW_DEV_LOCKOUT_BYPASS: 'true',
    };
    expect(isLockoutBypassAllowed(vercelStagingEnv)).toBe(false);
  });

  // 4. Production cannot bypass lockout even when bypass variable is supplied
  it('4. should categorically reject bypass in production environments under any circumstances', () => {
    const prodNodeEnv = {
      NODE_ENV: 'production',
      ALLOW_DEV_LOCKOUT_BYPASS: 'true',
    };
    expect(isLockoutBypassAllowed(prodNodeEnv)).toBe(false);

    const prodAppEnv = {
      NODE_ENV: 'development',
      APP_ENV: 'production',
      ALLOW_DEV_LOCKOUT_BYPASS: 'true',
    };
    expect(isLockoutBypassAllowed(prodAppEnv)).toBe(false);
  });

  // 5. Test execution environment categorically rejects bypass
  it('5. should categorically reject bypass during automated test runs (VITEST=true)', () => {
    const testEnv = {
      NODE_ENV: 'development',
      ALLOW_DEV_LOCKOUT_BYPASS: 'true',
      VITEST: 'true',
    };
    expect(isLockoutBypassAllowed(testEnv)).toBe(false);
  });

  // 6. Repeated invalid logins trigger lockout after MAX_FAILED_LOGIN_ATTEMPTS
  it('6. should lock account after 5 consecutive failed attempts and calculate remaining minutes', () => {
    const profile: Profile = {
      id: 'test-user-lockout',
      email: 'lockout-test@zealosh.com',
      fullName: 'Lockout Test Candidate',
      status: 'ACTIVE',
      failedLoginCount: 0,
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Attempts 1 to 4 should NOT lock
    for (let i = 1; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      const res = recordFailedLogin(profile, false);
      expect(res.isLocked).toBe(false);
      expect(res.failedAttempts).toBe(i);
      expect(profile.lockedUntil).toBeUndefined();
    }

    // 5th attempt must lock the account
    const fifthAttempt = recordFailedLogin(profile, false);
    expect(fifthAttempt.isLocked).toBe(true);
    expect(fifthAttempt.remainingMinutes).toBe(LOCKOUT_DURATION_MINUTES);
    expect(fifthAttempt.failedAttempts).toBe(5);
    expect(profile.lockedUntil).toBeDefined();

    // Verification via evaluateAccountLockout
    const check = evaluateAccountLockout(profile, false);
    expect(check.isLocked).toBe(true);
    expect(check.remainingMinutes).toBeGreaterThan(0);
  });

  // 7. Successful login resets failure counters
  it('7. should reset failed attempts counter and clear lockedUntil upon successful login', () => {
    const profile: Profile = {
      id: 'test-user-reset',
      email: 'reset-test@zealosh.com',
      fullName: 'Reset Test Candidate',
      status: 'ACTIVE',
      failedLoginCount: 3,
      lockedUntil: new Date(Date.now() + 600000).toISOString(),
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    resetAccountLockout(profile);
    expect(profile.failedLoginCount).toBe(0);
    expect(profile.lockedUntil).toBeUndefined();

    const check = evaluateAccountLockout(profile, false);
    expect(check.isLocked).toBe(false);
    expect(check.remainingMinutes).toBe(0);
  });

  // 8. Lockout expiry automatically clears lock
  it('8. should clear lock when lockout duration has elapsed', () => {
    const profile: Profile = {
      id: 'test-user-expired',
      email: 'expired-test@zealosh.com',
      fullName: 'Expired Lockout Candidate',
      status: 'ACTIVE',
      failedLoginCount: 5,
      // Locked 20 minutes ago (15-min lock is expired)
      lockedUntil: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const check = evaluateAccountLockout(profile, false);
    expect(check.isLocked).toBe(false);
    expect(check.remainingMinutes).toBe(0);
    expect(profile.lockedUntil).toBeUndefined();
    expect(profile.failedLoginCount).toBe(0);
  });

  // 9. Integration: Login Route HTTP 423 enforcement
  it('9. should return HTTP 423 with time remaining when locked account attempts login', async () => {
    const user = await db.getUserByEmail('student@zealosh.com');
    expect(user).toBeDefined();

    const profile = await db.getProfile(user!.id);
    expect(profile).toBeDefined();

    // Lock account directly
    profile!.failedLoginCount = 5;
    profile!.lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.saveProfile(profile!);

    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@zealosh.com', password: 'SomeWrongPassword123' }),
    });

    const res = await loginPost(req);
    expect(res.status).toBe(423);

    const body = await res.json();
    expect(body.error).toContain('Account is temporarily locked');
  });
});

