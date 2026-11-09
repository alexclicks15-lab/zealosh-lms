import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as requestResetHandler } from '@/app/api/auth/password-reset/request/route';
import { POST as confirmResetHandler } from '@/app/api/auth/password-reset/confirm/route';
import { POST as applyHandler } from '@/app/api/admissions/apply/route';
import { POST as reviewAdmissionHandler } from '@/app/api/admin/admissions/[id]/review/route';
import { GET as getSubtopicsHandler, POST as createSubtopicHandler } from '@/app/api/admin/academic/subtopics/route';
import {
  GET as getSingleSubtopicHandler,
  PATCH as patchSubtopicHandler,
  DELETE as deleteSubtopicHandler,
} from '@/app/api/admin/academic/subtopics/[id]/route';
import { POST as bulkImportHandler } from '@/app/api/admin/admissions/bulk-import/route';
import { POST as migrateModulesHandler } from '@/app/api/admin/academic/migrate-modules/route';
import { moodleAdapter } from '@/lib/adapters/moodle-adapter';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { signToken } from '@/lib/auth/jwt';
import {
  validateDocumentUpload,
  sanitizeFilename,
  verifyDocumentMagicBytes,
} from '@/lib/storage/document-validation';

describe('Zealosh LMS — ZM-01.1B Security Acceptance Audit & Defect Closure', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  // --------------------------------------------------------------------------
  // Audit 1: Password Reset Token Invalidation, Expiry & Replay Rejection
  // --------------------------------------------------------------------------
  it('1. should enforce single-use token invalidation, replay rejection and password complexity', async () => {
    const user = await db.getUserByEmail('student@zealosh.com');
    expect(user).toBeDefined();

    // Request reset token
    const resetData = await db.requestPasswordReset('student@zealosh.com');
    expect(resetData).toBeDefined();
    const token = resetData!.token;

    // Reject weak password (< 10 chars, no symbol)
    const reqWeak = new Request('http://localhost:3000/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        newPassword: 'weak',
      }),
    });
    const resWeak = await confirmResetHandler(reqWeak);
    expect(resWeak.status).toBe(400);
    const bodyWeak = await resWeak.json();
    expect(bodyWeak.error).toMatch(/at least 10 characters/i);

    // Confirm password reset with compliant strong password
    const reqStrong = new Request('http://localhost:3000/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        newPassword: 'NewSecurePass@2026!',
      }),
    });
    const resStrong = await confirmResetHandler(reqStrong);
    expect(resStrong.status).toBe(200);
    const bodyStrong = await resStrong.json();
    expect(bodyStrong.success).toBe(true);

    // Replay attack: Re-submitting the same token MUST be rejected
    const reqReplay = new Request('http://localhost:3000/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        newPassword: 'AnotherStrongPass@2026!',
      }),
    });
    const resReplay = await confirmResetHandler(reqReplay);
    expect(resReplay.status).toBe(400);
    const bodyReplay = await resReplay.json();
    expect(bodyReplay.error).toMatch(/invalid or already used/i);
  });

  // --------------------------------------------------------------------------
  // Audit 2: Account Lockout Enforcement (5 Failed Attempts -> 15-Minute Lock)
  // --------------------------------------------------------------------------
  it('2. should lock account after 5 consecutive failed attempts and return HTTP 423 with remaining time', async () => {
    const email = 'student@zealosh.com';

    // 4 failed attempts should return 401
    for (let i = 1; i <= 4; i++) {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'WrongPassword123!' }),
      });
      const res = await loginHandler(req);
      expect(res.status).toBe(401);
    }

    const profileBefore5th = await db.getProfile('usr-std-01');
    expect(profileBefore5th?.failedLoginCount).toBe(4);
    expect(profileBefore5th?.lockedUntil).toBeUndefined();

    // 5th failed attempt triggers lockout
    const req5 = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'WrongPassword123!' }),
    });
    const res5 = await loginHandler(req5);
    expect(res5.status).toBe(423);
    const body5 = await res5.json();
    expect(body5.error).toMatch(/temporarily locked/i);
    expect(body5.error).toMatch(/15 minutes/i);

    // Profile in DB must reflect lock state
    const lockedProfile = await db.getProfile('usr-std-01');
    expect(lockedProfile?.failedLoginCount).toBe(5);
    expect(lockedProfile?.lockedUntil).toBeDefined();

    // 6th attempt while locked must still be rejected with 423
    const req6 = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'WrongPassword123!' }),
    });
    const res6 = await loginHandler(req6);
    expect(res6.status).toBe(423);
  });

  // --------------------------------------------------------------------------
  // Audit 3: Role Privilege Boundary (Self-Registration Restricts to STUDENT)
  // --------------------------------------------------------------------------
  it('3. should reject self-registration attempts with elevated roles (SUPER_ADMIN, INSTRUCTOR)', async () => {
    // Attempt self-registration as SUPER_ADMIN
    const reqPriv = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hacker Admin',
        email: 'hacker@zealosh.com',
        password: 'AdminPassword@2026!',
        role: 'SUPER_ADMIN',
      }),
    });
    const resPriv = await registerHandler(reqPriv);
    expect(resPriv.status).toBe(403);
    const bodyPriv = await resPriv.json();
    expect(bodyPriv.error).toMatch(/restricted to STUDENT role only/i);

    // Legitimate STUDENT self-registration should succeed
    const reqValid = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Gopika Varma',
        email: 'gopika.v@example.com',
        password: 'StudentPass@2026!',
        role: 'STUDENT',
      }),
    });
    const resValid = await registerHandler(reqValid);
    expect(resValid.status).toBe(201);
    const bodyValid = await resValid.json();
    expect(bodyValid.user.role).toBe('STUDENT');
  });

  // --------------------------------------------------------------------------
  // Audit 4: Admissions Application Validation & Batch Capacity Guard
  // --------------------------------------------------------------------------
  it('4. should reject application for non-existent course/batch and enforce capacity limits upon approval', async () => {
    // Non-existent course
    const reqBadCourse = new Request('http://localhost:3000/api/admissions/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Applicant',
        email: 'applicant@example.com',
        courseId: 'crs-nonexistent-99',
      }),
    });
    const resBadCourse = await applyHandler(reqBadCourse);
    expect(resBadCourse.status).toBe(404);

    // Non-existent batch
    const reqBadBatch = new Request('http://localhost:3000/api/admissions/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Applicant',
        email: 'applicant@example.com',
        courseId: 'crs-asp-01',
        preferredBatchId: 'btc-nonexistent-99',
      }),
    });
    const resBadBatch = await applyHandler(reqBadBatch);
    expect(resBadBatch.status).toBe(404);

    // Fill batch capacity to test boundary
    const batch = await db.getBatch('btc-asp-nov26');
    expect(batch).toBeDefined();
    batch!.enrolledCount = batch!.capacity;
    await db.saveBatch(batch!);

    // Submit valid application
    const reqApp = new Request('http://localhost:3000/api/admissions/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Capacity Tester',
        email: 'capacity.tester@example.com',
        courseId: 'crs-asp-01',
        preferredBatchId: 'btc-asp-nov26',
      }),
    });
    const resApp = await applyHandler(reqApp);
    expect(resApp.status).toBe(201);
    const bodyApp = await resApp.json();
    const appId = bodyApp.application.id;

    // Approving application into full batch MUST fail with BATCH_CAPACITY_EXCEEDED
    const reqReview = new Request(`http://localhost:3000/api/admin/admissions/${appId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'APPROVED',
        reviewerId: 'usr-admin-01',
      }),
    });
    const resReview = await reviewAdmissionHandler(reqReview, { params: Promise.resolve({ id: appId }) });
    expect(resReview.status).toBe(409);
    const bodyReview = await resReview.json();
    expect(bodyReview.error).toMatch(/BATCH_CAPACITY_EXCEEDED/i);
  });

  // --------------------------------------------------------------------------
  // Audit 5: Atomic Enrollment & Concurrent Seat Reservation
  // --------------------------------------------------------------------------
  it('5. should prevent duplicate enrollment for the same user in the same batch and reject reviewed transitions', async () => {
    // Submit application
    const reqApp = new Request('http://localhost:3000/api/admissions/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Rahul Menon',
        email: 'rahul.menon@example.com',
        courseId: 'crs-asp-01',
        preferredBatchId: 'btc-asp-nov26',
      }),
    });
    const resApp = await applyHandler(reqApp);
    expect(resApp.status).toBe(201);
    const { application: app } = await resApp.json();

    // Reset batch count to 0 for clear counting
    const batch = await db.getBatch('btc-asp-nov26');
    batch!.enrolledCount = 0;
    await db.saveBatch(batch!);

    // First Review: Approve
    const reqReview1 = new Request(`http://localhost:3000/api/admin/admissions/${app.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'APPROVED',
        reviewerId: 'usr-admin-01',
      }),
    });
    const resReview1 = await reviewAdmissionHandler(reqReview1, { params: Promise.resolve({ id: app.id }) });
    expect(resReview1.status).toBe(200);
    const bodyReview1 = await resReview1.json();
    expect(bodyReview1.application.status).toBe('APPROVED');
    expect(bodyReview1.enrollment).toBeDefined();

    // Verify batch enrolledCount incremented by exactly 1
    const updatedBatch = await db.getBatch('btc-asp-nov26');
    expect(updatedBatch?.enrolledCount).toBe(1);

    // Second Review (Duplicate State Transition Rejection)
    const reqReview2 = new Request(`http://localhost:3000/api/admin/admissions/${app.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'APPROVED',
        reviewerId: 'usr-admin-01',
      }),
    });
    const resReview2 = await reviewAdmissionHandler(reqReview2, { params: Promise.resolve({ id: app.id }) });
    expect(resReview2.status).toBe(409);
    const bodyReview2 = await resReview2.json();
    expect(bodyReview2.error).toMatch(/APPLICATION_ALREADY_REVIEWED/i);

    // Enrolled count MUST NOT double-increment
    const finalBatch = await db.getBatch('btc-asp-nov26');
    expect(finalBatch?.enrolledCount).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Audit 6: Academic Hierarchy Integrity & Subtopic Validation
  // --------------------------------------------------------------------------
  it('6. should reject subtopics with invalid parent topicId and create subtopic with valid hierarchy', async () => {
    // Non-existent parent topicId
    const reqBadTopic = new Request('http://localhost:3000/api/admin/academic/subtopics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: 'top-nonexistent-99',
        title: 'Orphaned Subtopic',
      }),
    });
    const resBadTopic = await createSubtopicHandler(reqBadTopic);
    expect(resBadTopic.status).toBe(404);
    const bodyBadTopic = await resBadTopic.json();
    expect(bodyBadTopic.error).toMatch(/Parent topic not found/i);

    // Valid parent topicId ('top-asp-01')
    const reqValid = new Request('http://localhost:3000/api/admin/academic/subtopics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: 'top-asp-01',
        title: 'Safety Interlocks and E-Stops',
        code: 'SUBTOP-01-01',
        displayOrder: 1,
      }),
    });
    const resValid = await createSubtopicHandler(reqValid);
    expect(resValid.status).toBe(201);
    const bodyValid = await resValid.json();
    expect(bodyValid.subtopic.id).toBeDefined();
    expect(bodyValid.subtopic.topicId).toBe('top-asp-01');
  });

  // --------------------------------------------------------------------------
  // Audit 7: Admissions Document Security (MIME Whitelist & Configurable Ceiling)
  // --------------------------------------------------------------------------
  it('7. should reject documents with disallowed MIME types or sizes exceeding ceiling', async () => {
    // Test disallowed MIME type (.exe / binary)
    const reqBadMime = new Request('http://localhost:3000/api/admissions/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Security Tester',
        email: 'mime.test@example.com',
        phone: '+91 999 888 7777',
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-nov26',
        documents: [
          {
            filename: 'payload.exe',
            mimeType: 'application/x-msdownload',
            fileSizeBytes: 1024,
          },
        ],
      }),
    });
    const resBadMime = await applyHandler(reqBadMime);
    expect(resBadMime.status).toBe(400);
    const bodyBadMime = await resBadMime.json();
    expect(bodyBadMime.error).toMatch(/unsupported MIME type/i);

    // Test file exceeding 25MB ceiling (26MB)
    const reqOversized = new Request('http://localhost:3000/api/admissions/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Security Tester',
        email: 'oversized.test@example.com',
        phone: '+91 999 888 7777',
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-nov26',
        documents: [
          {
            filename: 'giant_certificate.pdf',
            mimeType: 'application/pdf',
            fileSizeBytes: 26 * 1024 * 1024, // 26MB
          },
        ],
      }),
    });
    const resOversized = await applyHandler(reqOversized);
    expect(resOversized.status).toBe(400);
    const bodyOversized = await resOversized.json();
    expect(bodyOversized.error).toMatch(/exceeds maximum allowable file size/i);
  });

  // --------------------------------------------------------------------------
  // Audit 8: Legacy Module Migration Idempotency
  // --------------------------------------------------------------------------
  it('8. should execute legacy module migration idempotently without duplicate modules', async () => {
    // First migration run
    const req1 = new Request('http://localhost:3000/api/admin/academic/migrate-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: 'crs-asp-01' }),
    });
    const res1 = await migrateModulesHandler(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);

    // Second migration run (idempotency check)
    const req2 = new Request('http://localhost:3000/api/admin/academic/migrate-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: 'crs-asp-01' }),
    });
    const res2 = await migrateModulesHandler(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);

    // On second run, 0 new modules should be created because all lessons already have valid moduleId
    expect(body2.modulesCreated).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Audit 9: Moodle Core Integration Adapter & OIDC User Contract
  // --------------------------------------------------------------------------
  it('9. should verify Moodle Core adapter contracts and user synchronization format', async () => {
    // User creation contract
    const userPayload = {
      username: 'student_naveen',
      firstname: 'Naveen',
      lastname: 'Kumar',
      email: 'naveen.kumar@example.com',
    };
    const moodleUser = await moodleAdapter.createUser(userPayload);
    expect(moodleUser).toBeDefined();
    expect(moodleUser.id).toBeGreaterThan(0);
    expect(moodleUser.username).toBe('student_naveen');

    // Enrolment contract
    const enrolPayload = {
      roleid: 5, // Student role
      userid: moodleUser.id,
      courseid: 101,
    };
    const enrolResult = await moodleAdapter.enrolUser(enrolPayload);
    expect(enrolResult.success).toBe(true);

    // Course contents contract
    const contents = await moodleAdapter.getCourseContents(101);
    expect(Array.isArray(contents)).toBe(true);
    expect(contents.length).toBeGreaterThanOrEqual(1);
    expect(contents[0].modules.length).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // Audit 10: Subtopics Full CRUD Lifecycle (GET, PATCH, DELETE/archival)
  // --------------------------------------------------------------------------
  it('10. should complete the subtopic lifecycle with GET, PATCH, and safe archival DELETE', async () => {
    // 1. Create a subtopic
    const reqCreate = new Request('http://localhost:3000/api/admin/academic/subtopics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: 'top-asp-01',
        title: 'Fall Protection Calculations',
        code: 'SUBTOP-FP-01',
        displayOrder: 2,
        description: 'Free fall distance and deceleration calculations',
      }),
    });
    const resCreate = await createSubtopicHandler(reqCreate);
    expect(resCreate.status).toBe(201);
    const { subtopic: created } = await resCreate.json();
    const subtopicId = created.id;

    // 2. Query individual subtopic via GET [id]
    const reqGet = new Request(`http://localhost:3000/api/admin/academic/subtopics/${subtopicId}`);
    const resGet = await getSingleSubtopicHandler(reqGet, { params: Promise.resolve({ id: subtopicId }) });
    expect(resGet.status).toBe(200);
    const bodyGet = await resGet.json();
    expect(bodyGet.subtopic.title).toBe('Fall Protection Calculations');

    // 3. Update subtopic title & order via PATCH [id]
    const reqPatch = new Request(`http://localhost:3000/api/admin/academic/subtopics/${subtopicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Advanced Fall Protection Calculations',
        displayOrder: 5,
      }),
    });
    const resPatch = await patchSubtopicHandler(reqPatch, { params: Promise.resolve({ id: subtopicId }) });
    expect(resPatch.status).toBe(200);
    const bodyPatch = await resPatch.json();
    expect(bodyPatch.subtopic.title).toBe('Advanced Fall Protection Calculations');
    expect(bodyPatch.subtopic.displayOrder).toBe(5);

    // 4. Archive subtopic via DELETE [id] (Soft delete preserving data integrity)
    const reqDelete = new Request(`http://localhost:3000/api/admin/academic/subtopics/${subtopicId}`, {
      method: 'DELETE',
    });
    const resDelete = await deleteSubtopicHandler(reqDelete, { params: Promise.resolve({ id: subtopicId }) });
    expect(resDelete.status).toBe(200);
    const bodyDelete = await resDelete.json();
    expect(bodyDelete.subtopic.status).toBe('ARCHIVED');

    // 5. Verify database record still exists but is ARCHIVED
    const archivedInDb = await db.getSubtopicById(subtopicId);
    expect(archivedInDb).toBeDefined();
    expect(archivedInDb?.status).toBe('ARCHIVED');
  });

  // --------------------------------------------------------------------------
  // Audit 11: Bulk Admissions Policy Compliance (BDR-01 Safe PENDING_REVIEW vs AUTO_ENROLL)
  // --------------------------------------------------------------------------
  it('11. should default bulk admissions import to safe PENDING_REVIEW mode without auto-enrolling', async () => {
    const csvContent = [
      'name,email,course,phone',
      'Kiran Kumar,kiran.k@example.com,crs-asp-01,+91 944 111 2233',
      'Meera Nair,meera.n@example.com,crs-asp-01,+91 944 222 3344',
    ].join('\n');

    // Default import (PENDING_REVIEW mode)
    const reqDefault = new Request('http://localhost:3000/api/admin/admissions/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvContent }),
    });
    const resDefault = await bulkImportHandler(reqDefault);
    expect(resDefault.status).toBe(200);
    const bodyDefault = await resDefault.json();

    expect(bodyDefault.totalRows).toBe(2);
    expect(bodyDefault.importedCount).toBe(2);
    expect(bodyDefault.pendingReviewCount).toBe(2);
    expect(bodyDefault.createdEnrollmentIds.length).toBe(0); // Zero auto-enrollments!

    // Verify applications are in SUBMITTED status
    const appKiran = await db.getAdmissionApplication(bodyDefault.createdApplicationIds[0]);
    expect(appKiran?.status).toBe('SUBMITTED');

    // Verify student user accounts were safely provisioned
    const userKiran = await db.getUserByEmail('kiran.k@example.com');
    expect(userKiran).toBeDefined();
    expect(userKiran?.role).toBe('STUDENT');
  });

  it('11b. should allow explicit AUTO_ENROLL mode only when explicitly requested and permitted by policy gate', async () => {
    // Enable central policy gate for auto-enrollment in this test
    const prevSettings = await db.getPlatformSettings();
    await db.updatePlatformSettings({ admissionsAutoEnrollEnabled: true });

    try {
      const csvContent = [
        'name,email,course,batch',
        'Suresh Babu,suresh.b@example.com,crs-asp-01,btc-asp-nov26',
      ].join('\n');

      const reqAuto = new Request('http://localhost:3000/api/admin/admissions/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          mode: 'AUTO_ENROLL',
          authorizedBy: 'usr-admin-01',
        }),
      });
      const resAuto = await bulkImportHandler(reqAuto);
      expect(resAuto.status).toBe(200);
      const bodyAuto = await resAuto.json();

      expect(bodyAuto.importedCount).toBe(1);
      expect(bodyAuto.createdEnrollmentIds.length).toBe(1);

      // Verify application was APPROVED and enrolled
      const app = await db.getAdmissionApplication(bodyAuto.createdApplicationIds[0]);
      expect(app?.status).toBe('APPROVED');
    } finally {
      await db.updatePlatformSettings({ admissionsAutoEnrollEnabled: prevSettings.admissionsAutoEnrollEnabled || false });
    }
  });

  // --------------------------------------------------------------------------
  // Audit 12: Deep Document Security: Magic Bytes, Executable Rejection & Traversal Sanitization
  // --------------------------------------------------------------------------
  it('12. should inspect magic bytes, reject disguised executables, and sanitize path traversal filenames', async () => {
    // 1. Path traversal sanitization
    const dirtyFilename = '../../../../etc/passwd.pdf';
    const cleanName = sanitizeFilename(dirtyFilename);
    expect(cleanName).not.toContain('..');
    expect(cleanName).not.toContain('/');
    expect(cleanName).toBe('passwd.pdf');

    // 2. Reject Windows PE (MZ) disguised as a PDF
    const mzBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const mzCheck = verifyDocumentMagicBytes(mzBuffer, 'application/pdf');
    expect(mzCheck.valid).toBe(false);
    expect(mzCheck.isExecutable).toBe(true);

    // 3. Reject Linux ELF disguised as a JPEG
    const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);
    const elfCheck = verifyDocumentMagicBytes(elfBuffer, 'image/jpeg');
    expect(elfCheck.valid).toBe(false);
    expect(elfCheck.isExecutable).toBe(true);

    // 4. Reject Script Shebang (#!) disguised as a PNG
    const scriptBuffer = Buffer.from('#!/bin/bash\nrm -rf /');
    const scriptCheck = verifyDocumentMagicBytes(scriptBuffer, 'image/png');
    expect(scriptCheck.valid).toBe(false);
    expect(scriptCheck.isExecutable).toBe(true);

    // 5. Valid PDF Magic Bytes (%PDF-)
    const pdfBuffer = Buffer.from('%PDF-1.7\n%stream');
    const pdfCheck = verifyDocumentMagicBytes(pdfBuffer, 'application/pdf');
    expect(pdfCheck.valid).toBe(true);

    // 6. Valid PNG Magic Bytes
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const pngCheck = verifyDocumentMagicBytes(pngBuffer, 'image/png');
    expect(pngCheck.valid).toBe(true);

    // 7. Full document upload validation rejection for disguised payload via apply API
    const reqDisguised = new Request('http://localhost:3000/api/admissions/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Disguised Attacker',
        email: 'attacker@example.com',
        courseId: 'crs-asp-01',
        documents: [
          {
            filename: 'malicious.pdf',
            mimeType: 'application/pdf',
            fileSizeBytes: 1024,
            contentBase64: Buffer.from([0x4d, 0x5a, 0x90, 0x00]).toString('base64'),
          },
        ],
      }),
    });
    const resDisguised = await applyHandler(reqDisguised);
    expect(resDisguised.status).toBe(400);
    const bodyDisguised = await resDisguised.json();
    expect(bodyDisguised.error).toMatch(/Executable binary files/i);
  });

  // --------------------------------------------------------------------------
  // Audit 13: Administrator Authorization Guard: Zero Dev Bypass & Role Canonicalization
  // --------------------------------------------------------------------------
  it('13. should reject unauthenticated requests and correctly canonicalize administrator roles', async () => {
    // 1. Unauthenticated request MUST return 401 (zero dev bypass)
    const unauthReq = new Request('http://localhost:3000/api/admin/academic/subtopics');
    const unauthResult = authorizeAdmin(unauthReq);
    expect('errorResponse' in unauthResult).toBe(true);
    if ('errorResponse' in unauthResult) {
      expect(unauthResult.errorResponse.status).toBe(401);
    }

    // 2. Student token MUST return 403 Forbidden
    const studentUser = await db.getUserByEmail('student@zealosh.com');
    expect(studentUser).toBeDefined();
    const studentToken = signToken(studentUser!);
    const studentReq = new Request('http://localhost:3000/api/admin/academic/subtopics', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const studentResult = authorizeAdmin(studentReq);
    expect('errorResponse' in studentResult).toBe(true);
    if ('errorResponse' in studentResult) {
      expect(studentResult.errorResponse.status).toBe(403);
    }

    // 3. SUPER_ADMIN token MUST succeed
    const superAdminUser = await db.getUserByEmail('admin@zealosh.com');
    expect(superAdminUser).toBeDefined();
    const adminToken = signToken(superAdminUser!);
    const adminReq = new Request('http://localhost:3000/api/admin/academic/subtopics', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminResult = authorizeAdmin(adminReq);
    expect('actor' in adminResult).toBe(true);
    if ('actor' in adminResult) {
      expect(adminResult.actor.role).toBe('SUPER_ADMIN');
    }

    // 4. Legacy ORG_ADMIN token canonicalized to institutional ADMIN
    const orgAdminToken = signToken({
      ...superAdminUser!,
      role: 'ORG_ADMIN' as any,
    });
    const orgAdminReq = new Request('http://localhost:3000/api/admin/academic/subtopics', {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    const orgAdminResult = authorizeAdmin(orgAdminReq);
    expect('actor' in orgAdminResult).toBe(true);
    if ('actor' in orgAdminResult) {
      expect(orgAdminResult.actor.role).toBe('ADMIN');
    }
  });
});
