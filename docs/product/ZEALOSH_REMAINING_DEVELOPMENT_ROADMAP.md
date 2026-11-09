# Zealosh LMS — Remaining Product Development Master Roadmap

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-08A — Complete Product Scope Audit, Functional Gap Analysis & Remaining Development Roadmap  
**Execution Policy:** Development-First (Complete All Software Modules Prior to Infrastructure Procurement)  
**Target Environment:** Local Antigravity IDE & Isolated PostgreSQL Verification  
**Infrastructure Policy:** HARDWARE PROCUREMENT STRICTLY GATED UNTIL DEVELOPMENT COMPLETION  
**Date:** November 2026  
**Status:** AUTHORITATIVE DEVELOPMENT PROGRAMME  

---

## 1. Master Development-First Strategy

The institutional leadership has issued an explicit strategic directive:
> **"Finish the entire Zealosh software product before proceeding with server procurement, infrastructure provisioning, staging deployment or production launch."**

To ensure zero technical debt, zero feature omissions, and predictable execution, the remaining product capabilities identified in the Gap Matrix are structured into **six focused, dependency-ordered development milestones (ZM-IMPL-08B through 08G)**, followed by final full-platform regression verification and gated procurement (08H).

---

## 2. Master Implementation Milestone Sequence

```
[ ZM-IMPL-08A: Master Product Scope Audit & Functional Gap Analysis (Current) ]
                                  │
                                  ▼
[ ZM-IMPL-08B: Foundation Hardening (Auth Decoupling, Sessions, Storage Client) ]
                                  │
                                  ▼
[ ZM-IMPL-08C: Commerce Decoupling, Entitlement Engine & Admissions Pipeline ]
                                  │
                                  ▼
[ ZM-IMPL-08D: Institutional Scheduling, Orientation & Isolated Group Messaging ]
                                  │
                                  ▼
[ ZM-IMPL-08E: Central Question Bank, PDF Certificates & Document Vector RAG ]
                                  │
                                  ▼
[ ZM-IMPL-08F: Certification Planning, Testimonials, Gamification & Growth ]
                                  │
                                  ▼
[ ZM-IMPL-08G: Enterprise Operations, PWA Mobile Engine & Event Outbox Sync ]
                                  │
                                  ▼
[ ZM-IMPL-08H: Full Regression Verification, Procurement Gating & Penetration Testing ]
                                  │
                                  ▼
[ ZM-IMPL-09: Official Production Launch (DNS Cutover to https://zealosh.com) ]
```

---

## 3. Detailed Milestone Specifications & Acceptance Gates

### Milestone ZM-IMPL-08B — Track 1: Foundation Hardening
* **Objective:** Harden core security, decouple authentication into native Supabase GoTrue Auth, and build the direct cloud storage client abstraction.
* **Scope & Capabilities:**
  1. `AUTH-01`: Implement Supabase GoTrue Auth integration (`auth.users`), creating a database trigger to populate `public.profiles` automatically while maintaining backward compatibility for existing test sessions.
  2. `AUTH-04`: Active user sessions panel (`/api/auth/sessions`) with one-click revocation of other devices.
  3. `AUTH-05`: Database-level 5-attempt failed login counter with automatic 15-minute lockout.
  4. `MEDIA-01`: S3/R2 direct pre-signed PUT/GET URL generator abstraction supporting direct browser-to-bucket uploads with file MIME and size validation.
* **Existing Code Reused:** `src/lib/auth/jwt.ts`, `src/lib/supabase/`, `src/lib/storage/recording-storage.ts`.
* **Verification & Test Plan:**
  - Automated tests for multi-device session revocation.
  - Automated tests for 5-attempt lockout and expiry.
  - Mock S3 pre-signed URL signing tests.
* **Exit Gate:** 100% green tests; zero regressions in existing authentication suites.

---

### Milestone ZM-IMPL-08C — Track 2: Commerce Decoupling, Entitlements & Admissions Pipeline
* **Objective:** Decouple Academic Courses from Commercial Sellable Products, implement the server-authoritative Entitlement Engine, and build the 14-stage admissions pipeline.
* **Scope & Capabilities:**
  1. `COMM-01`: Decouple academic courses from commercial products. Implement schema and models for `public.products`, `public.product_offerings`, and `public.product_entitlements`.
  2. `COMM-02`: Server-authoritative Entitlement Engine (`verifyEntitlement(userId, courseId, feature)`) gating access to Live WebRTC classes, Quizzes, Video lectures, or Exam simulations per purchased tier.
  3. `CRM-01 & CRM-02`: 14-stage Admissions Pipeline Kanban board, qualification document upload & verification queue with side-by-side approval controls.
  4. `PROV-01`: Resumable post-admission provisioning orchestrator (Identity -> Entitlement -> Batch Allocation -> Welcome Email) with dead-letter queue.
  5. `CMS-04`: Dynamic Course Landing Page template driven directly by authoritative course offerings and batch schedules.
* **Existing Code Reused:** `src/lib/store/supabase-adapter.ts`, `src/app/api/admissions/`, `src/app/api/payments/`.
* **Verification & Test Plan:**
  - Test verifying that a student who bought a "Video Only" SKU receives `403 FORBIDDEN` when attempting to join a live WebRTC class or start a high-stakes exam.
  - Test verifying idempotent post-admission provisioning retries.
* **Exit Gate:** Complete commerce and admissions workflows locally verified.

---

### Milestone ZM-IMPL-08D — Track 3: Institutional Scheduling, Orientation & Group Communication
* **Objective:** Unify institutional calendars, implement course orientation booking, and expand messaging into group/batch channels with strict academic isolation.
* **Scope & Capabilities:**
  1. `CAL-01`: Master Institutional Calendar aggregating live classes, exam windows, assignment deadlines, and faculty availability with timezone conversion.
  2. `ORIENT-01`: Course orientation booking engine supporting online (BigBlueButton) and physical venue slots, capacity management, and attendance logging.
  3. `MENTOR-01`: 1-on-1 faculty office hours and mentorship appointment booking engine with double-booking prevention.
  4. `MSG-02`: Course channels, batch channels, and cross-batch revision groups. Strict Invariant: Messaging channel membership must NEVER grant academic course access or grade visibility.
* **Existing Code Reused:** `src/app/api/messages/`, `src/app/api/live/`, `supabase/migrations/20261103000018_zealosh_in_app_messaging.sql`.
* **Verification & Test Plan:**
  - Concurrency tests preventing overbooking of orientation and mentorship slots.
  - Academic isolation test verifying cross-batch messaging security.
* **Exit Gate:** Calendar, orientation, mentorship, and channel messaging fully operational.

---

### Milestone ZM-IMPL-08E — Track 4: Central Question Bank, PDF Certificates & Vector RAG Ingestion
* **Objective:** Centralize assessment question authoring, build dynamic PDF certificate rasterization, and implement the automated document text ingestion pipeline for Zealosh AI.
* **Scope & Capabilities:**
  1. `EXAM-03`: Centralized searchable Question Bank workspace with category taxonomy, difficulty tags, Bloom's cognitive levels, and question pool reuse.
  2. `EXAM-05`: Psychometric distractor analysis, item difficulty calculation, and discrimination index reporting for certification mock exams.
  3. `CRED-03`: Dynamic PDF certificate rasterization using PDFKit with high-resolution vector layout, authentic Zealosh branding, and embedded cryptographic QR codes.
  4. `AI-03`: Automated PDF document text extraction, semantic chunking, and vector embedding ingestion pipeline (`pgvector`) for course-grounded RAG retrieval.
* **Existing Code Reused:** `src/lib/ai/`, `src/lib/store/supabase-adapter.ts`, `src/app/api/exams/`.
* **Verification & Test Plan:**
  - Psychometric formula unit tests.
  - PDF generation and QR scan validation tests.
  - Document chunking and semantic similarity retrieval tests.
* **Exit Gate:** Question bank, PDF certificates, and vector ingestion locally verified.

---

### Milestone ZM-IMPL-08F — Track 5: Student Engagement, Reviews, Growth & Certification Planning
* **Objective:** Implement student trust features, student-owned external certification tracking, motivation/gamification, and promotional growth tools.
* **Scope & Capabilities:**
  1. `PLAN-01`: Student-owned External Certification Planning tracker (target exam dates, preparation milestones, tutor advisory feedback, verified outcome logging).
  2. `TRUST-01`: Course and instructor review engine with granular student consent capture, testimonial moderation queue, and public success story showcase.
  3. `GAME-01`: Student daily study streaks, XP learning points, achievement milestone badges, and privacy-respecting opt-out leaderboards.
  4. `GROWTH-01`: Student referral link generator, promotional discount coupon validator at checkout, and campaign UTM attribution tracking.
* **Existing Code Reused:** `src/components/`, `src/lib/store/db.ts`, `src/app/api/cms/`.
* **Verification & Test Plan:**
  - Test verifying student consent enforcement (no unconsented testimonials display).
  - Coupon redemption and discount calculation tests.
* **Exit Gate:** Reviews, certification planning, gamification, and referral tracking locally verified.

---

### Milestone ZM-IMPL-08G — Track 6: Enterprise Operations, PWA Mobile Engine & Event Outbox Sync
* **Objective:** Complete the mobile Progressive Web App (PWA) engine, cross-service event outbox synchronization, and institutional calendar iCal feed.
* **Scope & Capabilities:**
  1. `PWA-01`: Complete Progressive Web App implementation (`public/manifest.json`, service worker for offline asset shell, touch navigation, and install prompt).
  2. `SYNC-01`: Generic cross-service transactional event outbox (`public.event_outbox`), background consumer worker, dead-letter queue, correlation ID tracking, and administrative replay viewer.
  3. `CMS-05`: Protected workspace layout customizer allowing admins to toggle and arrange dashboard widgets within approved bounds.
  4. `INT-01`: Secure academic calendar subscribe feed (`/api/calendar/feed/[token].ics`) for Google Calendar / Apple Calendar.
* **Existing Code Reused:** `src/lib/store/`, `src/app/api/admin/config/`.
* **Verification & Test Plan:**
  - PWA manifest and service worker audit.
  - Transactional outbox event dispatch and dead-letter replay test.
* **Exit Gate:** Complete product development program verified; zero remaining software gaps.

---

### Milestone ZM-IMPL-08H — Final Platform Verification, Gated Procurement & Security Audit (COMPLETED & VERIFIED / RELEASE GATED)
* **Status:** COMPLETED & VERIFIED (November 8, 2026)
* **Objective:** Comprehensive end-to-end regression audit across the entire completed product, formal stakeholder procurement sign-off readiness, staging BOM reconciliation, and independent penetration testing RFP finalization.
* **Scope & Capabilities Delivered:**
  1. Full regression testing: 93 / 98 Vitest files passed (937 / 973 tests green; 36 tests in 5 Profile D suites awaiting live remote Supabase cloud).
  2. Full real-browser regression: 14 / 14 Playwright E2E spec files passed (**72 / 72 tests 100% green on Google Chrome**).
  3. Strict compiler & build: 0 TypeScript errors (`npx tsc --noEmit`), 163 Next.js routes compiled cleanly with Exit Code 0 (`npm run build`).
  4. Multi-domain concurrency suite (`tests/full-platform-concurrency.test.ts`): 6 / 6 passed (zero overselling, webhook idempotency, orientation capacity, attempt sealing, XP ledger, dispatcher lease mutual exclusion).
  5. Security hardening: Edge maintenance bypass cryptographically secured with native Web Crypto HMAC-SHA256 (`verifyAdminEmergencyBypass`), eliminating unsigned headers and plain cookies.
  6. OWASP ASVS 5.0.0 Level 2 & WSTG 4.2 mapping completed; static secret scan confirmed 0 leaks; dependency audit completed.
  7. Staging procurement BOM verified: Server 1 (Hetzner CPX31, ~₹1,628/mo), Server 2 (OVHcloud Rise-1 Bare Metal, ~₹6,195/mo under ₹10,000/mo ceiling), Server 3 (Contabo VPS 3, ~₹1,947/mo), Supabase Pro (~₹2,478/mo), Cloudflare Edge (~₹0-1,980/mo). Total TCO: ~₹12,500 – ₹14,700 INR/month.
  8. Independent Penetration Testing RFP finalized (`ZEALOSH_PENETRATION_TESTING_RFP.md`) with ASVS 5.0.0 / WSTG 4.2 alignment across all 20 institutional domains.
* **Exit Gate:** Local Engineering Complete & Verified (Gate A & B Pass); Release Gated for Staging Infrastructure Authorization (Gate D/E/G).

---

### Milestone ZM-IMPL-09 — Official Production Launch
* **Objective:** Production cutover and public launch on `https://zealosh.com`.
* **Scope:** DNS cutover, Let's Encrypt TLS activation, production database migration, smoke testing, and public academy opening.

