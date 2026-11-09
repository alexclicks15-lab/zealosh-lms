# ZM-03 Requirement Traceability Matrix

**Document Identifier:** `ZM-03-DOC-004`  
**Milestone:** ZM-03 — High-Stakes HSE Certification Examination Engine, Commerce, Payments & Invoicing Lifecycle  
**Author:** Principal Software Architect & QA Automation Engineer  
**Date:** October 31, 2026  
**Status:** Canonical & Audited  
**Institutional Scope:** Single Institutional Learning & Examination Platform (`https://zealosh.com`)  

---

## 1. Traceability Overview
This matrix maps every functional and technical requirement in ZM-03 to its corresponding architectural design, database entity, API route, server implementation, automated verification test, and canonical documentation deliverable.

---

## 2. Master Traceability Register

| Req ID | Requirement Description | Data Model / Schema | API Endpoint | Business Logic Method | Automated Test ID | Verification Deliverable |
|---|---|---|---|---|---|---|
| **REQ-EXAM-01** | HSE Certification Blueprints (ASP, CSP, BCRSP, CIT) with versioning & lifecycle | `exam_blueprints` (`version`, `status`) | `GET /api/exams` | `db.getExamBlueprints`, `db.createExamBlueprint` | `EXAM-TEST-01` | `ZM-03_EXAMINATION_BLUEPRINT_AND_QUESTION_BANK_SPEC.md` |
| **REQ-EXAM-02** | Categorized Question Bank with Domain Weighting | `exam_questions`, `learner_exam_questions` | `GET /api/admin/exams/questions` | `db.getExamQuestions`, `db.addExamQuestion` | `EXAM-TEST-02` | `ZM-03_EXAMINATION_BLUEPRINT_AND_QUESTION_BANK_SPEC.md` |
| **REQ-EXAM-03** | Server-Authoritative Answer Key & Explanation Shielding | `learner_exam_questions` (View) | `GET /api/exams/[id]/start` | `db.getQuestionsForClient` | `EXAM-TEST-03` | `ZM-03_EXAMINATION_BLUEPRINT_AND_QUESTION_BANK_SPEC.md` |
| **REQ-EXAM-04** | Candidate Eligibility & Prerequisite Coursework Gating (80%) | `enrollments`, `courses` | `POST /api/exams/[id]/start` | Prerequisite Gate in Route Handler | `EXAM-TEST-04` | `ZM-03_CANDIDATE_ELIGIBILITY_AND_ATTEMPT_SPEC.md` |
| **REQ-EXAM-05** | Server-Authoritative Countdown Timer with Network Grace Period | `exam_attempts` (`deadline_time`) | `POST /api/exams/[id]/start` | `db.startExamAttempt` | `EXAM-TEST-05` | `ZM-03_CANDIDATE_ELIGIBILITY_AND_ATTEMPT_SPEC.md` |
| **REQ-EXAM-06** | In-Flight Real-Time Autosave & Bookmark Persistence | `exam_attempts` (`answers`, `bookmarked_question_ids`) | `PUT /api/exams/[id]/answers` | `db.saveExamAnswers` | `EXAM-TEST-06` | `ZM-03_CANDIDATE_ELIGIBILITY_AND_ATTEMPT_SPEC.md` |
| **REQ-EXAM-07** | Reconnect Recovery without Time Extension or Key Leakage | `exam_attempts` | `GET /api/exams/[id]` | `db.getExamAttempt` | `EXAM-TEST-07` | `ZM-03_CANDIDATE_ELIGIBILITY_AND_ATTEMPT_SPEC.md` |
| **REQ-EXAM-08** | Idempotent Concurrency-Safe Examination Submission | `exam_attempts` (`status = 'COMPLETED'`) | `POST /api/exams/[id]/submit` | `db.submitExamAttempt` | `EXAM-TEST-08` | `ZM-03_SCORING_EVALUATION_AND_RESULT_GOVERNANCE.md` |
| **REQ-EXAM-09** | Objective Scoring Engine & Domain Diagnostic Breakdown | `exam_attempts` (`domain_breakdown`) | `POST /api/exams/[id]/submit` | `db.submitExamAttempt` | `EXAM-TEST-09` | `ZM-03_SCORING_EVALUATION_AND_RESULT_GOVERNANCE.md` |
| **REQ-EXAM-10** | Manual Evaluation Rubric Queue for Subjective Scenario Questions | `exam_manual_evaluations` | `POST /api/admin/exams/evaluations` | `db.submitManualEvaluation` | `EXAM-TEST-10` | `ZM-03_SCORING_EVALUATION_AND_RESULT_GOVERNANCE.md` |
| **REQ-EXAM-11** | Formal Examination Certificate (`ZEI/EXAM/YYYY/XXXXXX`) strictly separated from Course Completion | `certificates` (`certificate_type = 'EXAM_CERTIFICATION'`) | `/api/verify/[code]` | `db.issueAutomaticCertificate` | `EXAM-TEST-11` | `ZM-03_EXAMINATION_CERTIFICATE_INTEGRATION.md` |
| **REQ-COMM-01** | Multi-Currency Course Payment Order Creation (INR / USD) | `payment_orders` | `POST /api/payments/order` | `db.createPaymentOrder` | `COMM-TEST-01` | `ZM-03_COMMERCE_AND_ORDER_LIFECYCLE_SPEC.md` |
| **REQ-COMM-02** | Cryptographic Webhook HMAC-SHA256 Signature Verification | N/A (Security Header) | `POST /api/payments/webhook` | Webhook Crypto Verifier | `COMM-TEST-02` | `ZM-03_PAYMENT_PROVIDER_INTEGRATION_SPEC.md` |
| **REQ-COMM-03** | Webhook Deduplication, Replay Protection & Idempotent Capture | `payment_orders` (`status = 'PAID'`) | `POST /api/payments/webhook` | Webhook Idempotency Check | `COMM-TEST-03` | `ZM-03_PAYMENT_IDEMPOTENCY_AND_RECONCILIATION.md` |
| **REQ-COMM-04** | Atomic Enrollment Activation & Batch Seat Capacity Allocation | `enrollments`, `batches` (`enrolled_count`) | `POST /api/payments/webhook` | `db.completePaymentOrder`, `db.enrollStudent` | `COMM-TEST-04` | `ZM-03_PAYMENT_IDEMPOTENCY_AND_RECONCILIATION.md` |
| **REQ-COMM-05** | Administrative Refund Processing, Seat Restoration & Enrollment Revocation | `payment_orders` (`status = 'REFUNDED'`), `enrollments` (`status = 'REVOKED'`) | `POST /api/payments/refund` | `db.processRefund` | `COMM-TEST-05` | `ZM-03_REFUND_AND_ADJUSTMENT_LIFECYCLE.md` |
| **REQ-INVC-01** | Statutory Sequential Invoice Numbering (`INV-YYYY-XXXX`) | `invoices` (`invoice_number_seq`) | `GET /api/invoices/[id]` | `db.completePaymentOrder` | `INVC-TEST-01` | `ZM-03_INVOICE_AND_TAX_COMPLIANCE_REVIEW.md` |
| **REQ-INVC-02** | Indian GST Tax Engine: Intra-State (CGST+SGST) vs Inter-State (IGST) | `invoices` (`cgst_amount`, `sgst_amount`, `igst_amount`) | `GET /api/invoices/[id]` | `db.completePaymentOrder` | `INVC-TEST-02` | `ZM-03_INVOICE_AND_TAX_COMPLIANCE_REVIEW.md` |
| **REQ-INVC-03** | Zero-Rated Export of Educational Services under LUT (USD / Overseas) | `invoices` (`is_export`, `lut_reference`) | `GET /api/invoices/[id]` | `db.completePaymentOrder` | `INVC-TEST-03` | `ZM-03_INVOICE_AND_TAX_COMPLIANCE_REVIEW.md` |
| **REQ-INVC-04** | Statutory Credit Note Generation on Refund (`CN-YYYY-XXXX`) | `invoice_credit_notes` | `GET /api/invoices/[id]/credit-note` | `db.processRefund` | `INVC-TEST-04` | `ZM-03_INVOICE_AND_TAX_COMPLIANCE_REVIEW.md` |
| **REQ-SECU-01** | Row-Level Security Defense-in-Depth for Invoices, Orders & Attempts | PostgreSQL RLS Policies | Supabase RLS | Supabase Migration DDL | `SECU-TEST-01` | `ZM-03_RLS_AND_SECURITY_PERMISSION_MATRIX.md` |
| **REQ-DATA-01** | Byte-for-byte Preservation of `data/zealosh-store.json` | JSON File Storage | File System | SHA-256 Hashing Gate | `DATA-TEST-01` | `ZM-03_PHASE2_BASELINE_AND_EVIDENCE_AUDIT.md` |

---

## 3. Coverage Certification
All 22 functional, security, data, and compliance requirements have direct bidirectional mappings to executable code, unit/integration tests, and canonical documentation.

