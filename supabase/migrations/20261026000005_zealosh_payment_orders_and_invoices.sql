-- ============================================================================
-- ZEALOSH LMS — PHASE 3: AUTHORITATIVE COMMERCE & TAX INVOICING PERSISTENCE
-- Migration: 20261026000005_zealosh_payment_orders_and_invoices.sql
-- Architecture: ADR-002 (Server-Side Authoritative & Defense-in-Depth RLS)
-- Target: Core Hub Project 1 (yeegsljnjwxdhgzfdnyg)
-- Standards: Statutory Accounting Snapshots, Atomic Concurrency, Row-Level Security
-- Invariants:
--   1. Valid foreign keys for users, courses, batches, and enrollments
--   2. Immutable historical accounting snapshot in invoices (preserving base price & tax)
--   3. Unique gateway payment ID constraint on paid orders preventing double-capture
--   4. Monotonic, concurrency-safe invoice numbering via public.invoice_number_seq
--   5. Privileged RPC functions restricted to service_role only (no anon/authenticated execution)
--   6. Search paths hardened with public, pg_temp against object shadowing
--   7. Zero anonymous access grants (anon revoked from payment_orders and invoices)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Dedicated Sequence for Concurrency-Safe Invoice Numbering
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 1001 INCREMENT BY 1;

DO $$
DECLARE
    v_max_num BIGINT;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM '\d+$')::BIGINT), 1000)
    INTO v_max_num
    FROM public.invoices
    WHERE invoice_number ~ '^\w+-\d+-\d+$';

    IF v_max_num >= 1000 THEN
        PERFORM setval('public.invoice_number_seq', v_max_num + 1, false);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Payment Orders Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
    batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED')),
    gateway VARCHAR(32) NOT NULL DEFAULT 'RAZORPAY' CHECK (gateway IN ('RAZORPAY', 'STRIPE', 'MANUAL')),
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    gateway_refund_id TEXT,
    refund_reason TEXT,
    billing_address JSONB DEFAULT '{}'::jsonb,
    invoice_id VARCHAR(64),
    enrollment_id VARCHAR(64) REFERENCES public.enrollments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(8) DEFAULT 'INR';
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'PENDING';
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS gateway VARCHAR(32) DEFAULT 'RAZORPAY';
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS gateway_order_id TEXT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS gateway_refund_id TEXT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(64);
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS enrollment_id VARCHAR(64) REFERENCES public.enrollments(id) ON DELETE SET NULL;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Status check constraint alignment
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_status_check;
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS check_payment_orders_status;
ALTER TABLE public.payment_orders ADD CONSTRAINT check_payment_orders_status 
    CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'));

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_course_batch ON public.payment_orders(course_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_gateway_payment_id ON public.payment_orders(gateway_payment_id);

-- Enforce idempotency: prevent multiple PAID orders sharing the same gateway payment ID
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_orders_gateway_payment_paid 
ON public.payment_orders(gateway_payment_id) 
WHERE gateway_payment_id IS NOT NULL AND status = 'PAID';

-- ----------------------------------------------------------------------------
-- 3. Invoices Table (Historical Accounting Snapshot)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id VARCHAR(64) PRIMARY KEY,
    invoice_number VARCHAR(64) NOT NULL UNIQUE,
    order_id VARCHAR(64) NOT NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    billing_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
    course_title TEXT NOT NULL,
    batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
    batch_name TEXT NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    tax_amount NUMERIC(12,2) NOT NULL CHECK (tax_amount >= 0),
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL DEFAULT 'PAID' CHECK (status IN ('ISSUED', 'PAID', 'REFUNDED', 'VOID')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hsn_code VARCHAR(16) NOT NULL DEFAULT '999293',
    provider_gstin VARCHAR(32) NOT NULL DEFAULT '32AABCZ1234F1Z5',
    payment_method TEXT,
    transaction_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(64);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS order_id VARCHAR(64) REFERENCES public.payment_orders(id) ON DELETE RESTRICT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE RESTRICT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS course_title TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE RESTRICT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS batch_name TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC(5,2) DEFAULT 18.00;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(8) DEFAULT 'INR';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'PAID';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(16) DEFAULT '999293';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS provider_gstin VARCHAR(32) DEFAULT '32AABCZ1234F1Z5';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS transaction_ref TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Status check constraint alignment
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS check_invoices_status;
ALTER TABLE public.invoices ADD CONSTRAINT check_invoices_status 
    CHECK (status IN ('ISSUED', 'PAID', 'REFUNDED', 'VOID'));

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON public.invoices(issued_at);

-- Link payment_orders to invoices
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_payment_orders_invoice' 
          AND table_name = 'payment_orders'
    ) THEN
        ALTER TABLE public.payment_orders 
        ADD CONSTRAINT fk_payment_orders_invoice 
        FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (RLS) & Access Grants
-- ----------------------------------------------------------------------------
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Anonymous users have zero visibility into financial transactions
REVOKE ALL ON public.payment_orders FROM PUBLIC, anon;
REVOKE ALL ON public.invoices FROM PUBLIC, anon;

GRANT SELECT ON public.payment_orders TO authenticated;
GRANT SELECT ON public.invoices TO authenticated;

GRANT ALL ON public.payment_orders TO service_role;
GRANT ALL ON public.invoices TO service_role;

-- SELECT policy for payment_orders: Candidate sees own orders; Admin sees all
DROP POLICY IF EXISTS payment_orders_read_policy ON public.payment_orders;
CREATE POLICY payment_orders_read_policy ON public.payment_orders
    FOR SELECT TO authenticated, service_role
    USING (
        public.is_admin()
        OR user_id = public.current_user_id()
    );

-- WRITE policy for payment_orders: Admins & service_role only
DROP POLICY IF EXISTS payment_orders_write_policy ON public.payment_orders;
CREATE POLICY payment_orders_write_policy ON public.payment_orders
    FOR ALL TO authenticated, service_role
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- SELECT policy for invoices: Candidate sees own tax invoices; Admin sees all
DROP POLICY IF EXISTS invoices_read_policy ON public.invoices;
CREATE POLICY invoices_read_policy ON public.invoices
    FOR SELECT TO authenticated, service_role
    USING (
        public.is_admin()
        OR user_id = public.current_user_id()
    );

-- WRITE policy for invoices: Admins & service_role only
DROP POLICY IF EXISTS invoices_write_policy ON public.invoices;
CREATE POLICY invoices_write_policy ON public.invoices
    FOR ALL TO authenticated, service_role
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. Atomic Payment Fulfillment & Invoice Generation Function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_payment_order_atomic(
    p_order_id TEXT,
    p_gateway_payment_id TEXT,
    p_actor_email TEXT DEFAULT 'system@zealosh.com',
    p_billing_address JSONB DEFAULT '{}'::jsonb,
    p_hsn_code TEXT DEFAULT '999293',
    p_provider_gstin TEXT DEFAULT '32AABCZ1234F1Z5'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.payment_orders%ROWTYPE;
    v_course public.courses%ROWTYPE;
    v_batch public.batches%ROWTYPE;
    v_user public.users%ROWTYPE;
    v_existing_invoice public.invoices%ROWTYPE;
    v_enroll_result JSONB;
    v_enrollment_id TEXT;
    v_invoice_id TEXT;
    v_invoice_number TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_tax_rate NUMERIC := 18.00;
    v_subtotal NUMERIC;
    v_tax_amount NUMERIC;
    v_billing JSONB;
BEGIN
    -- 1. Lock payment order row for atomic transition
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Payment order % does not exist', p_order_id;
    END IF;

    -- 2. Idempotency Guard: if already PAID, return existing records
    IF v_order.status = 'PAID' AND v_order.invoice_id IS NOT NULL AND v_order.enrollment_id IS NOT NULL THEN
        SELECT * INTO v_existing_invoice FROM public.invoices WHERE id = v_order.invoice_id;
        RETURN jsonb_build_object(
            'success', true,
            'isNew', false,
            'orderId', v_order.id,
            'status', v_order.status,
            'invoiceId', v_existing_invoice.id,
            'invoiceNumber', v_existing_invoice.invoice_number,
            'enrollmentId', v_order.enrollment_id
        );
    END IF;

    IF v_order.status <> 'PENDING' THEN
        RAISE EXCEPTION 'INVALID_STATE: Cannot complete payment order in status %', v_order.status;
    END IF;

    -- 3. Verify gateway payment ID has not been used by another paid order
    IF EXISTS (
        SELECT 1 FROM public.payment_orders 
        WHERE gateway_payment_id = p_gateway_payment_id 
          AND status = 'PAID' 
          AND id <> p_order_id
    ) THEN
        RAISE EXCEPTION 'DUPLICATE_PAYMENT_ID: Gateway payment % has already been redeemed', p_gateway_payment_id;
    END IF;

    -- 4. Load Course, Batch, User for snapshot creation
    SELECT * INTO v_course FROM public.courses WHERE id = v_order.course_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'COURSE_NOT_FOUND: Course % does not exist', v_order.course_id;
    END IF;

    SELECT * INTO v_batch FROM public.batches WHERE id = v_order.batch_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'BATCH_NOT_FOUND: Batch % does not exist', v_order.batch_id;
    END IF;

    SELECT * INTO v_user FROM public.users WHERE id = v_order.user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND: User % does not exist', v_order.user_id;
    END IF;

    -- 5. Atomically enroll student using existing concurrency-controlled procedure
    v_enroll_result := public.enroll_learner_atomic(
        v_order.user_id,
        v_order.batch_id,
        'enrol_' || v_order.batch_id || '_' || v_order.user_id
    );

    v_enrollment_id := v_enroll_result->'enrollment'->>'id';
    IF v_enrollment_id IS NULL THEN
        RAISE EXCEPTION 'ENROLLMENT_FAILED: Failed to create atomic enrollment record';
    END IF;

    -- 6. Compute Indian GST (18% inclusive)
    v_subtotal := ROUND(v_order.amount / (1 + v_tax_rate / 100.0), 2);
    v_tax_amount := ROUND(v_order.amount - v_subtotal, 2);

    -- 7. Generate sequential unique invoice numbers via dedicated database sequence
    v_invoice_id := 'inv-' || floor(extract(epoch from v_now) * 1000)::text || '-' || substr(md5(random()::text), 1, 6);
    v_invoice_number := 'INV-' || TO_CHAR(v_now, 'YYYY') || '-' || LPAD(nextval('public.invoice_number_seq')::TEXT, 4, '0');

    -- Resolve billing address: prefer webhook param, fallback to order address, fallback to default
    v_billing := COALESCE(
        NULLIF(p_billing_address, '{}'::jsonb),
        NULLIF(v_order.billing_address, '{}'::jsonb),
        jsonb_build_object('city', 'Kochi', 'state', 'Kerala', 'country', 'India')
    );

    -- 8. Insert immutable historical tax invoice
    INSERT INTO public.invoices (
        id,
        invoice_number,
        order_id,
        user_id,
        user_name,
        user_email,
        billing_address,
        course_id,
        course_title,
        batch_id,
        batch_name,
        subtotal,
        tax_rate_percent,
        tax_amount,
        total_amount,
        currency,
        status,
        issued_at,
        paid_at,
        hsn_code,
        provider_gstin,
        payment_method,
        transaction_ref,
        created_at,
        updated_at
    ) VALUES (
        v_invoice_id,
        v_invoice_number,
        v_order.id,
        v_user.id,
        v_user.name,
        v_user.email,
        v_billing,
        v_course.id,
        v_course.title,
        v_batch.id,
        v_batch.name,
        v_subtotal,
        v_tax_rate,
        v_tax_amount,
        v_order.amount,
        v_order.currency,
        'PAID',
        v_now,
        v_now,
        COALESCE(p_hsn_code, '999293'),
        COALESCE(p_provider_gstin, '32AABCZ1234F1Z5'),
        v_order.gateway || ' Gateway',
        p_gateway_payment_id,
        v_now,
        v_now
    );

    -- 9. Update Payment Order record
    UPDATE public.payment_orders
    SET status = 'PAID',
        gateway_payment_id = p_gateway_payment_id,
        invoice_id = v_invoice_id,
        enrollment_id = v_enrollment_id,
        billing_address = v_billing,
        paid_at = v_now,
        updated_at = v_now
    WHERE id = v_order.id;

    -- 10. Audit logging
    INSERT INTO public.audit_logs (
        id,
        actor_user_id,
        actor_email,
        actor_role,
        action,
        entity_type,
        entity_id,
        details
    ) VALUES (
        'aud-' || floor(extract(epoch from v_now) * 1000)::text || '-' || substr(md5(random()::text), 1, 6),
        v_user.id,
        p_actor_email,
        'STUDENT',
        'PAYMENT_ORDER_COMPLETED',
        'PAYMENT_ORDER',
        v_order.id,
        jsonb_build_object(
            'amount', v_order.amount,
            'currency', v_order.currency,
            'invoiceId', v_invoice_id,
            'invoiceNumber', v_invoice_number,
            'enrollmentId', v_enrollment_id,
            'transactionRef', p_gateway_payment_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'isNew', true,
        'orderId', v_order.id,
        'status', 'PAID',
        'invoiceId', v_invoice_id,
        'invoiceNumber', v_invoice_number,
        'enrollmentId', v_enrollment_id,
        'subtotal', v_subtotal,
        'taxAmount', v_tax_amount,
        'totalAmount', v_order.amount
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Atomic Refund & Access Revocation Function
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_refund_atomic(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.process_refund_atomic(
    p_order_id TEXT,
    p_actor_user_id TEXT,
    p_actor_email TEXT,
    p_actor_role TEXT DEFAULT 'SUPER_ADMIN',
    p_reason TEXT DEFAULT 'Administrative refund approval',
    p_gateway_refund_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.payment_orders%ROWTYPE;
    v_invoice public.invoices%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Actor & reason validation
    IF p_actor_user_id IS NULL OR trim(p_actor_user_id) = '' THEN
        RAISE EXCEPTION 'INVALID_ACTOR: Actor user ID is required for refund processing';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'INVALID_REFUND_REASON: A non-empty refund reason is required';
    END IF;

    -- 1. Lock payment order
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Payment order % does not exist', p_order_id;
    END IF;

    IF v_order.status = 'REFUNDED' THEN
        RAISE EXCEPTION 'ALREADY_REFUNDED: Order % has already been refunded', p_order_id;
    END IF;

    IF v_order.status <> 'PAID' THEN
        RAISE EXCEPTION 'INVALID_REFUND_STATE: Cannot refund order in status %', v_order.status;
    END IF;

    -- 2. Lock invoice
    IF v_order.invoice_id IS NOT NULL THEN
        SELECT * INTO v_invoice
        FROM public.invoices
        WHERE id = v_order.invoice_id
        FOR UPDATE;

        IF FOUND THEN
            UPDATE public.invoices
            SET status = 'REFUNDED',
                updated_at = v_now
            WHERE id = v_invoice.id;
        END IF;
    END IF;

    -- 3. Update order status and refund details
    UPDATE public.payment_orders
    SET status = 'REFUNDED',
        refund_reason = p_reason,
        gateway_refund_id = p_gateway_refund_id,
        refunded_at = v_now,
        updated_at = v_now
    WHERE id = v_order.id;

    -- 4. Revoke enrollment & decrement cohort seat count
    IF v_order.enrollment_id IS NOT NULL THEN
        UPDATE public.enrollments
        SET status = 'REVOKED'
        WHERE id = v_order.enrollment_id;

        UPDATE public.batches
        SET enrolled_count = GREATEST(0, enrolled_count - 1),
            updated_at = v_now
        WHERE id = v_order.batch_id;
    END IF;

    -- 5. Record audit trail with actual actor identity
    INSERT INTO public.audit_logs (
        id,
        actor_user_id,
        actor_email,
        actor_role,
        action,
        entity_type,
        entity_id,
        details
    ) VALUES (
        'aud-' || floor(extract(epoch from v_now) * 1000)::text || '-' || substr(md5(random()::text), 1, 6),
        p_actor_user_id,
        p_actor_email,
        COALESCE(p_actor_role, 'SUPER_ADMIN'),
        'PAYMENT_REFUNDED',
        'PAYMENT_ORDER',
        v_order.id,
        jsonb_build_object(
            'reason', p_reason,
            'gatewayRefundId', p_gateway_refund_id,
            'amount', v_order.amount,
            'currency', v_order.currency,
            'invoiceId', v_order.invoice_id,
            'invoiceNumber', v_invoice.invoice_number,
            'enrollmentId', v_order.enrollment_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'orderId', v_order.id,
        'status', 'REFUNDED',
        'invoiceId', v_invoice.id,
        'invoiceNumber', v_invoice.invoice_number,
        'revokedEnrollmentId', v_order.enrollment_id,
        'refundReason', p_reason,
        'gatewayRefundId', p_gateway_refund_id
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Privileged RPC Function Access Grants (SERVICE_ROLE ONLY)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.complete_payment_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_order_atomic(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.process_refund_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
