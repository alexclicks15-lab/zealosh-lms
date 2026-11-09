# ZEALOSH LMS — ZM-03.1 BASELINE RECONCILIATION
## Claim-Versus-Evidence Matrix

| Historical ZM-03.1 Claim | Source Code Inspection | Database Inspection | API Verification | Test Execution | Verification Status |
|---|---|---|---|---|---|
| **Frozen Question Snapshots** | `src/types/index.ts`, `db.ts` | `questionSnapshots` JSON & `question_snapshots` JSONB | `/api/exams/[id]/start`, `/api/exams/[id]` | `tests/phase3-integrity-closure.test.ts` | **VERIFIED** |
| **Server-Authoritative Timing** | `db.ts`, `supabase-adapter.ts` | `deadline_time`, `grace_period_seconds` | `/api/exams/[id]/answers`, `/api/exams/[id]/submit` | Expiration boundary tests passed | **VERIFIED (REMEDIATED)** |
| **Answer-Key Protection** | `getQuestionsForAttempt` in `db.ts` | Redacted client view | `/api/exams/[id]` | Serialized JSON verified clean | **VERIFIED** |
| **Manual Rubric Queue** | `admin/exams/evaluations/route.ts` | `exam_manual_evaluations` table | `GET/POST/PUT /api/admin/exams/evaluations` | Evaluator RBAC and scoring verified | **VERIFIED** |
| **Certificate Lifecycle** | `db.ts`, `supabase-adapter.ts` | `certificates` table | `/verify/[code]` | `ZEI/EXAM/` vs `ZEI/COURSE/` verified | **VERIFIED** |
| **Foreign-Key Protection** | Migration `20261031000011` | PostgreSQL DDL | N/A | `ON DELETE RESTRICT` confirmed | **VERIFIED** |
| **Webhook Replay Protection** | `api/payments/webhook/route.ts` | `payment_webhook_events` table | HMAC-SHA256 signature check | Duplicate delivery ignored idempotently | **VERIFIED (PRESERVED)** |
| **Refund Reconciliation** | `db.processRefund` | `invoice_credit_notes` table | Deferred | Isolated unit tests only | **DEFERRED BY SCOPE** |
| **Statutory GST & Invoicing** | `src/lib/tax/tax-engine.ts` | `invoices` table | Deferred | No live activation | **DEFERRED BY SCOPE** |
