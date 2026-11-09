import { Profile } from '@/types';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;
export const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000;

/**
 * Determine if account lockout bypass is permitted.
 * Rules:
 * 1. Lockout is enabled by default. Missing env vars NEVER enable bypass.
 * 2. Staging and Production environments categorically reject bypass.
 * 3. Test environments (VITEST) categorically reject bypass.
 * 4. Only pure local development (NODE_ENV !== 'production' && !isStaging)
 *    with explicit opt-in (ALLOW_DEV_LOCKOUT_BYPASS === 'true') is permitted.
 */
export function isLockoutBypassAllowed(env: Record<string, string | undefined> = process.env): boolean {
  const nodeEnv = env.NODE_ENV || 'development';
  const appEnv = (env.APP_ENV || env.VERCEL_ENV || '').toLowerCase();

  // Categorically reject in production or staging
  if (nodeEnv === 'production' || appEnv === 'production' || appEnv === 'staging') {
    return false;
  }

  // Categorically reject in automated tests so tests always enforce real security
  if (env.VITEST || nodeEnv === 'test') {
    return false;
  }

  // Only allow if explicitly requested via environment variable
  return env.ALLOW_DEV_LOCKOUT_BYPASS === 'true';
}

export interface LockoutCheckResult {
  isLocked: boolean;
  remainingMinutes: number;
}

/**
 * Evaluates whether an account is currently locked out.
 * If the lock has expired, automatically resets the counters.
 */
export function evaluateAccountLockout(
  profile: Profile | null | undefined,
  bypassAllowed: boolean = false
): LockoutCheckResult {
  if (!profile) {
    return { isLocked: false, remainingMinutes: 0 };
  }

  if (bypassAllowed) {
    if (profile.lockedUntil) {
      profile.lockedUntil = undefined;
      profile.failedLoginCount = 0;
    }
    return { isLocked: false, remainingMinutes: 0 };
  }

  if (!profile.lockedUntil) {
    return { isLocked: false, remainingMinutes: 0 };
  }

  const lockExpiry = new Date(profile.lockedUntil).getTime();
  const now = Date.now();

  if (lockExpiry > now) {
    const remainingMinutes = Math.max(1, Math.ceil((lockExpiry - now) / (60 * 1000)));
    return { isLocked: true, remainingMinutes };
  }

  // Lock has expired; clear lock state
  profile.lockedUntil = undefined;
  profile.failedLoginCount = 0;
  return { isLocked: false, remainingMinutes: 0 };
}

/**
 * Records a failed login attempt and determines whether lockout should be triggered.
 */
export function recordFailedLogin(
  profile: Profile,
  bypassAllowed: boolean = false
): { isLocked: boolean; remainingMinutes: number; failedAttempts: number } {
  profile.failedLoginCount = (profile.failedLoginCount || 0) + 1;

  if (!bypassAllowed && profile.failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
    profile.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
    return {
      isLocked: true,
      remainingMinutes: LOCKOUT_DURATION_MINUTES,
      failedAttempts: profile.failedLoginCount,
    };
  }

  return {
    isLocked: false,
    remainingMinutes: 0,
    failedAttempts: profile.failedLoginCount,
  };
}

/**
 * Resets the failed attempt counters and clears lockout on successful login.
 */
export function resetAccountLockout(profile: Profile): void {
  profile.failedLoginCount = 0;
  profile.lockedUntil = undefined;
}
