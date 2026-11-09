# Zealosh LMS — Master Client Decision Register

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-08A — Complete Product Scope Audit, Functional Gap Analysis & Remaining Development Roadmap  
**Scope:** Institutional, Financial, Legal, and Policy Decisions Requiring Human Stakeholder Approval  
**Date:** November 2026  
**Status:** FORMAL STAKEHOLDER DECISION REGISTER  

---

## 1. Governance & Policy Principles

The engineering constitution strictly forbids the AI coding agent from inventing arbitrary business rules, fee structures, tax treatments, or legal terms. Every decision below is documented with its operational context, available alternatives, technical dependencies, and risk of proceeding without approval.

---

## 2. Master Institutional Decision Register

### BDR-01: Student Admission & Enrollment Approval Model
- **Decision Question:** Should student enrollment be fully automated upon successful online payment, or should it require administrative review of student qualifications?
- **Options:**
  - *Option A:* Immediate automated enrollment upon payment gateway webhook.
  - *Option B:* Two-stage: Student submits application + documents; admin reviews; upon approval, payment link is issued.
  - *Option C (Recommended Default):* Hybrid: Open self-paced courses auto-enroll; advanced accredited certification cohorts (ASP, CSP, CRSP) require document verification before payment.
- **Current Technical Implementation:** Hybrid architecture supported; `platformSettings.admissionsAutoEnrollEnabled: false` by default.
- **Required Owner:** Institutional Leadership / Academic Dean.
- **Cost Implication:** Low (affects staff review workload).
- **Technical Dependency:** Admissions CRM (Domain K) and Post-Admission Provisioning (Domain P).
- **Risk Without Approval:** Unqualified students enrolling in advanced certification cohorts, risking accreditation compliance.
- **Blocks Development?** No (both flows are architected; default is manual review).

---

### BDR-02: Mandatory Live Class Attendance Threshold
- **Decision Question:** What minimum live class attendance percentage is required for a student to qualify for course completion and certificate issuance?
- **Options:**
  - *Option A:* 75% attendance of all scheduled live meeting minutes (Standard).
  - *Option B:* 80% attendance (Strict).
  - *Option C:* Flexible: 60% live attendance allowed if student watches 100% of published session recordings.
- **Current Technical Implementation:** 75% attendance default (configurable via system settings).
- **Required Owner:** Academic Committee / Lead Faculty.
- **Cost Implication:** Zero.
- **Technical Dependency:** Multi-Criteria Completion Engine (Domain E / CRED-01).
- **Risk Without Approval:** Disputed graduations and certificate eligibility claims.
- **Blocks Development?** No (threshold is an integer parameter in `course_completion_policies`).

---

### BDR-03: Prerecorded Video Scrubbing & Forward Seeking Restrictions
- **Decision Question:** Should students be allowed to scrub forward through prerecorded video lectures on their first attempt, or must they watch sequentially without skipping?
- **Options:**
  - *Option A:* Unrestricted scrubbing: Students can fast-forward and scrub at will.
  - *Option B:* Enforced sequential viewing: Forward scrub disabled until the video has been watched completely once (playback speed up to 1.5x permitted).
  - *Option C (Recommended):* Configurable per course: Accredited certification modules enforce sequential viewing; revision modules permit free scrubbing.
- **Current Technical Implementation:** High-frequency progress beacon tracks exact watched seconds; forward scrub is enabled in current player.
- **Required Owner:** Academic Dean.
- **Cost Implication:** Zero.
- **Technical Dependency:** Video Player Component (`src/components/classroom/VideoPlayer.tsx`).
- **Risk Without Approval:** Students skipping video lectures and artificially claiming completion hours.
- **Blocks Development?** No.

---

### BDR-04: Video Watch Completion Threshold
- **Decision Question:** What percentage of a prerecorded video duration must a student watch for the lesson to be marked as "Completed"?
- **Options:**
  - *Option A:* 85% of total video duration.
  - *Option B (Recommended):* 90% of total video duration (allows for closing credits/buffer gaps).
  - *Option C:* 95% of total video duration.
- **Current Technical Implementation:** 90% threshold hardcoded in `LearningProgressService`.
- **Required Owner:** Academic Committee.
- **Cost Implication:** Zero.
- **Technical Dependency:** `evaluateLessonCompletion`.
- **Blocks Development?** No.

---

### BDR-05: Assignment Late Submission & Penalty Policy
- **Decision Question:** What policy governs student coursework submitted after the published deadline?
- **Options:**
  - *Option A:* Hard cutoff: Submissions blocked immediately upon deadline expiration.
  - *Option B (Recommended):* Soft cutoff with daily penalty: 5% mark deduction per 24 hours overdue, up to 3 days (after which submission is rejected).
  - *Option C:* Instructor discretion: Submissions flagged as "Late" with exact overdue hours; instructor decides penalty during rubric grading.
- **Current Technical Implementation:** Submissions accepted with `isLate: true` and overdue hour counter; instructor applies penalty manually.
- **Required Owner:** Faculty Senate / Academic Dean.
- **Cost Implication:** Zero.
- **Technical Dependency:** Rubric Grading Engine (`src/lib/store/db.ts`).
- **Blocks Development?** No.

---

### BDR-06: Assignment Resubmission & Attempt Limits
- **Decision Question:** How many resubmission attempts should a student be allowed if an instructor requests revisions or grades a submission as "Needs Rework"?
- **Options:**
  - *Option A (Recommended):* Maximum 1 resubmission attempt.
  - *Option B:* Maximum 2 resubmission attempts.
  - *Option C:* Unlimited attempts until the grading period closes.
- **Current Technical Implementation:** Version history stored; status transitions support `REVISION_REQUESTED`.
- **Required Owner:** Academic Dean.
- **Cost Implication:** Zero.
- **Blocks Development?** No.

---

### BDR-07: High-Stakes Exam Retake Cooling-Off Period
- **Decision Question:** What cooling-off period must elapse before a student who fails a formal certification mock examination is permitted to retake it?
- **Options:**
  - *Option A:* 7 days cooling-off period.
  - *Option B (Recommended):* 14 days cooling-off period (mirrors international HSE board policies).
  - *Option C:* Immediate retake allowed (subject to maximum attempt limit).
- **Current Technical Implementation:** Blueprint enforces `maxAttempts` and `cooldownHours: 336` (14 days).
- **Required Owner:** Examination Board / Lead HSE Faculty.
- **Cost Implication:** Zero.
- **Technical Dependency:** Exam Simulator (`/api/exams/[id]/start`).
- **Blocks Development?** No.

---

### BDR-08: Online Remote Proctoring / Invigilation Policy
- **Decision Question:** Should high-stakes certification examinations require live webcam proctoring, AI facial tracking, and browser lockdown, or is full-screen timer anti-cheat sufficient?
- **Options:**
  - *Option A (Current Stance):* Full-screen lock, tab-switching detection, and server-side timer enforcement (Zero recurring cost, zero biometric privacy risk).
  - *Option B:* Automated AI proctoring (webcam snapshots, audio anomaly detection) via third-party service.
  - *Option C:* Live human proctoring via BigBlueButton invigilation rooms.
- **Current Technical Implementation:** Option A fully verified in `tests/exam-integrity.test.ts`.
- **Required Owner:** Institutional Leadership & Legal Counsel.
- **Cost Implication:** Option B costs \$2–\$5 per student per exam; Option A costs ₹0.
- **Technical Dependency:** Exam Engine.
- **Blocks Development?** No (Option A is complete; Option B/C are deferred extensions).

---

### BDR-09: Payment Gateway Provider Selection
- **Decision Question:** Which payment gateway should be authorized for production student fee transactions?
- **Options:**
  - *Option A (Recommended for India):* **Razorpay** (Supports UPI, RuPay, NetBanking, Credit/Debit cards, EMI, automated GST invoicing).
  - *Option B (Recommended for Global):* **Stripe** (Industry standard for international cards, USD/EUR billing).
  - *Option C:* Dual gateway (Razorpay for INR transactions, Stripe for international students).
- **Current Technical Implementation:** Provider-neutral adapter in `src/lib/payments/` with idempotent webhook processing; runs in simulation mode.
- **Required Owner:** Finance Director / Managing Trustee.
- **Cost Implication:** Gateway fee: 2% + GST per domestic transaction; 3% + currency conversion for international.
- **Technical Dependency:** Domain O (`/api/payments/order`, `/api/payments/webhook`).
- **Risk Without Approval:** Cannot accept real monetary payments from students.
- **Blocks Development?** Blocks live financial processing; does NOT block application development or simulation testing.

---

### BDR-10: GST & Tax Treatment Invoicing Rules
- **Decision Question:** What is the authoritative tax registration number, legal entity name, and GST treatment for course fee invoices?
- **Options:**
  - *Option A:* 18% GST inclusive in published course prices.
  - *Option B:* 18% GST added at checkout (base fee + 18% GST).
  - *Option C:* Educational exemption (where applicable under statutory rules).
- **Current Technical Implementation:** Invoicing service generates compliant sequential invoices (`ZL-INV-YYYY-XXXXX`) with line-item tax calculation.
- **Required Owner:** Finance Director / Chartered Accountant.
- **Cost Implication:** High (statutory tax compliance).
- **Technical Dependency:** Domain O (`src/lib/store/db.ts`).
- **Blocks Development?** No (tax rate is a configurable parameter).

---

### BDR-11: Partial Payments & Instalment Schedules
- **Decision Question:** Are students permitted to pay high-value coaching course fees in instalments, and how are entitlements gated during partial payments?
- **Options:**
  - *Option A:* 100% upfront payment required for all courses.
  - *Option B:* Two-part instalment: 50% on admission, 50% prior to final examination. Access suspended if instalment 2 is overdue.
  - *Option C:* Third-party education financing / NBFC integration (e.g. Propelld / LiquiLoans).
- **Current Technical Implementation:** Single full-payment model active in current schema.
- **Required Owner:** Finance Director.
- **Cost Implication:** Medium (affects cash flow and collections).
- **Technical Dependency:** Domain N (Product Entitlements) and Domain O (Finance).
- **Blocks Development?** No (Option A is default baseline; instalment engine is scheduled in Phase 8C).

---

### BDR-12: Multi-Tier Commercial Product Packaging (Separate from Courses)
- **Decision Question:** How should Zealosh monetize its academic courses? (e.g., selling "Video Only" vs "Full Hybrid Live Coaching").
- **Options:**
  - *Option A (Monolithic):* A course is sold as a single package with all materials and live classes included.
  - *Option B (Recommended Multi-Tier):* Each academic course can have multiple sellable product offerings:
    - Tier 1: Self-Study (Videos + PDFs only) — e.g. ₹9,999.
    - Tier 2: Practice Bundle (Self-Study + Quizzes + Question Bank + Mock Exams) — e.g. ₹19,999.
    - Tier 3: Complete Professional Coaching (Tier 2 + Live WebRTC Classes + Tutor Mentorship) — e.g. ₹34,999.
- **Current Technical Implementation:** Monolithic course model currently in code; multi-tier model identified as **Critical Architectural Gap (Domain N)**.
- **Required Owner:** Institutional Leadership & Marketing Director.
- **Cost Implication:** Massive revenue upside (captures different student budget tiers without duplicating courses).
- **Technical Dependency:** Domain N (`public.products`, `public.product_offerings`, `public.user_entitlements`).
- **Blocks Development?** Blocks commercial expansion; development scheduled for Milestone ZM-IMPL-08C.

---

### BDR-13: Messaging Cross-Batch Revision Group Isolation
- **Decision Question:** When students from different batches are grouped into a shared revision channel, what academic boundaries must be enforced?
- **Policy Invariant:** In-app messaging channel membership must **NEVER** grant access to another batch's live classes, recordings, assignments, submissions, grades, or faculty notes.
- **Status:** **MANDATORY POLICY INVARIANT (APPROVED)**.
- **Required Owner:** Lead Architect & Academic Dean.
- **Technical Dependency:** Domain J (`supabase/migrations/20261103000018_zealosh_in_app_messaging.sql`).

---

### BDR-14: Official WhatsApp Business API (WABA) Gateway
- **Decision Question:** Which official WhatsApp Business Solution Provider (BSP) should be engaged for student admission alerts and class reminders?
- **Options:**
  - *Option A:* Meta Cloud API (Direct, lowest per-message cost).
  - *Option B:* Twilio / Gupshup / Interakt (Turnkey BSP with Indian template support).
  - *Option C:* Defer WhatsApp until Phase 9; rely on transactional email and in-app notifications.
- **Current Technical Implementation:** Transactional email outbox (SMTP/Resend) is 100% operational; WhatsApp is unconfigured.
- **Required Owner:** Marketing Director.
- **Cost Implication:** ~₹0.40–₹0.80 per conversation/template message.
- **Blocks Development?** No (email outbox handles all critical notifications; WhatsApp is an optional transport channel).

---

### BDR-15: Native Android/iOS Applications vs Progressive Web App (PWA)
- **Decision Question:** Does Zealosh require native mobile applications published to Google Play Store and Apple App Store, or is the installable Progressive Web App (PWA) sufficient for launch?
- **Options:**
  - *Option A (Recommended for Initial Launch):* **Progressive Web App (PWA)**. Works instantly on Android and iOS browsers, installable to home screen, zero app-store commissions, zero multi-codebase maintenance.
  - *Option B:* **React Native Mobile App** sharing the existing Next.js backend and Supabase database.
- **Current Technical Implementation:** Mobile-responsive PWA layout 100% passing in browser tests.
- **Required Owner:** Managing Trustee / Executive Leadership.
- **Cost Implication:** Native apps add ₹3,00,000–₹5,00,000 in mobile development and annual \$99 Apple Developer fees; PWA costs ₹0 additional.
- **Status:** **NATIVE MOBILE DECISION REQUIRED (PWA ACTIVE AS BASELINE)**.

---

### BDR-16: Student Gamification Policy (Points, Streaks & Badges)
- **Decision Question:** Should gamification (daily streaks, XP points, cohort leaderboards) be introduced into the academic experience?
- **Policy Invariant:** Gamification points must be strictly motivational; they must **NEVER** grant examination eligibility or substitute for academic lesson completion.
- **Status:** **UNDECIDED — Academic Committee Decision Required**.
- **Required Owner:** Academic Committee.
- **Blocks Development?** Deferred to Milestone ZM-IMPL-08F.

---

### BDR-17: Cloud Object Storage Provider Selection
- **Decision Question:** Which object storage provider should be selected for student course PDFs and BigBlueButton session recordings?
- **Options:**
  - *Option A (Recommended):* **Cloudflare R2** (\$0.015/GB storage, **\$0 egress bandwidth fees**).
  - *Option B:* **AWS S3 + CloudFront** (\$0.023/GB storage + \$0.085/GB egress).
  - *Option C:* **Supabase Storage** (Included in Pro Plan up to 100 GB, then \$0.021/GB + \$0.09/GB egress).
- **Current Technical Implementation:** Storage service abstraction in `src/lib/storage/recording-storage.ts` supports S3-compatible APIs.
- **Required Owner:** Lead Infrastructure Architect & Finance Director.
- **Cost Implication:** Cloudflare R2 saves ₹10,000–₹30,000/year in video streaming egress fees.
- **Blocks Development?** No (abstraction works with all 3; credentials gated until deployment).

---

### BDR-18: Private AI Inference Model & Privacy Policy
- **Decision Question:** Which open-source LLM should be deployed on Server 3 for the Zealosh AI Course Tutor?
- **Options:**
  - *Option A (Recommended):* **Meta Llama 3.2 (3B)** — Extremely fast token generation on CPU, low memory footprint (2.5 GB), high reasoning accuracy for HSE topics.
  - *Option B:* **Qwen 2.5 (3B / 7B)** — Strong technical explanation capabilities.
- **Privacy Invariant:** Invariant: Student PII (names, phone numbers, email addresses) is stripped before prompt dispatch; inference occurs exclusively on Server 3 private LAN with zero data shared with third-party AI APIs.
- **Status:** **APPROVED ARCHITECTURAL BASELINE (Server 3 deployment gated)**.
- **Required Owner:** Lead AI Engineer & Legal Counsel.

