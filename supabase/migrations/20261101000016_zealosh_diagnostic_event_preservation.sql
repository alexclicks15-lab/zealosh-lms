-- ============================================================================
-- ZEALOSH LMS — PHASE 5C.1 INTEGRITY CORRECTION: DIAGNOSTIC EVENT PRESERVATION
-- Migration: 20261101000016_zealosh_diagnostic_event_preservation.sql
-- Workstream: Immutable Diagnostic Audit History & Deletion Cascade Prevention
-- Architecture Baseline: ADR-004 (Supabase PostgreSQL as Sole Authoritative Database)
-- Principle: Strict historical immutability; issue deletion must NEVER destroy event logs
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Modify Foreign Key from ON DELETE CASCADE to ON DELETE RESTRICT
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Find and drop existing foreign key constraints on diagnostic_events.issue_id
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'diagnostic_events'
          AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.diagnostic_events DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Apply explicit ON DELETE RESTRICT constraint
ALTER TABLE public.diagnostic_events
    ADD CONSTRAINT diagnostic_events_issue_id_fkey
    FOREIGN KEY (issue_id)
    REFERENCES public.diagnostic_issues(id)
    ON DELETE RESTRICT;

-- ----------------------------------------------------------------------------
-- 2. Expand Issue Status Check to include ARCHIVED (Supporting Soft-Archival)
-- ----------------------------------------------------------------------------
ALTER TABLE public.diagnostic_issues DROP CONSTRAINT IF EXISTS chk_diag_issue_status;

ALTER TABLE public.diagnostic_issues
    ADD CONSTRAINT chk_diag_issue_status
    CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'REOPENED', 'IGNORED', 'ARCHIVED'));

COMMIT;

