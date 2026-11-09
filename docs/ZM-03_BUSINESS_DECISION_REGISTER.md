# ZM-03 Business Decision Register — Examination Engine, Commerce & Statutory Invoicing

**Document Identifier:** `ZM-03-DOC-002`  
**Milestone:** ZM-03 — High-Stakes HSE Certification Examination Engine, Commerce, Payments & Invoicing Lifecycle  
**Author:** Principal Software Architect & Technical Product Manager  
**Date:** October 31, 2026  
**Status:** Canonical & Audited  
**Institutional Scope:** Zealosh Training & Consultants (`https://zealosh.com`)  

---

## 1. Governance Directive & Principles
In compliance with Rule 8 and Zealosh Engineering Constitutions:
- Architectural and engineering designs must never silently masquerade as institutional business policy.
- All items below document the operational context, available alternatives, technical default implemented in software, and explicitly state whether formal institutional ratification is pending.
- Unratified items are marked **`UNDECIDED — Institutional Decision Required`**.

---

## 2. Phase 3 Business Decision Inventory

### BDR-16: Examination Network Latency & Clock Jitter Grace Period
- **Operational Question:** What grace period duration should be permitted after the server-authoritative countdown timer expires before in-flight answer synchronization is permanently rejected?
- **Business & Operational Context:** Candidates in remote industrial sites or using mobile data connections may experience transient packet latency or TCP socket reconnections right as the final minute expires. An immediate hard cutoff at 0ms causes answer data loss; an excessively long grace period enables cheating.
- **Affected Components:** `src/lib/store/db.ts` (`saveExamAnswers`, `submitExamAttempt`), `/api/exams/[id]/answers`, `/api/exams/[id]/submit`.
- **Available Options:**
  - *Option A:* 30 seconds grace period for network transit.
  - *Option B:* 60 seconds grace period for network transit.
  - *Option C:* 120 seconds grace period with client-side cached offline sync.
- **Implemented Software Baseline:** Option B (60-second server-side grace period added to `deadlineTime`).
- **Institutional Status:** **UNDECIDED — Academic Examination Committee Decision Required**. The 60-second buffer operates as a defensive technical baseline.

---

### BDR-17: Certification Examination Scheduling — Fixed Sittings vs On-Demand Availability
- **Operational Question:** Are formal certification mock examinations (ASP, CSP, BCRSP, CIT) restricted to fixed, scheduled calendar sittings with cohort proctoring, or available on-demand as soon as coursework prerequisites are satisfied?
- **Business & Operational Context:** Fixed sittings simulate authentic Prometric/Pearson VUE testing center protocols and enable live remote invigilation. On-demand availability provides flexibility for working safety engineers across Gulf and international time zones.
- **Affected Components:** `exam_blueprints`, `exam_sittings`, `/api/exams`, Candidate Eligibility Validator.
- **Available Options:**
  - *Option A:* Strictly scheduled cohort sittings: Candidates must register for a specific exam window announced by administration.
  - *Option B:* Unrestricted on-demand: Available immediately upon reaching the 80% lesson completion threshold.
  - *Option C:* Hybrid model: Open practice examinations are on-demand; formal final certification milestone examinations require scheduled sitting booking.
- **Implemented Software Baseline:** Option C (Configurable per blueprint: supports both on-demand access once 80% coursework completed and scheduled sitting windows).
- **Institutional Status:** **UNDECIDED — Director of Academic Affairs Decision Required**.

---

### BDR-18: Examination Certificate Expiry & Recertification Validity Period
- **Operational Question:** Do formal examination certification credentials issued by Zealosh (`ZEI/EXAM/YYYY/XXXXXX`) expire after a fixed period (e.g., 2 or 3 years) requiring Continuous Professional Development (CPD) or recertification, or remain perpetual?
- **Business & Operational Context:** Professional HSE bodies (BCSP, BCRSP) require periodic recertification and CPD points. Course completion certificates (`ZEI/COURSE/YYYY/XXXXXX`) are historically perpetual records of course attendance.
- **Affected Components:** `certificates` table, `issueAutomaticCertificate`, `/verify/[code]` portal.
- **Available Options:**
  - *Option A:* Perpetual validity: Certificates never expire.
  - *Option B:* 2-Year validity with automated renewal notification.
  - *Option C:* 3-Year validity aligned with international safety board cycles.
- **Implemented Software Baseline:** Perpetual by default, with optional `expiryDate` field supported in database schema and certificate verification contracts.
- **Institutional Status:** **UNDECIDED — Academic Accreditation Board Decision Required**.

---

### BDR-19: Payment Gateway Dual-Routing & Multi-Currency Strategy
- **Operational Question:** How should payments be routed between Razorpay and Stripe across domestic and international learners?
- **Business & Operational Context:** Razorpay offers superior checkout conversion, UPI, Netbanking, and domestic debit card success in India (INR). Stripe provides seamless international credit card capture and multi-currency processing for expatriate students (USD).
- **Affected Components:** `/api/payments/order`, `/api/payments/webhook`, `PaymentOrder`.
- **Available Options:**
  - *Option A:* Razorpay exclusively for INR transactions; Stripe exclusively for USD transactions.
  - *Option B:* Razorpay as primary with automatic fallback to Stripe if Razorpay API fails.
  - *Option C:* Manual gateway selection by student at checkout.
- **Implemented Software Baseline:** Option A (Currency-driven routing: INR routes to Razorpay; USD routes to Stripe; Manual bank transfer option configurable for corporate sponsor invoices).
- **Institutional Status:** **UNDECIDED — Finance Director Decision Required**.

---

### BDR-20: Automatic Refund Eligibility Window & Cancellation Policy
- **Operational Question:** Can a candidate receive an automated full or partial refund upon withdrawal, and what time window applies?
- **Business & Operational Context:** Protecting revenue against students who consume high-value study materials or attend multiple live sessions before requesting refunds, versus complying with consumer protection standards.
- **Affected Components:** `/api/payments/refund`, `db.processRefund`, `invoice_credit_notes`.
- **Available Options:**
  - *Option A:* 7-day cooling-off window: 100% refund permitted if less than 15% of coursework has been accessed and zero live sessions attended.
  - *Option B:* No automated refunds: All refund requests require administrative investigation and manual approval.
  - *Option C:* Tiered refund: 100% before batch start date; 50% within first 7 calendar days; 0% thereafter.
- **Implemented Software Baseline:** Option B (Administrative authorization required for all refund executions; system enforces atomic seat restoration, enrollment revocation, and Credit Note issuance).
- **Institutional Status:** **UNDECIDED — Managing Director & Legal Counsel Decision Required**.

---

### BDR-21: Statutory GST Invoicing for Non-Resident Overseas Learners (Export of Services)
- **Operational Question:** How should Indian Goods and Services Tax (GST) be applied to individual overseas students paying in USD from the UAE, Saudi Arabia, Qatar, or Oman?
- **Business & Operational Context:** Under the Integrated Goods and Services Tax (IGST) Act, supply of online information and database access or retrieval (OIDAR) / educational services to individuals located outside India qualifies as an "Export of Services" if payment is received in convertible foreign exchange and the supplier possesses a Letter of Undertaking (LUT), making it zero-rated. Alternatively, if place of supply criteria are not met, 18% IGST applies.
- **Affected Components:** `invoices`, `completePaymentOrder`, Tax Breakdown Calculation Engine.
- **Available Options:**
  - *Option A:* Charge standard 18% IGST on all transactions regardless of customer location.
  - *Option B:* Apply zero-rated Export of Services under LUT (0% IGST) for non-India billing addresses paid in USD, displaying statutory LUT reference on invoices.
  - *Option C:* Exempt overseas training services under specific educational export provisions.
- **Implemented Software Baseline:** Configurable: Defaults to Zero-rated Export under LUT (0% IGST) when billing country is not India and currency is USD, with LUT endorsement; otherwise standard 18% GST (CGST 9% + SGST 9% for Kerala; IGST 18% for rest of India).
- **Institutional Status:** **UNDECIDED — Chartered Accountant / Statutory Tax Auditor Ratification Required**.

---

### BDR-22: Manual Rubric Evaluation Approval Gate for Hybrid Examinations
- **Operational Question:** When an examination contains subjective scenario questions or calculation steps evaluated via manual rubrics, can an objective preliminary pass score be displayed immediately, or must all results remain sealed until formal instructor evaluation and moderation approval?
- **Business & Operational Context:** Immediate provisional scores can motivate students but create disputes if manual rubric scoring lowers the overall aggregate below the passing line.
- **Affected Components:** `exam_attempts`, `exam_manual_evaluations`, `/api/exams/[id]/submit`.
- **Available Options:**
  - *Option A:* Pure objective exams publish results immediately; hybrid exams transition to `PENDING_MANUAL_EVALUATION` and withhold final pass/fail decisions until all rubrics are graded and published.
  - *Option B:* Publish objective score immediately as "Provisional Score"; update final grade once manual evaluation concludes.
- **Implemented Software Baseline:** Option A (Exams containing unverified manual rubric questions remain in `PENDING_MANUAL_EVALUATION` until the evaluation queue is cleared by an instructor/admin).
- **Institutional Status:** **UNDECIDED — Academic Examination Board Decision Required**.

---

## 3. Summary Table & Approval Ownership

| Decision ID | Topic | Current Technical Baseline | Approval Authority | Status |
|---|---|---|---|---|
| **BDR-16** | Exam Network Grace Period | 60 seconds (Configurable per blueprint) | Academic Exam Committee | **UNDECIDED** |
| **BDR-17** | Exam Scheduling vs On-Demand | Configurable Hybrid (Window & On-Demand) | Director of Academic Affairs | **UNDECIDED** |
| **BDR-18** | Exam Certificate Expiry | Perpetual (Schema-ready with expiry column) | Accreditation Board | **UNDECIDED** |
| **BDR-19** | Gateway Currency Routing | Razorpay (INR) / Stripe (USD) | Finance Director | **UNDECIDED** |
| **BDR-20** | Refund Policy & Approval | Admin Manual Approval (Diagnostic history intact) | Managing Director & Legal | **UNDECIDED** |
| **BDR-21** | GST Export of Services (LUT) | 0% Export with verified LUT (18% fallback) | Chartered Accountant | **UNDECIDED** |
| **BDR-22** | Manual Rubric Result Gate | Withhold until Evaluated (PENDING_MANUAL_EVALUATION) | Academic Exam Board | **UNDECIDED** |

> **ZM-03.1 Governance Note:** All underlying architectural components have been implemented in a fully configurable, fail-safe manner. Formal institutional decisions for BDR-16 through BDR-22 remain reserved and explicitly **UNDECIDED** until ratified by their respective institutional authorities.

