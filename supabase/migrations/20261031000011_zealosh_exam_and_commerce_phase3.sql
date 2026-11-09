-- ============================================================================
-- ZEALOSH LMS — PHASE 3: HSE EXAMINATION ENGINE, COMMERCE & GST INVOICING
-- Migration: 20261031000011_zealosh_exam_and_commerce_phase3.sql
-- Architecture: ADR-003 (High-Stakes Summative Exam Engine, Statutory GST Tax Model)
-- Target: Core Hub PostgreSQL / Supabase
-- Standards: Non-Destructive Schema Evolution, Strict Foreign Keys, Row-Level Security
-- Invariants:
--   1. Pure forward-compatible DDL (no table drops, no data loss)
--   2. Strict server-authoritative timer deadline columns
--   3. Normalized manual rubric evaluations queue
--   4. Statutory CGST, SGST, IGST, and Export LUT columns on invoices
--   5. Dedicated invoice credit notes table for legal audit trail on refunds
--   6. Defense-in-depth Row-Level Security (RLS) policies for candidates and faculty
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Examination Blueprint Evolution
-- ----------------------------------------------------------------------------
ALTER TABLE public.exam_blueprints ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE public.exam_blueprints ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'PUBLISHED';
ALTER TABLE public.exam_blueprints ADD COLUMN IF NOT EXISTS grace_period_seconds INT DEFAULT 60;
ALTER TABLE public.exam_blueprints ADD COLUMN IF NOT EXISTS scheduled_start_time TIMESTAMPTZ;
ALTER TABLE public.exam_blueprints ADD COLUMN IF NOT EXISTS scheduled_end_time TIMESTAMPTZ;

-- Defensive check constraint alignment for blueprint status
DO $$
BEGIN
    ALTER TABLE public.exam_blueprints DROP CONSTRAINT IF EXISTS check_exam_blueprints_status;
    ALTER TABLE public.exam_blueprints ADD CONSTRAINT check_exam_blueprints_status
        CHECK (status IN ('DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Examination Questions Evolution
-- ----------------------------------------------------------------------------
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS points NUMERIC(5,2) DEFAULT 1.00;
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS rubric_criteria JSONB DEFAULT '[]'::jsonb;

-- Update sanitized candidate projection view
CREATE OR REPLACE VIEW public.learner_exam_questions AS
SELECT 
  id,
  certification_type,
  domain,
  topic,
  stem,
  type,
  difficulty,
  options,
  points,
  rubric_criteria
FROM public.exam_questions;

-- ----------------------------------------------------------------------------
-- 3. Examination Attempt Evolution
-- ----------------------------------------------------------------------------
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS grace_period_seconds INT DEFAULT 60;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS autosaved_at TIMESTAMPTZ;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS question_snapshots JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS manual_evaluations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS certificate_id VARCHAR(64);
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS certificate_code VARCHAR(64);

-- Align attempt status check constraint to support manual rubric grading
DO $$
BEGIN
    ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check;
    ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS check_exam_attempts_status;
    ALTER TABLE public.exam_attempts ADD CONSTRAINT check_exam_attempts_status
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'PENDING_MANUAL_EVALUATION'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_attempts_deadline ON public.exam_attempts(deadline_time);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_blueprint ON public.exam_attempts(user_id, blueprint_id);

-- ----------------------------------------------------------------------------
-- 4. Manual Rubric Evaluation Queue Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exam_manual_evaluations (
    id VARCHAR(64) PRIMARY KEY,
    attempt_id VARCHAR(64) NOT NULL REFERENCES public.exam_attempts(id) ON DELETE RESTRICT,
    question_id VARCHAR(64) NOT NULL REFERENCES public.exam_questions(id) ON DELETE RESTRICT,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    evaluator_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    evaluator_name TEXT,
    rubric_criterion_id TEXT,
    awarded_points NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    max_points NUMERIC(6,2) NOT NULL DEFAULT 1.00,
    feedback TEXT,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_manual_evals_attempt ON public.exam_manual_evaluations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_manual_evals_evaluator ON public.exam_manual_evaluations(evaluator_id);

-- ----------------------------------------------------------------------------
-- 5. Commerce & Payment Orders Evolution
-- ----------------------------------------------------------------------------
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_payment_orders_idempotency ON public.payment_orders(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. Invoices Table Evolution (Statutory Indian GST Compliance)
-- ----------------------------------------------------------------------------
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cgst_rate_percent NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sgst_rate_percent NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS igst_rate_percent NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS place_of_supply_state_code VARCHAR(8);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS place_of_supply_state_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_export BOOLEAN DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS lut_reference TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS credit_note_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_invoices_credit_note_id ON public.invoices(credit_note_id)
WHERE credit_note_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 7. Statutory Credit Notes Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_credit_notes (
    id VARCHAR(64) PRIMARY KEY,
    credit_note_number VARCHAR(64) NOT NULL UNIQUE,
    original_invoice_id VARCHAR(64) NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    original_invoice_number VARCHAR(64) NOT NULL,
    order_id VARCHAR(64) NOT NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    reason TEXT NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    tax_amount NUMERIC(12,2) NOT NULL,
    cgst_amount NUMERIC(12,2) DEFAULT 0.00,
    sgst_amount NUMERIC(12,2) DEFAULT 0.00,
    igst_amount NUMERIC(12,2) DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    issued_by_user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_orig_invoice ON public.invoice_credit_notes(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_user_id ON public.invoice_credit_notes(user_id);

-- ----------------------------------------------------------------------------
-- 8. Durable Payment Webhook Events (Replay Protection & Idempotency)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id VARCHAR(64) PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    event_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    order_id VARCHAR(64) REFERENCES public.payment_orders(id) ON DELETE SET NULL,
    payment_id VARCHAR(128),
    payload_hash VARCHAR(128) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_event
    ON public.payment_webhook_events(provider, event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_order
    ON public.payment_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_status
    ON public.payment_webhook_events(status);

-- ----------------------------------------------------------------------------
-- 9. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.exam_manual_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- Manual Evaluations: Faculty & Admins manage; Candidate views own after completion
DROP POLICY IF EXISTS "Faculty manage manual evaluations" ON public.exam_manual_evaluations;
CREATE POLICY "Faculty manage manual evaluations"
    ON public.exam_manual_evaluations FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()::text
            AND users.role IN ('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR', 'COURSE_MANAGER')
        )
    );

DROP POLICY IF EXISTS "Learner view own manual evaluations" ON public.exam_manual_evaluations;
CREATE POLICY "Learner view own manual evaluations"
    ON public.exam_manual_evaluations FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()::text
        AND EXISTS (
            SELECT 1 FROM public.exam_attempts
            WHERE exam_attempts.id = exam_manual_evaluations.attempt_id
            AND exam_attempts.status = 'COMPLETED'
        )
    );

-- Credit Notes: Learner view own; Admin manage all
DROP POLICY IF EXISTS "Learner view own credit notes" ON public.invoice_credit_notes;
CREATE POLICY "Learner view own credit notes"
    ON public.invoice_credit_notes FOR SELECT
    TO authenticated
    USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Admin manage credit notes" ON public.invoice_credit_notes;
CREATE POLICY "Admin manage credit notes"
    ON public.invoice_credit_notes FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()::text
            AND users.role IN ('SUPER_ADMIN', 'ORG_ADMIN')
        )
    );

-- Webhook Events: Administrators inspect; Service Role manages
DROP POLICY IF EXISTS "Admin view webhook events" ON public.payment_webhook_events;
CREATE POLICY "Admin view webhook events"
    ON public.payment_webhook_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()::text
            AND users.role IN ('SUPER_ADMIN', 'ORG_ADMIN')
        )
    );

-- Grant privileges to authenticated users and service_role
GRANT SELECT ON public.learner_exam_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exam_manual_evaluations TO authenticated;
GRANT SELECT ON public.invoice_credit_notes TO authenticated;
GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.exam_manual_evaluations TO service_role;
GRANT ALL ON public.invoice_credit_notes TO service_role;
GRANT ALL ON public.payment_webhook_events TO service_role;

REVOKE ALL ON public.exam_manual_evaluations FROM anon;
REVOKE ALL ON public.invoice_credit_notes FROM anon;
REVOKE ALL ON public.payment_webhook_events FROM anon;

COMMIT;

