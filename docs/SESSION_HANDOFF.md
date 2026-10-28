# Zealosh LMS — Session Handoff & Durable Checkpoint

**Document Version:** 1.1.0 (Step A Documentation Reconciliation Complete)  
**Date:** October 28, 2026  
**Workspace Path:** `C:\Users\alexc\.gemini\antigravity-ide\scratch\zealosh-lms`  
**Current Git Head:** `7d09f62` (`feat(staging): CP-8.2 finalize moodle database decision option a and staging infrastructure readiness`)  
**Active Milestone Reached:** Milestone 8: Staging Infrastructure Readiness & Moodle Database Architecture (Option A Finalized)  
**Task Reached:** Step A Completed (Documentation Reconciled: Cost Model, BBB 4.0 / Ubuntu 24.04, Hostnames, Safe Secret Piping, Accurate OAuth Model); Step B Operational Fixes Queued for Authorization.

---

## 1. Verified System State & Regression Summary

| Verification Category | Status | Details / Evidence |
| :--- | :---: | :--- |
| **Vitest Test Suite** | **PASS (206/206)** | 20 test files, 206 tests passing (100% green). Covers AI Tutor gate (12), Class Recordings & Doubts (17), Enterprise Commerce (17), Coursework live Supabase (11), Learner E2E (11), OIDC SSO (17), Persistence (29), Security (13), Moodle healthcheck (10), Schema gate (9), Secret hygiene (9), Credential interpolation (12), Superadmin config (7), Adapters (6), Enrollment (4), Exams (4), Supabase gateway (4), Auth (3), PWA (3). |
| **TypeScript Strict Check** | **PASS (0 errors)** | `npx tsc --noEmit` exited with code 0 across all 48 routes, API endpoints, adapters, and test suites. |
| **Next.js Production Build** | **PASS (48 routes)** | `npm run build` exited with code 0. All 48 static and dynamic routes compiled cleanly. Shared First Load JS: `87.1 kB`. |
| **Shell Scripts Syntax** | **PASS (13/13)** | All 13 core deployment shell scripts validated via Bash 5.3 (`bash -n`) with zero syntax errors. |
| **Working Tree Hygiene** | **PRESERVED** | Preserved valid store timestamps and seeded password hashes in `data/zealosh-store.json`. |

---

## 2. Reconciled Architectural Decisions (Step A Complete)

- **Moodle Database Architecture:** **Option A: Dedicated Supabase Project 2 (PostgreSQL 17+)**
  - Supabase Project 1 (`yeegsljnjwxdhgzfdnyg`) remains 100% separate, untouched, and unpolluted.
  - Port 5432 Session Mode Pooler with tenant suffix (`postgres.[ref]`).
  - Data API disabled on Project 2; retained on Project 1.
- **BigBlueButton Baseline:**
  - Dedicated Server 2 on **Ubuntu 24.04 LTS 64-bit** with **BigBlueButton 4.0 (`noble-400`)**.
  - Hardware: 8 vCPU, 16GB RAM, 500GB NVMe SSD ($134/mo total for Server 2).
  - Canonical media hostname: `media.staging.zealosh.com` (Prod: `media.zealosh.com`).
- **OAuth Runtime Reality & Security Boundary:**
  - Current implementation (`src/app/api/oauth/token/route.ts`) enforces RFC 7636 PKCE (`code_verifier`) and **does NOT validate `client_secret` at runtime**.
  - `JWT_SECRET` must **NEVER** be shared with Moodle or configured as Moodle's client secret.
  - Adding dedicated `OAUTH_CLIENT_SECRET` runtime validation is queued for **Step B — Operational Fixes**.
- **Safe Secret-Handling Protocol:**
  - BigBlueButton secret transfer updated to non-leaking SSH pipe into `/opt/zealosh/.env.staging`, replacing terminal stdout `sudo cat`.
- **Reconciled Cost Model:**
  - Server 1 (App): $84.00/mo.
  - Server 2 (Media + 500GB NVMe): $134.00/mo ($84 compute + $50 NVMe volume).
  - Supabase Project 2: $10.00–$20.00/mo (Micro/Small compute add-on in existing Pro Org) or $0.00/mo for initial smoke test.
  - Cloudflare R2: ~$0.75/mo (50GB storage, $0 egress).
  - **Staging Total (Paid DB): ~$228.75 – $238.75 / month** (or ~$218.75/mo with Free DB; +18% GST if applicable: ~$269.93 – $281.73/mo).

---

## 3. Scope Boundaries & Next Phase (Step B Operational Fixes)

All operational changes remain decoupled from documentation and await explicit authorization under **Step B**:
1. `.env.staging.example`: Align `BIGBLUEBUTTON_URL` from `classroom.staging.zealosh.com` to `media.staging.zealosh.com`, remove obsolete `NEXT_PUBLIC_BASE_URL` duplicate, add dedicated `OAUTH_CLIENT_SECRET` template variable decoupled from `JWT_SECRET`.
2. `deploy/bbb-staging-setup.sh`: Update default hostname parameter from `classroom.staging.zealosh.com` to `media.staging.zealosh.com`.
3. `infra/terraform/outputs.tf`: Update BBB endpoint output to `media.staging.zealosh.com`.
4. `deploy/nginx/nginx.staging.conf`: Align upstream media comments if applicable.
5. `src/app/api/oauth/token/route.ts`: Implement dedicated `OAUTH_CLIENT_SECRET` validation (when provided/configured), maintaining strict decoupling from `JWT_SECRET`, accompanied by unit tests in `tests/oidc-sso.test.ts`.

---

## 4. Commands Executed & Verified Results

| Command Line | Exit Code | Verified Output |
| :--- | :---: | :--- |
| `& "C:\Program Files\Git\mingw64\bin\git.exe" status` | 0 | Preserved `data/zealosh-store.json` intact. |
| `npm test` | 0 | 20 passed files, 206 passed tests (23.57s duration). |
| `npx tsc --noEmit` | 0 | 0 compilation errors across entire codebase. |
| `npm run build` | 0 | 48 production routes compiled cleanly. Shared JS: 87.1 kB. |
| `bash -n` across 13 shell scripts | 0 | 13/13 scripts validated with zero syntax errors. |
