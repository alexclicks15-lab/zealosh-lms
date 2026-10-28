# Zealosh LMS — Project Status Report

**Project:** Zealosh LMS — Enterprise HSE Certification Learning & Virtual Classroom Platform  
**Client:** Zealosh Training & Consultants (Kollam, Kerala, India / Global)  
**Document Version:** 8.2.0 (Milestone 8 Finalized: Moodle Database Architecture Option A Approved, Staging Preflight Verified, 206 Vitest Tests Passing Across 20 Suites, Next.js 48 Routes Cleanly Built)  
**Date:** October 28, 2026  
**Status:** **ACTIVE EXECUTION / CORE LMS, COMMERCE, RECORDED LEARNING & PERSISTENCE ENGINE COMPLETE / AI TUTOR UNAPPROVED & SAFELY GATED**  
- **ADR-001** (Moodle/BBB Open-Source Adoption & Unified Rebranding) Accepted and Active.
- **ADR-002** (Supabase Security, Auth & Defense-in-Depth RLS) Accepted and Active.
- **ADR-003** (Optional AI Tutor Feature Gate, Minimal Integration Boundary & Strict Security Constraints) Proposed & Active.
- **Optional AI Tutor Capability Gate & Minimal Integration Boundary (ADR-003):**
  - **Product Decision Status:** OPTIONAL, PROPOSED, AND NOT APPROVED FOR FULL IMPLEMENTATION. Zero AI VPS provisioned, zero Ollama instances deployed, zero document embedding jobs run, zero unapproved costs.
  - **Durable Schema:** Migration `supabase/migrations/20261027000007_zealosh_ai_tutor_gate.sql` adding `ai_tutor_enabled BOOLEAN NOT NULL DEFAULT FALSE` to `public.feature_flags`.
  - **Capability Gate:** Central server-side checks (`isAiTutorEnabled()`, `assertAiTutorEnabled()`) defaulting strictly to `false`.
  - **Zero Outbound Inference:** `AiTutorService` hard-gated with `AiTutorDisabledError` before any network or compute operations; verified zero outbound requests when disabled.
  - **Protected Seam:** Direct API endpoint `/api/ai-tutor/query` protected by JWT session authentication and returns HTTP 403 `AI_TUTOR_DISABLED` with structured refusal.
  - **Superadmin Authorization:** `/api/admin/config/features` enforces that only `SUPER_ADMIN` can alter `aiTutorEnabled`; ordinary admins, instructors, and learners are rejected with HTTP 403.
  - **Candidate Configuration Schema:** `validateAiTutorConfig()` strictly validates server-side URLs, model identifiers, token bounds (64-4096), and timeouts (1000-60000ms).
  - **Zero Premature UI:** Tutor launchers, chatbot widgets, and misleading operational toggles remain completely hidden from learners, instructors, and ordinary administrators.
  - **Automated Verification:** 12/12 dedicated tests passing in `tests/ai-tutor-gate.test.ts`.
- **Direct Persistence Hardening & Memory Access Remediation:**
  - Hardened exam submission endpoint `/api/exams/[examId]/submit`: replaced direct in-memory `db.examQuestions.get()` fallback with asynchronous question bank retrieval and full-bank fallback.
  - Hardened system readiness probe `/api/health/readiness`: replaced synchronous `db.users.size` with awaited `db.getUsers()`. Verified zero direct Map accesses in `src/app/api/` and `src/lib/`.
- **Class Recordings, Topic Highlights, References & Interactive Doubts (CP-7.9):**
  - Authoritative PostgreSQL database migration `20261026000006_zealosh_recordings_and_doubts.sql` deployed and verified on Core Hub Project 1 (`yeegsljnjwxdhgzfdnyg`).
  - Durable schema deployed across 6 relational tables: `class_recordings`, `recording_batch_access`, `recording_highlights`, `recording_resources`, `recording_doubts`, and `recording_doubt_answers`.
  - Object storage provider abstraction (`RecordingStorageService`) with timing-safe HMAC-SHA256 streaming and download token generation, TTL expiry verification, and server-side policy enforcement (`verifyAccess()`).
  - Strict download gating: streaming endpoint `/api/recordings/[recordingId]/stream` rejects unauthorized download attempts with 403 `RECORDING_DOWNLOAD_DISABLED`.
  - Administrator-governed previous-batch access (`/api/admin/recordings/access`): enables cross-cohort class access with optional download overrides and expiration dates, backed by immutable audit logging (`RECORDING_ACCESS_GRANTED`, `RECORDING_ACCESS_REVOKED`).
  - Instructor chapter markers & topic highlights (`/api/recordings/[recordingId]/highlights`): strictly validates timestamp bounds (`end > start`, `end <= durationSeconds`) and orders chapters monotonically.
  - Topic-linked study resources (`/api/recordings/[recordingId]/resources`): securely attaches reference materials (`PDF`, `SLIDES`, `URL`, `CODE`, `NOTES`) with protocol validation rejecting unsafe pseudo-protocols (`javascript:`, `data:`, `vbscript:`).
  - Interactive doubts & answers (`/api/recordings/[recordingId]/doubts`): students submit questions linked to exact video timestamps with learner privacy isolation (learners view only own + public doubts; instructors view all); instructors reply with auto-resolution to `RESOLVED`.
  - Integrated 4-portal experience: dedicated learner video player (`/recordings/[recordingId]`), Student Hub (`/student`), Instructor Hub (`/instructor`), and Superadmin Control Center (`/admin`).
  - Comprehensive automated suite: 194/194 tests green across 19 test files; `npx tsc --noEmit` exits with 0 errors; `npm run build` exits with code 0 across 47 routes.
  - Zero residual test records verified on live Core Hub Project 1.
- **Financial RPC Security Hardening & Accounting Integrity Reconciled (CP-7.8):**
  - Live PostgreSQL RPC execution privileges revoked from `PUBLIC`, `anon`, and `authenticated` on `complete_payment_order_atomic` and `process_refund_atomic`. Execution granted exclusively to trusted backend `service_role`.
  - Live PostgreSQL search paths hardened with `SET search_path = public, pg_temp` and schema-qualified references across both financial functions to prevent object shadowing vulnerabilities.
  - Concurrency-safe monotonic invoice numbering: deployed `public.invoice_number_seq` for reliable `INV-2026-XXXX` generation, completely eliminating random 4-digit unique constraint collision risks.
  - Payment completion lifecycle secured (`/api/payments/webhook`): validates persisted pending order, verifies expected amount (with subunit handling), currency, and gateway order reference; rejects failed or uncaptured events without mutating order state.
  - Secured administrative refund engine (`/api/admin/refunds`): enforces `SUPER_ADMIN`/`ORG_ADMIN` authorization, derives real actor identity from session JWT (no caller-supplied identity spoofing), requires non-empty refund reasons, and logs unforgeable audit records.
  - Payment-state model unified across PostgreSQL, TypeScript, and adapters: canonical status constraints on `payment_orders` (`PENDING`, `PAID`, `FAILED`, `REFUNDED`, `CANCELLED`) and `invoices` (`ISSUED`, `PAID`, `REFUNDED`, `VOID`), with partial unique index `uq_payment_orders_gateway_payment_paid` enforcing gateway idempotency on `PAID`.
  - Comprehensive automated suite: 177/177 tests green across 18 test files; `npx tsc --noEmit` exits with 0 errors; `npm run build` exits with code 0 across 45 routes.
- **Enterprise Commerce, Invoicing & Authoritative Persistence Reconciled (CP-7.7):**
  - Live PostgreSQL database migration `20261026000005_zealosh_payment_orders_and_invoices.sql` deployed and verified on Core Hub Project 1 (`yeegsljnjwxdhgzfdnyg`).
  - Durable persistence schema: `payment_orders` and `invoices` tables created with full immutable accounting snapshot columns, foreign key relations, and unique partial constraint `uq_payment_orders_gateway_payment_paid`.
  - Atomic PostgreSQL transaction functions: `public.complete_payment_order_atomic` and `public.process_refund_atomic` deployed for concurrency-safe seat reservation, enrollment, invoice creation, and refund access revocation.
  - Defense-in-depth Row Level Security (RLS): All table access revoked from `anon` (verified live: `permission denied`), candidate read restricted to `user_id = public.current_user_id()`, and admin access guarded via `public.is_admin()`.
  - Hardened data layer: `SupabaseAdapter` and `db.ts` operate directly against PostgreSQL without silent fallbacks to memory or local JSON.
  - Dynamic payment order initiation (`/api/payments/order`) with course pricing (INR/USD), prerequisite credential checking (ASP required for CSP), batch seat availability validation, and comprehensive audit trails.
  - Cryptographic payment webhook receiver (`/api/payments/webhook`) with constant-time HMAC-SHA256 signature verification (`crypto.timingSafeEqual`), duplicate payment idempotency defense, and atomic seat reservation + enrollment fulfillment.
  - Full statutory Indian GST invoicing engine (18% inclusive tax; CGST 9% + SGST 9%) with SAC code `999293`, verified rounding reconciliation, and staging registration transparency flag (`providerGstinVerified`).
  - Printable official Tax Invoice page (`/invoices/[invoiceId]`) with `@media print` styling, digital authenticity stamp, customer/sponsor GSTIN, and direct print invocation.
  - Learner Dashboard Invoicing Integration (`/student`) displaying chronological payment receipts, status badges, amounts, and one-click access to official tax invoices.
  - Multi-dataset regulatory compliance reporting engine (`/api/admin/reports`) streaming RFC 4180 CSV and structured JSON for `enrollments`, `exams`, `certificates`, and `revenue`.
  - Superadmin Reporting Hub (Tab 14 on `/admin`) with 4 KPI summary cards, interactive dataset selectors, real-time table preview, and instantaneous export triggers.
  - Full automated suite: 175/175 tests green across 18 test files; `npx tsc --noEmit` exits with 0 errors; `npm run build` exits with code 0 across 44 routes.
- **Core LMS & Learner Lifecycle Completeness Delivered:**
  - Dynamic user account & role governance (`/api/admin/users`) with audit logging.
  - Comprehensive student enrollment lifecycle (`/api/admin/enrollments`) with progress tracking and status overrides (`ACTIVE`, `EXPIRED`, `REVOKED`).
  - Technical coursework & rubric authoring (`/api/assignments`) with multi-criteria scoring breakdowns, persisted directly in PostgreSQL (`assignments.rubric` JSONB).
  - Student solution submissions (`/api/assignments/[id]/submit`) with strict user isolation, enrollment verification, and zero redundant course/batch storage.
  - Instructor assignment grading queue (`/api/assignments/[id]/grade`) with criterion-level scores, feedback, and course-scoped instructor RBAC (`public.is_course_instructor`).
  - Authoritative database migration synchronized: `supabase/migrations/20261026000004_zealosh_assignments_and_submissions.sql` deployed and verified on Core Hub Project 1 (`yeegsljnjwxdhgzfdnyg`).
  - Zero anonymous access grants (`anon` revoked from both `assignments` and `assignment_submissions`).
  - Required foreign-key indexes created and verified.
  - SupabaseAdapter hardened with explicit database error rethrowing and zero silent mock fallback.
  - Dedicated live coursework suite `tests/supabase-coursework-live.test.ts` passing all 10 real PostgreSQL scenarios (11/11 tests green) with guaranteed fixture cleanup (0 leftover records).
  - Recurring live session scheduling (`/api/live`) with weekend interval computation.
  - Live session attendance verification (`/api/live/[id]/attendance`).
  - Course prerequisite validation (ASP required for CSP enrollment) and completion date bounds.
  - Persistent lesson progression tracking (`/api/courses/[slug]/progress`).
  - Dynamic course assignment mapping in `/learn/[courseId]` (resolved hardcoded `crs-asp-01`).
  - Server-enforced prerequisite examination gating in `/api/exams` and `/api/exams/[examId]/start`: candidates must be actively enrolled and achieve >=80% lesson progress before starting mock exams; unenrolled or unprogressed candidates are blocked with structured 403 errors (`EXAM_UNENROLLED`, `EXAM_PROGRESS_INSUFFICIENT`); Super Admin override supported.
  - Enhanced `/exams` and `/exams/[examId]` UI with lock badges, progress indicators (e.g. 50% / 80% required), direct CTAs to lessons or enrollment, and post-exam accreditation card with instantaneous credential verification link (`/verify/[code]`).
  - Centralized administrative certificate revocation governance (`/api/admin/certificates/revoke`) with reason tracking and immutable audit logging.
  - End-to-end integration test suite `tests/learner-workflow-e2e.test.ts` (11 tests) validating the complete 11-step journey from enrollment gating to post-exam certification and revocation.
- **Production-grade OpenID Connect (OIDC) SSO Provider** implemented with RFC 7636 PKCE verification, single-use replay protection, state/nonce propagation, and strict environment domain isolation.
- **Full automated test suite passing:** **160/160 tests green** across 17 test files in Vitest.
- **TypeScript compilation clean:** `npx tsc --noEmit` exits with 0 errors.
- **Next.js Production Build:** Exit Code 0, 40/40 routes compiled cleanly.
- Multi-stage production `Dockerfile`, `docker-compose.zealosh-platform.yml` with RAM tmpfs `/run/secrets`, dedicated one-time upgrade runner `moodle-upgrade-runner.sh`, and `deploy/nginx/` with environment-specific virtual host routing validated.
- Moodle custom theme package `moodle-custom/theme_zealosh/` complete with `version.php`, `config.php`, `lib.php`, SCSS brand tokens, language files, and mustache templates.
- BigBlueButton branding package `bbb-custom/` prepared with custom CSS, `settings.json`, and automated deployment script `apply-branding.sh`.
- End-to-end verifiable certificate registry with QR verification (`/verify/[code]`), authenticated student certificate retrieval (`/api/certificates`), and automated issuance on passing exam score.

---

## 1. Verified Host Environment Baseline

| Component | Verified State | Notes / Operational Status |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 / Windows NT (x64) | Shell: PowerShell (`pwsh`) |
| **Node.js** | `v24.12.0` (Active) | Compatible with Next.js 14 App Router and TypeScript 5.6 |
| **npm** | `11.6.2` (Active) | Primary package manage| **TypeScript** | `5.6.3` (Strict mode) | 0 compilation errors across all 48 routes, API endpoints, and test suites |
| **Git** | `v2.55.0.windows.5` via mingw64 | Verified using mingit & mingw64 tools |
| **Docker Tooling** | Not installed on Windows host | Production manifests (`docker-compose.zealosh-platform.yml`, `Dockerfile`, `nginx.conf`) fully validated for staging/production Linux deployment. |
| **Database Persistence** | Multi-Mode ACID Engine (`in_memory` & `supabase` PostgreSQL) | Persistent transactional storage for courses, batches, enrollments, users, assignments, submissions, exams, certificates, payment orders, tax invoices, class recordings, doubts, highlights, workflows, templates, and audit logs. |
| **Vitest Test Suite** | 206/206 Tests Passing (100% Green across 20 files) | Covers AI Tutor Capability Gate (12 tests), Class Recordings, Chapters, Resources & Interactive Doubts (17 tests, including live Supabase Project 1 roundtrip), Milestone 7 Enterprise Commerce & Reporting (17 tests, including live PostgreSQL persistence roundtrip, atomic fulfillment, invoice reconciliation, refund revocation, seat capacity barrier, and catalog price change snapshot survival), Core LMS workflows (8 tests), Learner Journey & Exam Gating (11 tests), Supabase persistence & security (46 tests), Live Supabase Coursework persistence & security (11 tests), OIDC PKCE/replay & environment isolation (17 tests), Superadmin config (7 tests), PWA offline caching (3 tests), enrollment limits (4 tests), exam engine (4 tests), cryptography (3 tests), credential interpolation (12 tests), redirect-aware healthcheck (10 tests), exact 3-state schema gate & collision defense (9 tests), and ephemeral secret whitespace preservation (9 tests). |
| **Next.js Production Build** | Exit Code 0 | All 48 static and dynamic routes compiled cleanly. First Load JS shared by all routes: `87.1 kB`. |
| **Browser Verification** | Visual Validation Complete | Verified `/student` Tax Invoices list, `/invoices/[invoiceId]` printable view, `/admin` Tab 14 Compliance Reporting Engine, and `/recordings/[recordingId]` learner player. |
| **Preflight Gates & Hardening** | Staging Domain Isolation, Dual-Path Secret Hygiene, Exact 3-State Schema Gate, Finalized Option A DB | Staging URLs (`lms.staging.zealosh.com`), dual-path secret hygiene (read-only Compose secret preserved; disposable copy on tmpfs `/run/moodle-installer/moodle_admin_pass.tmp` zero-wiped after use), loopback healthcheck, `CLEAN`/`INSTALLED`/`PARTIAL_OR_UNEXPECTED` database classification, and Option A dedicated Supabase Project 2 architecture with PostgREST Data API disabled. Secret-mount runtime verification and live cloud provisioning are **BLOCKED** pending operator cloud action and Linux host with Docker Compose execution. |

---

## 2. Authoritative Eight-Milestone Roadmap Execution Status

| # | Authoritative Milestone | Scope & Delivered Sub-Items | Verified State | Evidence & Operational Constraints |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Core Hub Persistence & Regression Testing** | Next.js 14 Hub, dual storage adapter (`in_memory` & `supabase`), 12-point ACID persistence, atomic enrollment function (`enroll_student_atomic`), objective exam engine, verifiable certificate issuance, coursework rubrics, submissions, and grading queue. Live remote Supabase migration `20261026000004_zealosh_assignments_and_submissions.sql` fully reconciled and verified against Project 1 (`yeegsljnjwxdhgzfdnyg`). | **PASS / VERIFIED** | 160/160 Vitest tests green across 17 files; `tests/supabase-coursework-live.test.ts` (11/11 tests pass against live PostgreSQL); Next.js production build exit code 0; clean fixture teardown verified (0 leftover test records). |
| **2** | **Moodle Database Connectivity, Installation & Data Persistence** | Moodle 5.3 LTS container connecting to dedicated Supabase Project 2 (Option A: Session Mode port 5432, PostgREST Data API disabled on Project 2, least-privilege SQL grants), 30 Apache prefork workers, 3-state schema gate (`CLEAN`, `INSTALLED`, `PARTIAL_OR_UNEXPECTED`), Docker Compose file secret (`moodle_admin_pass`), disposable tmpfs working copy (`/run/moodle-installer/moodle_admin_pass.tmp`), controlled upgrade runner (`moodle-upgrade-runner.sh`), loopback redirect-aware healthcheck (`moodle-healthcheck.sh`), and non-destructive restore drill (`backup-restore-test.sh`). | **PREPARED / GATE-HARDENED (INFRASTRUCTURE PENDING OPERATOR AUTHORIZATION)** | Docker Engine absent on Windows NT host; Supabase Project 2 unprovisioned. Container builds, live secret-mount permissions, and database migration execution remain BLOCKED pending operator authorization and Server 1 Linux host. |
| **3** | **Authentic Branding & Real OIDC Browser SSO** | Authentic Zealosh brand assets (`public/logo.png`, `public/logo-round.png` preserved unchanged), Boost child theme package `moodle-custom/theme_zealosh`, RFC 8414 OIDC discovery with strictly isolated canonical issuer (`getCanonicalBaseUrl`), RFC 7636 PKCE verification, single-use auth code replay prevention, cross-environment redirect rejection, userinfo trick rejection. | **PROTOCOL: PASS (SIMULATED) / BROWSER SSO: BLOCKED** | 17/17 OIDC unit tests passing (SIMULATED); live browser single-click SSO navigation into Moodle web UI remains BLOCKED until Moodle container runs on Server 1. |
| **4** | **BigBlueButton Live Classroom Deployment** | Dedicated Server 2 specification (Ubuntu 24.04 LTS / BigBlueButton 4.0, 8 vCPU, 16GB RAM), automated deployment script `deploy/bbb-staging-setup.sh` with isolated secret salt file, custom HTML5 client branding skin `bbb-custom/apply-branding.sh`. | **PREPARED / SCRIPTS VALIDATED (LIVE MEDIA BLOCKED)** | Scripts and configuration validated; live WebRTC audio, video, screen sharing, and recording validation remain BLOCKED pending physical Server 2 provisioning. |
| **5** | **End-to-End Learner & Administrator Workflows** | Course discovery (`/courses/[slug]`) -> atomic seat reservation -> student dashboard (`/student`) -> dynamic lesson coursework (`/learn/[courseId]`) -> server-enforced prerequisite exam gating (`/api/exams`, `/api/exams/[id]/start`) -> exam autosave & scoring (`/exams/[id]`) -> verifiable accreditation card & instant verification (`/verify/[code]`) -> administrative certificate governance & revocation (`/api/admin/certificates/revoke`). Superadmin console (`/admin`), dynamic configuration, audit logs, and instant rollback. | **CORE HUB: PASS (VERIFIED) / FEDERATED: BLOCKED** | Core Hub workflows verified with dedicated 11-scenario integration suite `tests/learner-workflow-e2e.test.ts` against live persistence; federated cross-platform student handoff into Moodle course modules and BBB live meetings remains BLOCKED pending Moodle & BBB runtimes. |
| **6** | **Security Hardening, Backups/Restoration & Production Review** | OWASP Top 10 alignment, bcrypt hashing, signed JWT auth, Nginx reverse proxy overwriting forwarded headers, 5-tier secret exposure defense, 4-tier decoupled backup runbook (`docs/BACKUP_AND_RESTORE_RUNBOOK.md`). Hardened `backup-restore-test.sh` with 7-day retention rotation and non-destructive restore drill into disposable database (`zealosh_drill_*`). | **RUNBOOK PREPARED / RESTORE DRILL BLOCKED** | Cryptographic and proxy isolation verified; physical non-destructive database restore drill into disposable `zealosh_drill_*` database remains BLOCKED until staging database is provisioned. |
| **7** | **Enterprise Commerce, Invoicing & Multi-Dataset Reporting Engine** | Complete payment order lifecycle (`/api/payments/order`), cryptographic HMAC-SHA256 webhook processing (`/api/payments/webhook`), automated 18% GST statutory tax invoicing (`INV-2026-XXXX`, HSN 999293), responsive printable tax invoice view (`/invoices/[invoiceId]`), student portal invoice history (`/student`), and multi-dataset compliance reporting engine (`/api/admin/reports`) streaming RFC 4180 CSV and JSON across `enrollments`, `exams`, `certificates`, and `revenue`. Enhanced Superadmin Tab 14 with KPI summary metrics, dataset selectors, live preview table, and export triggers. Authoritative persistence in Core Hub PostgreSQL Project 1 (`yeegsljnjwxdhgzfdnyg`) via migration `20261026000005_zealosh_payment_orders_and_invoices.sql`, with RLS anon denial and atomic RPC functions `complete_payment_order_atomic` and `process_refund_atomic`. PWA manifest and offline caching. Class Recordings, Chapters, Resources & Doubts (CP-7.9) across 6 tables, HMAC playback tokens, and 4-portal integration. | **PASS / VERIFIED** | 17/17 dedicated tests passing in `tests/enterprise-commerce-reports.test.ts`; 17/17 in `tests/recording-doubts-highlights.test.ts`; 206/206 full suite tests passing; 48 routes building cleanly; verified in automated browser testing. |
| **8** | **AI Tutor Feature Gate, Seam Scaffolding & Staging Readiness** | Optional AI Tutor strictly disabled (`aiTutorEnabled: false`), capability gate (`assertAiTutorEnabled`), zero outbound inference, ADR-003, memory leak elimination in API routes (`/api/exams/[id]/submit`, `/api/health/readiness`), Option A Moodle database decision finalized in `MOODLE_DATABASE_ARCHITECTURE.md`, 10-step operator-controlled staging deployment sequence and 12-point acceptance checklist in `DEPLOYMENT_RUNBOOK.md`, and Ubuntu 24.04 / BBB 4.0 baseline. | **PASS / VERIFIED (STAGING INFRASTRUCTURE UNPROVISIONED)** | 12/12 dedicated tests passing in `tests/ai-tutor-gate.test.ts`; 206/206 full suite tests passing; TypeScript 0 errors; 48 routes building cleanly; staging deployment pending operator authorization. |

---

## 3. Disambiguation of Test Suites and Execution Modes

To prevent confusion between Core Hub application testing and unprovisioned infrastructure components:

1. **Full Vitest Suite Command:** `npx vitest run`
   - **Total Tests:** 206 passed / 206 total across 20 test files (Exit Code 0).
   - **Active Storage Mode:** `DATABASE_STORAGE="supabase"` connected to remote Supabase Project 1 (`https://yeegsljnjwxdhgzfdnyg.supabase.co`).
2. **Core LMS, Learner, Commerce & Recording Regression Suites:**
   - `tests/ai-tutor-gate.test.ts` (12 tests): Validates default disabled capability gate, server-side refusal HTTP 403 `AI_TUTOR_DISABLED`, zero outbound network inference, candidate config validation, superadmin RBAC, and active exam attempt guard.
   - `tests/recording-doubts-highlights.test.ts` (17 tests): Validates HMAC-SHA256 streaming tokens, download policy enforcement, cross-batch access grants with audit trails, chapter timeline validation, study resource URL protocol safety, timestamp-linked doubts with learner privacy isolation, and live Supabase PostgreSQL Project 1 roundtrip.
   - `tests/enterprise-commerce-reports.test.ts` (17 tests): Validates payment order creation, prerequisite gating, HMAC-SHA256 webhook signature verification, idempotency defense, 18% Indian GST calculation, learner invoice isolation, refund access revocation, accounting snapshot invariance against catalog price changes, seat capacity gating, live Supabase roundtrip with atomic fulfillment and clean fixture deletion, and multi-dataset compliance report streaming (CSV/JSON).
   - `tests/learner-workflow-e2e.test.ts` (11 tests): Validates the full learner journey: unauthenticated block, unenrolled block, <80% progress block, admin override, exam catalog gating, 100% progress unlock, exam autosave, authoritative scoring & certificate issuance, public verification, and administrative revocation.
   - `tests/core-lms-workflows.test.ts` (8 tests): Validates course publishing lifecycle, prerequisite bounds, lesson progression persistence, assignment authoring with rubrics, student submission isolation, instructor grading queue, recurring live session scheduling, and admin role governance.
3. **Core Hub-Only Live Database Tests:**
   - `tests/supabase-coursework-live.test.ts` (11 tests): Validates live PostgreSQL coursework persistence, course-scoped instructor permissions, student active enrollment checks, fresh adapter instance persistence, RLS defense-in-depth against score tampering, foreign key constraint enforcement, and audit logs on remote Supabase Project 1.
   - `tests/supabase-persistence.test.ts` (29 tests): Validates live PostgreSQL CRUD, atomic seat reservations, exam state transitions, and audit logs on remote Supabase Project 1.
   - `tests/supabase-security.test.ts` (13 tests): Validates RLS policies, unauthenticated write rejections, and schema invariants.
   - `tests/supabase.test.ts` (4 tests): Validates client initialization and gateway health.
   - **Total Live Supabase Tests:** 72 tests passed against live Supabase Project 1 (including coursework, persistence, security, commerce roundtrip, and recordings roundtrip).
4. **Infrastructure & Logic Unit Tests (SIMULATED):**
   - `tests/oidc-sso.test.ts` (17 tests): Evaluates OIDC RFC 8414 discovery, PKCE S256 challenge, code replay defense, hostile forwarded-host isolation, and redirect security (SIMULATED in Node runtime; not a live browser SSO test).
   - `tests/moodle-healthcheck.test.ts` (10 tests): Evaluates bash loopback URL parsing and redirect safety logic (SIMULATED; not against live Apache).
   - `tests/moodle-schema-gate.test.ts` (9 tests): Evaluates 3-state schema classifier logic (SIMULATED).
   - `tests/secret-ephemeral.test.ts` (9 tests): Evaluates 5-tier secret exposure defense, memory buffer zero-wiping, and tmpfs hygiene (SIMULATED).
   - `tests/credential-interpolation.test.ts` (12 tests): Evaluates shell, Compose, and PHP var_export escaping (SIMULATED).
   - `tests/superadmin-config.test.ts` (7 tests), `tests/enrollment.test.ts` (4 tests), `tests/exam-engine.test.ts` (4 tests), `tests/auth.test.ts` (3 tests), `tests/pwa-offline.test.ts` (3 tests), `tests/adapters.test.ts` (6 tests).
5. **Unprovisioned Infrastructure (BLOCKED):**
   - **Docker Engine & Containers:** Windows host lacks Docker daemon; 0 containers built or running.
   - **Supabase Project 2 (Moodle):** Not provisioned; zero `mdl_*` tables created.
   - **BigBlueButton (Server 2):** Not provisioned; live audio/video WebRTC untested.

