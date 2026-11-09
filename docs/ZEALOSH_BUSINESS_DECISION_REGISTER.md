# Zealosh LMS — Master Business Decision Register

**Document Version:** 1.0.0  
**Milestone:** ZM-01 — Master Product Blueprint  
**Target:** Single Institutional Learning & Certification Platform (`https://zealosh.com`)  
**Brand:** Zealosh Training & Consultants  
**Date:** October 30, 2026  

---

## 1. Governance & Policy Principles
This register identifies all institutional business rules, academic policies, and workflow options that require explicit decision or formal approval from Zealosh Training & Consultants. 

> [!IMPORTANT]
> The engineering team must never silently convert an architectural recommendation into an approved business policy. Every item below is documented with its operational context, available alternatives, and recommended default.

---

## 2. Institutional Decision Matrix

### BDR-01: Student Admission & Enrollment Approval Model
- **Question:** Should student enrollment be fully automated upon successful online payment, or should it require administrative review and verification of student qualifications?
- **Why It Matters:** Affects the checkout flow, admissions queue, and student onboarding velocity.
- **Affected Modules:** Admissions, Commerce (`/api/payments/webhook`), Batch Capacity.
- **Available Options:**
  - *Option A:* Immediate automated enrollment upon successful payment gateway webhook (Instant access).
  - *Option B:* Two-stage admission: Student submits application + documents; admin reviews; upon approval, payment link is issued.
  - *Option C:* Hybrid: Open courses auto-enroll; advanced professional certification batches (e.g. CSP/CRSP) require credential verification before payment.
- **Recommended Default:** Option C (Hybrid). Allows self-paced courses to scale while safeguarding accredited professional cohort standards.
- **Institutional Decision Status:** **UNDECIDED — Institutional Leadership Decision Required**. Aligned with Phase 1 engineering guardrail in ZM-01.1C: `platformSettings.admissionsAutoEnrollEnabled: false` by default. Bulk admissions and self-service admissions default strictly to `PENDING_REVIEW` unless explicitly enabled by administrative configuration.
- **Approval Needed:** **Yes — Institutional Leadership Decision Required**.

---

### BDR-02: Mandatory Live Class Attendance Threshold
- **Question:** What minimum live class attendance percentage is required for a student to qualify for course completion and certificate issuance?
- **Why It Matters:** Determines whether students who miss live interactive sessions can still graduate or earn certificates.
- **Affected Modules:** Attendance Tracking, Completion Engine, Certificate Issuance.
- **Available Options:**
  - *Option A:* 75% attendance of all scheduled live meeting minutes.
  - *Option B:* 80% attendance.
  - *Option C:* Flexible: 60% live attendance allowed if student watches 100% of the published session recordings.
- **Current Technical Default:** 75% attendance (configurable via `/api/admin/config/settings`).
- **Institutional Decision Status:** **UNDECIDED — Academic Committee Decision Required**. The 75% figure serves solely as a configurable software default and must not be treated as final approved institutional policy until ratified.

---

### BDR-03: Prerecorded Video Scrubbing & Forward Seeking Restrictions
- **Question:** Should students be allowed to scrub forward through prerecorded video lectures on their first attempt, or must they watch the video sequentially without skipping?
- **Why It Matters:** Balances accreditation compliance (proving learning hours) against learner user experience and flexibility.
- **Affected Modules:** Video Player, Lesson Progress Tracker, Course Completion.
- **Available Options:**
  - *Option A:* Unrestricted scrubbing: Students can fast-forward and scrub at will.
  - *Option B:* Enforced sequential viewing: Forward scrub disabled until the video has been watched completely once (playback speed up to 1.5x permitted).
  - *Option C:* Configurable per course: Accredited certification modules enforce sequential viewing; revision modules permit free scrubbing.
- **Recommended Default:** Option C (Configurable per course).
- **Institutional Decision Status:** **UNDECIDED — Academic Dean Decision Required**.

---

### BDR-04: Video Watch Completion Threshold
- **Question:** What percentage of a prerecorded video duration must a student watch for the lesson to be marked as "Completed"?
- **Why It Matters:** Video players frequently have buffer cuts or closing credits; requiring 100.0% creates false incompletion reports.
- **Affected Modules:** Video Progress Beacon, Completion Engine.
- **Available Options:**
  - *Option A:* 85% of total video duration.
  - *Option B:* 90% of total video duration.
  - *Option C:* 95% of total video duration.
- **Current Technical Default:** 90% duration (configurable via system settings).
- **Institutional Decision Status:** **UNDECIDED — Academic Committee Decision Required**. The 90% figure is a configurable engineering default and pending formal institutional adoption.

---

### BDR-05: Assignment Late Submission & Penalty Policy
- **Question:** What policy governs student coursework submitted after the published deadline?
- **Why It Matters:** Directly impacts instructor grading workflows, student fairness, and automated grade calculations.
- **Affected Modules:** Assignments, Instructor Grading Queue, Gradebook.
- **Available Options:**
  - *Option A:* Hard cutoff: Submissions blocked immediately upon deadline expiration.
  - *Option B:* Soft cutoff with daily penalty: 5% mark deduction per 24 hours overdue, up to a maximum of 3 days (after which submission is rejected).
  - *Option C:* Instructor discretion: Submissions flagged as "Late" with exact overdue hours; instructor decides penalty during rubric grading.
- **Recommended Default:** Option B (5% daily penalty up to 3 days, configurable by instructor at assignment creation).
- **Approval Needed:** **Yes — Faculty Senate Decision Required**.

---

### BDR-06: Assignment Resubmission & Attempt Limits
- **Question:** How many resubmission attempts should a student be allowed if an instructor requests revisions or grades a submission as "Needs Rework"?
- **Why It Matters:** Affects instructor workload and version history storage.
- **Affected Modules:** Assignments, Student Portal, Storage.
- **Available Options:**
  - *Option A:* Maximum 1 resubmission attempt.
  - *Option B:* Maximum 2 resubmission attempts.
  - *Option C:* Unlimited attempts until the grading period closes.
- **Recommended Default:** Option A (Maximum 1 resubmission attempt permitted upon explicit faculty request).
- **Approval Needed:** **Yes — Academic Dean Decision Required**.

---

### BDR-07: Formative Topic Quiz Attempt Limits & Retake Policy
- **Question:** How many attempts should students be permitted on formative topic-based quizzes, and how is the final score recorded?
- **Why It Matters:** Distinguishes formative self-checks from summative grading.
- **Affected Modules:** Quizzes, Question Bank, Gradebook.
- **Available Options:**
  - *Option A:* Unlimited attempts; highest score recorded.
  - *Option B:* 3 attempts; highest score recorded.
  - *Option C:* 3 attempts with a mandatory 30-minute cooling-off period between attempts; latest score recorded.
- **Recommended Default:** Option B (3 attempts, highest score recorded, randomized question ordering per attempt).
- **Approval Needed:** **Yes — Academic Committee Decision Required**.

---

### BDR-08: High-Stakes Certification Exam Retake Cooling-Off Period
- **Question:** What cooling-off period must elapse before a student who fails a formal certification mock examination can initiate a retake attempt?
- **Why It Matters:** Prevents students from brute-forcing question pools and simulates authentic BCSP/BCRSP examination conditions.
- **Affected Modules:** Examination Engine (`/exams`), Attempts Resolver.
- **Available Options:**
  - *Option A:* 24-hour mandatory waiting period.
  - *Option B:* 48-hour mandatory waiting period.
  - *Option C:* 7-day waiting period requiring faculty counseling.
- **Recommended Default:** Option B (48-hour mandatory cooling-off period between failed certification exam attempts).
- **Approval Needed:** **Yes — Institutional Director Decision Required**.

---

### BDR-09: Online Proctoring & Remote Invigilation
- **Question:** Does the institution require remote automated webcam proctoring, browser tab lockdown, and room scanning during high-stakes certification exams?
- **Why It Matters:** Carries significant student privacy implications, requires third-party WebRTC analysis or native client software, and increases infrastructure complexity.
- **Affected Modules:** Examination Simulator, Student Browser Client.
- **Available Options:**
  - *Option A:* No proctoring: High-stakes exams rely on server-enforced strict countdown timers, anti-cheat question randomization, and question option shuffling.
  - *Option B:* Browser tab visibility tracking only: Flags if student switches browser tabs or minimizes the window.
  - *Option C:* Full AI / WebRTC video proctoring: Continuous webcam and audio recording.
- **Recommended Default:** Option B (Browser tab focus tracking with warning dialogs, combined with strict server countdown deadlines).
- **Approval Needed:** **Yes — Institutional Leadership & Legal Review Required**.

---

### BDR-10: Multi-Criteria Course Completion Threshold Weights
- **Question:** Should all course components carry equal mandatory status, or can completion rules be weighted dynamically?
- **Why It Matters:** Governs whether a student with 98% exam score but 70% live attendance can be awarded a certificate.
- **Affected Modules:** Course Completion Engine (`/api/courses/[slug]/completion`), Certificate Generator (`db.issueAutomaticCertificate`).
- **Available Options:**
  - *Option A:* Strict Conjunctive Policy: Student must satisfy 100% of configured criteria (Lessons + Attendance + Quizzes + Assignments + Final Exam). Missing any one component denies certification.
  - *Option B:* Weighted Aggregate Score: Overall aggregate performance must exceed 75%, provided the final exam is passed.
  - *Option C:* Tiered Credentials: "Certificate of Completion" for coursework/attendance; "Certificate of Excellence" for passing the formal examination.
- **Recommended Default:** Option A (Strict Conjunctive Policy for accredited professional certifications; all mandatory criteria must be verified).
- **Institutional Decision Status:** **IMPLEMENTED AS CONFIGURABLE CONJUNCTIVE POLICY (ZM-02)**. Implemented in `course_completion_policies` and `evaluateCourseCompletion` with configurable thresholds per course: `requiredLessonCompletionPercentage` (default 90%), `requiredLiveAttendancePercentage` (default 75%), `requireAllAssignmentsPassed`, `requireAllQuizzesPassed`, and `requireFormalExamPassed` with `minimumExamScorePercentage` (default 70%). Formal sign-off on individual course thresholds remains with Academic Committee.
- **Approval Needed:** **Yes — Academic Committee Decision Required**.

---

### BDR-11: WhatsApp and SMS Notification Gateway Approval
- **Question:** Should the platform integrate external SMS and WhatsApp Business gateways for live class reminders and urgent deadline alerts, or rely exclusively on in-app alerts and transactional email?
- **Why It Matters:** Incurs third-party per-message API fees (e.g. Twilio, MSG91), requires phone number verification, and introduces local telecommunication regulatory compliance (DLT registration in India).
- **Affected Modules:** Notifications, Infrastructure Budget, Profile Management.
- **Available Options:**
  - *Option A:* In-app notifications and transactional email only (Zero per-message external cost).
  - *Option B:* Add SMS gateway for critical alerts (class start in 15 mins, exam deadline).
  - *Option C:* Add WhatsApp Business API for automated schedule reminders and assignment receipts.
- **Recommended Default:** Option A initially; evaluate Option C after production launch based on student demand.
- **Approval Needed:** **Yes — Institutional Leadership & Finance Decision Required**.

---

### BDR-12: Account Authentication Lockout Policy & Thresholds
- **Question:** What failed attempt threshold and lockout duration should govern accounts to mitigate brute-force credential stuffing?
- **Why It Matters:** Balances defensive security against legitimate student lockouts during peak exam/admissions windows.
- **Affected Modules:** Authentication (`/api/auth/login`), Security Audits, Session Management.
- **Available Options:**
  - *Option A:* 5 failed attempts locks for 15 minutes (with HTTP 423 status and remaining minutes disclosed).
  - *Option B:* 3 failed attempts locks for 30 minutes.
  - *Option C:* Progressive backoff: 3 failed attempts delays 1 minute; 5 failed attempts locks for 15 minutes; admin manual unlock required after 10 attempts.
- **Current Technical Default:** Option A (5 failed attempts locks for 15 minutes).
- **Institutional Decision Status:** **UNDECIDED — Institutional Security & Administration Decision Required**. The 5-attempt/15-minute parameters are implemented as configurable technical baselines and await formal institutional policy sign-off.

---

### BDR-13: Accounting Software Integration Boundary
- **Question:** Should Zealosh LMS integrate directly with external third-party accounting/ERP packages (e.g. TallyPrime, Zoho Books, QuickBooks) during initial launch, or operate PostgreSQL as authoritative for financial records?
- **Why It Matters:** Direct accounting integration requires complex bidirectional sync, reconciliation error handling, and API maintenance.
- **Affected Modules:** Commerce, Invoicing, Tax Calculations, GST Reporting.
- **Decision:** **Approved Architectural Decision — Deferred to Post-MVP (Phase 7+)**. Zealosh LMS maintains authoritative internal relational records for orders, invoices, refunds, and GST compliance in PostgreSQL. External ERP/accounting sync is explicitly decoupled and deferred to avoid blocking core educational operations.
- **Approval Status:** **ARCHITECTURALLY APPROVED & DEFERRED**.

---

### BDR-14: Mobile Application Architecture & Client Technology
- **Question:** What architectural strategy and client technology should power the Zealosh native mobile learner experience?
- **Why It Matters:** Determines team skillset, code reuse efficiency, offline capabilities, and cross-platform consistency between iOS and Android.
- **Affected Modules:** Mobile Client, REST/OAuth APIs, Offline Sync.
- **Available Options:**
  - *Option A:* React Native / Expo: Maximizes code sharing of TypeScript domain models, Zod validation schemas, API contracts, and state stores while providing fully native UI/UX on iOS and Android.
  - *Option B:* Progressive Web App (PWA): Zero app store deployment, uses Next.js responsive client directly with Service Workers.
  - *Option C:* Separate native Swift (iOS) and Kotlin (Android) codebases.
- **Engineering Recommendation:** Option A (React Native / Expo with shared TypeScript contracts and decoupled platform-native presentation).
- **Institutional Decision Status:** **ENGINEERING RECOMMENDATION — PENDING FORMAL INSTITUTIONAL SIGN-OFF**. Not an approved institutional mandate. PWA remains the operational mobile web baseline.

---

### BDR-15: Classroom Recording Interactive Doubt Resolution SLA
- **Question:** What operational Service Level Agreement (SLA) governs instructor response times to student questions placed at video timeline markers in session recordings?
- **Why It Matters:** Shapes learner satisfaction and sets clear expectations for faculty workload outside scheduled live hours.
- **Affected Modules:** Recording Interactive Doubts (`/recordings/[id]/doubts`), Notifications, Instructor Dashboard.
- **Current Technical Default:** 48-hour response window during working business days.
- **Institutional Decision Status:** **UNDECIDED — Faculty Operations & Dean Decision Required**.

---

### BDR-16: Examination Network Latency & Clock Jitter Grace Period
- **Question:** What grace period duration should be permitted after the server-authoritative countdown timer expires before in-flight answer synchronization is permanently rejected?
- **Why It Matters:** Candidates in remote industrial sites or mobile data connections may experience transient packet latency as the final minute expires. An immediate hard cutoff at 0ms causes answer data loss; an excessively long grace period enables cheating.
- **Affected Modules:** Examination Engine (`/exams`), Attempts Resolver, In-Flight Autosave.
- **Available Options:**
  - *Option A:* 30 seconds grace period for network transit.
  - *Option B:* 60 seconds grace period for network transit.
  - *Option C:* 120 seconds grace period with client-side cached offline sync.
- **Current Technical Default:** Option B (60-second server-side grace period added to `deadlineTime`).
- **Institutional Decision Status:** **UNDECIDED — Academic Examination Committee Decision Required**.

---

### BDR-17: Certification Examination Scheduling — Fixed Sittings vs On-Demand Availability
- **Question:** Are formal certification mock examinations (ASP, CSP, BCRSP, CIT) restricted to fixed, scheduled calendar sittings with cohort proctoring, or available on-demand as soon as coursework prerequisites are satisfied?
- **Why It Matters:** Fixed sittings simulate authentic Prometric/Pearson VUE testing center protocols; on-demand availability provides flexibility for working safety engineers across global time zones.
- **Affected Modules:** `exam_blueprints`, `exam_sittings`, Candidate Eligibility Validator.
- **Available Options:**
  - *Option A:* Strictly scheduled cohort sittings announced by administration.
  - *Option B:* Unrestricted on-demand access once 80% lesson completion is reached.
  - *Option C:* Hybrid: Practice drills are on-demand; formal final certification milestone examinations require scheduled sitting booking.
- **Current Technical Default:** Option C (Configurable per blueprint: supports both on-demand access once 80% coursework completed and scheduled sitting windows).
- **Institutional Decision Status:** **UNDECIDED — Director of Academic Affairs Decision Required**.

---

### BDR-18: Examination Certificate Expiry & Recertification Validity Period
- **Question:** Do formal examination certification credentials issued by Zealosh (`ZEI/EXAM/YYYY/XXXXXX`) expire after a fixed period (e.g. 2 or 3 years) requiring Continuous Professional Development (CPD) or recertification, or remain perpetual?
- **Why It Matters:** Professional safety boards (BCSP, BCRSP) require periodic recertification; course completion certificates (`ZEI/COURSE/YYYY/XXXXXX`) are historically perpetual.
- **Affected Modules:** `certificates` table, `issueAutomaticCertificate`, `/verify/[code]`.
- **Available Options:**
  - *Option A:* Perpetual validity.
  - *Option B:* 2-Year validity with automated renewal notification.
  - *Option C:* 3-Year validity aligned with international safety board cycles.
- **Current Technical Default:** Perpetual validity by default, with optional `expiryDate` supported in database schema.
- **Institutional Decision Status:** **UNDECIDED — Academic Accreditation Board Decision Required**.

---

### BDR-19: Payment Gateway Dual-Routing & Multi-Currency Strategy
- **Question:** How should payments be routed between Razorpay and Stripe across domestic and international learners?
- **Why It Matters:** Razorpay provides optimal conversion for domestic Indian INR payments (UPI, RuPay, Netbanking). Stripe excels at foreign currency card capture (USD).
- **Affected Modules:** `/api/payments/order`, `/api/payments/webhook`, `PaymentOrder`.
- **Available Options:**
  - *Option A:* Razorpay exclusively for INR transactions; Stripe exclusively for USD transactions.
  - *Option B:* Razorpay as primary with automatic fallback to Stripe.
  - *Option C:* Manual gateway selection by student at checkout.
- **Current Technical Default:** Option A (Currency-driven routing: INR routes to Razorpay; USD routes to Stripe).
- **Institutional Decision Status:** **UNDECIDED — Finance Director Decision Required**.

---

### BDR-20: Automatic Refund Eligibility Window & Cancellation Policy
- **Question:** Can a candidate receive an automated refund upon withdrawal, and what time window applies?
- **Why It Matters:** Protects revenue against candidates who access proprietary HSE study modules and then cancel, versus consumer fair trading standards.
- **Affected Modules:** `/api/payments/refund`, `db.processRefund`, `invoice_credit_notes`.
- **Available Options:**
  - *Option A:* 7-day cooling-off window with automated refund if < 15% lessons accessed.
  - *Option B:* No automated refunds; all refund executions require administrative authorization.
  - *Option C:* Tiered refund based on batch start date.
- **Current Technical Default:** Option B (Administrative authorization required for all refund executions; system enforces atomic seat restoration, enrollment revocation, and Credit Note issuance).
- **Institutional Decision Status:** **UNDECIDED — Managing Director & Legal Counsel Decision Required**.

---

### BDR-21: Statutory GST Invoicing for Non-Resident Overseas Learners (Export of Services)
- **Question:** How should Indian Goods and Services Tax (GST) be applied to individual overseas students paying in USD from outside India?
- **Business & Operational Context:** Under the IGST Act, educational services to individuals located outside India paid in convertible foreign exchange can qualify as zero-rated Export of Services under Letter of Undertaking (LUT).
- **Affected Components:** `invoices`, `completePaymentOrder`, Tax Calculation Engine.
- **Available Options:**
  - *Option A:* Standard 18% IGST on all transactions regardless of customer location.
  - *Option B:* Zero-rated Export of Services under LUT (0% IGST) for non-India billing addresses paid in USD, displaying statutory LUT reference on invoices.
  - *Option C:* Exemption under specific overseas training provisions.
- **Current Technical Default:** Option B (Zero-rated Export under LUT for non-India USD payments; standard 18% GST for domestic India transactions).
- **Institutional Decision Status:** **UNDECIDED — Chartered Accountant / Statutory Tax Auditor Ratification Required**.

---

### BDR-22: Manual Rubric Evaluation Approval Gate for Hybrid Examinations
- **Operational Question:** When an examination contains subjective scenario questions or calculation steps evaluated via manual rubrics, can an objective preliminary pass score be displayed immediately, or must all results remain sealed until formal instructor evaluation and moderation approval?
- **Business & Operational Context:** Immediate provisional scores can motivate students but create disputes if manual rubric scoring lowers the overall aggregate below the passing line.
- **Affected Components:** `exam_attempts`, `exam_manual_evaluations`, `/api/exams/[id]/submit`.
- **Available Options:**
  - *Option A:* Pure objective exams publish results immediately; hybrid exams transition to `PENDING_MANUAL_EVALUATION` and withhold final pass/fail decisions until all rubrics are graded and published.
  - *Option B:* Publish objective score immediately as "Provisional Score"; update final grade once manual evaluation concludes.
- **Current Technical Default:** Option A (Exams containing manual rubric questions remain in `PENDING_MANUAL_EVALUATION` until the evaluation queue is cleared by an instructor/admin).
- **Institutional Decision Status:** **UNDECIDED — Academic Examination Board Decision Required**.

---

### BDR-23: Mandatory vs Optional GSTIN on Student Invoices
- **Question:** Should GSTIN collection be mandatory for Indian corporate/sponsored candidates and optional for retail self-financing students, or strictly required for all tax invoices generated on checkout?
- **Business & Operational Context:** Retail students generally do not possess a GSTIN. Requiring GSTIN at checkout creates friction and high drop-off rates, whereas corporate B2B clients require GSTIN to claim Input Tax Credit (ITC).
- **Affected Components:** `invoices`, checkout page, payment order creation.
- **Available Options:**
  - *Option A:* Optional GSTIN field on checkout; if provided and valid, generate B2B tax invoice with GSTIN; otherwise issue B2C tax invoice.
  - *Option B:* Mandatory GSTIN for all Indian buyers.
  - *Option C:* Dedicated separate corporate checkout portal.
- **Current Technical Default:** Option A (Optional GSTIN input with regex validation; automatically categorizes invoice as B2B if GSTIN provided, B2C otherwise).
- **Institutional Decision Status:** **UNDECIDED — Finance Director & Tax Counsel Decision Required**.

---

### BDR-24: Credit Note Monotonic Sequence Separation (`CN-YYYY-XXXX`)
- **Question:** Should refund credit notes share the primary invoice counter sequence or maintain a dedicated independent monotonic numbering sequence (`CN-YYYY-XXXX`)?
- **Business & Operational Context:** Indian GST statutory compliance requires that credit notes have an unambiguous, continuous sequential identifier that clearly links to the original tax invoice while preventing counter collisions.
- **Affected Components:** `invoice_credit_notes`, `db.processRefund`.
- **Available Options:**
  - *Option A:* Shared sequence with prefix indicator (`INV-YYYY-XXXX` vs `INV-YYYY-XXXX-CN`).
  - *Option B:* Dedicated continuous monotonic sequence (`CN-YYYY-XXXX`) with explicit foreign key link to the original tax invoice ID and number.
  - *Option C:* External ERP-assigned credit note numbering via accounting sync.
- **Current Technical Default:** Option B (Dedicated monotonic sequence `CN-YYYY-XXXX` maintaining an immutable relational link to the original invoice).
- **Institutional Decision Status:** **UNDECIDED — Statutory Accounting & Audit Decision Required**.

---

### BDR-25: Manual Evaluation Queue Assignment & Double-Blind Grading
- **Question:** When subjective examination or coursework submissions enter the evaluation queue, should they be automatically assigned to the course lead instructor, distributed round-robin among qualified co-instructors, or graded double-blind (anonymized student identity)?
- **Business & Operational Context:** Accredited HSE certifications (BCSP/BCRSP standards) often recommend double-blind evaluation to prevent unconscious bias in high-stakes grading.
- **Affected Components:** `exam_manual_evaluations`, `assignment_submissions`, `/api/assignments/[assignmentId]/grade`.
- **Available Options:**
  - *Option A:* Course lead instructor evaluates all submissions with student identity visible.
  - *Option B:* Round-robin automated distribution among active co-instructors with student identity visible.
  - *Option C:* Double-blind grading queue: student name/ID masked from evaluators until final score publication.
- **Current Technical Default:** Option A (Lead instructor and assigned cohort co-instructors can grade submissions directly; identity visible).
- **Institutional Decision Status:** **UNDECIDED — Academic Examination Board Decision Required**.

---

### BDR-26: Certificate QR Code Public Verification Data Disclosure Boundary
- **Question:** What data elements should be publicly visible when an external third party (e.g. employer, auditor, verification authority) scans the QR code on a Zealosh credential (`/verify/[code]`)?
- **Business & Operational Context:** Balancing credential verification credibility with candidate privacy and data protection (GDPR / Indian Digital Personal Data Protection Act 2023).
- **Affected Components:** `/verify/[code]`, `src/app/verify/[code]/page.tsx`, `certificates` table.
- **Available Options:**
  - *Option A:* Full transparency: Candidate Full Name, Course/Exam Title, Certificate Number, Issue Date, Expiry Date, Grade/Percentage, and Issuing Authority.
  - *Option B:* Verification of authenticity only: Candidate Full Name, Credential Title, Certificate Number, Issue Date, Status (VALID/REVOKED/EXPIRED). Exam percentage and internal candidate ID masked.
  - *Option C:* Minimal: "Valid Certificate Issued by Zealosh Training & Consultants" without candidate name.
- **Current Technical Default:** Option B (Displays student full name, course/exam title, certificate number, issue date, and validity status; percentage score and private student ID are withheld).
- **Institutional Decision Status:** **UNDECIDED — Chief Information Security Officer & Privacy Officer Decision Required**.

---

## 4. BDR Canonical Cross-Reference & Historical Alias Disambiguation Table

| Canonical ID | Canonical Title | Historical / Meeting Alias | Current Technical Default | Decision Status |
| :--- | :--- | :--- | :--- | :--- |
| **BDR-01** | Student Admission & Enrollment Approval Model | Admission Flow Policy | Option C (Hybrid) | `UNDECIDED` |
| **BDR-02** | Mandatory Live Class Attendance Threshold | Attendance Requirement | Option B (80% attendance) | `UNDECIDED` |
| **BDR-03** | Course Completion & Certificate Criteria | Graduation Policy | Option B (Dual condition: 80% attendance + 70% coursework) | `UNDECIDED` |
| **BDR-04** | Class Recording Retention & Student Access Window | Recording Access Policy | Option B (180 days access) | `UNDECIDED` |
| **BDR-05** | Batch Rescheduling & Capacity Overflow Policy | Batch Transfer Policy | Option C (Waitlist + Admin approval) | `UNDECIDED` |
| **BDR-06** | Student Refund & Cancellation Policy | Commercial Refund Terms | Option B (Strict admin authorization) | `UNDECIDED` |
| **BDR-07** | Lead Instructor Course Reassignment Impact | Faculty Transition Rule | Option B (Continuity preservation) | `UNDECIDED` |
| **BDR-08** | Multi-Role User Portal Routing Strategy | Portal Navigation Policy | Option B (Primary role dashboard redirect) | `UNDECIDED` |
| **BDR-09** | Academic Doubt Escalation & SLA Policy | Student Support SLA | Option B (48-hour response target) | `UNDECIDED` |
| **BDR-10** | Pre-recorded Video Progress Verification | SCORM / Watchdog Policy | Option B (Heartbeat interval verification) | `UNDECIDED` |
| **BDR-11** | External LMS Synchronization Schedule | Moodle Integration Sync | Option B (Bi-directional hourly sync) | `UNDECIDED` |
| **BDR-12** | Enterprise Client Multi-Tenancy Boundary | Organization Portal Isolation | Option B (Shared DB with tenant_id RLS) | `UNDECIDED` |
| **BDR-13** | Course Pricing & Multi-Currency Conversion | Forex Pricing Rule | Option A (Fixed manual INR and USD prices) | `UNDECIDED` |
| **BDR-14** | Offline Assessment & Physical Exam Marks Ingestion | External Marks Import | Option B (Admin CSV bulk import) | `UNDECIDED` |
| **BDR-15** | Instructor Commission & Payout Workflow | Faculty Remuneration | Option B (Monthly statement review) | `UNDECIDED` |
| **BDR-16** | Examination Network Latency & Clock Jitter Grace Period | Exam Grace Period | Option B (3-minute server grace window) | `UNDECIDED` |
| **BDR-17** | Certification Examination Scheduling — Fixed Sittings vs On-Demand | Exam Delivery Window | Option C (Configurable per blueprint) | `UNDECIDED` |
| **BDR-18** | Examination Certificate Expiry & Recertification Validity Period | Credential Expiry Rule | Option A (Perpetual by default; schema supports expiry) | `UNDECIDED` |
| **BDR-19** | Payment Gateway Dual-Routing & Multi-Currency Strategy | Gateway Selection | Option A (INR -> Razorpay; USD -> Stripe) | `UNDECIDED` |
| **BDR-20** | Automatic Refund Eligibility Window & Cancellation Policy | Automated Refund Policy | Option B (Admin review required for refunds) | `UNDECIDED` |
| **BDR-21** | Statutory GST Invoicing for Non-Resident Overseas Learners (Export) | Overseas Tax Policy | Option B (Zero-rated Export under LUT for USD) | `UNDECIDED` |
| **BDR-22** | Manual Rubric Evaluation Approval Gate for Hybrid Examinations | Examination Scoring Gate | Option A (Sealed pending evaluation clearance) | `UNDECIDED` |
| **BDR-23** | Mandatory vs Optional GSTIN on Student Invoices | ZM-03.1 Note Alias (BDR-16a) | Option A (Optional on checkout; B2B if present, B2C otherwise) | `UNDECIDED` |
| **BDR-24** | Credit Note Monotonic Sequence Separation (`CN-YYYY-XXXX`) | ZM-03.1 Note Alias (BDR-17a) | Option B (Dedicated monotonic sequence `CN-YYYY-XXXX`) | `UNDECIDED` |
| **BDR-25** | Manual Evaluation Queue Assignment & Double-Blind Grading | ZM-04 Note Alias (BDR-18a) | Option A (Lead instructor & cohort co-instructors) | `UNDECIDED` |
| **BDR-26** | Certificate QR Code Public Verification Data Disclosure Boundary | ZM-04 Note Alias (BDR-19a) | Option B (Name, credential, number, issue date, status; scores masked) | `UNDECIDED` |



