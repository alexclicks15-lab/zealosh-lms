import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../src/lib/store/db';
import { signToken } from '../src/lib/auth/jwt';
import { bbbAdapter, BBBRecordingItem } from '../src/lib/adapters/bbb-adapter';
import { recordingIngestionService } from '../src/lib/storage/recording-ingestion-service';
import { resolveCourseRecordings } from '../src/lib/store/course-recording-resolver';
import { resolveStudentLiveSessions } from '../src/lib/store/live-session-resolver';
import { POST as postWebhook } from '../src/app/api/webhooks/bbb/recording/route';
import { POST as postAdminReconcile } from '../src/app/api/admin/recordings/reconcile/route';
import { ClassRecording, Course, Enrollment, LiveSession, User } from '../src/types';

describe('Zealosh LMS — CP-8.10: Webhook Security Hardening & Recording Ingestion Suite', () => {
  const originalStorage = process.env.DATABASE_STORAGE;
  const originalSecret = process.env.BBB_WEBHOOK_SECRET;
  const webhookSecret = 'zealosh-test-webhook-secret-2026';

  // Seed Entities
  const courseAsp: Course = {
    id: 'crs-asp-01',
    slug: 'asp-examination-prep',
    title: 'Associate Safety Professional (ASP) Examination Prep',
    headline: 'ASP Comprehensive Prep',
    description: 'Comprehensive preparation for BCSP ASP certification.',
    deliveryModel: 'HYBRID',
    leadInstructorId: 'usr-inst-asp',
    coInstructorIds: [],
    certificationType: 'ASP',
    status: 'PUBLISHED',
    learningObjectives: [],
    prerequisites: [],
    priceInr: 35000,
    priceUsd: 499,
    durationWeeks: 10,
    coverImage: '/images/asp-thumb.jpg',
    modulesCount: 4,
    totalLessons: 20,
    totalHours: 40,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const batchActiveAsp: any = {
    id: 'btc-asp-nov26',
    courseId: courseAsp.id,
    name: 'ASP November 2026 Evening Cohort',
    instructorId: 'usr-inst-asp',
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-12-15T00:00:00Z',
    schedule: 'Mon/Wed/Fri 19:00-21:00 IST',
    maxStudents: 35,
    enrolledCount: 15,
    status: 'ACTIVE',
  };

  const studentEnrolled: User = {
    id: 'usr-std-asp-enrolled',
    name: 'Pooja Varma',
    email: 'pooja.varma@zealosh.com',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const superAdminUser: User = {
    id: 'usr-admin-super',
    name: 'Super Admin Officer',
    email: 'admin.super@zealosh.com',
    passwordHash: 'hash',
    role: 'SUPER_ADMIN',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const instructorAsp: User = {
    id: 'usr-inst-asp',
    name: 'Er. Vishnu Nair (Lead Faculty)',
    email: 'vishnu.inst@zealosh.com',
    passwordHash: 'hash',
    role: 'INSTRUCTOR',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const activeEnrollment: Enrollment = {
    id: 'enr-asp-active',
    userId: studentEnrolled.id,
    courseId: courseAsp.id,
    batchId: batchActiveAsp.id,
    status: 'ACTIVE',
    enrolledAt: '2026-10-01T00:00:00Z',
    expiresAt: '2027-10-01T00:00:00Z',
    progressPercent: 25,
    completedLessonIds: [],
  };

  const sessionAsp01: LiveSession = {
    id: 'ses-asp-01',
    meetingId: 'mtg-asp-01',
    courseId: courseAsp.id,
    batchId: batchActiveAsp.id,
    title: 'Industrial Ventilation & Contaminant Transport Calculations',
    scheduledStartTime: '2026-10-28T18:00:00Z',
    durationMinutes: 90,
    instructorId: instructorAsp.id,
    status: 'ENDED',
  };

  const sessionAsp02: LiveSession = {
    id: 'ses-asp-02',
    meetingId: 'mtg-asp-02',
    courseId: courseAsp.id,
    batchId: batchActiveAsp.id,
    title: 'Radiation Safety, Shielding & Inverse Square Laws',
    scheduledStartTime: '2026-10-30T18:00:00Z',
    durationMinutes: 120,
    instructorId: instructorAsp.id,
    status: 'ENDED',
  };

  let tokenAdmin: string;
  let tokenStudent: string;

  beforeAll(() => {
    process.env.DATABASE_STORAGE = 'in_memory';
    process.env.BBB_WEBHOOK_SECRET = webhookSecret;
    recordingIngestionService.reloadSecrets();
    tokenAdmin = signToken(superAdminUser);
    tokenStudent = signToken(studentEnrolled);
  });

  afterAll(() => {
    process.env.DATABASE_STORAGE = originalStorage;
    if (originalSecret !== undefined) {
      process.env.BBB_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.BBB_WEBHOOK_SECRET;
    }
    recordingIngestionService.reloadSecrets();
  });

  beforeEach(async () => {
    db.resetToSeed();
    bbbAdapter.clearMockRecordings();
    process.env.BBB_WEBHOOK_SECRET = webhookSecret;
    recordingIngestionService.reloadSecrets();

    await db.saveCourse(courseAsp);
    db.batches.set(batchActiveAsp.id, batchActiveAsp);
    await db.saveUser(studentEnrolled);
    await db.saveUser(superAdminUser);
    await db.saveUser(instructorAsp);
    db.enrollments.set(activeEnrollment.id, activeEnrollment);

    await db.saveLiveSession({ ...sessionAsp01, status: 'ENDED', recordingUrl: undefined });
    await db.saveLiveSession({ ...sessionAsp02, status: 'ENDED', recordingUrl: undefined });
  });

  // Independent Checksum Calculation Helper (Documented BBB Webhooks algorithm)
  // CHECKSUM = HASH(callbackURLWithoutChecksum + rawBody + salt)
  function calculateBBBChecksum(url: string, body: string, secret: string, algo: 'sha256' | 'sha1' = 'sha256'): string {
    const parsed = new URL(url);
    parsed.searchParams.delete('checksum');
    const remainingQuery = parsed.searchParams.toString();
    const basePath = `${parsed.origin}${parsed.pathname}`;
    const rawUrl = remainingQuery ? `${basePath}?${remainingQuery}` : basePath;
    return crypto.createHash(algo).update(`${rawUrl}${body}${secret}`).digest('hex');
  }

  // Helper to construct independent Recording-Ready HS256 JWT
  function signRecordingReadyJwt(
    payload: { meeting_id?: string; record_id?: string; [key: string]: any },
    secret: string = webhookSecret,
    headerOverride?: any
  ): string {
    if (headerOverride) {
      const headerStr = Buffer.from(JSON.stringify(headerOverride)).toString('base64url');
      const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
      if (headerOverride.alg === 'none') {
        return `${headerStr}.${payloadStr}.`;
      }
      const sig = crypto.createHmac('sha256', secret).update(`${headerStr}.${payloadStr}`).digest('base64url');
      return `${headerStr}.${payloadStr}.${sig}`;
    }
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
  }

  // Helper to construct HMAC signature
  function generateHmac(payload: string, secret: string = webhookSecret): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  // =========================================================================
  // Section 1: CP-8.10 Webhook Auth & Request Validation (Prompt Section 4)
  // =========================================================================

  describe('1. Webhook Auth & Cryptographic Security Hardening', () => {
    it('Scenario 1a: Valid callback signed with documented SHA-256 algorithm accepted with 200 OK', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const rawBody = JSON.stringify({
        event: 'recording_published',
        recordID: 'rec-webhook-sha256-01',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Ventilation Calculations Lecture (SHA-256)',
        playbackUrl: 'https://bbb.zealosh.com/playback/slides/rec-webhook-sha256-01',
        length: 5400,
        size: 250000000,
      });

      const checksum = calculateBBBChecksum(callbackBaseUrl, rawBody, webhookSecret, 'sha256');
      const requestUrl = `${callbackBaseUrl}?checksum=${checksum}`;

      const request = new Request(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      const response = await postWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('SUCCESS');
      expect(data.recordingId).toBe('rec-webhook-sha256-01');
    });

    it('Scenario 1b: Valid callback signed with fallback SHA-1 algorithm accepted with 200 OK', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const rawBody = JSON.stringify({
        event: 'recording_published',
        recordID: 'rec-webhook-sha1-01b',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Ventilation Calculations Lecture (SHA-1)',
        playbackUrl: 'https://bbb.zealosh.com/playback/slides/rec-webhook-sha1-01b',
        length: 5400,
      });

      const checksum = calculateBBBChecksum(callbackBaseUrl, rawBody, webhookSecret, 'sha1');
      const requestUrl = `${callbackBaseUrl}?checksum=${checksum}`;

      const request = new Request(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      const response = await postWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('SUCCESS');
    });

    it('Scenario 1c: Valid bearer token accepted with 200 OK', async () => {
      const payload = JSON.stringify({
        event: 'recording_published',
        recordID: 'rec-webhook-bearer-01c',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Ventilation Calculations Lecture (Bearer)',
        playbackUrl: 'https://bbb.zealosh.com/playback/slides/rec-webhook-bearer-01c',
        length: 90,
      });

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`,
        },
        body: payload,
      });

      const response = await postWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('SUCCESS');
      expect(data.recordingId).toBe('rec-webhook-bearer-01c');
    });

    it('Scenario 1d: Valid HMAC signature accepted with 200 OK', async () => {
      const payload = JSON.stringify({
        event: 'recording_published',
        recordID: 'rec-webhook-hmac-01d',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Ventilation Calculations Lecture (HMAC)',
        playbackUrl: 'https://bbb.zealosh.com/playback/slides/rec-webhook-hmac-01d',
        length: 90,
      });

      const signature = generateHmac(payload);

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BBB-Signature': signature,
        },
        body: payload,
      });

      const response = await postWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('SUCCESS');
    });

    it('Scenario 2: Callback with invalid checksum rejected with 401 Unauthorized', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const rawBody = JSON.stringify({
        recordID: 'rec-invalid-checksum-02',
        meetingID: sessionAsp01.meetingId,
      });

      const invalidChecksum = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const requestUrl = `${callbackBaseUrl}?checksum=${invalidChecksum}`;

      const request = new Request(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid BigBlueButton callback checksum/i);
    });

    it('Scenario 3: Callback body altered after signing rejected with 401 Unauthorized', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const originalBody = JSON.stringify({
        recordID: 'rec-tampered-03',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
      });

      // Sign the original body
      const checksum = calculateBBBChecksum(callbackBaseUrl, originalBody, webhookSecret);

      // Attacker tampers with the body after signing
      const tamperedBody = JSON.stringify({
        recordID: 'rec-tampered-03',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        tamperedField: 'malicious-injected-value',
      });

      const request = new Request(`${callbackBaseUrl}?checksum=${checksum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: tamperedBody,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid BigBlueButton callback checksum/i);
    });

    it('Scenario 4: Callback with wrong shared secret rejected with 401 Unauthorized', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const rawBody = JSON.stringify({
        recordID: 'rec-wrong-secret-04',
        meetingID: sessionAsp01.meetingId,
      });

      // Signed with a different, foreign secret
      const checksum = calculateBBBChecksum(callbackBaseUrl, rawBody, 'wrong-foreign-salt-999');

      const request = new Request(`${callbackBaseUrl}?checksum=${checksum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
    });

    it('Scenario 5: Callback signed for a different URL rejected with 401 Unauthorized', async () => {
      const actualServerUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const foreignUrl = 'https://evil-attacker.example.com/api/webhooks/callback';
      const rawBody = JSON.stringify({
        recordID: 'rec-url-mismatch-05',
        meetingID: sessionAsp01.meetingId,
      });

      // Sign using foreignUrl instead of the actual destination URL
      const checksum = calculateBBBChecksum(foreignUrl, rawBody, webhookSecret);

      // Sent to actualServerUrl with foreign signature
      const request = new Request(`${actualServerUrl}?checksum=${checksum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid BigBlueButton callback checksum/i);
    });

    it('Scenario 6: Missing signature and missing auth header rejected with 401 Unauthorized', async () => {
      const payload = JSON.stringify({
        recordID: 'rec-missing-auth-06',
        meetingID: sessionAsp01.meetingId,
      });

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Missing BigBlueButton authentication credentials/i);
    });

    it('Scenario 7: Malformed signature format rejected with 401 Unauthorized', async () => {
      const payload = JSON.stringify({
        recordID: 'rec-malformed-sig-07',
        meetingID: sessionAsp01.meetingId,
      });

      // Non-hex characters / empty / whitespace checksum
      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording?checksum=???not-a-hex-signature???', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
    });

    it('Scenario 8: Missing or empty shared secret in production configuration fails safely without unauthenticated bypass', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalBbSalt = process.env.BIGBLUEBUTTON_SALT;
      const originalSecSalt = process.env.BBB_SECURITY_SALT;
      const originalBbSec = process.env.BIGBLUEBUTTON_SECRET;

      try {
        // Simulate production environment with no secrets configured
        (process.env as any).NODE_ENV = 'production';
        delete process.env.BBB_WEBHOOK_SECRET;
        delete process.env.BIGBLUEBUTTON_WEBHOOK_SECRET;
        delete process.env.BBB_SECURITY_SALT;
        delete process.env.BIGBLUEBUTTON_SALT;
        delete process.env.BIGBLUEBUTTON_SECRET;
        recordingIngestionService.reloadSecrets();

        const rawBody = JSON.stringify({ recordID: 'rec-prod-unconfigured-08', meetingID: sessionAsp01.meetingId });
        const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording?checksum=abcdef123456', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: rawBody,
        });

        const response = await postWebhook(request);
        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toMatch(/secret is not configured on server/i);
      } finally {
        (process.env as any).NODE_ENV = originalNodeEnv;
        if (originalBbSalt) process.env.BIGBLUEBUTTON_SALT = originalBbSalt;
        if (originalSecSalt) process.env.BBB_SECURITY_SALT = originalSecSalt;
        if (originalBbSec) process.env.BIGBLUEBUTTON_SECRET = originalBbSec;
        process.env.BBB_WEBHOOK_SECRET = webhookSecret;
        recordingIngestionService.reloadSecrets();
      }
    });

    it('Scenario 9: Valid event delivered with application/x-www-form-urlencoded encoding accepted with 200 OK', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const eventJson = JSON.stringify({
        recordID: 'rec-form-encoded-09',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Form Encoded Event Test',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-form-encoded-09',
        length: 3600,
      });

      // Construct application/x-www-form-urlencoded body
      const formBody = `event=${encodeURIComponent(eventJson)}&timestamp=1761674400000`;
      const checksum = calculateBBBChecksum(callbackBaseUrl, formBody, webhookSecret);

      const request = new Request(`${callbackBaseUrl}?checksum=${checksum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.recordingId).toBe('rec-form-encoded-09');

      const rec = await db.getClassRecording('rec-form-encoded-09');
      expect(rec).toBeDefined();
      expect(rec?.status).toBe('AVAILABLE');
    });

    it('Scenario 10a: Malformed form-encoded body (missing event parameter) rejected with 400 Bad Request', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const formBody = 'timestamp=1761674400000&unrelated=value';
      const checksum = calculateBBBChecksum(callbackBaseUrl, formBody, webhookSecret);

      const request = new Request(`${callbackBaseUrl}?checksum=${checksum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/missing event parameter/i);
    });

    it('Scenario 10b: Malformed JSON within event form parameter rejected with 400 Bad Request', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const formBody = `event=${encodeURIComponent('{ broken json: true, ')}&timestamp=123`;
      const checksum = calculateBBBChecksum(callbackBaseUrl, formBody, webhookSecret);

      const request = new Request(`${callbackBaseUrl}?checksum=${checksum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid form-encoded JSON payload/i);
    });

    it('Scenario 10c: Malformed raw JSON payload rejected with 400 Bad Request', async () => {
      const malformedPayload = '{"event": "recording_published", "recordID": '; // truncated syntax

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`,
        },
        body: malformedPayload,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid JSON payload/i);
    });

    it('Scenario 11: Callback with body exceeding 1 MB rejected with 413 Payload Too Large', async () => {
      const largePadding = 'A'.repeat(1024 * 1024 + 100);
      const oversizedPayload = JSON.stringify({
        event: 'recording_published',
        recordID: 'rec-oversized-11',
        meetingID: sessionAsp01.meetingId,
        padding: largePadding,
      });

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`,
        },
        body: oversizedPayload,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toMatch(/Payload too large/i);
    });

    it('Scenario 12: Conflicting auth mechanisms (valid Bearer + invalid HMAC) rejected with 401 Unauthorized', async () => {
      const payload = JSON.stringify({
        event: 'recording_published',
        recordID: 'rec-conflicting-auth-12',
        meetingID: sessionAsp01.meetingId,
      });

      // Valid Bearer token but forged/invalid HMAC signature header
      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`,
          'X-BBB-Signature': '0000000000000000000000000000000000000000000000000000000000000000',
        },
        body: payload,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid HMAC signature/i);
    });

    it('Scenario 13: Native bbb-webhooks event array payload [ { data: { id: "rap-publish-ended", ... } } ] accepted with 200 OK', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const nativeBbbPayload = JSON.stringify([
        {
          data: {
            type: 'event',
            id: 'rap-publish-ended',
            attributes: {
              meeting: {
                'external-meeting-id': sessionAsp01.meetingId,
                name: 'Ventilation & Fluid Dynamics Lecture',
              },
              recording: {
                'record-id': 'rec-native-array-13',
                'meeting-id': sessionAsp01.meetingId,
                name: 'Ventilation & Fluid Dynamics Lecture',
                published: true,
                state: 'published',
                playback: {
                  format: [
                    {
                      type: 'presentation',
                      url: 'https://media.staging.zealosh.com/playback/presentation/2.3/rec-native-array-13',
                      length: 90,
                    },
                  ],
                },
                'raw-size': 420000000,
                metadata: {
                  sessionId: sessionAsp01.id,
                  courseId: courseAsp.id,
                  batchId: batchActiveAsp.id,
                },
              },
            },
          },
        },
      ]);

      const checksum = calculateBBBChecksum(callbackBaseUrl, nativeBbbPayload, webhookSecret);
      const request = new Request(`${callbackBaseUrl}?checksum=${checksum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: nativeBbbPayload,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.recordingId).toBe('rec-native-array-13');

      const rec = await db.getClassRecording('rec-native-array-13');
      expect(rec).toBeDefined();
      expect(rec?.status).toBe('AVAILABLE');
      expect(rec?.mediaUrl).toBe('https://media.staging.zealosh.com/playback/presentation/2.3/rec-native-array-13');
    });

    it('Scenario 14: Old CP-8.9 query-only checksum formula sha1(callName + query + secret) rejected with 401 Unauthorized', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const rawBody = JSON.stringify({
        recordID: 'rec-old-formula-14',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
      });

      // Old flawed formula from CP-8.9: sha1("recording" + query + secret) which ignored rawBody
      const oldQuery = 'meetingID=mtg-asp-01';
      const oldFlawedChecksum = crypto
        .createHash('sha1')
        .update(`recording${oldQuery}${webhookSecret}`)
        .digest('hex');

      const request = new Request(`${callbackBaseUrl}?${oldQuery}&checksum=${oldFlawedChecksum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid BigBlueButton callback checksum/i);
    });

    it('Scenario 15: Single-process concurrency: simultaneous duplicate deliveries are serialized safely without race conditions', async () => {
      const callbackBaseUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const payload = JSON.stringify({
        recordID: 'rec-concurrent-15',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Concurrent Ingestion Test',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-concurrent-15',
        length: 3600,
      });

      const checksum = calculateBBBChecksum(callbackBaseUrl, payload, webhookSecret);
      const url = `${callbackBaseUrl}?checksum=${checksum}`;

      // Dispatch 2 simultaneous webhook POSTs for the exact same recordID
      const [res1, res2] = await Promise.all([
        postWebhook(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })),
        postWebhook(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
      const actions = [data1.action, data2.action];

      // One request CREATED the record, and the concurrent sibling SKIPPED it idempotently
      expect(actions).toContain('CREATED');
      expect(actions).toContain('SKIPPED');

      // Database has exactly 1 recording record, not duplicate records
      const recording = await db.getClassRecording('rec-concurrent-15');
      expect(recording).toBeDefined();
      expect(recording?.status).toBe('AVAILABLE');
    });

    it('Scenario 16: Static query parameters in registered callback URL are preserved during checksum verification', async () => {
      // Callback URL with static query parameter: ?tenant=main
      const baseUrlWithQuery = 'https://lms.zealosh.com/api/webhooks/bbb/recording?tenant=main';
      const payload = JSON.stringify({
        recordID: 'rec-static-query-16',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Static Query Param Lecture',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-static-query-16',
      });

      // Upstream bbb-webhooks hashes (baseUrlWithQuery + rawBody + salt) and appends &checksum=<hash>
      const checksum = calculateBBBChecksum(baseUrlWithQuery, payload, webhookSecret);
      const requestUrl = `${baseUrlWithQuery}&checksum=${checksum}`;

      const request = new Request(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.recordingId).toBe('rec-static-query-16');
    });

    it('Scenario 17: Forged Host or forwarded header cannot alter signature URL to attacker domain', async () => {
      const actualServerUrl = 'https://lms.zealosh.com/api/webhooks/bbb/recording';
      const payload = JSON.stringify({
        recordID: 'rec-host-forgery-17',
        meetingID: sessionAsp01.meetingId,
      });

      // Attacker signs payload for their own host
      const attackerChecksum = calculateBBBChecksum('https://attacker.example.com/api/webhooks/bbb/recording', payload, webhookSecret);

      const request = new Request(`${actualServerUrl}?checksum=${attackerChecksum}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': 'attacker.example.com',
          'X-Forwarded-Host': 'attacker.example.com',
        },
        body: payload,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid BigBlueButton callback checksum/i);
    });
  });

  // =========================================================================
  // Section 1.5: BigBlueButton Recording-Ready Callbacks (meta_bbb-recording-ready-url)
  // =========================================================================

  describe('1.5. Recording-Ready URL Callback (signed_parameters HS256 JWT)', () => {
    it('Scenario RR-1: Valid signed_parameters HS256 JWT for known session accepted with 200 OK and marks session RECORDING_READY', async () => {
      // Seed upstream BBB recording item
      const upstreamMock: BBBRecordingItem = {
        recordID: 'rec-rr-valid-01',
        meetingID: sessionAsp01.meetingId,
        name: 'Ventilation Recording-Ready Workshop',
        published: true,
        state: 'published',
        playbackUrl: 'https://media.staging.zealosh.com/playback/presentation/2.3/rec-rr-valid-01',
        playbackFormat: 'presentation',
        playbackLength: 90,
        durationSeconds: 5400,
      };
      bbbAdapter.setMockRecordings([upstreamMock]);

      // Generate valid signed_parameters HS256 JWT
      const token = signRecordingReadyJwt({
        meeting_id: sessionAsp01.meetingId,
        record_id: 'rec-rr-valid-01',
      });

      const formBody = `signed_parameters=${encodeURIComponent(token)}`;
      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.recordingId).toBe('rec-rr-valid-01');

      // Verify ClassRecording created in DB
      const recording = await db.getClassRecording('rec-rr-valid-01');
      expect(recording).toBeDefined();
      expect(recording?.status).toBe('AVAILABLE');
      expect(recording?.mediaUrl).toBe('https://media.staging.zealosh.com/playback/presentation/2.3/rec-rr-valid-01');
      expect(recording?.sessionId).toBe(sessionAsp01.id);
      expect(recording?.courseId).toBe(courseAsp.id);
      expect(recording?.batchId).toBe(batchActiveAsp.id);

      // Verify LiveSession transition to RECORDING_READY
      const session = await db.getLiveSession(sessionAsp01.id);
      expect(session?.status).toBe('RECORDING_READY');
      expect(session?.recordingUrl).toBe('/recordings/rec-rr-valid-01');
    });

    it('Scenario RR-2: Callback with wrong shared secret rejected with 401 Unauthorized', async () => {
      const token = signRecordingReadyJwt(
        { meeting_id: sessionAsp01.meetingId, record_id: 'rec-rr-wrong-secret-02' },
        'wrong-secret-salt-12345'
      );

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=${encodeURIComponent(token)}`,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid signed_parameters JWT signature/i);
    });

    it('Scenario RR-3: Invalid JWT signature (tampered token) rejected with 401 Unauthorized', async () => {
      const validToken = signRecordingReadyJwt({
        meeting_id: sessionAsp01.meetingId,
        record_id: 'rec-rr-tampered-03',
      });
      const parts = validToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.tamperedSignatureHere`;

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=${encodeURIComponent(tamperedToken)}`,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Invalid signed_parameters JWT signature/i);
    });

    it('Scenario RR-4: Altered token payload after signing rejected with 401 Unauthorized', async () => {
      const validToken = signRecordingReadyJwt({
        meeting_id: sessionAsp01.meetingId,
        record_id: 'rec-rr-payload-tamper-04',
      });
      const parts = validToken.split('.');
      // Tamper payload base64
      const alteredPayload = Buffer.from(JSON.stringify({
        meeting_id: sessionAsp01.meetingId,
        record_id: 'forged-attacker-record-id',
      })).toString('base64url');
      const forgedToken = `${parts[0]}.${alteredPayload}.${parts[2]}`;

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=${encodeURIComponent(forgedToken)}`,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
    });

    it('Scenario RR-5: Unsupported JWT algorithm (alg: none or RS256) rejected with 401 Unauthorized', async () => {
      // alg: none
      const tokenNone = signRecordingReadyJwt(
        { meeting_id: sessionAsp01.meetingId, record_id: 'rec-rr-alg-none-05' },
        webhookSecret,
        { alg: 'none', typ: 'JWT' }
      );

      const reqNone = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=${encodeURIComponent(tokenNone)}`,
      });
      const resNone = await postWebhook(reqNone);
      expect(resNone.status).toBe(401);
      const dataNone = await resNone.json();
      expect(dataNone.error).toMatch(/Unsupported JWT algorithm 'none'/i);

      // alg: RS256 substitution attempt
      const tokenRs256 = signRecordingReadyJwt(
        { meeting_id: sessionAsp01.meetingId, record_id: 'rec-rr-alg-rs256-05' },
        webhookSecret,
        { alg: 'RS256', typ: 'JWT' }
      );

      const reqRs256 = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=${encodeURIComponent(tokenRs256)}`,
      });
      const resRs256 = await postWebhook(reqRs256);
      expect(resRs256.status).toBe(401);
      const dataRs256 = await resRs256.json();
      expect(dataRs256.error).toMatch(/Unsupported JWT algorithm 'RS256'/i);
    });

    it('Scenario RR-6: Missing or malformed signed_parameters rejected with 401 Unauthorized', async () => {
      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=not-a-valid-jwt-token-at-all`,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Malformed signed_parameters JWT token/i);
    });

    it('Scenario RR-7: Missing required meeting_id or record_id in JWT payload rejected with 400 Bad Request', async () => {
      // Token missing record_id
      const tokenMissingRecord = signRecordingReadyJwt({
        meeting_id: sessionAsp01.meetingId,
      } as any);

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=${encodeURIComponent(tokenMissingRecord)}`,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/Missing required meeting_id or record_id/i);
    });

    it('Scenario RR-8: Unknown meeting ID (no internal LiveSession) rejected with 410 Gone', async () => {
      const token = signRecordingReadyJwt({
        meeting_id: 'unknown-deleted-meeting-999',
        record_id: 'rec-rr-unknown-meeting-08',
      });

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=${encodeURIComponent(token)}`,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toMatch(/No internal LiveSession found for meeting ID/i);
    });

    it('Scenario RR-9: Duplicate callback delivery of valid authenticated signed_parameters handled idempotently', async () => {
      bbbAdapter.setMockRecordings([
        {
          recordID: 'rec-rr-duplicate-09',
          meetingID: sessionAsp01.meetingId,
          name: 'Idempotency Duplicate Test',
          published: true,
          state: 'published',
          playbackUrl: 'https://media.staging.zealosh.com/playback/rec-rr-duplicate-09',
        },
      ]);

      const token = signRecordingReadyJwt({
        meeting_id: sessionAsp01.meetingId,
        record_id: 'rec-rr-duplicate-09',
      });

      // Delivery 1: Created
      const res1 = await postWebhook(new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=${encodeURIComponent(token)}`,
      }));
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.action).toBe('CREATED');

      // Delivery 2: Skipped as duplicate
      const res2 = await postWebhook(new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=${encodeURIComponent(token)}`,
      }));
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.status).toBe('IGNORED_DUPLICATE');
      expect(data2.action).toBe('SKIPPED');
    });

    it('Scenario RR-10: Valid callback whose authoritative upstream recording state is not yet published remains PROCESSING', async () => {
      // Mock upstream BBB returns recording with state: 'processing', published: false
      bbbAdapter.setMockRecordings([
        {
          recordID: 'rec-rr-processing-10',
          meetingID: sessionAsp01.meetingId,
          name: 'Processing Video Stream',
          published: false,
          state: 'processing',
          playbackUrl: undefined,
        },
      ]);

      const token = signRecordingReadyJwt({
        meeting_id: sessionAsp01.meetingId,
        record_id: 'rec-rr-processing-10',
      });

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `signed_parameters=${encodeURIComponent(token)}`,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(200);

      const recording = await db.getClassRecording('rec-rr-processing-10');
      expect(recording?.status).toBe('PROCESSING');
      expect(recording?.mediaUrl).toBe('');
      expect(recording?.isDownloadable).toBe(false);

      // Session should NOT be RECORDING_READY yet
      const session = await db.getLiveSession(sessionAsp01.id);
      expect(session?.status).toBe('ENDED');
    });

    it('Scenario RR-11: Conflicting credentials (valid signed_parameters + invalid HMAC header) rejected with 401', async () => {
      const token = signRecordingReadyJwt({
        meeting_id: sessionAsp01.meetingId,
        record_id: 'rec-rr-conflict-11',
      });

      const request = new Request('https://lms.zealosh.com/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-BBB-Signature': '0000000000000000000000000000000000000000000000000000000000000000',
        },
        body: `signed_parameters=${encodeURIComponent(token)}`,
      });

      const response = await postWebhook(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/Conflicting invalid authentication credentials/i);
    });
  });

  // =========================================================================
  // Section 1.7: Ingestion Concurrency, Failure Propagation & Durable Idempotency Hardening
  // =========================================================================

  describe('1.7. Ingestion Concurrency, Failure Propagation & Durable Idempotency Hardening', () => {
    it('Scenario CC-1: First concurrent delivery fails, second delivery does NOT falsely report success', async () => {
      // Mock db.saveClassRecording to throw on first attempt only
      let attempts = 0;
      const originalSave = db.saveClassRecording.bind(db);
      db.saveClassRecording = async (rec) => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Database transaction deadlocked on first attempt');
        }
        return originalSave(rec);
      };

      try {
        const payload = {
          recordID: 'rec-cc-fail-01',
          meetingID: sessionAsp01.meetingId,
          state: 'published',
          playbackUrl: 'https://bbb.zealosh.com/playback/rec-cc-fail-01',
        };

        // Dispatch 2 concurrent calls
        const [res1, res2] = await Promise.all([
          recordingIngestionService.ingestRecording(payload),
          recordingIngestionService.ingestRecording(payload),
        ]);

        // Neither result should be a false positive "IGNORED_DUPLICATE" if no record was actually saved!
        // At least one failed or attempted retry:
        const hasFailure = res1.status === 'FAILED' || res2.status === 'FAILED';
        expect(hasFailure).toBe(true);
      } finally {
        db.saveClassRecording = originalSave;
      }
    });

    it('Scenario CC-2: First writer failure followed by retry: lock is released and retry succeeds', async () => {
      let failOnce = true;
      const originalSave = db.saveClassRecording.bind(db);
      db.saveClassRecording = async (rec) => {
        if (failOnce) {
          failOnce = false;
          throw new Error('Temporary disk I/O lock');
        }
        return originalSave(rec);
      };

      try {
        const payload = {
          recordID: 'rec-cc-retry-02',
          meetingID: sessionAsp01.meetingId,
          state: 'published',
          playbackUrl: 'https://bbb.zealosh.com/playback/rec-cc-retry-02',
        };

        // Attempt 1: Fails with 500
        const result1 = await recordingIngestionService.ingestRecording(payload);
        expect(result1.status).toBe('FAILED');

        // Verify lock is released and record does NOT exist in DB
        const inDb1 = await db.getClassRecording('rec-cc-retry-02');
        expect(inDb1).toBeUndefined();

        // Attempt 2 (Retry): Succeeds cleanly
        const result2 = await recordingIngestionService.ingestRecording(payload);
        expect(result2.status).toBe('SUCCESS');
        expect(result2.action).toBe('CREATED');

        const inDb2 = await db.getClassRecording('rec-cc-retry-02');
        expect(inDb2).toBeDefined();
        expect(inDb2?.status).toBe('AVAILABLE');
      } finally {
        db.saveClassRecording = originalSave;
      }
    });

    it('Scenario CC-3: Concurrent delivery with state transition: PROCESSING races with PUBLISHED', async () => {
      const recId = 'rec-cc-transition-03';

      // Request A has state: 'processing'
      const payloadProcessing = {
        recordID: recId,
        meetingID: sessionAsp01.meetingId,
        state: 'processing',
        name: 'Early Processing Delivery',
      };

      // Request B has state: 'published' with playbackUrl
      const payloadPublished = {
        recordID: recId,
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Late Ready Delivery',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-cc-transition-03',
        length: 3600,
      };

      // Ingest processing first
      await recordingIngestionService.ingestRecording(payloadProcessing);
      const inDbProcessing = await db.getClassRecording(recId);
      expect(inDbProcessing?.status).toBe('PROCESSING');

      // Now published delivery arrives: must NOT be skipped as duplicate; must apply the update!
      const updateResult = await recordingIngestionService.ingestRecording(payloadPublished);
      expect(updateResult.status).toBe('SUCCESS');
      expect(updateResult.action).toBe('UPDATED');

      const inDbPublished = await db.getClassRecording(recId);
      expect(inDbPublished?.status).toBe('AVAILABLE');
      expect(inDbPublished?.mediaUrl).toBe('https://bbb.zealosh.com/playback/rec-cc-transition-03');
    });

    it('Scenario CC-4: Out-of-order race: PUBLISHED arrives first, late PROCESSING is safely ignored', async () => {
      const recId = 'rec-cc-antidowngrade-04';

      // Published arrives first
      await recordingIngestionService.ingestRecording({
        recordID: recId,
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-cc-antidowngrade-04',
      });

      // Late processing event arrives
      const lateResult = await recordingIngestionService.ingestRecording({
        recordID: recId,
        meetingID: sessionAsp01.meetingId,
        state: 'processing',
      });

      expect(lateResult.status).toBe('IGNORED_DUPLICATE');
      expect(lateResult.action).toBe('SKIPPED');

      // Database recording remains AVAILABLE
      const recording = await db.getClassRecording(recId);
      expect(recording?.status).toBe('AVAILABLE');
      expect(recording?.mediaUrl).toBe('https://bbb.zealosh.com/playback/rec-cc-antidowngrade-04');
    });

    it('Scenario CC-5: Multi-instance durable uniqueness: saving the same recording ID updates rather than duplicating', async () => {
      const recId = 'rec-cc-uniqueness-05';

      const initialCount = (await db.getClassRecordings({ courseId: courseAsp.id })).length;

      // Instance A writes recording
      await db.saveClassRecording({
        id: recId,
        sessionId: sessionAsp01.id,
        courseId: courseAsp.id,
        batchId: batchActiveAsp.id,
        title: 'Instance A Title',
        storageProvider: 'EXTERNAL_SECURE',
        storagePath: `/recordings/${recId}`,
        mediaUrl: `https://bbb.zealosh.com/playback/${recId}`,
        durationSeconds: 3600,
        fileSizeBytes: 1000000,
        status: 'AVAILABLE',
        isDownloadable: true,
        availableFrom: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const afterFirst = (await db.getClassRecordings({ courseId: courseAsp.id })).length;
      expect(afterFirst).toBe(initialCount + 1);

      // Instance B writes same recording ID with updated metadata
      await db.saveClassRecording({
        id: recId,
        sessionId: sessionAsp01.id,
        courseId: courseAsp.id,
        batchId: batchActiveAsp.id,
        title: 'Instance B Title Updated',
        storageProvider: 'EXTERNAL_SECURE',
        storagePath: `/recordings/${recId}`,
        mediaUrl: `https://bbb.zealosh.com/playback/${recId}`,
        durationSeconds: 3600,
        fileSizeBytes: 1000000,
        status: 'AVAILABLE',
        isDownloadable: true,
        availableFrom: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const afterSecond = (await db.getClassRecordings({ courseId: courseAsp.id })).length;
      // Count must still be initialCount + 1, NOT initialCount + 2
      expect(afterSecond).toBe(initialCount + 1);

      const rec = await db.getClassRecording(recId);
      expect(rec?.title).toBe('Instance B Title Updated');
    });
  });

  // =========================================================================
  // Section B: Ingestion & Idempotency (Scenarios 6–12)
  // =========================================================================

  describe('2. Ingestion & Idempotency State Transitions', () => {
    it('Scenario 6: First-time published recording creates ClassRecording + marks LiveSession RECORDING_READY', async () => {
      // Pre-condition: session status is ENDED
      const preSession = await db.getLiveSession(sessionAsp01.id);
      expect(preSession?.status).toBe('ENDED');

      const result = await recordingIngestionService.ingestRecording({
        recordID: 'rec-published-first-06',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Industrial Ventilation Deep Dive',
        playbackUrl: 'https://bbb.zealosh.com/playback/slides/rec-published-first-06',
        length: 5400,
        size: 350000000,
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.action).toBe('CREATED');
      expect(result.recordingId).toBe('rec-published-first-06');

      // Verify ClassRecording in DB
      const recording = await db.getClassRecording('rec-published-first-06');
      expect(recording).toBeDefined();
      expect(recording?.status).toBe('AVAILABLE');
      expect(recording?.sessionId).toBe(sessionAsp01.id);
      expect(recording?.courseId).toBe(courseAsp.id);
      expect(recording?.batchId).toBe(batchActiveAsp.id);
      expect(recording?.mediaUrl).toBe('https://bbb.zealosh.com/playback/slides/rec-published-first-06');
      expect(recording?.isDownloadable).toBe(true);

      // Verify LiveSession transition to RECORDING_READY
      const postSession = await db.getLiveSession(sessionAsp01.id);
      expect(postSession?.status).toBe('RECORDING_READY');
      expect(postSession?.recordingUrl).toBe('/recordings/rec-published-first-06');
    });

    it('Scenario 7: Repeated published recording (identical recordID) returns IGNORED_DUPLICATE; no duplicate created', async () => {
      const payload = {
        recordID: 'rec-duplicate-07',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Duplicate Test Lecture',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-duplicate-07',
        length: 3600,
        size: 100000000,
      };

      // First delivery
      const res1 = await recordingIngestionService.ingestRecording(payload);
      expect(res1.status).toBe('SUCCESS');
      expect(res1.action).toBe('CREATED');

      const initialCount = (await db.getClassRecordings({ courseId: courseAsp.id })).length;

      // Second identical delivery
      const res2 = await recordingIngestionService.ingestRecording(payload);
      expect(res2.status).toBe('IGNORED_DUPLICATE');
      expect(res2.action).toBe('SKIPPED');
      expect(res2.message).toMatch(/Identical recording already ingested/i);

      // Check no duplicate created
      const currentRecordings = await db.getClassRecordings({ courseId: courseAsp.id });
      expect(currentRecordings.length).toBe(initialCount);
    });

    it('Scenario 8: Processing status creates or updates ClassRecording with status PROCESSING', async () => {
      const result = await recordingIngestionService.ingestRecording({
        recordID: 'rec-proc-08',
        meetingID: sessionAsp01.meetingId,
        state: 'processing',
        name: 'Ventilation Lecture In Processing',
        length: 3600,
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.action).toBe('CREATED');

      const recording = await db.getClassRecording('rec-proc-08');
      expect(recording?.status).toBe('PROCESSING');
      expect(recording?.mediaUrl).toBe('');
      expect(recording?.isDownloadable).toBe(false);

      // Session should NOT be RECORDING_READY yet
      const session = await db.getLiveSession(sessionAsp01.id);
      expect(session?.status).toBe('ENDED');
    });

    it('Scenario 9: Processing -> Published transition updates status to AVAILABLE and refreshes media URLs', async () => {
      // Step 1: Ingest processing state
      await recordingIngestionService.ingestRecording({
        recordID: 'rec-trans-09',
        meetingID: sessionAsp01.meetingId,
        state: 'processing',
        name: 'Ventilation Transition Test',
      });

      const recProc = await db.getClassRecording('rec-trans-09');
      expect(recProc?.status).toBe('PROCESSING');

      // Step 2: Ingest published state with playback URL
      const result = await recordingIngestionService.ingestRecording({
        recordID: 'rec-trans-09',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Ventilation Transition Test (Final)',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-trans-09',
        length: 4200,
        size: 300000000,
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.action).toBe('UPDATED');

      const recPub = await db.getClassRecording('rec-trans-09');
      expect(recPub?.status).toBe('AVAILABLE');
      expect(recPub?.mediaUrl).toBe('https://bbb.zealosh.com/playback/rec-trans-09');
      expect(recPub?.durationSeconds).toBe(4200);

      // LiveSession is now marked RECORDING_READY
      const session = await db.getLiveSession(sessionAsp01.id);
      expect(session?.status).toBe('RECORDING_READY');
    });

    it('Scenario 10: Out-of-order Processing received AFTER Published is safely ignored (anti-downgrade guard)', async () => {
      // Step 1: Already published
      await recordingIngestionService.ingestRecording({
        recordID: 'rec-antidowngrade-10',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Published First',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-antidowngrade-10',
        length: 3600,
      });

      // Step 2: Late processing event arrives
      const result = await recordingIngestionService.ingestRecording({
        recordID: 'rec-antidowngrade-10',
        meetingID: sessionAsp01.meetingId,
        state: 'processing',
        name: 'Delayed Processing Webhook',
      });

      expect(result.action).toBe('SKIPPED');
      expect(result.status).toBe('IGNORED_DUPLICATE');
      expect(result.message).toMatch(/Refusing downgrade/i);

      // Verify DB recording remains AVAILABLE and has intact mediaUrl
      const rec = await db.getClassRecording('rec-antidowngrade-10');
      expect(rec?.status).toBe('AVAILABLE');
      expect(rec?.mediaUrl).toBe('https://bbb.zealosh.com/playback/rec-antidowngrade-10');
    });

    it('Scenario 11: Deleted/unpublished upstream event transitions ClassRecording to ARCHIVED', async () => {
      // Step 1: Ingest published recording
      await recordingIngestionService.ingestRecording({
        recordID: 'rec-del-11',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-del-11',
      });

      // Step 2: Ingest deleted event
      const result = await recordingIngestionService.ingestRecording({
        recordID: 'rec-del-11',
        meetingID: sessionAsp01.meetingId,
        state: 'deleted',
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.action).toBe('UPDATED');

      const recording = await db.getClassRecording('rec-del-11');
      expect(recording?.status).toBe('ARCHIVED');
      expect(recording?.isDownloadable).toBe(false);
    });

    it('Scenario 12: Failed upstream event transitions ClassRecording to ARCHIVED/FAILED gracefully', async () => {
      const result = await recordingIngestionService.ingestRecording({
        recordID: 'rec-failed-12',
        meetingID: sessionAsp01.meetingId,
        state: 'failed',
        name: 'Encoding Failed Session',
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.action).toBe('CREATED');

      const recording = await db.getClassRecording('rec-failed-12');
      expect(recording?.status).toBe('ARCHIVED');

      // LiveSession is not broken
      const session = await db.getLiveSession(sessionAsp01.id);
      expect(session).toBeDefined();
    });
  });

  // =========================================================================
  // Section C: Association & Multitenancy (Scenarios 13–16)
  // =========================================================================

  describe('3. Association & Multitenancy Boundaries', () => {
    it('Scenario 13: Webhook with unknown meetingID/sessionID rejected with 404 (does NOT create orphan recording)', async () => {
      const result = await recordingIngestionService.ingestRecording({
        recordID: 'rec-orphan-13',
        meetingID: 'non-existent-meeting-id-999',
        state: 'published',
      });

      expect(result.status).toBe('FAILED');
      expect(result.statusCode).toBe(404);
      expect(result.message).toMatch(/No internal LiveSession found/i);

      // Ensure no orphan recording created
      const orphan = await db.getClassRecording('rec-orphan-13');
      expect(orphan).toBeUndefined();
    });

    it('Scenario 14: Course ID and Batch ID derived strictly from internal LiveSession, NOT forged webhook metadata', async () => {
      const result = await recordingIngestionService.ingestRecording({
        recordID: 'rec-anti-forgery-14',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        playbackUrl: 'https://bbb.zealosh.com/playback/anti-forgery',
        courseId: 'forged-course-id-hacker',
        batchId: 'forged-batch-id-hacker',
      });

      expect(result.status).toBe('SUCCESS');

      const recording = await db.getClassRecording('rec-anti-forgery-14');
      expect(recording).toBeDefined();
      // Must equal authentic internal session IDs, NOT forged IDs
      expect(recording?.courseId).toBe(courseAsp.id);
      expect(recording?.batchId).toBe(batchActiveAsp.id);
      expect(recording?.courseId).not.toBe('forged-course-id-hacker');
    });

    it('Scenario 15: Cross-tenant attempt rejected or strictly bound to internal session tenant scope', async () => {
      // Even if metadata includes a foreign organization ID or spoofed credentials
      const result = await recordingIngestionService.ingestRecording({
        recordID: 'rec-tenant-15',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        organizationId: 'org-foreign-attacker',
      });

      expect(result.status).toBe('SUCCESS');

      // The recording created is bound strictly to the batch and course of sessionAsp01
      const recording = await db.getClassRecording('rec-tenant-15');
      expect(recording?.courseId).toBe(courseAsp.id);
      expect(recording?.batchId).toBe(batchActiveAsp.id);
    });

    it('Scenario 16: Conflicting session association rejected cleanly or maps accurately', async () => {
      // Ingestion with invalid meetingID and unknown session
      const result = await recordingIngestionService.ingestRecording({
        recordID: 'rec-conflict-16',
        meetingID: 'unknown-conflict-meeting',
        sessionId: 'unknown-conflict-session',
        state: 'published',
      });

      expect(result.status).toBe('FAILED');
      expect(result.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // Section D: Reconciliation Workflow (Scenarios 17–21)
  // =========================================================================

  describe('4. Bounded Reconciliation Workflow', () => {
    it('Scenario 17: Reconcile discovers missing published recordings and creates ClassRecording records', async () => {
      // Seed a mock upstream BBB recording for sessionAsp01
      const mockItem: BBBRecordingItem = {
        recordID: 'rec-bbb-recon-17',
        meetingID: sessionAsp01.meetingId,
        name: 'Reconciled Ventilation Class',
        published: true,
        state: 'published',
        startTime: '1761674400000',
        endTime: '1761679800000',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-bbb-recon-17',
        playbackType: 'presentation',
        playbackLength: 90,
      };
      bbbAdapter.setMockRecordings([mockItem]);

      // Run reconciliation
      const report = await recordingIngestionService.reconcileSessionRecordings({
        sessionId: sessionAsp01.id,
      });

      expect(report.scannedSessions).toBe(1);
      expect(report.recordingsDiscovered).toBe(1);
      expect(report.recordingsCreated).toBe(1);
      expect(report.failures).toHaveLength(0);

      const recording = await db.getClassRecording('rec-bbb-recon-17');
      expect(recording).toBeDefined();
      expect(recording?.status).toBe('AVAILABLE');
      expect(recording?.mediaUrl).toBe('https://bbb.zealosh.com/playback/rec-bbb-recon-17');
    });

    it('Scenario 18: Reconcile handles sessions with no upstream recordings gracefully (zero created, no error)', async () => {
      // Adapter has NO recordings
      bbbAdapter.clearMockRecordings();

      const report = await recordingIngestionService.reconcileSessionRecordings({
        sessionId: sessionAsp02.id,
      });

      expect(report.scannedSessions).toBe(1);
      expect(report.recordingsDiscovered).toBe(0);
      expect(report.recordingsCreated).toBe(0);
      expect(report.recordingsIgnored).toBe(0);
      expect(report.failures).toHaveLength(0);
    });

    it('Scenario 19: Reconcile skips already-ingested recordings idempotently (marked IGNORED_DUPLICATE)', async () => {
      const mockItem: BBBRecordingItem = {
        recordID: 'rec-bbb-recon-19',
        meetingID: sessionAsp01.meetingId,
        name: 'Reconciled Duplicate Test',
        published: true,
        state: 'published',
        playbackUrl: 'https://bbb.zealosh.com/playback/rec-bbb-recon-19',
        playbackType: 'presentation',
      };
      bbbAdapter.setMockRecordings([mockItem]);

      // Run 1: Created
      const report1 = await recordingIngestionService.reconcileSessionRecordings({
        sessionId: sessionAsp01.id,
      });
      expect(report1.recordingsCreated).toBe(1);

      // Run 2: Skipped as duplicate
      const report2 = await recordingIngestionService.reconcileSessionRecordings({
        sessionId: sessionAsp01.id,
      });
      expect(report2.recordingsCreated).toBe(0);
      expect(report2.recordingsIgnored).toBe(1);
      expect(report2.failures).toHaveLength(0);
    });

    it('Scenario 20: Reconcile respects maxScanLimit (e.g. limit 1 scans at most 1 session)', async () => {
      const report = await recordingIngestionService.reconcileSessionRecordings({
        maxScanLimit: 1,
      });

      expect(report.scannedSessions).toBe(1);
    });

    it('Scenario 21: Reconcile failure on one session does not abort entire batch (partial failure reporting)', async () => {
      // Mock getRecordings to fail for sessionAsp01 but succeed for sessionAsp02
      const originalGetRecordings = bbbAdapter.getRecordings.bind(bbbAdapter);
      bbbAdapter.getRecordings = async (filter?: { meetingId?: string; meetingID?: string; recordId?: string; recordID?: string }) => {
        const targetMtg = filter?.meetingId || filter?.meetingID;
        if (targetMtg === sessionAsp01.meetingId) {
          throw new Error('Simulated upstream BBB network timeout on meeting 01');
        }
        return originalGetRecordings(filter);
      };

      try {
        const report = await recordingIngestionService.reconcileSessionRecordings({
          maxScanLimit: 10,
        });

        // sessionAsp01 fails, sessionAsp02 succeeds
        expect(report.failures.length).toBeGreaterThanOrEqual(1);
        expect(report.failures.some((f) => f.sessionId === sessionAsp01.id)).toBe(true);
        expect(report.scannedSessions).toBe(2);
      } finally {
        bbbAdapter.getRecordings = originalGetRecordings;
      }
    });
  });

  // =========================================================================
  // Section E: Backwards Compatibility & Integration (Scenarios 22–25)
  // =========================================================================

  describe('5. Backwards Compatibility & System Integration', () => {
    it('Scenario 22: Ingested AVAILABLE recording is discoverable via course-recording-resolver (CP-8.8 contract)', async () => {
      // Ingest recording
      await recordingIngestionService.ingestRecording({
        recordID: 'rec-cp88-compat-22',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'CP-8.8 Compatibility Lecture',
        playbackUrl: 'https://bbb.zealosh.com/playback/cp88',
        length: 5400,
      });

      // Query course-level discovery as enrolled student
      const discovery = await resolveCourseRecordings(studentEnrolled.id, courseAsp.id);

      expect(discovery.courseId).toBe(courseAsp.id);
      expect(discovery.recordings.length).toBeGreaterThanOrEqual(1);

      const found = discovery.recordings.find((r) => r.id === 'rec-cp88-compat-22');
      expect(found).toBeDefined();
      expect(found?.status).toBe('AVAILABLE');
      expect(found?.canPlay).toBe(true);
      expect(found?.playbackUrl).toBe('/recordings/rec-cp88-compat-22');
    });

    it('Scenario 23: Ingested AVAILABLE recording resolves in live-session-resolver (CP-8.7 contract)', async () => {
      // Ingest recording
      await recordingIngestionService.ingestRecording({
        recordID: 'rec-cp87-compat-23',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'CP-8.7 Compatibility Lecture',
        playbackUrl: 'https://bbb.zealosh.com/playback/cp87',
        length: 3600,
      });

      // Query student sessions
      const studentResolution = await resolveStudentLiveSessions(studentEnrolled.id);

      const foundSession = studentResolution.sessions.find((s) => s.id === sessionAsp01.id);
      expect(foundSession).toBeDefined();
      expect(foundSession?.replayState).toBe('AVAILABLE');
      expect(foundSession?.replay).toBeDefined();
      expect(foundSession?.replay?.recordingId).toBe('rec-cp87-compat-23');
      expect(foundSession?.replay?.playbackUrl).toBe('/recordings/rec-cp87-compat-23');
    });

    it('Scenario 24: Existing recording relations (highlights, resources, doubts, batch grants) preserved across updates', async () => {
      // First ingest
      await recordingIngestionService.ingestRecording({
        recordID: 'rec-relations-24',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Original Title',
        playbackUrl: 'https://bbb.zealosh.com/playback/original',
      });

      // Add custom relations
      const rec = await db.getClassRecording('rec-relations-24');
      expect(rec).toBeDefined();
      rec!.highlights = [
        {
          id: 'hl-01',
          recordingId: 'rec-relations-24',
          startTimestampSeconds: 120,
          endTimestampSeconds: 240,
          title: 'Critical Formula Overview',
          description: 'Duct air volume velocity equation',
          createdBy: instructorAsp.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      rec!.resources = [
        {
          id: 'res-01',
          recordingId: 'rec-relations-24',
          title: 'Ventilation Formula Sheet PDF',
          resourceType: 'DOCUMENT' as any,
          url: '/docs/ventilation.pdf',
          fileSizeBytes: 1048576,
          uploadedBy: instructorAsp.id,
          createdAt: new Date().toISOString(),
        },
      ];
      rec!.doubts = [
        {
          id: 'dbt-01',
          recordingId: 'rec-relations-24',
          userId: studentEnrolled.id,
          userName: studentEnrolled.name,
          timestampSeconds: 300,
          question: 'Does this apply to laminar flow?',
          status: 'OPEN' as any,
          isPublic: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      await db.saveClassRecording(rec!);

      // Update arrives from BBB with new name or refreshed playbackUrl
      const updateResult = await recordingIngestionService.ingestRecording({
        recordID: 'rec-relations-24',
        meetingID: sessionAsp01.meetingId,
        state: 'published',
        name: 'Updated Title from Upstream',
        playbackUrl: 'https://bbb.zealosh.com/playback/updated',
      });

      expect(updateResult.action).toBe('UPDATED');

      // Verify relations are preserved!
      const updatedRec = await db.getClassRecording('rec-relations-24');
      expect(updatedRec?.title).toBe('Updated Title from Upstream');
      expect(updatedRec?.mediaUrl).toBe('https://bbb.zealosh.com/playback/updated');
      expect(updatedRec?.highlights).toHaveLength(1);
      expect(updatedRec?.highlights?.[0].title).toBe('Critical Formula Overview');
      expect(updatedRec?.resources).toHaveLength(1);
      expect(updatedRec?.resources?.[0].title).toBe('Ventilation Formula Sheet PDF');
      expect(updatedRec?.doubts).toHaveLength(1);
      expect(updatedRec?.doubts?.[0].question).toBe('Does this apply to laminar flow?');
    });

    it('Scenario 25: Storage failure during write handled gracefully without crashing or corrupting state', async () => {
      const originalSave = db.saveClassRecording.bind(db);
      db.saveClassRecording = async () => {
        throw new Error('Simulated atomic persistence disk write failure');
      };

      try {
        const result = await recordingIngestionService.ingestRecording({
          recordID: 'rec-storage-fail-25',
          meetingID: sessionAsp01.meetingId,
          state: 'published',
        });

        expect(result.status).toBe('FAILED');
        expect(result.statusCode).toBe(500);
        expect(result.message).toMatch(/Simulated atomic persistence disk write failure/i);
      } finally {
        db.saveClassRecording = originalSave;
      }
    });
  });

  // =========================================================================
  // Section F: Administrative Reconciliation API Route (/api/admin/recordings/reconcile)
  // =========================================================================

  describe('6. Admin Reconciliation Route Handler', () => {
    it('Admin can trigger reconciliation with valid JWT Bearer token', async () => {
      const request = new Request('https://lms.zealosh.com/api/admin/recordings/reconcile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({ sessionId: sessionAsp01.id, maxScanLimit: 5 }),
      });

      const response = await postAdminReconcile(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.report).toBeDefined();
      expect(data.report.scannedSessions).toBe(1);
    });

    it('Student JWT token is rejected with 403 Forbidden', async () => {
      const request = new Request('https://lms.zealosh.com/api/admin/recordings/reconcile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenStudent}`,
        },
        body: JSON.stringify({ maxScanLimit: 5 }),
      });

      const response = await postAdminReconcile(request);
      expect(response.status).toBe(403);
    });

    it('Missing auth header is rejected with 403 Forbidden', async () => {
      const request = new Request('https://lms.zealosh.com/api/admin/recordings/reconcile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const response = await postAdminReconcile(request);
      expect(response.status).toBe(403);
    });
  });
});
