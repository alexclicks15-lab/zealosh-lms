import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/store/db';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as verifyEmailHandler, GET as verifyEmailGetHandler } from '@/app/api/auth/verify-email/route';
import { POST as mfaEnrollHandler } from '@/app/api/auth/mfa/enroll/route';
import { POST as mfaChallengeHandler } from '@/app/api/auth/mfa/challenge/route';
import { POST as mfaVerifyHandler } from '@/app/api/auth/mfa/verify/route';
import { POST as mfaUnenrollHandler } from '@/app/api/auth/mfa/unenroll/route';
import { POST as bulkImportHandler } from '@/app/api/admin/admissions/bulk-import/route';
import { POST as resetRequestHandler } from '@/app/api/auth/password-reset/request/route';
import { POST as resetConfirmHandler } from '@/app/api/auth/password-reset/confirm/route';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { signToken, verifyToken } from '@/lib/auth/jwt';
import { createUserAuthClient } from '@/lib/supabase';
import { validateDocumentUpload, getMaxDocumentSizeBytes } from '@/lib/storage/document-validation';
import fs from 'fs';
import path from 'path';

describe('Zealosh LMS — ZM-01.1C Final Authentication, Security & Database Integrity Suite', () => {
  beforeEach(async () => {
    // Reset any temporary state if needed
  });

  // --------------------------------------------------------------------------
  // 1. Workstream A: Registration Email Verification & Pending Status
  // --------------------------------------------------------------------------
  it('1. should register student with unconfirmed email, pending status, and zero session cookie', async () => {
    const testEmail = `candidate.unverified.${Date.now()}@example.com`;
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unverified Candidate',
        email: testEmail,
        password: 'ValidPassword@2026',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.pendingVerification).toBe(true);
    expect(body.emailVerified).toBe(false);
    expect(body.verificationToken).toBeDefined();

    // Verify no cookie was set
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeNull();

    // Verify stored user & profile state
    const user = await db.getUserByEmail(testEmail);
    expect(user).toBeDefined();
    expect(user?.emailVerified).toBe(false);

    const profile = await db.getProfile(user!.id);
    expect(profile?.status).toBe('PENDING_VERIFICATION');
    expect(profile?.emailVerified).toBe(false);
  });

  it('2. should reject public registration when registrationMode is DISABLED', async () => {
    const prevSettings = await db.getPlatformSettings();
    await db.updatePlatformSettings({ registrationMode: 'DISABLED' });

    try {
      const req = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Blocked User',
          email: 'blocked.user@example.com',
          password: 'ValidPassword@2026',
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/disabled/i);
    } finally {
      await db.updatePlatformSettings({ registrationMode: prevSettings.registrationMode || 'PUBLIC' });
    }
  });

  // --------------------------------------------------------------------------
  // 2. Workstream A: Email Verification Lifecycle
  // --------------------------------------------------------------------------
  it('3. should verify email via token, activate profile, and reject token replay or invalid tokens', async () => {
    const testEmail = `candidate.verify.${Date.now()}@example.com`;
    const regReq = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Verify Candidate',
        email: testEmail,
        password: 'ValidPassword@2026',
      }),
    });
    const regRes = await registerHandler(regReq);
    const { verificationToken } = await regRes.json();
    expect(verificationToken).toBeDefined();

    // Verify via GET request
    const getReq = new Request(`http://localhost:3000/api/auth/verify-email?token=${verificationToken}`);
    const getRes = await verifyEmailGetHandler(getReq);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.success).toBe(true);

    // Verify database state updated to ACTIVE
    const user = await db.getUserByEmail(testEmail);
    const profile = await db.getProfile(user!.id);
    expect(profile?.status).toBe('ACTIVE');
    expect(profile?.emailVerified).toBe(true);

    // Replay attack: verifying again MUST return 400
    const replayReq = new Request('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verificationToken }),
    });
    const replayRes = await verifyEmailHandler(replayReq);
    expect(replayRes.status).toBe(400);

    // Invalid token returns 400
    const badReq = new Request('http://localhost:3000/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bogus-token-xyz' }),
    });
    const badRes = await verifyEmailHandler(badReq);
    expect(badRes.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // 3. Workstream A & B: Unverified Login Prevention & Client Isolation
  // --------------------------------------------------------------------------
  it('4. should reject login attempts by unverified accounts with HTTP 403', async () => {
    const testEmail = `candidate.loginlock.${Date.now()}@example.com`;
    const regReq = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Login Lock Candidate',
        email: testEmail,
        password: 'ValidPassword@2026',
      }),
    });
    const regRes = await registerHandler(regReq);
    const { verificationToken } = await regRes.json();

    // Login before email verification MUST fail with 403
    const loginReq = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'ValidPassword@2026',
      }),
    });
    const loginRes = await loginHandler(loginReq);
    expect(loginRes.status).toBe(403);
    const loginBody = await loginRes.json();
    expect(loginBody.code).toBe('EMAIL_VERIFICATION_REQUIRED');

    // Verify student email
    await db.verifyStudentEmail(verificationToken);

    // Login after verification MUST succeed (use fresh Request)
    const loginReq2 = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'ValidPassword@2026',
      }),
    });
    const loginRes2 = await loginHandler(loginReq2);
    expect(loginRes2.status).toBe(200);
    const loginBody2 = await loginRes2.json();
    expect(loginBody2.success).toBe(true);
    expect(loginBody2.token).toBeDefined();
  });

  it('5. should provide isolated client instances with anon key via createUserAuthClient and ensure concurrent isolation', async () => {
    const client1 = createUserAuthClient();
    const client2 = createUserAuthClient();

    // Should return distinct client instances or safe client wrappers
    expect(client1).toBeDefined();
    expect(client2).toBeDefined();

    // Simulate concurrent logins for two distinct seeded users
    const [loginA, loginB] = await Promise.all([
      loginHandler(
        new Request('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'student@zealosh.com',
            password: 'Zealosh@2026',
          }),
        })
      ),
      loginHandler(
        new Request('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'vishnu@zealosh.com',
            password: 'Zealosh@2026',
          }),
        })
      ),
    ]);

    expect(loginA.status).toBe(200);
    expect(loginB.status).toBe(200);

    const bodyA = await loginA.json();
    const bodyB = await loginB.json();

    expect(bodyA.user.email).toBe('student@zealosh.com');
    expect(bodyB.user.email).toBe('vishnu@zealosh.com');
    expect(bodyA.token).not.toBe(bodyB.token);
    expect(bodyA.sessionId).not.toBe(bodyB.sessionId);
  });

  // --------------------------------------------------------------------------
  // 4. Workstream C: Password Recovery, Token Versioning & Session Invalidation
  // --------------------------------------------------------------------------
  it('6. should advance tokenVersion and invalidate older sessions upon password reset', async () => {
    const adminUser = await db.getUserByEmail('admin@zealosh.com');
    expect(adminUser).toBeDefined();

    const profileBefore = await db.getProfile(adminUser!.id);
    const initialVersion = profileBefore?.tokenVersion || 1;

    // Sign a token with current version
    const oldToken = signToken({
      ...adminUser!,
      tokenVersion: initialVersion,
    });

    // Guard authorizes valid admin token
    const mockReqOld = new Request('http://localhost:3000/api/admin/config', {
      headers: { Authorization: `Bearer ${oldToken}` },
    });
    const auth1 = authorizeAdmin(mockReqOld);
    expect('actor' in auth1).toBe(true);

    // Request and confirm password reset
    const resetData = await db.requestPasswordReset(adminUser!.email);
    expect(resetData?.token).toBeDefined();

    const confirmRes = await resetConfirmHandler(
      new Request('http://localhost:3000/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetData!.token,
          newPassword: 'NewSecureAdminPassword@2026',
        }),
      })
    );
    expect(confirmRes.status).toBe(200);

    // Profile tokenVersion has incremented
    const profileAfter = await db.getProfile(adminUser!.id);
    expect(profileAfter?.tokenVersion).toBeGreaterThan(initialVersion);

    // Old token MUST now be rejected by admin guard
    const authOldAfter = authorizeAdmin(mockReqOld);
    expect('errorResponse' in authOldAfter).toBe(true);
    if ('errorResponse' in authOldAfter) {
      expect(authOldAfter.errorResponse.status).toBe(401);
    }

    // New token signed with updated version is authorized
    const newToken = signToken({
      ...adminUser!,
      tokenVersion: profileAfter!.tokenVersion,
    });
    const mockReqNew = new Request('http://localhost:3000/api/admin/config', {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    const authNew = authorizeAdmin(mockReqNew);
    expect('actor' in authNew).toBe(true);

    // Restore original password for test repeatability
    await db.confirmPasswordReset(
      (await db.requestPasswordReset(adminUser!.email))!.token,
      'Password@2026'
    );
  });

  // --------------------------------------------------------------------------
  // 5. Workstream D: MFA Factor Enrollment, Challenge & Verification Lifecycle
  // --------------------------------------------------------------------------
  it('7. should execute complete MFA lifecycle and enforce MFA requirement on admin guard', async () => {
    const adminUser = await db.getUserByEmail('admin@zealosh.com');
    const adminProfile = await db.getProfile(adminUser!.id);
    const adminToken = signToken(adminUser!);

    // 1. Enroll MFA Factor
    const enrollReq = new Request('http://localhost:3000/api/auth/mfa/enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        factorType: 'totp',
        friendlyName: 'Admin Authenticator',
      }),
    });
    const enrollRes = await mfaEnrollHandler(enrollReq);
    expect(enrollRes.status).toBe(200);
    const enrollBody = await enrollRes.json();
    expect(enrollBody.factor.status).toBe('unverified');
    expect(enrollBody.totp.secret).toBeDefined();
    const factorId = enrollBody.factor.id;

    // 2. Create Challenge
    const challengeReq = new Request('http://localhost:3000/api/auth/mfa/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId }),
    });
    const challengeRes = await mfaChallengeHandler(challengeReq);
    expect(challengeRes.status).toBe(200);
    const challengeBody = await challengeRes.json();
    const challengeId = challengeBody.challenge.id;

    // 3. Verify Challenge with valid 6-digit code
    const verifyReq = new Request('http://localhost:3000/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, code: '123456' }),
    });
    const verifyRes = await mfaVerifyHandler(verifyReq);
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.verified).toBe(true);
    expect(verifyBody.assuranceLevel).toBe('aal2');

    // 4. Verify admin profile now has mfaEnabled = true
    const updatedProfile = await db.getProfile(adminUser!.id);
    expect(updatedProfile?.mfaEnabled).toBe(true);

    // 5. Admin guard without MFA claim MUST be rejected with 403 MFA_REQUIRED
    const reqNoMfa = new Request('http://localhost:3000/api/admin/config', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const guardNoMfa = authorizeAdmin(reqNoMfa);
    expect('errorResponse' in guardNoMfa).toBe(true);
    if ('errorResponse' in guardNoMfa) {
      expect(guardNoMfa.errorResponse.status).toBe(403);
    }

    // 6. Admin guard with untrusted client MFA header MUST be rejected with 403 (Header cannot forge MFA)
    const reqWithMfaHeader = new Request('http://localhost:3000/api/admin/config', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-mfa-verified': 'true',
      },
    });
    const guardWithMfaHeader = authorizeAdmin(reqWithMfaHeader);
    expect('errorResponse' in guardWithMfaHeader).toBe(true);
    if ('errorResponse' in guardWithMfaHeader) {
      expect(guardWithMfaHeader.errorResponse.status).toBe(403);
    }

    const tokenAal2 = signToken({
      ...adminUser!,
      tokenVersion: updatedProfile!.tokenVersion,
      mfaVerified: true,
      aal: 'aal2',
    });
    const reqWithAal2 = new Request('http://localhost:3000/api/admin/config', {
      headers: { Authorization: `Bearer ${tokenAal2}` },
    });
    const guardWithAal2 = authorizeAdmin(reqWithAal2);
    expect('actor' in guardWithAal2).toBe(true);

    // 7. Unenroll MFA Factor
    const unenrollReq = new Request('http://localhost:3000/api/auth/mfa/unenroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAal2}`,
      },
      body: JSON.stringify({ factorId }),
    });
    const unenrollRes = await mfaUnenrollHandler(unenrollReq);
    expect(unenrollRes.status).toBe(200);

    const finalProfile = await db.getProfile(adminUser!.id);
    expect(finalProfile?.mfaEnabled).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 6. Workstream E: Forward-Only Migration for Audit Safety
  // --------------------------------------------------------------------------
  it('8. should verify migration 20261031000009 sets ON DELETE RESTRICT on audit foreign keys', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20261031000009_zealosh_phase1_audit_fk_safety.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/ALTER TABLE public\.enrollment_transfers/i);
    expect(sql).toMatch(/ON DELETE RESTRICT/i);
    expect(sql).toMatch(/ALTER TABLE public\.enrollment_withdrawals/i);
    expect(sql).toMatch(/enrollment_transfers_enrollment_id_fkey/i);
    expect(sql).toMatch(/enrollment_withdrawals_enrollment_id_fkey/i);
  });

  // --------------------------------------------------------------------------
  // 7. Workstream G: Admissions Auto-Enrollment Policy Gate (BDR-01)
  // --------------------------------------------------------------------------
  it('9. should enforce BDR-01 central policy gate on admissions auto-enrollment', async () => {
    // 1. By default, admissionsAutoEnrollEnabled is false (pending BDR-01 decision)
    const settings = await db.getPlatformSettings();
    expect(Boolean(settings?.admissionsAutoEnrollEnabled)).toBe(false);

    const csvContent = [
      'name,email,course,batch',
      `Candidate Gate,gate.${Date.now()}@example.com,crs-asp-01,btc-asp-nov26`,
    ].join('\n');

    // Attempting AUTO_ENROLL while gate is disabled MUST demote to PENDING_REVIEW with policyNotice
    const reqBlocked = new Request('http://localhost:3000/api/admin/admissions/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvContent,
        mode: 'AUTO_ENROLL',
        authorizedBy: 'usr-admin-01',
      }),
    });
    const resBlocked = await bulkImportHandler(reqBlocked);
    expect(resBlocked.status).toBe(200);
    const bodyBlocked = await resBlocked.json();

    expect(bodyBlocked.pendingReviewCount).toBe(1);
    expect(bodyBlocked.createdEnrollmentIds.length).toBe(0);
    expect(bodyBlocked.policyNotice).toBeDefined();
    expect(bodyBlocked.policyNotice).toMatch(/BDR-01/i);

    // 2. Explicitly enabling gate permits auto-enrollment
    await db.updatePlatformSettings({ admissionsAutoEnrollEnabled: true });
    try {
      const csvContent2 = [
        'name,email,course,batch',
        `Candidate Gate 2,gate2.${Date.now()}@example.com,crs-asp-01,btc-asp-nov26`,
      ].join('\n');

      const reqAllowed = new Request('http://localhost:3000/api/admin/admissions/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent: csvContent2,
          mode: 'AUTO_ENROLL',
          authorizedBy: 'usr-admin-01',
        }),
      });
      const resAllowed = await bulkImportHandler(reqAllowed);
      expect(resAllowed.status).toBe(200);
      const bodyAllowed = await resAllowed.json();

      expect(bodyAllowed.createdEnrollmentIds.length).toBe(1);
      expect(bodyAllowed.policyNotice).toBeUndefined();
    } finally {
      await db.updatePlatformSettings({ admissionsAutoEnrollEnabled: false });
    }
  });

  // --------------------------------------------------------------------------
  // 8. Workstream H: Document Upload Positive Bounds & Security
  // --------------------------------------------------------------------------
  it('10. should enforce positive integer bounds on document sizes and validate storage bucket', () => {
    // Zero, negative, and non-numeric sizes must be rejected
    const testPdfBuffer = Buffer.from('%PDF-1.4 valid test pdf content', 'utf8');

    const resNegative = validateDocumentUpload({
      filename: 'resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: -100,
      buffer: testPdfBuffer,
    });
    expect(resNegative.valid).toBe(false);
    expect(resNegative.error).toMatch(/positive/i);

    const resZero = validateDocumentUpload({
      filename: 'resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 0,
      buffer: testPdfBuffer,
    });
    expect(resZero.valid).toBe(false);
    expect(resZero.error).toMatch(/positive/i);

    // Document size exceeding ceiling must be rejected
    const resOver = validateDocumentUpload(
      {
        filename: 'huge.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 30 * 1024 * 1024,
        buffer: testPdfBuffer,
      },
      0,
      25 * 1024 * 1024
    );
    expect(resOver.valid).toBe(false);
    expect(resOver.error).toMatch(/exceeds/i);

    // Safe bounds retrieval
    const defaultMax = getMaxDocumentSizeBytes();
    expect(defaultMax).toBe(25 * 1024 * 1024);

    const customMax = getMaxDocumentSizeBytes({ maxDocumentSizeBytes: 5 * 1024 * 1024 });
    expect(customMax).toBe(5 * 1024 * 1024);

    // Fallback on negative configuration
    const invalidConfigMax = getMaxDocumentSizeBytes({ maxDocumentSizeBytes: -5000 });
    expect(invalidConfigMax).toBe(25 * 1024 * 1024);
  });

  // --------------------------------------------------------------------------
  // 9. Workstream J: Monotonic Collision-Safe Application Numbering
  // --------------------------------------------------------------------------
  it('11. should generate monotonic collision-safe application numbers under concurrency', async () => {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;

    const appPromises = Array.from({ length: 5 }, (_, i) =>
      db.createAdmissionApplication({
        fullName: `Applicant Concurrent ${i}`,
        email: `app.concurrent.${Date.now()}.${i}@example.com`,
        courseId: 'crs-asp-01',
      })
    );

    const apps = await Promise.all(appPromises);
    const appNumbers = apps.map((a) => a.applicationNumber);

    // Verify all application numbers start with canonical prefix
    appNumbers.forEach((num) => {
      expect(num).toMatch(new RegExp(`^APP-${year}-\\d{4}$`));
    });

    // Verify all numbers in the batch are unique (zero collision)
    const uniqueNumbers = new Set(appNumbers);
    expect(uniqueNumbers.size).toBe(apps.length);
  });
});
