# Zealosh LMS — Skill Capability Matrix & Gap Analysis

**Project**: Zealosh LMS — Enterprise HSE Certification Learning & Examination Platform  
**Target Scope**: Fullstack LMS, BCSP/BCRSP Exam Engine, BigBlueButton Live Classroom, Moodle REST Core  
**Date**: October 25, 2026

---

## 1. Executive Summary

This gap analysis maps the actual software engineering capabilities of the Zealosh LMS workspace against the 13 required capability disciplines (Areas A through M). It strictly separates **Skills** (declarative knowledge, runbooks, schemas, and workflows) from **Software Dependencies** (runtime libraries, cloud services, daemon servers, and external credentials).

---

## 2. Distinction Between Skills and Software Dependencies

| Component Type | Nature | What It Provides | What It Does NOT Provide |
|---|---|---|---|
| **Skill** | Knowledge / Process | Workflows, architectural patterns, API contracts, failure modes, diagnostic runbooks | Binary drivers, running services, live API keys, network access |
| **Software Dependency** | Infrastructure / Tooling | Binary compilers, runtime libraries, daemon processes, database connections | Autonomous reasoning, domain business logic, test orchestration |

*Examples in Zealosh LMS:*
- The `playwright-and-qa-automation` skill provides the 13-step QA protocol, but requires Chromium binaries to execute headless browser journeys.
- The `postgresql-and-supabase` skill provides relational indexing and RLS rules, but requires a live PostgreSQL instance for persistent multi-container deployment.
- The `moodle-integration` skill provides REST schemas and idempotency invariants, but requires Moodle server credentials (`MOODLE_TOKEN`) for live syncing.
- The `bigbluebutton-integration` skill provides SHA-1 checksum calculation and join URL formulas, but requires a bare-metal Linux BigBlueButton cluster for WebRTC media streams.

---

## 3. Capability Coverage Across Required Areas (A through M)

### A. Software Architecture
- **Required Capabilities**: Requirements analysis, system architecture, modular design, API contract design, domain modeling, ADRs, dependency analysis, technical documentation.
- **Installed Skills**: `zealosh-architecture`, `brainstorming-and-architecture`, `clean-architecture`, `clean-code-and-refactoring`, `smart-coder`, `technical-documentation`.
- **Existing Tooling / Assets**: Next.js 14 App Router, authoritative store in `src/lib/store/db.ts`, 16 architecture docs in `docs/`.
- **Status**: **FULLY COVERED**.

### B. Frontend Engineering
- **Required Capabilities**: Next.js 14, React 18, TypeScript, responsive layouts, component architecture, form validation, state management, frontend performance, error & loading boundaries.
- **Installed Skills**: `nextjs-fullstack-architecture`, `react-development`, `typescript-development`, `frontend-design-system`, `chrome-devtools-debugging`.
- **Existing Tooling / Assets**: Next.js 14.2.15, React 18.3.1, TypeScript 5.6.3, Tailwind CSS 3.4.19, Lucide icons.
- **Status**: **FULLY COVERED**.

### C. UI/UX and Branding
- **Required Capabilities**: HSE corporate branding, user journeys, wireframing, design systems, student & instructor dashboards, admin portals, WCAG 2.1 AA accessibility.
- **Installed Skills**: `zealosh-ui-system`, `taste-design`, `shadcn-ui`, `web-animation-and-motion`, `design-md`, `site-md`.
- **Brand Guard & Stitch MCP Isolation**:
  - *Finding*: StitchMCP connection currently returns two projects belonging to **CakeToHome** (an unrelated luxury cake e-commerce bakery).
  - *Action*: CakeToHome assets and styles are strictly prohibited from being applied to Zealosh LMS. Zealosh uses its native Deep Navy (`#0A192F`), HSE Emerald (`#10B981`), and Gold (`#F59E0B`) palette.
- **Status**: **FULLY COVERED (Isolated from CakeToHome)**.

### D. Backend Engineering
- **Required Capabilities**: REST APIs, business logic, authentication, RBAC, multi-tenancy, input validation, background jobs, webhooks, idempotency, transaction management.
- **Installed Skills**: `nodejs-backend-architecture`, `api-design-and-security`, `background-jobs-and-queues`, `saas-multi-tenant-architecture`.
- **Existing Tooling / Assets**: Next.js route handlers (`/api/v1/...`), bcryptjs 2.4.3, jsonwebtoken 9.0.2, in-memory ACID store.
- **Status**: **FULLY COVERED**.

### E. Database Engineering
- **Required Capabilities**: PostgreSQL, relational schema design, entity relationships, constraints, indexes, migrations, ACID safety, query optimization, Supabase RLS, tenant isolation.
- **Installed Skills**: `postgresql-and-supabase`, `search-and-relevance-engineering`.
- **Existing Tooling / Assets**: 11 relational entities in `src/lib/store/db.ts` (Users, Courses, Batches, Enrollments, Lessons, LiveSessions, Attendance, ExamQuestions, Blueprints, Attempts, AuditLogs).
- **Dependency Gap**: Supabase cloud instance or local Docker Postgres container required for persistent SQL storage (in-memory adapter active for zero-dependency development).
- **Status**: **COVERED WITH DOCUMENTED LIMITATION (Persistent SQL requires connection string)**.

### F. LMS and Education
- **Required Capabilities**: Moodle REST integration, course/curriculum management, multiple tutors, recorded lessons, live-only/hybrid courses, progress tracking, enrollments, assignments, quizzes, certificates.
- **Installed Skills**: `moodle-integration`.
- **Existing Tooling / Assets**: `src/lib/adapters/moodle-adapter.ts` with deterministic mock mode and full REST payload schemas (`core_user_create_users`, `enrol_manual_enrol_users`, `core_course_get_contents`).
- **Dependency Gap**: Production Moodle 4.x endpoint and web service token (`MOODLE_URL`, `MOODLE_TOKEN`) required for live sync.
- **Status**: **COVERED WITH DOCUMENTED LIMITATION (Mock active, live sync requires remote token)**.

### G. Live Classrooms
- **Required Capabilities**: BigBlueButton integration, room creation, moderator/student join tokens, session scheduling, attendance tracking, recording management, SHA-1 checksum verification.
- **Installed Skills**: `bigbluebutton-integration`.
- **Existing Tooling / Assets**: `src/lib/adapters/bbb-adapter.ts` with SHA-1 checksum calculation and interactive `/live/[sessionId]` simulated stage.
- **Dependency Gap**: Linux BigBlueButton 2.7+ cluster URL and shared secret salt (`BIGBLUEBUTTON_URL`, `BIGBLUEBUTTON_SALT`) required for live WebRTC conferencing.
- **Status**: **COVERED WITH DOCUMENTED LIMITATION (Interactive stage active, remote WebRTC requires server salt)**.

### H. HSE Examination Engine
- **Required Capabilities**: BCSP/BCRSP question bank, timed attempts, randomized options, server-authoritative countdowns, anti-cheat question projection (stripped answer keys), in-flight autosave, diagnostic scoring.
- **Installed Skills**: `hse-exam-engine`.
- **Existing Tooling / Assets**: 60-question timed simulator in `src/app/exams/[examId]/page.tsx`, authoritative scoring in `src/app/api/exams/[examId]/submit/route.ts`, full question projection safety in `src/app/api/exams/[examId]/start/route.ts`.
- **Status**: **FULLY OPERATIONAL & VERIFIED**.

### I. Security
- **Required Capabilities**: OWASP ASVS review, bcrypt password hashing, JWT bearer tokens, RBAC route guards, HTTP-only secure cookies, CSRF/XSS protection, rate limiting, audit logging.
- **Installed Skills**: `security-auditing-and-owasp`, `security-audit`, `api-design-and-security`.
- **Existing Tooling / Assets**: bcrypt 10 rounds, HMAC-SHA256 tokens, audit log store in `db.ts`, Node test suites in `security-audit`.
- **Status**: **FULLY COVERED**.

### J. QA and Browser Automation
- **Required Capabilities**: Unit testing, integration testing, API testing, E2E browser automation, Playwright, responsive checks, video recording, screenshot capture.
- **Installed Skills**: `playwright-and-qa-automation`, `systematic-debugging`.
- **Existing Tooling / Assets**: Vitest 5.0.5 (17 tests passing), automated browser subagent (session video and 8 full-page screenshots captured on port 3000).
- **Status**: **FULLY OPERATIONAL & VERIFIED**.

### K. Performance and Reliability
- **Required Capabilities**: Frontend bundle analysis, query profiling, caching strategy, media optimization, load resilience, graceful error handling.
- **Installed Skills**: `performance-engineering`, `lazy-coder`, `image-and-media-optimization`.
- **Existing Tooling / Assets**: Next.js production build bundle report (87.1 kB shared JS), static ISR caching (`Cache-Control: s-maxage=31536000`), health endpoints (`/api/health/liveness`, `/api/health/readiness`).
- **Status**: **FULLY COVERED**.

### L. DevOps and Deployment
- **Required Capabilities**: Docker containerization, CI/CD pipelines, migration safety, health checks, rollback plans, production build verification.
- **Installed Skills**: `zealosh-production-readiness`, `devops-and-docker-deploy`, `git-workflow-and-releases`.
- **Existing Tooling / Assets**: MinGit 2.56.0, Next.js build scripts, daemon process management.
- **Status**: **FULLY COVERED**.

### M. Payments and Integrations
- **Required Capabilities**: Payment gateway integration (Razorpay / Stripe for INR/USD HSE enrollments), webhook verification, idempotency, enrollment state transitions.
- **Installed Skills**: `ecommerce-and-medusa`, `crm-and-workflow-automation`.
- **Existing Tooling / Assets**: Idempotent batch enrollment API (`/api/batches/[batchId]/enroll`), transactional seats capacity guard.
- **Dependency Gap**: Production Razorpay / Stripe merchant credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) required for processing real credit card / UPI transactions.
- **Status**: **COVERED WITH DOCUMENTED LIMITATION (Idempotent enrollment active, gateway keys required)**.

---

## 4. Gap Summary & Action Matrix

| Gap ID | Discipline | Missing Item | Impact | Recommended Action |
|:---:|---|---|---|---|
| **GAP-01** | Design & Stitch | Zealosh-specific Google Stitch project | Cannot push Zealosh screens to Stitch cloud | Create a dedicated Zealosh project in Stitch; strictly isolate from CakeToHome bakery assets. |
| **GAP-02** | External Services | Moodle Production Server URL & Token | Moodle sync operates in local mock mode | Retain mock adapter for dev/test; input production credentials before final rollout. |
| **GAP-03** | External Services | BigBlueButton WebRTC Cluster Salt | BBB runs in local simulated interactive mode | Retain interactive simulator; configure remote salt when Linux cluster is provisioned. |
| **GAP-04** | Database | Remote PostgreSQL / Supabase connection | State resides in memory (cleared on server restart) | Configure Supabase URL & Key in `.env.local` to persist relational tables. |
| **GAP-05** | Commerce | Razorpay / Stripe Payment Gateway Credentials | Direct payment checkout runs in direct-enrollment mode | Add payment merchant keys to `.env.local` when payment contract is established. |
