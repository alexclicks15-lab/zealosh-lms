# Zealosh LMS — Local Setup & Engineering Runbook

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-10 — Local Feature Completion & Full-System Verification  
**Audience:** Core Engineering Team & Platform Maintainers  
**Date:** November 9, 2026  

---

## 1. System Requirements & Prerequisites

- **Operating System:** Windows 10/11, macOS, or Linux.
- **Node.js:** v20.10.0+ LTS (recommended v20.18+).
- **Package Manager:** npm v10.0+ (pnpm compatible).
- **Browser:** Google Chrome (installed at `C:\Program Files\Google\Chrome\Application\chrome.exe` on Windows for real-browser Playwright testing).
- **PostgreSQL:** Embedded WebAssembly PGlite is bundled in `devDependencies`; no local PostgreSQL server installation required for running unit, integration, or disaster recovery suites.

---

## 2. Environment Configuration

Copy the baseline environment template to `.env.local`:

```bash
# Core Application Environment
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
INSTITUTION_NAME="Zealosh Training & Consultants"
INSTITUTION_TIMEZONE=Asia/Kolkata

# Authentication & JWT Secrets (Enforces HS256)
JWT_SECRET=zealosh-development-secret-jwt-key-2026-secure
SUPABASE_JWT_SECRET=zealosh-development-secret-jwt-key-2026-secure
JWT_SECRET_PREVIOUS=zealosh-development-secret-jwt-key-2025-previous

# Authoritative Database Storage Mode
# Options: in_memory | postgres | supabase
DATABASE_STORAGE=in_memory

# Payment Gateway (Provider-Neutral Staging Bypass)
RAZORPAY_KEY_ID=rzp_test_placeholder_key
RAZORPAY_KEY_SECRET=rzp_test_placeholder_secret
RAZORPAY_WEBHOOK_SECRET=zealosh_rzp_webhook_secret_staging

# Document & Storage Abstraction
MAX_DOCUMENT_SIZE_BYTES=26214400 # 25 MB
```

---

## 3. Daily Development & Verification Commands

### A. Run Static Type Checking
```bash
npx tsc --noEmit
```
*Expected: 0 errors.*

### B. Run Full Local Vitest Regression (95 Suites, 919 Tests)
```bash
npx vitest run --exclude="tests/supabase*.ts" --exclude="tests/staging-env-validation.test.ts"
```
*Expected: 95 passed (919 passed in ~160 seconds).*

### C. Run Cold-Start Disaster Recovery Replay
```bash
npx vitest run tests/disaster-recovery-local-restore.test.ts
```
*Expected: 5 passed (replays all 29 migrations in ~1.4 seconds in embedded PGlite).*

### D. Run Real-Browser Playwright E2E Suite (14 Specs, 72 Tests)
```bash
# 1. Build Next.js for E2E port 3022
$env:NEXT_DIST_DIR=".next-e2e"; npm run build

# 2. Execute Playwright test runner
npx playwright test
```
*Expected: 72 passed (in ~1.3 minutes).*

### E. Compile Production Application Build
```bash
npm run build
```
*Expected: 163 routes compiled with 0 errors, middleware size ~28.5 kB.*

---

## 4. Troubleshooting & Operational Guardrails

1. **Windows EPERM on `.next` Directory:**
   - On Windows environments, Next.js Webpack cache occasionally locks temporary chunk folders.
   - *Resolution:* If `EPERM: operation not permitted, mkdir` occurs, rerun `npm run build` or delete `.next` using PowerShell: `Remove-Item -Recurse -Force .next`.
2. **Port 3022 Already in Use:**
   - Playwright uses port 3022 for local testing.
   - *Resolution:* In PowerShell: `Get-Process -Id (Get-NetTCPConnection -LocalPort 3022).OwningProcess | Stop-Process -Force`.
3. **Protected Benchmark Invariant:**
   - Never edit or mutate `data/zealosh-store.json`.
   - Verify integrity using:
     ```powershell
     Get-FileHash data/zealosh-store.json -Algorithm SHA256
     ```
   - Target Hash: `F1CB59D0B3FC129548763266B8A1993300D76EB842070657B7719F5F21B3FB10`.

