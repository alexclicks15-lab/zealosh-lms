#!/usr/bin/env node
// ==============================================================================
// Zealosh LMS — Security Hardening & Configuration Audit Engine
// Milestone: ZM-IMPL-09 (Stage B-Prep)
// Audits Content Security Policy (CSP), HTTP security headers, webhook HMAC signatures,
// and secret isolation across the codebase and configuration files.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Audits Content Security Policy and security headers in next.config.mjs and middleware.ts
 */
export function auditSecurityHeaders(repoRoot = REPO_ROOT) {
  const issues = [];
  const nextConfigPath = path.join(repoRoot, 'next.config.mjs');
  const middlewarePath = path.join(repoRoot, 'src/middleware.ts');

  // 1. Next.js Config CSP
  if (fs.existsSync(nextConfigPath)) {
    const content = fs.readFileSync(nextConfigPath, 'utf8');

    // Rule: Must not permit unsafe-eval unconditionally or in production branch
    const prodCspMatch = content.match(/:\s*["']script-src\s+([^"']+)["']/);
    if (prodCspMatch && prodCspMatch[1].includes('unsafe-eval')) {
      issues.push("Security Violation: 'unsafe-eval' detected in production Content Security Policy (next.config.mjs)");
    }

    // Rule: Must have HSTS
    if (!content.includes('Strict-Transport-Security')) {
      issues.push('Missing Security Header: Strict-Transport-Security (HSTS) not found in next.config.mjs');
    }

    // Rule: Must have X-Content-Type-Options
    if (!content.includes('X-Content-Type-Options')) {
      issues.push('Missing Security Header: X-Content-Type-Options not found in next.config.mjs');
    }
  }

  // 2. Middleware Security
  if (fs.existsSync(middlewarePath)) {
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');

    if (!middlewareContent.includes('X-Frame-Options')) {
      issues.push('Missing Security Header: X-Frame-Options not set in middleware.ts');
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Audits webhook route handlers for mandatory HMAC signature verification
 */
export function auditWebhookSignatures(repoRoot = REPO_ROOT) {
  const issues = [];
  const webhookRoutes = [
    {
      file: 'src/app/api/webhooks/bbb/recording/route.ts',
      requiredPattern: /hmac|crypto|verify|x-zealosh-signature/i,
      name: 'BigBlueButton Recording Webhook',
    },
    {
      file: 'src/app/api/payments/webhook/route.ts',
      requiredPattern: /signature|hmac|crypto/i,
      name: 'Payment Gateway Webhook',
    },
    {
      file: 'src/app/api/webhooks/whatsapp/route.ts',
      requiredPattern: /signature|hub\.mode|hub\.challenge/i,
      name: 'WhatsApp Business Webhook',
    },
  ];

  for (const route of webhookRoutes) {
    const fullPath = path.join(repoRoot, route.file);
    if (!fs.existsSync(fullPath)) {
      issues.push(`Missing Webhook Route: ${route.file}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    if (!route.requiredPattern.test(content)) {
      issues.push(`Missing Signature Verification: ${route.name} (${route.file}) lacks HMAC/signature validation`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Scans code for dangerous raw private keys or certificates
 */
export function auditSecretHygiene(repoRoot = REPO_ROOT) {
  const issues = [];
  const sensitivePatterns = [
    new RegExp('-----' + 'BEGIN [A-Z ]*PRIVATE KEY' + '-----'),
  ];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === '.next' ||
        entry.name === 'audit-security-config.mjs'
      ) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') ||
          entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.mjs'))
      ) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of sensitivePatterns) {
          if (pattern.test(content)) {
            issues.push(`Secret Leakage: Private key pattern found in ${path.relative(repoRoot, fullPath)}`);
          }
        }
      }
    }
  }

  scanDir(path.join(repoRoot, 'src'));
  scanDir(path.join(repoRoot, 'deploy'));

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Executes complete security audit suite
 */
export function runFullSecurityAudit(repoRoot = REPO_ROOT) {
  const headers = auditSecurityHeaders(repoRoot);
  const webhooks = auditWebhookSignatures(repoRoot);
  const hygiene = auditSecretHygiene(repoRoot);

  const allIssues = [...headers.issues, ...webhooks.issues, ...hygiene.issues];

  return {
    overallPassed: allIssues.length === 0,
    headersCheck: headers,
    webhooksCheck: webhooks,
    secretHygieneCheck: hygiene,
    totalIssues: allIssues.length,
    issues: allIssues,
  };
}
