# Zealosh LMS — Master Implementation Roadmap

**Document Version:** 1.0.0  
**Status:** Approved Roadmap Baseline  
**Execution Model:** Phased, Test-Driven, Incremental Implementation

---

## 1. Phased Delivery Overview

```mermaid
gantt
    title Zealosh LMS Implementation Timeline
    dateFormat  YYYY-MM-DD
    section Phase 0: Discovery & Baseline
    Environment & Repositories     :active, p0_1, 2026-10-25, 1d
    Architecture & Docs Baseline  :active, p0_2, 2026-10-25, 1d
    section Phase 1: Minimal PoC
    Unified Zealosh Brand App     :p1_1, after p0_2, 2d
    Auth & Identity Federation    :p1_2, after p1_1, 2d
    Moodle & BBB Mock Adapters    :p1_3, after p1_1, 2d
    One Course Enrollment Flow    :p1_4, after p1_2, 2d
    section Phase 2: Core LMS
    Multi-Instructor & Batches    :p2_1, after p1_4, 3d
    Delivery Modes (Live/Hybrid)  :p2_2, after p2_1, 3d
    Student & Instructor Portals  :p2_3, after p2_2, 3d
    section Phase 3: Exam Engine
    HSE Question Banks & Blueprint:p3_1, after p2_3, 3d
    Secure Exam Engine & Timer    :p3_2, after p3_1, 3d
    Scoring, Results & Analytics  :p3_3, after p3_2, 2d
    section Phase 4: Business Ops
    Payments, Orders & Webhooks   :p4_1, after p3_3, 2d
    Certificates with QR Verify   :p4_2, after p4_1, 2d
    Audit Trail & Administration  :p4_3, after p4_2, 2d
    section Phase 5: AI & Security
    AI Practice & Study Assistant :p5_1, after p4_3, 2d
    Dynamic Watermarking & DRM    :p5_2, after p5_1, 2d
    section Phase 6: Production
    Automated E2E Playwright Suite:p6_1, after p5_2, 2d
    Load Testing & Performance    :p6_2, after p6_1, 2d
    Final Security & Runbooks     :p6_3, after p6_2, 1d
```

---

## 2. Phase Breakdown & Acceptance Criteria

### Phase 0: Discovery, Environment Verification & Acquisition (Current)
- **Goal:** Audit host environment, verify dependencies, evaluate upstream repositories, establish directory workspace, and generate the 10 mandatory architecture/compliance documents.
- **Deliverables:** Completed `docs/` suite, repository inventory, brand asset extraction (`logo.png`, `styles.css`), clean git repository.
- **Gate to Proceed:** Phase 0 documentation verified; environment compatibility matrix validated.

### Phase 1: Minimal Integrated Proof of Concept (PoC)
- **Goal:** Build the unified Zealosh web application shell, unified authentication system, course catalog, and the first integrated end-to-end workflow: Student Registration → Course Discovery → Batch Enrollment → Authorized Lesson Access → Live Classroom Launch → Student Progress.
- **Key Milestones:**
  1. Next.js 14+ frontend with official Zealosh design tokens (`#4f8c4c` primary green, `#252c41` navy, `#eaedf5` borders).
  2. NestJS backend with JWT auth, user entity, and external learning adapters.
  3. Moodle REST client adapter and BigBlueButton SHA1 signature adapter.
  4. End-to-end verification of registration to course view.
- **Gate to Proceed:** PoC workflow functions smoothly without errors; zero exposed secrets in browser.

### Phase 2: Core LMS & Multi-Instructor Cohorts
- **Goal:** Deliver full course lifecycle management, multi-instructor batch assignment, delivery mode flexibility (Recorded, Live, Hybrid, Materials-Only), and dedicated portals for students and instructors.
- **Key Milestones:**
  1. Batch capacity control and enrollment locking.
  2. Attendance logging for live sessions.
  3. Interactive curriculum viewer with notes, PDFs, and video chapters.
  4. Instructor grading dashboard and student progress tracking.
- **Gate to Proceed:** Multiple tutors successfully manage separate cohorts without cross-course privilege escalation.

### Phase 3: HSE Certification Examination Engine
- **Goal:** Implement the specialized HSE mock examination engine for ASP, CSP, CRSP, and CIT certifications.
- **Key Milestones:**
  1. Question banks mapped to official examination blueprints (Domains, Weights, Difficulty).
  2. Practice modes (Topic Practice, Timed Practice, Weak Area Review).
  3. Server-enforced countdown timer, periodic auto-save, auto-submission on expiration.
  4. Scoring engine with topic-level diagnostic feedback.
- **Gate to Proceed:** Concurrency test on exam submissions succeeds; client timer manipulation rejected by server.

### Phase 4: Business Operations, Payments & Certificates
- **Goal:** Complete commercial transactions, batch enrollment webhooks, verified certificate generation, and administrative audit logging.
- **Key Milestones:**
  1. Razorpay/Stripe webhook handlers with HMAC verification and idempotency keys.
  2. PDF certificate generation with unique cryptographic verification codes and public verification route (`/certificates/verify/[uuid]`).
  3. Super Admin dashboard with system-wide reporting and immutable audit trail.
- **Gate to Proceed:** Duplicate webhook test succeeds with zero duplicate enrollments; certificate verification returns valid status.

### Phase 5: AI Capabilities & Enhanced Media Protection
- **Goal:** Add AI-powered study assistance, personalized revision plans, question explanations, and dynamic streaming watermarks.
- **Key Milestones:**
  1. AI study assistant orchestrator with strict prompt safety guidelines and safety-critical disclaimers.
  2. Shaka Player integration with dynamic student watermark overlay.
- **Gate to Proceed:** AI assistant fails gracefully when offline; watermarks render dynamically across devices.

### Phase 6: Production Readiness & Quality Assurance
- **Goal:** Full automated test coverage, browser Playwright validation with recorded evidence, performance profiling, and disaster recovery drill.
- **Key Milestones:**
  1. 100% pass rate on unit and integration test suites.
  2. Complete Playwright E2E browser tests for Student, Instructor, and Admin journeys.
  3. Verified backup and recovery runbooks.
- **Gate to Proceed:** All acceptance criteria satisfied with real execution evidence.
