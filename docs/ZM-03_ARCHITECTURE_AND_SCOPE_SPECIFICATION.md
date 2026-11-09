# ZM-03 Architecture and Scope Specification — HSE Exam Engine, Commerce & Invoicing

**Document Identifier:** `ZM-03-DOC-003`  
**Milestone:** ZM-03 — High-Stakes HSE Certification Examination Engine, Commerce, Payments & Invoicing Lifecycle  
**Author:** Principal Software Architect  
**Date:** October 31, 2026  
**Status:** Canonical & Audited  
**Institutional Scope:** Single Institutional Learning & Examination Platform (`https://zealosh.com`)  

---

## 1. Architectural Mission & Core Boundaries

Zealosh LMS operates as an institutional digital learning and professional certification examination platform for **Zealosh Training & Consultants** (Kollam, Kerala, India).

### 1.1 Invariant Architecture Boundaries
1. **Single Institutional Boundary:** Zealosh LMS is engineered for one educational institution. It is **not** a multi-tenant SaaS application. There are zero tenant isolation prefixes or organization-switcher UI elements.
2. **PostgreSQL as Authoritative Source of Truth:** All user identities, credentials, courses, batches, enrollments, examination blueprints, question banks, candidate attempts, payment orders, invoices, credit notes, and audit logs originate and reside authoritatively in PostgreSQL / Supabase.
3. **Moodle & BigBlueButton Decoupled Engine Status:** Moodle Core is accessed strictly via authenticated server-side REST Web Services; BigBlueButton is accessed via signed server-side REST APIs with SHA-1 checksums. Neither engine holds authoritative state for user accounts, commercial orders, or certification outcomes.
4. **Brand Primacy:** Zealosh Training & Consultants is the exclusive customer-facing brand. Zero internal engine names (Moodle, BigBlueButton, Keycloak) appear on client-facing surfaces.

---

## 2. High-Stakes HSE Certification Examination Architecture

### 2.1 Distinct Conceptual Boundary: Formative Quizzes vs High-Stakes Summative Examinations

```
+------------------------------------+---------------------------------------+
| Formative Learning Delivery        | High-Stakes Certification Examination |
| (Phase 2 - ZM-02)                  | (Phase 3 - ZM-03)                     |
+------------------------------------+---------------------------------------+
| Quizzes, Topic Drills, BBB Pop-ups | BCSP ASP, BCSP CSP, BCRSP, CIT        |
| Table: `quizzes`, `quiz_attempts`  | Table: `exam_blueprints`, `exam_attempts`
| Immediate feedback during learning | Server-authoritative timer & deadline |
| Retakes encourage mastery          | Anti-cheat randomization & shielding   |
| Certificate: ZEI/COURSE/YYYY/XXXXXX| Certificate: ZEI/EXAM/YYYY/XXXXXX     |
+------------------------------------+---------------------------------------+
```

### 2.2 Blueprints, Question Bank & Domain Weighting
- **Blueprints:** Model authoritative examination specifications (total questions, duration, passing score percentage, domain distributions). Blueprints follow a formal lifecycle: `DRAFT` $\rightarrow$ `APPROVED` $\rightarrow$ `PUBLISHED` $\rightarrow$ `ARCHIVED`.
- **Question Bank:** Categorized by certification type (`ASP`, `CSP`, `CRSP`, `CIT`), domain, topic, difficulty (`EASY`, `MODERATE`, `HARD`), and type (`MULTIPLE_CHOICE`, `MULTIPLE_SELECT`, `TRUE_FALSE`, `SCENARIO_BASED`, `CALCULATION`).
- **Answer Key Shielding:** The database view `learner_exam_questions` strictly omits `correct_option_ids` and `explanation`. Candidates can never receive the answer key over the network during an active attempt.

### 2.3 Server-Authoritative Timer & Anti-Cheat Subsystem
- **Immutable Deadline:** Upon candidate attempt creation (`POST /api/exams/[id]/start`), the server computes:
  $$\text{deadlineTime} = \text{startTime} + (\text{durationMinutes} \times 60 \times 1000) + \text{gracePeriodMs}$$
- Client timers are purely cosmetic projections.
- In-flight autosave (`PUT /api/exams/[id]/answers`) validates that current server time $\le \text{deadlineTime}$. Expired attempts immediately transition to `EXPIRED`.
- Reconnect recovery restores saved answers and bookmarks seamlessly upon browser reload without granting additional time.

### 2.4 Scoring & Results Governance
- **Objective Scoring:** Evaluates multiple-choice and multiple-select questions against server answer keys. Generates comprehensive per-domain diagnostic breakdowns.
- **Manual Rubric Queue:** Questions requiring subjective assessment route to `exam_manual_evaluations` where instructors evaluate candidate submissions against defined criteria rubrics.
- **Result Publication:** Once evaluated, passing candidates receive an official Examination Certificate (`ZEI/EXAM/YYYY/XXXXXX`) with cryptographic verification URL.

---

## 3. Commerce, Orders & Payment Architecture

### 3.1 Dual Payment Gateway Pipeline
- **Razorpay Integration:** Primary gateway for domestic Indian candidates paying in INR. Supports UPI, Netbanking, debit cards, and credit cards.
- **Stripe Integration:** Primary gateway for international candidates paying in USD (Middle East, US, UK, Canada).
- **Manual Enterprise Gateway:** Supports corporate-sponsored cohort purchase orders and direct wire transfers.

### 3.2 State Machine & Idempotency Pipeline
```
[User Initiates] ---> (PENDING PaymentOrder created with batch & course locks)
                               |
         +---------------------+---------------------+
         |                                           |
  (Payment Success Webhook)                  (Payment Failed / Cancelled)
         |                                           |
  [HMAC-SHA256 Sig Check]                    [Order marked FAILED]
         |
  [Idempotency Check] (If already PAID, return 200 OK)
         |
  [Atomic Transaction]:
    - Mark PaymentOrder PAID
    - Allocate Batch Seat (enrolledCount++)
    - Create/Activate Enrollment
    - Generate Sequential Statutory Invoice (INV-YYYY-XXXX)
    - Calculate GST Breakdown (CGST+SGST / IGST / LUT Export)
    - Append Immutable Audit Log
```

### 3.3 Refund & Credit Note Lifecycle
- When an administrative refund is approved:
  1. Payment order transitions to `REFUNDED`.
  2. Associated enrollment is revoked (`status = 'REVOKED'`).
  3. Batch seat is released (`enrolledCount--`).
  4. Original invoice status transitions to `REFUNDED`.
  5. A statutory Credit Note (`CN-YYYY-XXXX`) is issued referencing the original invoice and reversing tax liabilities.

---

## 4. Statutory Invoicing & Indian GST Architecture

### 4.1 Legal & Statutory Parameters
- **Supplier Legal Name:** Zealosh Training & Consultants
- **Principal Address:** Kollam, Kerala, India
- **State Code:** `32` (Kerala)
- **Provider GSTIN:** `32AABCZ1234F1Z5`
- **SAC / HSN Code:** `999293` (Commercial Training and Coaching Services)
- **Standard Tax Rate:** 18.00%

### 4.2 Tax Determination Matrix
1. **Intra-State Supply (Customer in Kerala / State 32):**
   - CGST: 9.00%
   - SGST: 9.00%
   - Total Tax: 18.00%
2. **Inter-State Supply (Customer in India, outside Kerala):**
   - IGST: 18.00%
   - Total Tax: 18.00%
3. **Export of Services (Customer outside India, payment in USD):**
   - Zero-rated under Letter of Undertaking (LUT)
   - IGST: 0.00%
   - Statutory notice displayed: *"Export of educational services under Letter of Undertaking without payment of integrated tax."*

---

## 5. Scope Boundaries for ZM-03

### In-Scope:
- Full implementation and hardening of HSE Certification Examination Engine.
- Versioned blueprints, question bank shielding, candidate attempt lifecycle, server-enforced countdown timer, in-flight autosave, reconnect recovery, idempotent submit.
- Domain diagnostic scoring and manual evaluation queue.
- Separate formal examination certificates (`ZEI/EXAM/YYYY/XXXXXX`).
- Complete payment order lifecycle, webhook signature verification (HMAC-SHA256), replay protection, atomic enrollment, batch seat management.
- Statutory GST invoicing (CGST Act s.31, Rule 46), sequential numbering (`INV-YYYY-XXXX`), tax breakdown, and Credit Notes (`CN-YYYY-XXXX`).
- Comprehensive Vitest automated test suite (`tests/phase3-exam-and-commerce.test.ts`).
- Forward-only migration `20261031000011_zealosh_exam_and_commerce_phase3.sql`.
- 24 canonical documentation deliverables in `docs/`.

### Out-of-Scope (Deferred):
- Direct bidirectional sync with external accounting ERPs (Tally, Zoho Books) — deferred to Phase 7+.
- Remote AI webcam video proctoring and room scanning — deferred to Phase 6+.
- Native iOS and Android mobile app distribution — deferred to Phase 5+.
- S3 cloud bucket provisioning — deferred to Phase 7+.

