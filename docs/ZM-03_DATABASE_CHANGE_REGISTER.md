# Zealosh LMS — ZM-03 & ZM-03.1 Database Change Register

**Milestones:** ZM-03 & ZM-03.1  
**Migration File:** `supabase/migrations/20261031000011_zealosh_exam_and_commerce_phase3.sql`  
**Authoritative Reference:** [20261031000011_zealosh_exam_and_commerce_phase3.sql](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/supabase/migrations/20261031000011_zealosh_exam_and_commerce_phase3.sql)

---

## 1. Migration Summary

This forward-only, zero-downtime migration introduces table evolutions, new relation tables, integrity constraints, and Row-Level Security (RLS) policies supporting the High-Stakes HSE Certification Examination Engine, durable payment webhook event deduplication, and Indian GST statutory invoicing.

---

## 2. DDL Operations & Schema Alterations

### A. Schema Updates to Existing Tables
- **`exam_blueprints`**:
  - Added `version integer NOT NULL DEFAULT 1`
  - Added `status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))`
  - Added `grace_period_seconds integer NOT NULL DEFAULT 60`
  - Added `sitting_start_time timestamptz`
  - Added `sitting_end_time timestamptz`
  - Added `rubric_criteria jsonb DEFAULT '[]'::jsonb`
- **`exam_attempts`**:
  - Added `autosaved_at timestamptz`
  - Added `grace_period_seconds integer NOT NULL DEFAULT 60`
  - Added `domain_breakdown jsonb DEFAULT '{}'::jsonb`
  - Added `manual_evaluations jsonb DEFAULT '{}'::jsonb`
  - Added `certificate_id text`
  - Added `certificate_code text`
  - Added constraint check on `status IN ('IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'PENDING_MANUAL_EVALUATION', 'SUBMITTED')`
- **`payment_orders`**:
  - Added `idempotency_key text UNIQUE`
  - Added `gateway_order_id text`
  - Added `gateway_payment_id text`
  - Added `refund_status text DEFAULT NULL`
- **`invoices`**:
  - Added `cgst_rate numeric(5,2) DEFAULT 0`
  - Added `cgst_amount numeric(10,2) DEFAULT 0`
  - Added `sgst_rate numeric(5,2) DEFAULT 0`
  - Added `sgst_amount numeric(10,2) DEFAULT 0`
  - Added `igst_rate numeric(5,2) DEFAULT 0`
  - Added `igst_amount numeric(10,2) DEFAULT 0`
  - Added `tax_treatment text DEFAULT 'INTRA_STATE_GST'`
  - Added `lut_reference text`
  - Added `provider_gstin text`

### B. New Tables Created
- **`exam_manual_evaluations`**:
  - Primary key: `id varchar(64)`
  - Foreign key: `attempt_id varchar(64) REFERENCES exam_attempts(id) ON DELETE RESTRICT` (Guarded in ZM-03.1 against accidental cascade deletion)
  - Foreign key: `question_id varchar(64) REFERENCES exam_questions(id) ON DELETE RESTRICT`
  - Foreign key: `user_id varchar(64) REFERENCES users(id) ON DELETE RESTRICT`
  - Foreign key: `evaluator_id varchar(64) REFERENCES users(id) ON DELETE RESTRICT`
  - Attributes: `evaluator_name`, `rubric_criterion_id`, `awarded_points`, `max_points`, `feedback`, `evaluated_at`
- **`invoice_credit_notes`**:
  - Primary key: `id varchar(64)`
  - Attributes: `credit_note_number varchar(32) NOT NULL UNIQUE`, `original_invoice_id`, `order_id`, `user_id`, `reason`, `subtotal`, `tax_amount`, `cgst_amount`, `sgst_amount`, `igst_amount`, `total_amount`, `currency`, `issued_at`, `issued_by_user_id`
- **`payment_webhook_events`** (Added in ZM-03.1):
  - Primary key: `id varchar(64)`
  - Attributes: `provider varchar(32) NOT NULL`, `event_id varchar(128) NOT NULL`, `event_type varchar(64) NOT NULL`, `order_id varchar(64) REFERENCES payment_orders(id) ON DELETE SET NULL`, `payment_id varchar(128)`, `payload_hash varchar(128) NOT NULL`, `received_at timestamptz NOT NULL DEFAULT NOW()`, `processed_at timestamptz`, `status varchar(32) NOT NULL DEFAULT 'RECEIVED'`, `error_message text`
  - Unique index: `idx_payment_webhook_events_provider_event ON payment_webhook_events(provider, event_id)`
  - Index: `idx_payment_webhook_events_order ON payment_webhook_events(order_id)`

---

## 3. Row-Level Security (RLS) Policy Governance

- **`exam_manual_evaluations`**: Faculty and administrators (`SUPER_ADMIN`, `ORG_ADMIN`, `INSTRUCTOR`, `COURSE_MANAGER`) have full management access. Candidates can view evaluation feedback on their own attempts only after attempt status transitions to `COMPLETED`.
- **`invoice_credit_notes`**: Candidates can view their own credit notes. Administrators manage all records.
- **`payment_webhook_events`**: Administrators can view and query webhook audit logs. Public anonymous access is revoked.
