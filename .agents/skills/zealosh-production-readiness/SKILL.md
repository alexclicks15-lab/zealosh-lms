---
name: zealosh-production-readiness
description: Comprehensive deployment verification, production readiness, and release auditing runbook for Zealosh LMS. Use this skill when executing pre-deployment gates, verifying build artifacts, validating test suites, checking database integrity, auditing security configurations, or conducting live browser acceptance testing.
---

# Zealosh LMS — Production Readiness & Release Verification Runbook

## 1. The 7-Gate Production Verification Protocol

Before certifying any build or release of Zealosh LMS as production-ready, all 7 gates must pass with zero critical defects:

```
Gate 1: Static Type Check & Syntax Integrity (tsc --noEmit)
Gate 2: Automated Unit & Integration Testing (vitest run)
Gate 3: Production Build Compilation (next build)
Gate 4: Environment & Secrets Audit (Zero plaintext tokens)
Gate 5: Database ACID Integrity & Schema Invariants
Gate 6: Live Server Runtime Verification (HTTP 200 on port 3000)
Gate 7: End-to-End Browser Journey & QA Protocol
```

---

## 2. Gate-by-Gate Execution Guidelines

### Gate 1: TypeScript & Static Analysis
- **Command:** `npx tsc --noEmit`
- **Criteria:** 0 compiler errors. Verified TypeScript configuration (`tsconfig.json`) using `"target": "es2022"`, `"moduleResolution": "bundler"`, and valid module path aliases (`@/*`).

### Gate 2: Automated Test Suite
- **Command:** `npm run test` (Vitest)
- **Criteria:** 100% test pass rate across all test suites:
  - `tests/auth.test.ts`: bcrypt password hashing, JWT signing/verifying.
  - `tests/enrollment.test.ts`: idempotent batch enrollments, capacity checks.
  - `tests/exam-engine.test.ts`: question bank scoring, countdown deadlines, anti-cheat question projection.
  - `tests/adapters.test.ts`: Moodle REST payloads, BigBlueButton SHA-1 checksum calculations.

### Gate 3: Production Compilation
- **Command:** `npm run build`
- **Criteria:** Next.js production build exits with code 0. All 16 routes statically generated or dynamically optimized without bundle errors or hydration mismatches.

### Gate 4: Security & Environment Safeguards
- **Audit Points:**
  - `JWT_SECRET` configured and not using default fallback in production.
  - `BIGBLUEBUTTON_SALT` securely maintained server-side; 0 client leaks.
  - Cookies configured with `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
  - Rate limiting active on sensitive endpoints (`/api/v1/auth/login`, `/api/v1/exams/start`).

### Gate 5: Database Integrity
- **Audit Points:**
  - Authoritative in-memory / PostgreSQL store enforces ACID isolation and foreign key references.
  - Exam attempts are sealed upon completion (`status = 'COMPLETED'`) and cannot be re-submitted.
  - Audit log entries created for all high-stakes actions: user enrollment, score finalization, certificate issuance.

### Gate 6: Runtime Health & Availability
- **Audit Points:**
  - Production server launches cleanly via `npm run start` on designated port.
  - HTTP `GET /` returns `200 OK` within < 200ms.
  - Dynamic API endpoints return schema-compliant JSON payloads.

### Gate 7: End-to-End Browser Journey
- **Audit Points:**
  - Student registration and login journey.
  - Course discovery and cohort batch selection.
  - Live virtual classroom entry and simulated session stage.
  - Full timed exam simulation with question palette navigation, answer selection, and result diagnostic rendering.
  - Multi-viewport verification (Desktop 1920x1080, Tablet 768x1024, Mobile 375x667).
