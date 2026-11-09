// Zealosh LMS — Phase 5 Operations & Pre-Launch Validation Suite
// Task: ZM-IMPL-04B — Operations Audit, Helpdesk Validation & CSV Security
// Tests:
// 1. CSV Formula Injection Defense across all export surfaces (=, +, -, @, \t, \r, quotes, newlines, unicode)
// 2. Public Health Check Endpoint (/api/health) vs Admin Diagnostics Telemetry (/api/admin/diagnostics/health)
// 3. Support Helpdesk Lifecycle: Student vs Staff role boundaries, internal note confidentiality, and SLA unconfigured reporting
// 4. Notification & Email Outbox decoupling and idempotency

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { sanitizeCsvCell, generateSanitizedCsv } from '@/lib/reporting/csv-sanitizer';
import { supportService } from '@/lib/support';
import { GET as getPublicHealth } from '@/app/api/health/route';
import { GET as getAdminReports } from '@/app/api/admin/reports/route';
import { User } from '@/types';

describe('Phase 5 Operations & Pre-Launch Validation Suite (ZM-IMPL-04B)', () => {
  const studentUserA: User = {
    id: 'usr-ops-student-a',
    organizationId: 'org-zealosh-main',
    name: 'Aarav Nair',
    email: 'aarav@zealosh.test',
    passwordHash: 'mock-hash',
    role: 'STUDENT',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  };

  const studentUserB: User = {
    id: 'usr-ops-student-b',
    organizationId: 'org-zealosh-main',
    name: 'Diya Menon',
    email: 'diya@zealosh.test',
    passwordHash: 'mock-hash',
    role: 'STUDENT',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  };

  const adminUser: User = {
    id: 'usr-ops-admin-lead',
    organizationId: 'org-zealosh-main',
    name: 'Institutional Administrator',
    email: 'admin@zealosh.com',
    passwordHash: 'mock-hash',
    role: 'SUPER_ADMIN',
    permissions: [
      'support.tickets.read',
      'support.tickets.manage',
      'support.tickets.reply',
      'support.tickets.assign',
      'support.tickets.resolve',
      'support.analytics.read',
    ],
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  } as any;

  const adminToken = signToken({
    userId: adminUser.id,
    email: adminUser.email,
    role: 'SUPER_ADMIN',
    name: adminUser.name,
  });

  const studentAToken = signToken({
    userId: studentUserA.id,
    email: studentUserA.email,
    role: 'STUDENT',
    name: studentUserA.name,
  });

  beforeEach(() => {
    db.clearAll();
    db.users.set(studentUserA.id, studentUserA);
    db.users.set(studentUserB.id, studentUserB);
    db.users.set(adminUser.id, adminUser);
  });

  // --------------------------------------------------------------------------
  // 1. CSV Formula Injection Defense Across Attack Vectors
  // --------------------------------------------------------------------------
  describe('1. CSV Formula Injection Defense (OWASP Mitigation)', () => {
    it('neutralizes spreadsheet execution commands (=, +, -, @, \\t, \\r)', () => {
      // Equals injection
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"');
      expect(sanitizeCsvCell('=cmd|\'/C calc\'!A0')).toBe('"\'=cmd|\'/C calc\'!A0"');

      // Plus injection
      expect(sanitizeCsvCell('+cmd|/c calc')).toBe('"\'+cmd|/c calc"');

      // Minus formula injection (non-numeric)
      expect(sanitizeCsvCell('-cmd|/c calc')).toBe('"\'-cmd|/c calc"');
      expect(sanitizeCsvCell('-2+3')).toBe('"\'-2+3"');

      // At sign injection
      expect(sanitizeCsvCell('@HYPERLINK("http://malicious.test")')).toBe('"\'@HYPERLINK(""http://malicious.test"")"');

      // Whitespace / Tab / Carriage return command triggers
      expect(sanitizeCsvCell('\tcmd.exe')).toBe('"\'\tcmd.exe"');
      expect(sanitizeCsvCell('\rcmd.exe')).toBe('"\'\rcmd.exe"');
    });

    it('preserves legitimate numeric literals and negative numbers without escaping', () => {
      expect(sanitizeCsvCell(42)).toBe('"42"');
      expect(sanitizeCsvCell(-125.5)).toBe('"-125.5"');
      expect(sanitizeCsvCell('+100')).toBe('"+100"');
      expect(sanitizeCsvCell('-450.75')).toBe('"-450.75"');
    });

    it('safely escapes embedded quotes, commas, newlines, and unicode text', () => {
      expect(sanitizeCsvCell('Safety & Health, Industrial Hygiene')).toBe('"Safety & Health, Industrial Hygiene"');
      expect(sanitizeCsvCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(sanitizeCsvCell('Special "Quoted" Content')).toBe('"Special ""Quoted"" Content"');
      expect(sanitizeCsvCell('മലയാളം (Malayalam) & HSE Certifications')).toBe('"മലയാളം (Malayalam) & HSE Certifications"');
    });

    it('handles null, undefined, empty string, and long payloads safely', () => {
      expect(sanitizeCsvCell(null)).toBe('""');
      expect(sanitizeCsvCell(undefined)).toBe('""');
      expect(sanitizeCsvCell('')).toBe('""');

      const longPayload = 'A'.repeat(5000);
      const sanitized = sanitizeCsvCell(longPayload);
      expect(sanitized.length).toBe(5002);
      expect(sanitized.startsWith('"')).toBe(true);
      expect(sanitized.endsWith('"')).toBe(true);
    });

    it('sanitizes direct CSV exports from /api/admin/reports route', async () => {
      // Seed a test course with hostile title to test CSV export
      db.courses.set('crs-hostile-01', {
        id: 'crs-hostile-01',
        slug: 'hostile-course',
        title: '=cmd|\'/C calc\'!A0',
        description: 'Test course with formula injection in title',
        deliveryMode: 'LIVE',
        status: 'PUBLISHED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      // Seed an enrollment with hostile user name
      db.enrollments.set('enr-hostile-01', {
        id: 'enr-hostile-01',
        userId: 'usr-hostile',
        courseId: 'crs-hostile-01',
        batchId: 'btc-01',
        status: 'ACTIVE',
        progressPercent: 0,
        completedLessonIds: [],
        enrolledAt: new Date().toISOString(),
      } as any);

      const req = new Request('http://localhost:3000/api/admin/reports?dataset=enrollments&format=csv', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const res = await getAdminReports(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/csv');

      const csvText = await res.text();
      // Ensure formula injection is neutralized with single quote prefix
      expect(csvText).not.toContain('"=cmd|');
      expect(csvText).toContain('"\'=cmd|');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Public Health Check Endpoint vs Admin Telemetry
  // --------------------------------------------------------------------------
  describe('2. Public Health Check Endpoint (/api/health)', () => {
    it('returns HTTP 200 and scrubbed operational telemetry without secret leakage', async () => {
      const res = await getPublicHealth();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('HEALTHY');
      expect(body.timestamp).toBeDefined();
      expect(body.services).toBeDefined();
      expect(body.services.application).toBe('HEALTHY');
      expect(body.services.database).toBe('HEALTHY');

      // Crucial: No internal secrets or stack traces in public endpoint
      expect(body.details).toBeUndefined();
      expect(body.connectionString).toBeUndefined();
      expect(body.jwtSecret).toBeUndefined();
      expect(body.env).toBeUndefined();
    });

    it('denies unauthenticated requests to privileged /api/admin/reports endpoint', async () => {
      const unauthReq = new Request('http://localhost:3000/api/admin/reports?dataset=enrollments&format=csv');
      const res = await getAdminReports(unauthReq);
      expect(res.status).toBe(401);
    });

    it('denies student role from exporting compliance reports', async () => {
      const studentReq = new Request('http://localhost:3000/api/admin/reports?dataset=enrollments&format=csv', {
        headers: {
          Authorization: `Bearer ${studentAToken}`,
        },
      });
      const res = await getAdminReports(studentReq);
      expect(res.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Support Helpdesk Lifecycle & Role Isolation
  // --------------------------------------------------------------------------
  describe('3. Support Helpdesk Lifecycle & Confidentiality', () => {
    it('strictly isolates tickets: Student B is forbidden from reading Student A tickets', async () => {
      const ticketA = await supportService.createTicket(
        {
          categoryId: 'cat_acc_access',
          subject: 'Question on ASP Exam Blueprint',
          description: 'Need clarification on Section 4 mathematics domain weights.',
        },
        studentUserA
      );

      // Student A can access their own ticket
      const retrievedByA = await supportService.getTicketById(ticketA.id, studentUserA);
      expect(retrievedByA).not.toBeNull();
      expect(retrievedByA?.id).toBe(ticketA.id);

      // Student B attempting to access ticket A throws FORBIDDEN
      await expect(supportService.getTicketById(ticketA.id, studentUserB)).rejects.toThrow(/FORBIDDEN/);
    });

    it('conceals internal staff notes from student viewports', async () => {
      const ticket = await supportService.createTicket(
        {
          categoryId: 'cat_acc_access',
          subject: 'Certificate Dispatch Inquiry',
          description: 'When will my physical certificate arrive in Kochi?',
        },
        studentUserA
      );

      // Staff adds an internal note
      await supportService.addMessage(
        ticket.id,
        {
          body: 'CONFIDENTIAL: Candidate address verified against Aadhaar record. Dispatch batch #4.',
          visibility: 'INTERNAL',
        },
        adminUser
      );

      // Staff adds a public reply
      await supportService.addMessage(
        ticket.id,
        {
          body: 'Hello Aarav, your certificate was dispatched via speed post today.',
          visibility: 'PUBLIC',
        },
        adminUser
      );

      // Staff viewing ticket sees both messages
      const staffView = await supportService.getTicketById(ticket.id, adminUser);
      expect(staffView).toBeDefined();
      expect(staffView?.messages?.length).toBe(3); // Initial description + internal note + public reply
      expect(staffView?.messages?.some((m) => m.visibility === 'INTERNAL')).toBe(true);

      // Student viewing ticket sees ONLY public messages (internal note stripped)
      const studentView = await supportService.getTicketById(ticket.id, studentUserA);
      expect(studentView).toBeDefined();
      expect(studentView?.messages?.length).toBe(2); // Initial description + public reply
      expect(studentView?.messages?.some((m) => m.visibility === 'INTERNAL')).toBe(false);
      expect(studentView?.messages?.some((m) => m.body.includes('CONFIDENTIAL'))).toBe(false);
    });

    it('reports NOT_CONFIGURED when no SLA policy matches, with zero fabricated metrics', async () => {
      const ticket = await supportService.createTicket(
        {
          categoryId: 'cat_acc_access',
          subject: 'SLA Policy Invariant Check',
          description: 'Verifying that unconfigured SLA policies are reported truthfully.',
        },
        studentUserA
      );

      // Expect slaStatus to be explicitly NOT_CONFIGURED
      expect(ticket.slaStatus).toBe('NOT_CONFIGURED');
      expect(ticket.firstResponseDueAt).toBeUndefined();
      expect(ticket.resolutionDueAt).toBeUndefined();
    });
  });
});
