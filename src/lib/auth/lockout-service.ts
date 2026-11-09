// Zealosh LMS — Database-Enforced Concurrency-Safe Login Lockout Service
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import crypto from 'crypto';
import { isLockoutBypassAllowed } from './lockout';
import { isSupabaseConfigured, getSupabaseAdminClient } from '@/lib/supabase';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;
export const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000;

export interface LockoutResult {
  isLocked: boolean;
  remainingSeconds: number;
  remainingMinutes: number;
  failedAttempts: number;
}

export interface StoredLoginAttempt {
  identifierHash: string;
  ipAddress?: string;
  failedCount: number;
  lockedUntil?: string;
  lastFailedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Computes deterministic SHA-256 hash of an account identifier (normalized email).
 */
export function hashIdentifier(identifier: string): string {
  if (!identifier) return '';
  return crypto.createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');
}

export class DatabaseLockoutService {
  // In-memory store for isolated local dev and unit test suites
  private localAttempts: Map<string, StoredLoginAttempt> = new Map();
  // Concurrency mutex lock per identifier
  private locks: Map<string, Promise<any>> = new Map();

  private async acquireLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(key, lockPromise);
    try {
      return await fn();
    } finally {
      this.locks.delete(key);
      resolveLock();
    }
  }

  /**
   * Evaluates whether an identifier is currently locked out.
   */
  public async checkLockout(identifier: string): Promise<LockoutResult> {
    if (isLockoutBypassAllowed()) {
      return { isLocked: false, remainingSeconds: 0, remainingMinutes: 0, failedAttempts: 0 };
    }

    const idHash = hashIdentifier(identifier);

    // If Supabase is configured and in Supabase mode, query database RPC
    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      try {
        const admin = getSupabaseAdminClient();
        if (admin) {
          const { data, error } = await admin.rpc('check_login_lockout', {
            p_identifier_hash: idHash,
          });
          if (!error && data) {
            return {
              isLocked: Boolean(data.is_locked),
              remainingSeconds: Number(data.remaining_seconds || 0),
              remainingMinutes: Number(data.remaining_minutes || 0),
              failedAttempts: Number(data.failed_count || 0),
            };
          }
        }
      } catch {
        // Fallback to local store
      }
    }

    return this.acquireLock(idHash, async () => {
      const record = this.localAttempts.get(idHash);
      if (!record || !record.lockedUntil) {
        return { isLocked: false, remainingSeconds: 0, remainingMinutes: 0, failedAttempts: record?.failedCount || 0 };
      }

      const lockExpiry = new Date(record.lockedUntil).getTime();
      const now = Date.now();

      if (lockExpiry > now) {
        const remainingSeconds = Math.max(1, Math.ceil((lockExpiry - now) / 1000));
        const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
        return {
          isLocked: true,
          remainingSeconds,
          remainingMinutes,
          failedAttempts: record.failedCount,
        };
      }

      // Lock expired: reset
      record.lockedUntil = undefined;
      record.failedCount = 0;
      record.updatedAt = new Date().toISOString();
      return { isLocked: false, remainingSeconds: 0, remainingMinutes: 0, failedAttempts: 0 };
    });
  }

  /**
   * Atomically records a failed login attempt and enforces lockout when threshold is reached.
   */
  public async recordFailedAttempt(identifier: string, ipAddress?: string): Promise<LockoutResult> {
    if (isLockoutBypassAllowed()) {
      return { isLocked: false, remainingSeconds: 0, remainingMinutes: 0, failedAttempts: 0 };
    }

    const idHash = hashIdentifier(identifier);

    // If Supabase is configured and in Supabase mode, execute atomic stored procedure
    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      try {
        const admin = getSupabaseAdminClient();
        if (admin) {
          const { data, error } = await admin.rpc('record_login_attempt', {
            p_identifier_hash: idHash,
            p_is_success: false,
            p_ip_address: ipAddress || null,
            p_max_failures: MAX_FAILED_LOGIN_ATTEMPTS,
            p_lockout_minutes: LOCKOUT_DURATION_MINUTES,
          });

          if (!error && data) {
            return {
              isLocked: Boolean(data.is_locked),
              remainingSeconds: Number(data.remaining_seconds || 0),
              remainingMinutes: Number(data.remaining_minutes || 0),
              failedAttempts: Number(data.failed_count || 0),
            };
          }
        }
      } catch {
        // Fallback to local store
      }
    }

    return this.acquireLock(idHash, async () => {
      const now = new Date();
      let record = this.localAttempts.get(idHash);

      if (!record) {
        record = {
          identifierHash: idHash,
          ipAddress,
          failedCount: 0,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        this.localAttempts.set(idHash, record);
      }

      // Check if previously locked and lock expired
      if (record.lockedUntil && new Date(record.lockedUntil).getTime() <= now.getTime()) {
        record.failedCount = 0;
        record.lockedUntil = undefined;
      }

      record.failedCount += 1;
      record.lastFailedAt = now.toISOString();
      record.updatedAt = now.toISOString();
      record.ipAddress = ipAddress || record.ipAddress;

      if (record.failedCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
        const lockedUntilDate = new Date(now.getTime() + LOCKOUT_DURATION_MS);
        record.lockedUntil = lockedUntilDate.toISOString();
        return {
          isLocked: true,
          remainingSeconds: LOCKOUT_DURATION_MINUTES * 60,
          remainingMinutes: LOCKOUT_DURATION_MINUTES,
          failedAttempts: record.failedCount,
        };
      }

      return {
        isLocked: false,
        remainingSeconds: 0,
        remainingMinutes: 0,
        failedAttempts: record.failedCount,
      };
    });
  }

  /**
   * Atomically resets lockout counters after a successful login.
   */
  public async recordSuccessfulLogin(identifier: string, ipAddress?: string): Promise<void> {
    const idHash = hashIdentifier(identifier);

    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      try {
        const admin = getSupabaseAdminClient();
        if (admin) {
          await admin.rpc('record_login_attempt', {
            p_identifier_hash: idHash,
            p_is_success: true,
            p_ip_address: ipAddress || null,
            p_max_failures: MAX_FAILED_LOGIN_ATTEMPTS,
            p_lockout_minutes: LOCKOUT_DURATION_MINUTES,
          });
        }
      } catch {
        // Fallback
      }
    }

    await this.acquireLock(idHash, async () => {
      const record = this.localAttempts.get(idHash);
      if (record) {
        record.failedCount = 0;
        record.lockedUntil = undefined;
        record.updatedAt = new Date().toISOString();
        if (ipAddress) record.ipAddress = ipAddress;
      }
    });
  }

  /**
   * Resets local lockout memory (useful for test isolation).
   */
  public resetLocalState(): void {
    this.localAttempts.clear();
    this.locks.clear();
  }
}

export const lockoutService = new DatabaseLockoutService();

