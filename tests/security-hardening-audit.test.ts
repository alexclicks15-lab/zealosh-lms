// ==============================================================================
// Zealosh LMS — Security Hardening & Audit Verification Test Suite
// ==============================================================================

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  auditSecurityHeaders,
  auditWebhookSignatures,
  auditSecretHygiene,
  runFullSecurityAudit,
} from '../deploy/audit-security-config.mjs';

describe('Zealosh LMS — Security Hardening & Audit Engine', () => {
  const repoRoot = path.resolve(import.meta.dirname, '..');

  it('1. should verify strict Content Security Policy and security headers in configuration', () => {
    const result = auditSecurityHeaders(repoRoot);
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('2. should verify mandatory HMAC signature validation across all webhook handlers', () => {
    const result = auditWebhookSignatures(repoRoot);
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('3. should verify zero private keys or raw certificates in source files', () => {
    const result = auditSecretHygiene(repoRoot);
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('4. should pass comprehensive security audit cleanly with 0 issues', () => {
    const audit = runFullSecurityAudit(repoRoot);
    expect(audit.overallPassed).toBe(true);
    expect(audit.totalIssues).toBe(0);
  });
});

