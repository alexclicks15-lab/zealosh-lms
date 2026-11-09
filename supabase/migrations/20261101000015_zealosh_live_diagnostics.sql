-- ============================================================================
-- ZEALOSH LMS — PHASE 5C.1: LIVE BUG MONITORING, DIAGNOSTICS & HEALTH OBSERVABILITY
-- Migration: 20261101000015_zealosh_live_diagnostics.sql
-- Workstream: Centralized Incident Grouping, Correlation IDs & Health Telemetry
-- Architecture Baseline: ADR-004 (Supabase PostgreSQL as Sole Authoritative Database)
-- Security: Defense-in-Depth RLS, strict admin isolation, zero sensitive leakage
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Diagnostic Issues Table (Deduplicated, Grouped Incidents)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnostic_issues (
    id VARCHAR(64) PRIMARY KEY,
    fingerprint VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    affected_routes JSONB NOT NULL DEFAULT '[]'::jsonb,
    affected_services JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_correlation_id VARCHAR(64),
    last_error_message TEXT NOT NULL,
    sample_stack_trace TEXT,
    sample_component_stack TEXT,
    acknowledged_by VARCHAR(64),
    acknowledged_at TIMESTAMPTZ,
    resolved_by VARCHAR(64),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64);
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS category VARCHAR(64);
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS severity VARCHAR(32) DEFAULT 'MEDIUM';
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'OPEN';
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS occurrence_count INTEGER DEFAULT 1;
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS affected_routes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS affected_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS last_correlation_id VARCHAR(64);
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS last_error_message TEXT;
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS sample_stack_trace TEXT;
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS sample_component_stack TEXT;
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS acknowledged_by VARCHAR(64);
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(64);
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.diagnostic_issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_diag_issue_category'
  ) THEN
    ALTER TABLE public.diagnostic_issues 
      ADD CONSTRAINT chk_diag_issue_category 
      CHECK (category IN (
        'FRONTEND_RUNTIME',
        'FRONTEND_NETWORK',
        'API_FAILURE',
        'DATABASE_FAILURE',
        'AUTH_FAILURE',
        'ACADEMIC_WORKFLOW',
        'EXAMINATION_FAILURE',
        'INTEGRATION_FAILURE',
        'WORKER_FAILURE',
        'CONFIG_FAILURE'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_diag_issue_severity'
  ) THEN
    ALTER TABLE public.diagnostic_issues 
      ADD CONSTRAINT chk_diag_issue_severity 
      CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_diag_issue_status'
  ) THEN
    ALTER TABLE public.diagnostic_issues 
      ADD CONSTRAINT chk_diag_issue_status 
      CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'REOPENED', 'IGNORED'));
  END IF;
END $$;

-- Indexes for lightning-fast queries and filters
CREATE INDEX IF NOT EXISTS idx_diag_issues_status ON public.diagnostic_issues(status);
CREATE INDEX IF NOT EXISTS idx_diag_issues_severity ON public.diagnostic_issues(severity);
CREATE INDEX IF NOT EXISTS idx_diag_issues_category ON public.diagnostic_issues(category);
CREATE INDEX IF NOT EXISTS idx_diag_issues_last_seen ON public.diagnostic_issues(last_seen_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_diag_issues_fingerprint ON public.diagnostic_issues(fingerprint);

-- ----------------------------------------------------------------------------
-- 2. Diagnostic Events Table (Immutable Event Occurrences)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnostic_events (
    id VARCHAR(64) PRIMARY KEY,
    issue_id VARCHAR(64) NOT NULL REFERENCES public.diagnostic_issues(id) ON DELETE CASCADE,
    correlation_id VARCHAR(64) NOT NULL,
    category VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    source VARCHAR(32) NOT NULL DEFAULT 'BACKEND',
    route VARCHAR(255),
    service VARCHAR(64),
    method VARCHAR(16),
    status_code INTEGER,
    error_code VARCHAR(64),
    sanitized_message TEXT NOT NULL,
    stack_trace TEXT,
    component_stack TEXT,
    user_id VARCHAR(64),
    user_email VARCHAR(255),
    client_info JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS issue_id VARCHAR(64) REFERENCES public.diagnostic_issues(id) ON DELETE CASCADE;
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS category VARCHAR(64);
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS severity VARCHAR(32) DEFAULT 'MEDIUM';
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS source VARCHAR(32) DEFAULT 'BACKEND';
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS route VARCHAR(255);
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS service VARCHAR(64);
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS method VARCHAR(16);
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS status_code INTEGER;
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS error_code VARCHAR(64);
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS sanitized_message TEXT;
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS stack_trace TEXT;
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS component_stack TEXT;
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS client_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.diagnostic_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_diag_event_source'
  ) THEN
    ALTER TABLE public.diagnostic_events 
      ADD CONSTRAINT chk_diag_event_source 
      CHECK (source IN ('FRONTEND', 'BACKEND', 'WORKER', 'DATABASE', 'INTEGRATION'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_diag_events_issue_id ON public.diagnostic_events(issue_id);
CREATE INDEX IF NOT EXISTS idx_diag_events_correlation ON public.diagnostic_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_diag_events_created ON public.diagnostic_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diag_events_category ON public.diagnostic_events(category);

-- ----------------------------------------------------------------------------
-- 3. Service Health Checks Table (Persistent Telemetry Cache)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_health_checks (
    service_name VARCHAR(64) PRIMARY KEY,
    status VARCHAR(32) NOT NULL DEFAULT 'HEALTHY',
    latency_ms INTEGER,
    message TEXT NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.service_health_checks ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'HEALTHY';
ALTER TABLE public.service_health_checks ADD COLUMN IF NOT EXISTS latency_ms INTEGER;
ALTER TABLE public.service_health_checks ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.service_health_checks ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.service_health_checks ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_health_status'
  ) THEN
    ALTER TABLE public.service_health_checks 
      ADD CONSTRAINT chk_service_health_status 
      CHECK (status IN ('HEALTHY', 'DEGRADED', 'DOWN', 'UNCONFIGURED'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Row-Level Security (Strict Administrative Access Only)
-- ----------------------------------------------------------------------------
ALTER TABLE public.diagnostic_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_health_checks ENABLE ROW LEVEL SECURITY;

-- Clean existing policies defensively
DROP POLICY IF EXISTS diag_issues_admin_policy ON public.diagnostic_issues;
DROP POLICY IF EXISTS diag_events_admin_policy ON public.diagnostic_events;
DROP POLICY IF EXISTS service_health_admin_policy ON public.service_health_checks;

-- Policies: Only authorized administrators have access; service_role has full bypass
CREATE POLICY diag_issues_admin_policy ON public.diagnostic_issues
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY diag_events_admin_policy ON public.diagnostic_events
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY service_health_admin_policy ON public.service_health_checks
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Database Grants
GRANT ALL ON public.diagnostic_issues TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.diagnostic_issues TO authenticated;

GRANT ALL ON public.diagnostic_events TO service_role;
GRANT SELECT, INSERT ON public.diagnostic_events TO authenticated;

GRANT ALL ON public.service_health_checks TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.service_health_checks TO authenticated;

COMMIT;

