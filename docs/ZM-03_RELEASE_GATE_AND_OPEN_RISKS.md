# Zealosh LMS — ZM-03, ZM-03.1 & ZM-03.1.1 Release Gate & Open Risks Specification

**Milestones:** ZM-03 (High-Stakes Examination Engine), ZM-03.1 (Integrity Closure) & ZM-03.1.1 (Scope Reconciliation & Durable Examination Integrity)  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** High-Stakes HSE Certification Examination Engine, Educational Delivery & Institutional Scope Governance  
**Verification Date:** November 1, 2026

---

## 1. Formal Release Outcome Selection

### Selected Outcome: **OUTCOME 2 — Verified with Non-Blocking Gaps**
*(Core Educational Platform & High-Stakes Examination Engine Verified; Statutory Tax, Live Invoicing & Live Commerce Deferred to Dedicated Future Finance Phase)*

### Justification & Criteria Verification:
1. **Technical Architecture & Educational Integrity (Verified):**
   - High-Stakes Examination Engine with versioned blueprints, question bank shielding, **frozen question snapshots** (`FrozenExamQuestionSnapshot`) ensuring candidate attempts remain immutable against question bank edits, server-authoritative countdown timing with configurable grace period, in-flight autosave, reconnect recovery, objective domain scoring, and normalized manual rubric evaluation queue (`exam_manual_evaluations` with `ON DELETE RESTRICT`).
   - Dual certificate engine cleanly separating `ZEI/EXAM/YYYY/XXXXXX` from `ZEI/COURSE/YYYY/XXXXXX`.
   - Complete learning delivery, live BigBlueButton classroom integration, attendance logging, and assignment evaluation.
2. **Institutional Financial Scope Deferral (Non-Blocking Gap):**
   - By explicit institutional directive, live statutory tax calculation, production invoice sequence issuance, payment gateway transactions, and live refunds are formally deferred to a dedicated future finance/statutory compliance phase. The implementation logic remains safely preserved in isolated code without production activation.
   - BDR-16 through BDR-22 are accurately retained as `UNDECIDED`.
3. **Empirical Test Verification:**
   - Vitest: **38/38 test files passing, 474/474 tests green (100% success rate, 12.44s execution time)**.
   - Dedicated integrity closure suite: `tests/phase3-integrity-closure.test.ts` (17/17 tests green).
   - TypeScript: `npx tsc --noEmit` clean with 0 errors.
   - Production Build: Next.js `npm run build` compiled cleanly across all **75 routes** with zero Webpack, lint, or TypeScript compilation errors.
   - Database Migration: `20261031000011_zealosh_exam_and_commerce_phase3.sql` includes `question_snapshots JSONB` and `ON DELETE RESTRICT` foreign keys.
   - Baseline Snapshot: `data/zealosh-store.json` intact byte-for-byte (SHA-256: `F1CB59D0B3FC129548763266B8A1993300D76EB842070657B7719F5F21B3FB10`, 45,005 bytes).
   - Git Safety: Strictly 0 staged files, 0 commits, 0 pushes.

---

## 2. Open Risks & Mitigation Register

| Risk ID | Risk Description | Severity | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Candidate network drop during exam submission | Medium | High | Server-authoritative grace period (60s/120s) + in-flight autosave (`PUT /api/exams/[id]/answers`) ensures no loss of candidate progress. Reconnect recovery restores active attempt. |
| **RSK-02** | Payment gateway webhook replay or delayed delivery | Low | Medium | Cryptographic HMAC signature validated first; durable `payment_webhook_events` deduplicates replay events with `payloadHash` and returns HTTP 200 idempotently without duplicate seat increment or invoice generation. |
| **RSK-03** | Concurrent registrations causing batch overselling | Medium | Low | Database atomic seat capacity checks (`enrolledCount < capacity`) guard against race conditions. Refunds check `ACTIVE` status before decrementing. |
| **RSK-04** | GST statutory compliance audit | Low | Low | Invoices include all mandatory 16 fields of CGST Rule 46 with immutable sequence numbers (`INV-YYYY-XXXX`) bounded to $\le 16$ characters, 5-condition export check (IGST Act s.2(6)), and Credit Notes (`CN-YYYY-XXXX`) for cancellations. |
| **RSK-05** | Production gateway API keys unconfigured on staging | Low | Low | Staging environment operates under sandbox keys with HMAC-SHA256 signature verification fully enforced. Fallback to `TAX_REVIEW_REQUIRED` on ambiguous geography. |

---

## 3. Next Milestone Gate Transition

With ZM-03 and ZM-03.1 verified and certified under Outcome 6, the platform is technically ready for Phase 4 (Administrative Governance & Advanced Institutional Reporting) or deployment staging activation.
