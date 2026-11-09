// Zealosh LMS — Phase 5C.1 Live Bug Monitoring, Diagnostics & Application Health Test Suite
// Verifies:
// 1. Correlation ID Generation, Tracing & Header Extraction
// 2. Sensitive Data Redaction (Credentials, Tokens, Exam Answers, Payment Cards)
// 3. Deterministic Error Fingerprinting & Variable Parameter Normalization
// 4. Incident Deduplication & Aggregation (N events -> 1 Issue with occurrenceCount = N)
// 5. Incident Lifecycle State Machine (OPEN -> ACKNOWLEDGED -> RESOLVED -> REOPENED)
// 6. Critical Severity Administrative In-App Alert Dispatch
// 7. Dependency Health Observability & Expected Unconfigured Email Provider Gate
// 8. Client Reporting Endpoint (/api/diagnostics/report) Validation & Rate Limiting
// 9. Administrative Diagnostic APIs & RBAC Guard Isolation
// 10. ADR-004 Supabase Database Persistence & Query Integrity

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import {
  generateCorrelationId,
  extractCorrelationId,
} from '@/lib/diagnostics/correlation';
import {
  sanitizeString,
  redactSensitiveData,
  isKeySensitive,
} from '@/lib/diagnostics/redaction';
import {
  generateFingerprint,
  normalizeRoute,
  normalizeErrorMessage,
} from '@/lib/diagnostics/fingerprint';
import {
  diagnosticsService,
} from '@/lib/diagnostics/diagnostics-service';
import {
  runAllHealthChecks,
  checkEmailProviderHealth,
  checkSupabaseHealth,
} from '@/lib/diagnostics/health-checker';
import { POST as postReport } from '@/app/api/diagnostics/report/route';
import { GET as getAdminIssues } from '@/app/api/admin/diagnostics/issues/route';
import { GET as getAdminIssueDetail } from '@/app/api/admin/diagnostics/issues/[id]/route';
import { POST as postAcknowledge } from '@/app/api/admin/diagnostics/issues/[id]/acknowledge/route';
import { POST as postResolve } from '@/app/api/admin/diagnostics/issues/[id]/resolve/route';
import { GET as getAdminHealth } from '@/app/api/admin/diagnostics/health/route';
import { User } from '@/types';

describe('Phase 5C.1: Live Bug Monitoring, Centralized Diagnostics & Observability', () => {
  const adminId = 'usr-admin-diag-01';
  const studentId = 'usr-student-diag-01';

  const adminUser: User = {
    id: adminId,
    name: 'Administrator Vishnu',
    email: 'admin.vishnu@zealosh.com',
    role: 'SUPER_ADMIN',
    passwordHash: 'hash',
    organizationId: 'org-zealosh',
    tokenVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const studentUser: User = {
    id: studentId,
    name: 'Candidate Rahul',
    email: 'rahul.student@zealosh.com',
    role: 'STUDENT',
    passwordHash: 'hash',
    organizationId: 'org-zealosh',
    tokenVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const adminToken = signToken({
    userId: adminId,
    name: adminUser.name,
    email: adminUser.email,
    role: adminUser.role,
    tokenVersion: 1,
  });

  const studentToken = signToken({
    userId: studentId,
    name: studentUser.name,
    email: studentUser.email,
    role: studentUser.role,
    tokenVersion: 1,
  });

  beforeEach(() => {
    db.clearAll();
    db.users.set(adminId, adminUser);
    db.users.set(studentId, studentUser);
  });

  // --------------------------------------------------------------------------
  // 1. Correlation ID Generation & Tracing
  // --------------------------------------------------------------------------
  describe('1. Correlation ID Generation & Header Tracing', () => {
    it('generates date-stamped, collision-resistant correlation IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).toMatch(/^corr-\d{8}-[a-f0-9]{12}$/);
      expect(id2).toMatch(/^corr-\d{8}-[a-f0-9]{12}$/);
      expect(id1).not.toBe(id2);
    });

    it('extracts correlation ID from incoming headers or generates a fallback', () => {
      const headers = new Headers({ 'x-correlation-id': 'corr-custom-test-123' });
      expect(extractCorrelationId(headers)).toBe('corr-custom-test-123');

      const reqHeaders = new Headers({ 'x-request-id': 'req-incoming-456' });
      expect(extractCorrelationId(reqHeaders)).toBe('req-incoming-456');

      const emptyHeaders = new Headers();
      expect(extractCorrelationId(emptyHeaders)).toMatch(/^corr-\d{8}-[a-f0-9]{12}$/);
      expect(extractCorrelationId(null)).toMatch(/^corr-\d{8}-[a-f0-9]{12}$/);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Sensitive Data Redaction
  // --------------------------------------------------------------------------
  describe('2. Sensitive Data Redaction & Pattern Masking', () => {
    it('redacts sensitive keys including passwords, tokens, API keys, and candidate answers', () => {
      const sensitivePayload = {
        username: 'candidate1',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.abc',
        apiKey: 'sk_live_998877665544332211',
        answerKey: { q1: 'A', q2: 'D' },
        solutionText: 'The primary hazard is thermal radiation',
        nested: {
          authorization: 'Bearer secret_access_token_xyz',
          normalData: 'Allowed public note',
        },
      };

      const redacted = redactSensitiveData(sensitivePayload);

      expect(redacted.username).toBe('candidate1');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.token).toBe('[REDACTED]');
      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.answerKey).toBe('[REDACTED]');
      expect(redacted.solutionText).toBe('[REDACTED]');
      expect(redacted.nested.authorization).toBe('[REDACTED]');
      expect(redacted.nested.normalData).toBe('Allowed public note');
    });

    it('scrubs Bearer tokens and Basic auth from raw error strings and stack traces', () => {
      const rawError = 'Failed to fetch upstream: Bearer eyJhbGciOiJIUzI1Ni.abc.xyz returned 401 Unauthorized';
      const sanitized = sanitizeString(rawError);
      expect(sanitized).toBe('Failed to fetch upstream: Bearer [REDACTED] returned 401 Unauthorized');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1Ni.abc.xyz');
    });

    it('redacts credit card numbers in string messages', () => {
      const rawMessage = 'Card processing error on card 4111 2222 3333 4444 for candidate';
      const sanitized = sanitizeString(rawMessage);
      expect(sanitized).toBe('Card processing error on card [CARD_REDACTED] for candidate');
    });

    it('safely handles circular references and Error instances without throwing', () => {
      const circularObj: any = { name: 'cyclic' };
      circularObj.self = circularObj;

      const safe = redactSensitiveData(circularObj);
      expect(safe.name).toBe('cyclic');
      expect(safe.self).toBe('[CIRCULAR_REF]');

      const err = new Error('Database connection failed with password=hidden');
      (err as any).token = 'secret-token';
      const redactedErr: any = redactSensitiveData(err);
      expect(redactedErr.name).toBe('Error');
      expect(redactedErr.token).toBe('[REDACTED]');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Error Fingerprinting & Deduplication
  // --------------------------------------------------------------------------
  describe('3. Deterministic Fingerprinting & Error Deduplication', () => {
    it('normalizes variable IDs and routes to identical signatures', () => {
      const route1 = normalizeRoute('/api/courses/crs-98a7bc-1/assignments/assign-88712/submit');
      const route2 = normalizeRoute('/api/courses/crs-11b2cc-2/assignments/assign-99001/submit');
      expect(route1).toBe('/api/courses/:crsid/assignments/:assignid/submit');
      expect(route2).toBe('/api/courses/:crsid/assignments/:assignid/submit');
      expect(route1).toBe(route2);
    });

    it('normalizes error messages scrubbing dynamic timestamps, UUIDs, and numbers', () => {
      const msg1 = 'Query timeout on connection corr-20261101-abcdef123456 at 2026-11-01T15:30:00Z for row 9876543';
      const msg2 = 'Query timeout on connection corr-20261101-998877665544 at 2026-11-01T15:45:00Z for row 1122334';
      expect(normalizeErrorMessage(msg1)).toBe(normalizeErrorMessage(msg2));
    });

    it('produces identical fingerprints for recurring instances of the same bug', () => {
      const fp1 = generateFingerprint({
        category: 'DATABASE_FAILURE',
        errorCode: 'QUERY_TIMEOUT',
        route: '/api/courses/crs-101/enroll',
        message: 'Database query timed out after 3000ms with corr-20261101-aaa111',
      });

      const fp2 = generateFingerprint({
        category: 'DATABASE_FAILURE',
        errorCode: 'QUERY_TIMEOUT',
        route: '/api/courses/crs-202/enroll',
        message: 'Database query timed out after 3000ms with corr-20261101-bbb222',
      });

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(32);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Incident Deduplication & Lifecycle State Machine
  // --------------------------------------------------------------------------
  describe('4. Incident Grouping, Deduplication & State Machine', () => {
    it('groups multiple recurring events into a single issue and aggregates occurrence counts', async () => {
      for (let i = 0; i < 5; i++) {
        await diagnosticsService.recordEvent({
          category: 'API_FAILURE',
          severity: 'HIGH',
          route: '/api/live/session-101/join',
          errorCode: 'BBB_MEETING_NOT_RUNNING',
          message: `BigBlueButton meeting session-101 is not running yet (attempt ${i + 1})`,
        });
      }

      const issuesResult = await diagnosticsService.getIssues();
      expect(issuesResult.issues.length).toBe(1);

      const issue = issuesResult.issues[0];
      expect(issue.occurrenceCount).toBe(5);
      expect(issue.status).toBe('OPEN');
      expect(issue.severity).toBe('HIGH');
      expect(issue.category).toBe('API_FAILURE');

      const detail = await diagnosticsService.getIssueById(issue.id);
      expect(detail.events.length).toBe(5);
    });

    it('transitions through lifecycle: OPEN -> ACKNOWLEDGED -> RESOLVED -> REOPENED on new event', async () => {
      const { issue: initialIssue } = await diagnosticsService.recordEvent({
        category: 'ACADEMIC_WORKFLOW',
        severity: 'MEDIUM',
        route: '/api/assignments/assign-01/submit',
        errorCode: 'SUBMISSION_DEADLINE_PASSED',
        message: 'Candidate attempted submission after server deadline',
      });

      expect(initialIssue.status).toBe('OPEN');

      // Admin acknowledges issue
      const ackIssue = await diagnosticsService.acknowledgeIssue(initialIssue.id, adminId);
      expect(ackIssue?.status).toBe('ACKNOWLEDGED');
      expect(ackIssue?.acknowledgedBy).toBe(adminId);
      expect(ackIssue?.acknowledgedAt).toBeDefined();

      // Admin resolves issue with notes
      const resolvedIssue = await diagnosticsService.resolveIssue(
        initialIssue.id,
        adminId,
        'Grace period extended by policy amendment.'
      );
      expect(resolvedIssue?.status).toBe('RESOLVED');
      expect(resolvedIssue?.resolvedBy).toBe(adminId);
      expect(resolvedIssue?.resolutionNotes).toBe('Grace period extended by policy amendment.');

      // Another occurrence of the EXACT same bug arrives
      const { issue: reopenedIssue, reopened } = await diagnosticsService.recordEvent({
        category: 'ACADEMIC_WORKFLOW',
        severity: 'MEDIUM',
        route: '/api/assignments/assign-01/submit',
        errorCode: 'SUBMISSION_DEADLINE_PASSED',
        message: 'Candidate attempted submission after server deadline',
      });

      expect(reopened).toBe(true);
      expect(reopenedIssue.id).toBe(initialIssue.id);
      expect(reopenedIssue.status).toBe('REOPENED');
      expect(reopenedIssue.occurrenceCount).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Critical Administrative Alerts
  // --------------------------------------------------------------------------
  describe('5. Critical Incident Administrative In-App Alerts', () => {
    it('automatically generates in-app notifications for admins on CRITICAL severity incidents', async () => {
      expect(db.notifications.size).toBe(0);

      const { issue } = await diagnosticsService.recordEvent({
        category: 'DATABASE_FAILURE',
        severity: 'CRITICAL',
        errorCode: 'CONNECTION_POOL_EXHAUSTED',
        route: '/api/exams/attempt/submit',
        message: 'Database connection pool exhausted during high-stakes exam submission',
      });

      // Admin should have received an in-app notification
      const adminNotifs = Array.from(db.notifications.values()).filter(
        (n) => n.recipientUserId === adminId
      );

      expect(adminNotifs.length).toBeGreaterThan(0);
      const alert = adminNotifs[0];
      expect(alert.type).toBe('SYSTEM_ALERT');
      expect(alert.title).toContain('CRITICAL Incident');
      expect(alert.description).toContain('Database connection pool exhausted');
      expect(alert.actionUrl).toContain(issue.id);

      // Student should NOT receive admin diagnostic notifications
      const studentNotifs = Array.from(db.notifications.values()).filter(
        (n) => n.recipientUserId === studentId
      );
      expect(studentNotifs.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Application Health Observability & Gated Providers
  // --------------------------------------------------------------------------
  describe('6. Application Dependency Health & Staging Gate Handling', () => {
    it('verifies Supabase database connection health probe', async () => {
      const sbHealth = await checkSupabaseHealth();
      expect(['HEALTHY', 'DEGRADED', 'DOWN', 'UNCONFIGURED']).toContain(sbHealth.status);
      expect(sbHealth.serviceName).toBe('supabase');
      // When unconfigured, it must report UNCONFIGURED and never claim in-memory is healthy Supabase PostgreSQL
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        expect(sbHealth.status).toBe('UNCONFIGURED');
        expect(sbHealth.message).toContain('unconfigured');
      }
    });

    it('treats unconfigured email provider as an EXPECTED staging gate rather than an error', async () => {
      const emailHealth = await checkEmailProviderHealth();
      expect(emailHealth.status).toBe('UNCONFIGURED');
      expect(emailHealth.message).toContain('expected staging gate');
      expect(emailHealth.serviceName).toBe('email');
    });

    it('runs comprehensive health overview across all 5 monitored dependencies', async () => {
      const overview = await runAllHealthChecks();
      expect(['HEALTHY', 'DEGRADED', 'DOWN']).toContain(overview.status);
      expect(overview.services.supabase).toBeDefined();
      expect(overview.services.moodle).toBeDefined();
      expect(overview.services.bigbluebutton).toBeDefined();
      expect(overview.services.ollama).toBeDefined();
      expect(overview.services.email).toBeDefined();
      expect(overview.checkedAt).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Client Reporting Endpoint & Rate Limiting
  // --------------------------------------------------------------------------
  describe('7. Client Reporting Endpoint (/api/diagnostics/report)', () => {
    it('accepts and records frontend runtime errors from error boundary', async () => {
      const req = new Request('http://localhost:3000/api/diagnostics/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': 'corr-frontend-test-001',
          'user-agent': 'Mozilla/5.0 Test Browser',
        },
        body: JSON.stringify({
          category: 'FRONTEND_RUNTIME',
          severity: 'HIGH',
          name: 'TypeError',
          message: 'Cannot read properties of undefined (reading calculateScore)',
          route: '/exams/player/attempt-123',
          stack: 'TypeError: Cannot read properties of undefined\n    at ExamPlayer.tsx:42',
        }),
      });

      const res = await postReport(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.correlationId).toBe('corr-frontend-test-001');
      expect(json.issueId).toBeDefined();

      const issue = await db.getDiagnosticIssueById(json.issueId);
      expect(issue).not.toBeNull();
      expect(issue?.category).toBe('FRONTEND_RUNTIME');
    });

    it('enforces rate limiting when ingestion requests exceed threshold from single client', async () => {
      const clientIp = '192.168.10.99';
      let lastStatus = 200;

      for (let i = 0; i < 35; i++) {
        const req = new Request('http://localhost:3000/api/diagnostics/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': clientIp,
          },
          body: JSON.stringify({
            message: `Repetitive client event ${i}`,
          }),
        });

        const res = await postReport(req);
        lastStatus = res.status;
      }

      expect(lastStatus).toBe(429);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Administrative APIs & RBAC Isolation
  // --------------------------------------------------------------------------
  describe('8. Administrative Diagnostic APIs & RBAC Isolation', () => {
    it('blocks student requests to admin diagnostics endpoints with 403 Forbidden', async () => {
      const req = new Request('http://localhost:3000/api/admin/diagnostics/issues', {
        headers: { Authorization: `Bearer ${studentToken}` },
      });

      const res = await getAdminIssues(req);
      expect(res.status).toBe(403);
    });

    it('allows administrator to query, inspect, acknowledge, and resolve issues via APIs', async () => {
      // 1. Create a sample issue
      const { issue } = await diagnosticsService.recordEvent({
        category: 'INTEGRATION_FAILURE',
        severity: 'HIGH',
        route: '/api/moodle/sync',
        errorCode: 'MOODLE_AUTH_EXPIRED',
        message: 'Moodle Web Services token expired during nightly synchronization',
      });

      // 2. Admin queries issues list
      const listReq = new Request('http://localhost:3000/api/admin/diagnostics/issues?severity=HIGH', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const listRes = await getAdminIssues(listReq);
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.success).toBe(true);
      expect(listJson.issues.some((i: any) => i.id === issue.id)).toBe(true);

      // 3. Admin queries issue details
      const detailReq = new Request(`http://localhost:3000/api/admin/diagnostics/issues/${issue.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const detailRes = await getAdminIssueDetail(detailReq, { params: { id: issue.id } });
      expect(detailRes.status).toBe(200);
      const detailJson = await detailRes.json();
      expect(detailJson.issue.id).toBe(issue.id);
      expect(detailJson.events.length).toBeGreaterThan(0);

      // 4. Admin acknowledges issue
      const ackReq = new Request(`http://localhost:3000/api/admin/diagnostics/issues/${issue.id}/acknowledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const ackRes = await postAcknowledge(ackReq, { params: { id: issue.id } });
      expect(ackRes.status).toBe(200);
      const ackJson = await ackRes.json();
      expect(ackJson.issue.status).toBe('ACKNOWLEDGED');

      // 5. Admin resolves issue with notes
      const resolveReq = new Request(`http://localhost:3000/api/admin/diagnostics/issues/${issue.id}/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'Regenerated Moodle service token and verified sync.' }),
      });
      const resolveRes = await postResolve(resolveReq, { params: { id: issue.id } });
      expect(resolveRes.status).toBe(200);
      const resolveJson = await resolveRes.json();
      expect(resolveJson.issue.status).toBe('RESOLVED');
      expect(resolveJson.issue.resolutionNotes).toBe('Regenerated Moodle service token and verified sync.');

      // 6. Admin queries live health telemetry
      const healthReq = new Request('http://localhost:3000/api/admin/diagnostics/health', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const healthRes = await getAdminHealth(healthReq);
      expect(healthRes.status).toBe(200);
      const healthJson = await healthRes.json();
      expect(healthJson.success).toBe(true);
      expect(healthJson.health.services).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 9. ADR-004 Database Persistence Verification
  // --------------------------------------------------------------------------
  describe('9. ADR-004 Database Persistence & Entity Integrity', () => {
    it('persists and retrieves diagnostic issues and events through authoritative store methods', async () => {
      const customEvent = {
        category: 'CONFIG_FAILURE' as const,
        severity: 'MEDIUM' as const,
        route: '/admin/settings',
        errorCode: 'BRANDING_TOKEN_INVALID',
        message: 'Invalid hex color token provided for brand highlight',
      };

      const result = await diagnosticsService.recordEvent(customEvent);
      expect(result.issue.id).toBeDefined();

      const storedIssue = await db.getDiagnosticIssueById(result.issue.id);
      expect(storedIssue).not.toBeNull();
      expect(storedIssue?.title).toContain('BRANDING_TOKEN_INVALID');

      const storedEvents = await db.getDiagnosticEventsForIssue(result.issue.id);
      expect(storedEvents.length).toBe(1);
      expect(storedEvents[0].sanitizedMessage).toBe(customEvent.message);
    });

    it('preserves immutable diagnostic event history and supports soft-archival', async () => {
      const { issue, event } = await diagnosticsService.recordEvent({
        category: 'AUTH_FAILURE',
        severity: 'HIGH',
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Multiple failed login attempts from IP',
      });

      // Update issue status to ARCHIVED (soft-archival)
      const archivedIssue = await db.updateDiagnosticIssueStatus(issue.id, 'ARCHIVED', adminId);
      expect(archivedIssue?.status).toBe('ARCHIVED');

      // The individual diagnostic event MUST still exist and remain completely intact
      const eventsAfterArchive = await db.getDiagnosticEventsForIssue(issue.id);
      expect(eventsAfterArchive.length).toBe(1);
      expect(eventsAfterArchive[0].id).toBe(event.id);
      expect(eventsAfterArchive[0].correlationId).toBe(event.correlationId);
    });
  });
});
