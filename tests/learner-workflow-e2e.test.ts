import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { db } from '../src/lib/store/db';
import { signToken } from '../src/lib/auth/jwt';
import { User, Enrollment } from '../src/types';
import { GET as getExamsHandler } from '../src/app/api/exams/route';
import { POST as startExamHandler } from '../src/app/api/exams/[examId]/start/route';
import { POST as submitExamHandler } from '../src/app/api/exams/[examId]/submit/route';
import { PUT as saveAnswersHandler } from '../src/app/api/exams/[examId]/answers/route';
import { GET as verifyCertificateHandler } from '../src/app/api/certificates/verify/[code]/route';
import { POST as revokeCertificateHandler } from '../src/app/api/admin/certificates/revoke/route';

describe('Zealosh LMS — Milestone 5: End-to-End Learner Journey & Exam Gating Suite', () => {
  const originalStorage = process.env.DATABASE_STORAGE;

  const testStudent: User = {
    id: 'usr-m5-learner',
    email: 'm5-learner@zealosh.com',
    name: 'Pooja Varma',
    role: 'STUDENT',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const unenrolledStudent: User = {
    id: 'usr-m5-unenrolled',
    email: 'm5-unenrolled@zealosh.com',
    name: 'Unenrolled Candidate',
    role: 'STUDENT',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const superAdmin: User = {
    id: 'usr-m5-admin',
    email: 'm5-admin@zealosh.com',
    name: 'Dr. Systems Admin',
    role: 'SUPER_ADMIN',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const studentToken = signToken(testStudent);
  const unenrolledToken = signToken(unenrolledStudent);
  const adminToken = signToken(superAdmin);

  beforeAll(() => {
    process.env.DATABASE_STORAGE = 'in_memory';
  });

  afterAll(() => {
    process.env.DATABASE_STORAGE = originalStorage;
  });

  beforeEach(async () => {
    db.resetToSeed();
    await db.saveUser(testStudent);
    await db.saveUser(unenrolledStudent);
    await db.saveUser(superAdmin);
  });

  // --------------------------------------------------------------------------
  // 1. Unauthenticated exam start is rejected
  // --------------------------------------------------------------------------
  it('1. should reject unauthenticated requests to start an exam', async () => {
    const req = new Request('http://localhost:3000/api/exams/bp-asp-bcsp-v10/start', {
      method: 'POST',
    });

    const res = await startExamHandler(req, { params: { examId: 'bp-asp-bcsp-v10' } });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
  });

  // --------------------------------------------------------------------------
  // 2. Unenrolled student cannot start exam for a course
  // --------------------------------------------------------------------------
  it('2. should reject exam attempt when candidate is not enrolled in the corresponding course', async () => {
    const req = new Request('http://localhost:3000/api/exams/bp-asp-bcsp-v10/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${unenrolledToken}` },
    });

    const res = await startExamHandler(req, { params: { examId: 'bp-asp-bcsp-v10' } });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('EXAM_UNENROLLED');
    expect(body.error).toContain('Enrollment Required');
  });

  // --------------------------------------------------------------------------
  // 3. Enrolled student with <80% progress cannot start exam
  // --------------------------------------------------------------------------
  it('3. should reject exam attempt when coursework progression is below 80% threshold', async () => {
    // Enroll testStudent with 25% progress
    const enrollment = await db.enrollStudent({
      userId: testStudent.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
    });
    await db.updateEnrollmentProgress(enrollment.enrollment.id, ['lsn-asp-01'], 25);

    const req = new Request('http://localhost:3000/api/exams/bp-asp-bcsp-v10/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await startExamHandler(req, { params: { examId: 'bp-asp-bcsp-v10' } });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('EXAM_PROGRESS_INSUFFICIENT');
    expect(body.currentProgressPercent).toBe(25);
    expect(body.requiredProgressPercent).toBe(80);
    expect(body.error).toContain('Coursework Prerequisite Incomplete');
  });

  // --------------------------------------------------------------------------
  // 4. Admin override allows starting exam for auditing/testing
  // --------------------------------------------------------------------------
  it('4. should allow superadmin to start exam attempt directly without student progress gate', async () => {
    const req = new Request('http://localhost:3000/api/exams/bp-asp-bcsp-v10/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const res = await startExamHandler(req, { params: { examId: 'bp-asp-bcsp-v10' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attemptId).toBeDefined();
    expect(body.blueprint.title).toContain('ASP');
    expect(body.questions.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // 5. Gating status accurately reflected in GET /api/exams
  // --------------------------------------------------------------------------
  it('5. should expose lock reasons and progress thresholds in GET /api/exams catalog', async () => {
    // Before progress: testStudent has 25% progress
    const enrollment = await db.enrollStudent({
      userId: testStudent.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
    });
    await db.updateEnrollmentProgress(enrollment.enrollment.id, ['lsn-asp-01'], 25);

    const req = new Request('http://localhost:3000/api/exams', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getExamsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    const aspBlueprint = body.blueprints.find((b: any) => b.id === 'bp-asp-bcsp-v10');
    expect(aspBlueprint).toBeDefined();
    expect(aspBlueprint.isUnlocked).toBe(false);
    expect(aspBlueprint.lockReason).toBe('PROGRESS_INSUFFICIENT');
    expect(aspBlueprint.currentProgressPercent).toBe(25);
    expect(aspBlueprint.requiredProgressPercent).toBe(80);
  });

  // --------------------------------------------------------------------------
  // 6. Completing coursework (100% progress) unlocks exam
  // --------------------------------------------------------------------------
  it('6. should unlock exam when student achieves 80%+ lesson progress', async () => {
    const enrollment = await db.enrollStudent({
      userId: testStudent.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
    });
    await db.updateEnrollmentProgress(
      enrollment.enrollment.id,
      ['lsn-asp-01', 'lsn-asp-02', 'lsn-asp-03', 'lsn-asp-04'],
      100
    );

    const req = new Request('http://localhost:3000/api/exams', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getExamsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    const aspBlueprint = body.blueprints.find((b: any) => b.id === 'bp-asp-bcsp-v10');
    expect(aspBlueprint.isUnlocked).toBe(true);
    expect(aspBlueprint.lockReason).toBeNull();
    expect(aspBlueprint.currentProgressPercent).toBe(100);
  });

  // --------------------------------------------------------------------------
  // 7. Unlocked student starts exam and receives redacted questions
  // --------------------------------------------------------------------------
  it('7. should allow eligible student to start exam and securely redact answer keys', async () => {
    const enrollment = await db.enrollStudent({
      userId: testStudent.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
    });
    await db.updateEnrollmentProgress(enrollment.enrollment.id, ['lsn-asp-01', 'lsn-asp-02'], 100);

    const req = new Request('http://localhost:3000/api/exams/bp-asp-bcsp-v10/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await startExamHandler(req, { params: { examId: 'bp-asp-bcsp-v10' } });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.attemptId).toBeDefined();
    expect(body.deadlineTime).toBeDefined();
    expect(Array.isArray(body.questions)).toBe(true);

    // Verify answers are strictly redacted
    body.questions.forEach((q: any) => {
      expect(q.correctOptionIds).toBeUndefined();
      expect(q.explanation).toBeUndefined();
      expect(q.stem).toBeDefined();
      expect(q.options.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 8. In-flight answer autosave persists selections
  // --------------------------------------------------------------------------
  it('8. should autosave in-flight answers and bookmarks during examination', async () => {
    const enrollment = await db.enrollStudent({
      userId: testStudent.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
    });
    await db.updateEnrollmentProgress(enrollment.enrollment.id, ['lsn-asp-01'], 100);

    // Start exam
    const startReq = new Request('http://localhost:3000/api/exams/bp-asp-bcsp-v10/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const startRes = await startExamHandler(startReq, { params: { examId: 'bp-asp-bcsp-v10' } });
    const { attemptId, questions } = await startRes.json();

    // Autosave answers
    const saveReq = new Request('http://localhost:3000/api/exams/bp-asp-bcsp-v10/answers', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        attemptId,
        answers: { [questions[0].id]: ['opt-b'] },
        bookmarks: [questions[0].id],
      }),
    });

    const saveRes = await saveAnswersHandler(saveReq, { params: { examId: 'bp-asp-bcsp-v10' } });
    expect(saveRes.status).toBe(200);
    const saveBody = await saveRes.json();
    expect(saveBody.success).toBe(true);
    expect(saveBody.answeredCount).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 9. Passing exam triggers auto-issuance of certificate with metadata return
  // --------------------------------------------------------------------------
  it('9. should score exam authoritatively and issue certificate upon passing score', async () => {
    const enrollment = await db.enrollStudent({
      userId: testStudent.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
    });
    await db.updateEnrollmentProgress(enrollment.enrollment.id, ['lsn-asp-01'], 100);

    // Start exam
    const startReq = new Request('http://localhost:3000/api/exams/bp-asp-bcsp-v10/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const startRes = await startExamHandler(startReq, { params: { examId: 'bp-asp-bcsp-v10' } });
    const { attemptId } = await startRes.json();

    // Answer all 5 questions with known correct options:
    // q-asp-01: 'opt-b' (13.3 mR/hr)
    // q-asp-02: 'opt-b' (88 dBA)
    // q-asp-03: 'opt-c' (LEV)
    // q-asp-04: 'opt-d' (Class D)
    // q-asp-05: 'opt-a' (Ignitability, Corrosivity...)
    await db.saveExamAnswers(attemptId, testStudent.id, {
      'q-asp-01': ['opt-b'],
      'q-asp-02': ['opt-b'],
      'q-asp-03': ['opt-c'],
      'q-asp-04': ['opt-d'],
      'q-asp-05': ['opt-a'],
    });

    // Submit exam
    const submitReq = new Request('http://localhost:3000/api/exams/bp-asp-bcsp-v10/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ attemptId }),
    });

    const submitRes = await submitExamHandler(submitReq, { params: { examId: 'bp-asp-bcsp-v10' } });
    expect(submitRes.status).toBe(200);
    const submitBody = await submitRes.json();

    expect(submitBody.success).toBe(true);
    expect(submitBody.result.passed).toBe(true);
    expect(submitBody.result.totalScore).toBe(100);
    expect(submitBody.result.certificate).toBeDefined();
    expect(submitBody.result.certificate.certificateCode).toMatch(/ZEALOSH-ASP-\d{4}-[A-Z0-9]+/);
    expect(submitBody.result.certificate.verificationUrl).toContain('/verify/');
  });

  // --------------------------------------------------------------------------
  // 10. Public certificate verification route authenticates issued credential
  // --------------------------------------------------------------------------
  it('10. should publicly verify issued certificate authenticity and candidate details', async () => {
    const cert = await db.issueCertificate(testStudent.id, 'crs-asp-01', 94);
    expect(cert.status).toBe('ISSUED');

    const verifyReq = new Request(`http://localhost:3000/api/certificates/verify/${cert.certificateCode}`);
    const verifyRes = await verifyCertificateHandler(verifyReq, {
      params: { code: cert.certificateCode },
    });

    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.verified).toBe(true);
    expect(verifyBody.certificate.certificateCode).toBe(cert.certificateCode);
    expect(verifyBody.certificate.userName).toBe(testStudent.name);
    expect(verifyBody.certificate.courseTitle).toContain('ASP');
    expect(verifyBody.certificate.scorePercent).toBe(94);
    expect(verifyBody.certificate.status).toBe('ISSUED');
  });

  // --------------------------------------------------------------------------
  // 11. Administrator certificate revocation updates status and logs audit
  // --------------------------------------------------------------------------
  it('11. should allow administrator to revoke compromised certificate with audit logging', async () => {
    const cert = await db.issueCertificate(testStudent.id, 'crs-asp-01', 88);

    const revokeReq = new Request('http://localhost:3000/api/admin/certificates/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        code: cert.certificateCode,
        reason: 'Integrity policy violation during proctor review',
      }),
    });

    const revokeRes = await revokeCertificateHandler(revokeReq);
    expect(revokeRes.status).toBe(200);
    const revokeBody = await revokeRes.json();
    expect(revokeBody.success).toBe(true);
    expect(revokeBody.certificate.status).toBe('REVOKED');
    expect(revokeBody.certificate.revocationReason).toBe('Integrity policy violation during proctor review');

    // Subsequent public verification shows revoked status
    const verifyReq = new Request(`http://localhost:3000/api/certificates/verify/${cert.certificateCode}`);
    const verifyRes = await verifyCertificateHandler(verifyReq, {
      params: { code: cert.certificateCode },
    });
    const verifyBody = await verifyRes.json();
    expect(verifyBody.verified).toBe(true);
    expect(verifyBody.certificate.status).toBe('REVOKED');
  });
});
