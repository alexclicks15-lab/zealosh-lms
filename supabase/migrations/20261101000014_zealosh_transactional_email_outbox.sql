-- ============================================================================
-- ZEALOSH LMS — PHASE 5B: TRANSACTIONAL EMAIL DISPATCH ENGINE
-- Migration: 20261101000014_zealosh_transactional_email_outbox.sql
-- Workstream: Durable Email Outbox, Templates, Event Delivery & Reconciliation
-- Architecture Baseline: ADR-004 (Supabase PostgreSQL as Sole Authoritative Database)
-- Security: Defense-in-Depth RLS, tenant isolation, and atomic lease locking
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Email Templates Table (Versioned, Reusable Templates)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_templates (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    version VARCHAR(32) NOT NULL DEFAULT 'v1',
    subject_template TEXT NOT NULL,
    html_template TEXT NOT NULL,
    text_template TEXT NOT NULL,
    required_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS name VARCHAR(128);
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS event_type VARCHAR(64);
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS version VARCHAR(32) DEFAULT 'v1';
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS subject_template TEXT;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS html_template TEXT;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS text_template TEXT;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS required_variables JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_email_templates_event_ver 
    ON public.email_templates(event_type, version, is_active);

-- ----------------------------------------------------------------------------
-- 2. User Notification Preferences Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    channel VARCHAR(32) NOT NULL DEFAULT 'EMAIL',
    category VARCHAR(64) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS channel VARCHAR(32) DEFAULT 'EMAIL';
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS category VARCHAR(64);
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_pref_channel'
  ) THEN
    ALTER TABLE public.user_notification_preferences 
      ADD CONSTRAINT chk_user_pref_channel 
      CHECK (channel IN ('EMAIL', 'IN_APP'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_pref_category'
  ) THEN
    ALTER TABLE public.user_notification_preferences 
      ADD CONSTRAINT chk_user_pref_category 
      CHECK (category IN ('ANNOUNCEMENTS', 'ASSIGNMENTS', 'GRADES', 'LIVE_SESSIONS', 'DOUBTS', 'SECURITY'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_channel_category'
  ) THEN
    ALTER TABLE public.user_notification_preferences 
      ADD CONSTRAINT uq_user_channel_category 
      UNIQUE (user_id, channel, category);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_notification_pref_lookup 
    ON public.user_notification_preferences(user_id, channel, category);

-- ----------------------------------------------------------------------------
-- 3. Email Outbox Table (Durable Storage Before External Delivery)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_outbox (
    id VARCHAR(64) PRIMARY KEY,
    source_event_id VARCHAR(64),
    event_type VARCHAR(64) NOT NULL,
    recipient_user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    template_id VARCHAR(64) NOT NULL,
    template_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    template_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(64),
    provider VARCHAR(64) NOT NULL DEFAULT 'unconfigured',
    provider_message_id VARCHAR(128),
    error_message TEXT,
    error_classification VARCHAR(64),
    idempotency_key VARCHAR(128),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS source_event_id VARCHAR(64);
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS event_type VARCHAR(64);
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS recipient_user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS template_id VARCHAR(64);
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS template_version VARCHAR(32) DEFAULT 'v1';
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS template_variables JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS html_body TEXT;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS text_body TEXT;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'QUEUED';
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS locked_by VARCHAR(64);
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS provider VARCHAR(64) DEFAULT 'unconfigured';
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(128);
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS error_classification VARCHAR(64);
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.email_outbox ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Status and Classification Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_email_outbox_status'
  ) THEN
    ALTER TABLE public.email_outbox 
      ADD CONSTRAINT chk_email_outbox_status 
      CHECK (status IN ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'RETRY_PENDING', 'FAILED', 'BOUNCED', 'SUPPRESSED', 'CANCELLED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_email_outbox_error_class'
  ) THEN
    ALTER TABLE public.email_outbox 
      ADD CONSTRAINT chk_email_outbox_error_class 
      CHECK (error_classification IS NULL OR error_classification IN ('TRANSIENT_NETWORK', 'RATE_LIMIT', 'INVALID_RECIPIENT', 'AUTH_FAILURE', 'PERMANENT_REJECTION', 'SUPPRESSED', 'UNCONFIGURED'));
  END IF;
END $$;

-- Indexes for Queue Processing, Recipient Isolation & Deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_outbox_idempotency 
    ON public.email_outbox(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_outbox_claim 
    ON public.email_outbox(status, next_attempt_at) 
    WHERE status IN ('QUEUED', 'RETRY_PENDING');

CREATE INDEX IF NOT EXISTS idx_email_outbox_recipient 
    ON public.email_outbox(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_outbox_provider_msg 
    ON public.email_outbox(provider_message_id) 
    WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_outbox_event 
    ON public.email_outbox(source_event_id, event_type);

-- ----------------------------------------------------------------------------
-- 4. Email Delivery Events Table (Reconciliation & Provider Webhook Audit)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_delivery_events (
    id VARCHAR(64) PRIMARY KEY,
    outbox_id VARCHAR(64) REFERENCES public.email_outbox(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL,
    provider_message_id VARCHAR(128),
    event_type VARCHAR(64) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.email_delivery_events ADD COLUMN IF NOT EXISTS outbox_id VARCHAR(64) REFERENCES public.email_outbox(id) ON DELETE CASCADE;
ALTER TABLE public.email_delivery_events ADD COLUMN IF NOT EXISTS provider VARCHAR(64);
ALTER TABLE public.email_delivery_events ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(128);
ALTER TABLE public.email_delivery_events ADD COLUMN IF NOT EXISTS event_type VARCHAR(64);
ALTER TABLE public.email_delivery_events ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);
ALTER TABLE public.email_delivery_events ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.email_delivery_events ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.email_delivery_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_email_delivery_events_outbox 
    ON public.email_delivery_events(outbox_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_delivery_events_prov_msg 
    ON public.email_delivery_events(provider_message_id);

-- ----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) & Permissions
-- ----------------------------------------------------------------------------

-- Enable RLS across all 4 tables
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;

-- Clean existing policies defensively
DROP POLICY IF EXISTS email_templates_read_policy ON public.email_templates;
DROP POLICY IF EXISTS email_templates_write_policy ON public.email_templates;

DROP POLICY IF EXISTS user_pref_read_policy ON public.user_notification_preferences;
DROP POLICY IF EXISTS user_pref_write_policy ON public.user_notification_preferences;

DROP POLICY IF EXISTS email_outbox_read_policy ON public.email_outbox;
DROP POLICY IF EXISTS email_outbox_write_policy ON public.email_outbox;

DROP POLICY IF EXISTS email_delivery_events_admin_policy ON public.email_delivery_events;

-- Policies: Email Templates
CREATE POLICY email_templates_read_policy ON public.email_templates
FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY email_templates_write_policy ON public.email_templates
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policies: User Notification Preferences
CREATE POLICY user_pref_read_policy ON public.user_notification_preferences
FOR SELECT TO authenticated
USING (user_id = public.current_user_id() OR public.is_admin());

CREATE POLICY user_pref_write_policy ON public.user_notification_preferences
FOR ALL TO authenticated
USING (user_id = public.current_user_id() OR public.is_admin())
WITH CHECK (user_id = public.current_user_id() OR public.is_admin());

-- Policies: Email Outbox (Learners can only view their own; Admins can view and manage all)
CREATE POLICY email_outbox_read_policy ON public.email_outbox
FOR SELECT TO authenticated
USING (public.is_admin() OR recipient_user_id = public.current_user_id());

CREATE POLICY email_outbox_write_policy ON public.email_outbox
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policies: Email Delivery Events (Administrative & System only)
CREATE POLICY email_delivery_events_admin_policy ON public.email_delivery_events
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Grants
GRANT SELECT ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_preferences TO authenticated;
GRANT ALL ON public.user_notification_preferences TO service_role;

GRANT SELECT ON public.email_outbox TO authenticated;
GRANT ALL ON public.email_outbox TO service_role;

GRANT SELECT ON public.email_delivery_events TO authenticated;
GRANT ALL ON public.email_delivery_events TO service_role;

COMMIT;

