# ZM-03 Implementation Task Register

**Document Identifier:** `ZM-03-DOC-005`  
**Milestone:** ZM-03 — High-Stakes HSE Certification Examination Engine, Commerce, Payments & Invoicing Lifecycle  
**Author:** Principal Software Architect & Release Manager  
**Date:** October 31, 2026  
**Status:** Canonical & Audited  
**Institutional Scope:** Single Institutional Learning & Examination Platform (`https://zealosh.com`)  

---

## 1. Task Execution & Sequencing Plan

The implementation of ZM-03 follows a strict, dependency-ordered engineering workflow:

```
[Stage 0: Baseline Audit] 
        |
[Stage 1: Decisions & Scope] 
        |
[Stage 2: Core Domain Model & Types] 
        |
[Stage 3: Blueprints & Question Bank] 
        |
[Stage 4: Candidate Eligibility & Attempts] 
        |
[Stage 5: Anti-Cheat, Timer & Autosave] 
        |
[Stage 6: Scoring, Evaluation Queue & Certificates] 
        |
[Stage 7: Commerce, Payment Orders & Webhooks] 
        |
[Stage 8: Statutory GST Invoicing & Credit Notes] 
        |
[Stage 9: Forward Migration & Relational DDL] 
        |
[Stage 10: Security Architecture & RLS] 
        |
[Stage 11: API Contracts & Idempotency] 
        |
[Stage 12: Automated Verification Test Suite] 
        |
[Stage 13: 24 Canonical Documentation Deliverables] 
        |
[Stage 14: Release Outcome & Gate Verification]
```

---

## 2. Granular Task Inventory

| Task ID | Task Description | Target File(s) | Dependency | Status |
|---|---|---|---|---|
| **TSK-001** | Audit Phase 2 test baseline and resolve db.ts mismatches | `src/lib/store/db.ts` | None | **DONE** |
| **TSK-002** | Reconcile 9 vs 10 tables, delivery mode 4th mode, watermark privacy | `docs/ZM-03_PHASE2_BASELINE_AND_EVIDENCE_AUDIT.md` | TSK-001 | **DONE** |
| **TSK-003** | Author Business Decision Register with explicit UNDECIDED marks | `docs/ZM-03_BUSINESS_DECISION_REGISTER.md` | TSK-002 | **DONE** |
| **TSK-004** | Author Architecture and Scope Specification | `docs/ZM-03_ARCHITECTURE_AND_SCOPE_SPECIFICATION.md` | TSK-003 | **DONE** |
| **TSK-005** | Author Requirement Traceability Matrix | `docs/ZM-03_REQUIREMENT_TRACEABILITY_MATRIX.md` | TSK-004 | **DONE** |
| **TSK-006** | Author Implementation Task Register | `docs/ZM-03_IMPLEMENTATION_TASK_REGISTER.md` | TSK-005 | **DONE** |
| **TSK-007** | Define Phase 3 TypeScript interfaces and domain models | `src/types/index.ts` | TSK-006 | **READY** |
| **TSK-008** | Implement HSE Blueprint versioning and lifecycle methods in db.ts | `src/lib/store/db.ts` | TSK-007 | **READY** |
| **TSK-009** | Implement server-authoritative timer, grace period, and in-flight autosave | `src/lib/store/db.ts` | TSK-008 | **READY** |
| **TSK-010** | Implement manual rubric evaluation queue and score publication | `src/lib/store/db.ts` | TSK-009 | **READY** |
| **TSK-011** | Ensure examination certificates (`ZEI/EXAM/YYYY/XXXXXX`) are strictly separated | `src/lib/store/db.ts` | TSK-010 | **READY** |
| **TSK-012** | Implement Indian GST breakdown (CGST+SGST / IGST / LUT export) | `src/lib/store/db.ts` | TSK-011 | **READY** |
| **TSK-013** | Implement statutory Credit Note generation on refund (`CN-YYYY-XXXX`) | `src/lib/store/db.ts` | TSK-012 | **READY** |
| **TSK-014** | Harden Payment Webhook (HMAC-SHA256, replay protection, idempotency) | `src/app/api/payments/webhook/route.ts` | TSK-013 | **READY** |
| **TSK-015** | Author forward migration `20261031000011_zealosh_exam_and_commerce_phase3.sql` | `supabase/migrations/` | TSK-014 | **READY** |
| **TSK-016** | Author comprehensive automated test suite `tests/phase3-exam-and-commerce.test.ts` | `tests/` | TSK-015 | **READY** |
| **TSK-017** | Execute `npx vitest run` and certify 100% test pass rate | CLI | TSK-016 | **READY** |
| **TSK-018** | Verify clean TypeScript build (`npx tsc --noEmit`) and Next.js build | CLI | TSK-017 | **READY** |
| **TSK-019** | Author remaining canonical documentation deliverables (Docs 006 to 024) | `docs/` | TSK-018 | **READY** |
| **TSK-020** | Update master tracking files (`WORK_CHECKPOINTS`, `PROJECT_STATUS`, `ROADMAP`) | `docs/` | TSK-019 | **READY** |
| **TSK-021** | Verify `data/zealosh-store.json` SHA-256 hash and byte size | CLI | TSK-020 | **READY** |
| **TSK-022** | Check Git status (zero staged files) and select formal Release Outcome | CLI / Docs | TSK-021 | **READY** |

---

## 3. Progress Tracking
Tasks completed: 6 / 22.  
Next action: Implement Phase 3 TypeScript interfaces in `src/types/index.ts` and core domain methods in `src/lib/store/db.ts`.

