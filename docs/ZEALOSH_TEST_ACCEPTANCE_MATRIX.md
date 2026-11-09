# Zealosh LMS — Master Test & Acceptance Matrix

**Document Version:** 1.1.0  
**Milestone:** ZM-01.1 — Master Blueprint Reconciliation & Phase 1 Core Foundations Implementation  
**Target:** Single Institutional Learning & Certification Platform (`https://zealosh.com`)  
**Brand:** Zealosh Training & Consultants  
**Date:** October 31, 2026  

---

## 1. Testing Philosophy & Empirical Standards
Zealosh LMS enforces Rule 8 of the Engineering Constitution: **Verify Before Claiming Completion**.
- **Zero Simulated Realism:** No test mock may masquerade as production data to hide unresolved defects.
- **Strict Isolation:** Unit and integration test suites run against in-memory stores or isolated local PostgreSQL instances without mutating production cloud databases.
- **Pass Rate Mandate:** Every certified milestone must compile cleanly (`npx tsc --noEmit` exits with 0 errors) and achieve 100% test pass rates across automated test suites.

---

## 2. Existing Verified Test Suites Inventory

The following test suites exist in [`tests/`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/tests) and were verified empirically during milestone CP-8.14A.2:

| Test Suite File | Test Scope & Category | Tests Count | Duration | Verified Outcome |
| :--- | :--- | :---: | :---: | :---: |
| `tests/classroom-deployment-artifact.test.ts` | Server 2 UStar packaging, manifest hashing, runtime asset validation | 5 | 224ms | **PASS (100%)** |
| `tests/deployment-artifact.test.ts` | Server 1 UStar packaging, tar-bomb defense, reproducibility, symlink rejection | 9 | 1018ms | **PASS (100%)** |
| `tests/session-termination.test.ts` | Session lifecycle (`LIVE -> ENDING -> ENDED`), provider status check, 202/502 handling | 7 | 58ms | **PASS (100%)** |
| `tests/staging-env-validation.test.ts` | Preflight env validator, 24 variables, pooler mode enforcement, zero secret exposure | 8 | 18ms | **PASS (100%)** |
| `tests/classroom-provider.test.ts` | Classroom provider abstraction, role join URLs, moderation lifecycle, idempotency | 20 | 96ms | **PASS (100%)** |
| `tests/recording-persistence-regression.test.ts` | Disk persistence failures, atomic rename safety, lock handling, clean temp cleanup | 6 | 791ms | **PASS (100%)** |
| `tests/live-session-resolution.test.ts` | Live session discovery, enrollment verification, expired session join rejection | 12 | 1488ms | **PASS (100%)** |
| `tests/course-recordings.test.ts` | Course-level recording access, batch isolation, cross-batch access grants | 17 | 2016ms | **PASS (100%)** |
| `tests/oidc-sso.test.ts` | OIDC discovery, PKCE SHA-256 verification, replay prevention, token exchange | 27 | 2982ms | **PASS (100%)** |
| `tests/recording-ingestion-reconciliation.test.ts` | Dual webhook authentication, checksum/JWT verification, payload parsing, deduplication | 61 | 5543ms | **PASS (100%)** |
| `tests/phase1-auth-profiles.test.ts` | Phase 1: Profiles, multi-role assignments, self-registration, password reset, token auth | 8 | 810ms | **PASS (100%)** |
| `tests/phase1-academic-hierarchy.test.ts` | Phase 1: Academic years date validation, departments, programmes, modules, topics, tree | 6 | 476ms | **PASS (100%)** |
| `tests/phase1-admissions-lifecycle.test.ts` | Phase 1: Admissions apply, docs, review queue, atomic enrollment, cohort transfer, withdrawal, bulk CSV | 9 | 939ms | **PASS (100%)** |
| `tests/core-lms-workflows.test.ts` | Core LMS course management, lesson access, enrollment verification | 8 | 1500ms | **PASS (100%)** |
| `tests/learner-workflow-e2e.test.ts` | Learner course catalog, exam gating, progress calculation | 11 | 1277ms | **PASS (100%)** |
| `tests/superadmin-config.test.ts` | Platform settings, branding theme, feature flags, configuration audits | 7 | 923ms | **PASS (100%)** |
| `tests/enterprise-commerce-reports.test.ts` | Orders, Razorpay webhook, GST invoicing, revenue reports, refunds | 17 | 4942ms | **PASS (100%)** |
| `tests/recording-doubts-highlights.test.ts` | Class recordings, chapter highlights, student doubts, instructor answers | 17 | 6971ms | **PASS (100%)** |
| `tests/supabase-coursework-live.test.ts` | Coursework assignments, rubrics, learner isolation, grading queue | 11 | 7596ms | **PASS (100%)** |
| `tests/supabase-persistence.test.ts` | Supabase remote persistence, mode switching, examination lifecycle | 29 | 11221ms | **PASS (100%)** |
| `tests/moodle-healthcheck.test.ts` | Moodle engine redirect-aware health check routines | 10 | 1694ms | **PASS (100%)** |
| `tests/secret-ephemeral.test.ts` | Ephemeral secret masking, zero leak verification | 9 | 61ms | **PASS (100%)** |
| `tests/ai-tutor-gate.test.ts` | ADR-003 AI tutor feature flag gate enforcement | 12 | 224ms | **PASS (100%)** |
| `tests/credential-interpolation.test.ts` | Safe credential templating and env injection | 12 | 38ms | **PASS (100%)** |
| `tests/pwa-offline.test.ts` | PWA service worker manifest and offline caching | 3 | 16ms | **PASS (100%)** |
| `tests/supabase-security.test.ts` | RLS security policies, multi-tenant denial guards | 13 | 56ms | **PASS (100%)** |
| `tests/moodle-schema-gate.test.ts` | Moodle schema compatibility gate | 9 | 16ms | **PASS (100%)** |
| `tests/adapters.test.ts` | Moodle and BigBlueButton adapter interfaces | 6 | 9ms | **PASS (100%)** |
| `tests/exam-engine.test.ts` | BCSP ASP/CSP high-stakes exam blueprints | 4 | 13ms | **PASS (100%)** |
| `tests/auth.test.ts` | Bcrypt password hashing and JWT cryptography | 3 | 539ms | **PASS (100%)** |
| `scripts/skill-validation/routing-scenarios.test.ts` | Engineering skill router task classification | 15 | 22ms | **PASS (100%)** |
| **Total Automated Suites** | **33 Test Files** | **399** | **13.42s** | **100% PASS** |

In addition, `zealosh-classroom` contains:
- `bigbluebutton-html5/imports/ui/core/branding/brandingConfig.test.ts`: **5/5 tests passing** (verifying Zealosh green palette `#4f8c4c` and title formatting).

---

## 3. Required Future Test Suites Inventory (Gap Coverage)

To ensure comprehensive test gating across the 21 functional domains, the following suites must be developed:

| Required Suite Identifier | Target Domain | Specific Test Cases & Invariants to Verify | Category | Target Phase |
| :--- | :--- | :--- | :--- | :--- |
| `TEST-AUTH-01` | Authentication | Supabase Auth login, session refresh, email verification, 5-attempt lockout, password reset token expiry | Unit / API | Phase 1 |
| `TEST-ACAD-01` | Academic Admin | Academic year bounds, department tree hierarchy, course versioning, module ordering | Integration | Phase 1 |
| `TEST-ENROLL-01` | Admissions | Concurrent enrollment serialization (`enroll_student_atomic`), capacity overflow, batch transfer | Concurrency / DB | Phase 1 |
| `TEST-DELIV-01` | Delivery Modes | Multi-level delivery overrides (Course $\rightarrow$ Module $\rightarrow$ Topic), sequential prerecorded unlocks | Integration | Phase 2 |
| `TEST-VIDEO-01` | Prerecorded | Video progress beacon, scrub position resume, 90% completion threshold enforcement | Integration / API | Phase 2 |
| `TEST-ATTEND-01`| Attendance | Webhook leave event processing, percentage duration calculation, 75% threshold enforcement | Integration | Phase 2 |
| `TEST-ASSIGN-01`| Assignments | Concurrent rubric grading, late submission daily penalty, resubmission attempt limits | Concurrency / API| Phase 3 |
| `TEST-QUIZ-01` | Quizzes | Topic quiz generation, question randomization, auto-scoring, 3-attempt limit, cooling-off timer | Unit / API | Phase 3 |
| `TEST-EXAM-01` | Examinations | Server deadline rejection (+60s grace), anti-cheat answer key stripping, domain score breakdown | Unit / API | Phase 3 |
| `TEST-CERT-01` | Completion Engine| Multi-criteria evaluation (Lessons + Attendance + Quizzes + Assignments + Exam), unique QR code | Integration / DB | Phase 4 |
| `TEST-CERT-02` | Certificates | Concurrent certificate generation idempotency, public QR code verification, revocation audit | Concurrency / API| Phase 4 |
| `TEST-NOTIF-01` | Notifications | In-app notification delivery, transactional email payload compilation, duplicate suppression | Integration | Phase 5 |
| `TEST-DIAG-01` | Error Monitoring | Client exception capture, server error grouping, secret redaction in stack traces, diagnostic API | Security / API | Phase 5 |

---

## 4. End-to-End Acceptance Journey Scenarios

### Journey A: Student Full Academic Lifecycle (End-to-End)
1. **Scenario STU-E2E-01:** Learner registers account $\rightarrow$ completes email verification $\rightarrow$ enrolls in hybrid course batch $\rightarrow$ streams Module 1 video lessons to completion $\rightarrow$ takes Topic 1 quiz (passes with 85%) $\rightarrow$ attends scheduled live class via BigBlueButton $\rightarrow$ submits coursework assignment $\rightarrow$ receives rubric score (90/100) $\rightarrow$ launches certification exam $\rightarrow$ finishes before countdown expires $\rightarrow$ passes with 88% $\rightarrow$ completion engine awards verified certificate $\rightarrow$ public QR verification confirms authenticity.
2. **Success Invariant:** All milestones persist truthfully in PostgreSQL; no simulated mock routes used; zero credential leakage.

### Journey B: Faculty Cohort Management & Grading (End-to-End)
1. **Scenario FAC-E2E-01:** Instructor logs into `/instructor` $\rightarrow$ views assigned cohort roster $\rightarrow$ launches live session with moderator join URL $\rightarrow$ completes teaching and clicks End Session $\rightarrow$ LMS transitions to `ENDING` and reconciles to `ENDED` upon provider confirmation $\rightarrow$ reviews pending assignment submissions in grading queue $\rightarrow$ enters criterion rubric scores and student feedback $\rightarrow$ answers student doubt on class recording.
2. **Success Invariant:** Faculty scope strictly verified (instructor cannot grade unassigned courses or launch unassigned sessions).

### Journey C: Administrator Governance & System Audit (End-to-End)
1. **Scenario ADM-E2E-01:** Superadmin accesses `/admin` $\rightarrow$ inspects real-time diagnostic error logs $\rightarrow$ creates new academic session $\rightarrow$ configures batch capacity $\rightarrow$ grants previous-batch recording access to a student cohort $\rightarrow$ inspects immutable audit logs confirming all administrative actions are timestamped with actor ID and IP.
2. **Success Invariant:** Non-admin callers rejected with HTTP 403; audit logs cannot be updated or deleted.

