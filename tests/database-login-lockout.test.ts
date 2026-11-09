// Zealosh LMS — Concurrency-Safe Database Lockout Test Suite
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { lockoutService, hashIdentifier, MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES } from '@/lib/auth/lockout-service';
import { POST as loginPost } from '@/app/api/auth/login/route';

describe('Track 1: Database-Enforced Concurrency-Safe Login Lockout (ZM-IMPL-08B)', () => {
  const targetEmail = 'student@zealosh.com';

  beforeEach(async () => {
    await db.resetToSeed();
    lockoutService.resetLocalState();
  });

  it('1. should hash normalized identifiers deterministically', () => {
    const hash1 = hashIdentifier('student@zealosh.com');
    const hash2 = hashIdentifier('  STUDENT@ZEALOSH.COM  ');
    const hash3 = hashIdentifier('other@zealosh.com');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBe(64); // SHA-256 hex
  });

  it('2. should not lock out an account before reaching 5 failed attempts', async () => {
    for (let i = 1; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      const res = await lockoutService.recordFailedAttempt(targetEmail);
      expect(res.isLocked).toBe(false);
      expect(res.failedAttempts).toBe(i);
      expect(res.remainingMinutes).toBe(0);
    }

    const check = await lockoutService.checkLockout(targetEmail);
    expect(check.isLocked).toBe(false);
  });

  it('3. should trigger lockout upon exactly 5 failed login attempts', async () => {
    for (let i = 1; i <= 4; i++) {
      await lockoutService.recordFailedAttempt(targetEmail);
    }

    // 5th failed attempt triggers lockout
    const finalAttempt = await lockoutService.recordFailedAttempt(targetEmail);
    expect(finalAttempt.isLocked).toBe(true);
    expect(finalAttempt.failedAttempts).toBe(5);
    expect(finalAttempt.remainingMinutes).toBe(LOCKOUT_DURATION_MINUTES);

    const check = await lockoutService.checkLockout(targetEmail);
    expect(check.isLocked).toBe(true);
    expect(check.remainingMinutes).toBe(LOCKOUT_DURATION_MINUTES);
  });

  it('4. should reject login attempts with HTTP 423 when locked out', async () => {
    // Record 5 failed attempts directly
    for (let i = 0; i < 5; i++) {
      await lockoutService.recordFailedAttempt(targetEmail);
    }

    // Attempt login with correct password while locked
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: targetEmail,
        password: 'Password@123',
      }),
    });

    const res = await loginPost(req);
    expect(res.status).toBe(423);

    const body = await res.json();
    expect(body.error).toContain('temporarily locked');
    expect(body.error).toContain('15 minutes');
  });

  it('5. should reset failed attempt counters upon successful login', async () => {
    // 3 failed attempts
    for (let i = 0; i < 3; i++) {
      await lockoutService.recordFailedAttempt(targetEmail);
    }

    const checkBefore = await lockoutService.checkLockout(targetEmail);
    expect(checkBefore.failedAttempts).toBe(3);

    // Successful login resets counters
    await lockoutService.recordSuccessfulLogin(targetEmail);

    const checkAfter = await lockoutService.checkLockout(targetEmail);
    expect(checkAfter.failedAttempts).toBe(0);
    expect(checkAfter.isLocked).toBe(false);
  });

  it('6. should handle concurrent failed login attempts safely without race conditions', async () => {
    // Launch 10 simultaneous failed attempts
    const attempts = Array.from({ length: 10 }).map((_, i) =>
      lockoutService.recordFailedAttempt(targetEmail, `203.0.113.${10 + i}`)
    );

    const results = await Promise.all(attempts);

    // Check final status
    const finalStatus = await lockoutService.checkLockout(targetEmail);
    expect(finalStatus.isLocked).toBe(true);
    expect(finalStatus.failedAttempts).toBe(10);

    // Exactly the attempts from 5 onwards should report isLocked: true
    const lockedResults = results.filter((r) => r.isLocked);
    expect(lockedResults.length).toBe(6); // 5th, 6th, 7th, 8th, 9th, 10th
  });
});

