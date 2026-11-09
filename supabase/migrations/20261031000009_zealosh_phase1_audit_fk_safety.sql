-- ============================================================================
-- ZEALOSH LMS — PHASE 1: AUDIT & ENROLLMENT FOREIGN-KEY SAFETY MIGRATION
-- Migration: 20261031000009_zealosh_phase1_audit_fk_safety.sql
-- Architecture: ADR-002 & Master Data Constitution (Rule 7)
-- Purpose:
--   Protect historical compliance records in enrollment_transfers and
--   enrollment_withdrawals from cascading deletion when an enrollment is deleted.
--   Enforces ON DELETE RESTRICT so that physical deletion of a referenced
--   enrollment is strictly rejected by the database engine, safeguarding academic audit trails.
-- ============================================================================

BEGIN;

-- 1. Protect enrollment_transfers foreign key against accidental cascading delete
ALTER TABLE public.enrollment_transfers
    DROP CONSTRAINT IF EXISTS enrollment_transfers_enrollment_id_fkey;

ALTER TABLE public.enrollment_transfers
    ADD CONSTRAINT enrollment_transfers_enrollment_id_fkey
    FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id)
    ON DELETE RESTRICT;

-- 2. Protect enrollment_withdrawals foreign key against accidental cascading delete
ALTER TABLE public.enrollment_withdrawals
    DROP CONSTRAINT IF EXISTS enrollment_withdrawals_enrollment_id_fkey;

ALTER TABLE public.enrollment_withdrawals
    ADD CONSTRAINT enrollment_withdrawals_enrollment_id_fkey
    FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id)
    ON DELETE RESTRICT;

-- 3. Document canonical institutional retention policy
COMMENT ON CONSTRAINT enrollment_transfers_enrollment_id_fkey ON public.enrollment_transfers IS
    'Enforces audit durability: Enrollments with transfer history cannot be physically deleted.';

COMMENT ON CONSTRAINT enrollment_withdrawals_enrollment_id_fkey ON public.enrollment_withdrawals IS
    'Enforces audit durability: Enrollments with withdrawal history cannot be physically deleted.';

COMMIT;

