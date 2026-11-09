-- Zealosh LMS — Authoritative Database Migration
-- Phase 8 / Track 1: Foundation Hardening, Active Sessions & Object Storage
-- File: supabase/migrations/20261108000023_zealosh_foundation_hardening_and_auth_sessions.sql

-- ============================================================================
-- 1. ACTIVE SESSIONS & DEVICE REGISTRY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    device_label TEXT,
    browser TEXT,
    os TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by_user_id TEXT,
    revocation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON public.user_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(user_id, revoked_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON public.user_sessions(expires_at);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_sessions' AND policyname = 'user_sessions_select_own'
  ) THEN
    CREATE POLICY user_sessions_select_own ON public.user_sessions
      FOR SELECT
      USING (user_id = auth.uid()::TEXT);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_sessions' AND policyname = 'user_sessions_update_own'
  ) THEN
    CREATE POLICY user_sessions_update_own ON public.user_sessions
      FOR UPDATE
      USING (user_id = auth.uid()::TEXT);
  END IF;
END $$;

-- ============================================================================
-- 2. DURABLE DATABASE-ENFORCED LOGIN LOCKOUT
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    identifier_hash TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    failed_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts(identifier_hash);
CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until ON public.login_attempts(locked_until);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Atomic concurrency-safe function for login attempt recording and lockout evaluation
CREATE OR REPLACE FUNCTION public.record_login_attempt(
    p_identifier_hash TEXT,
    p_is_success BOOLEAN,
    p_ip_address TEXT DEFAULT NULL,
    p_max_failures INT DEFAULT 5,
    p_lockout_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_row public.login_attempts%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_is_locked BOOLEAN := FALSE;
    v_remaining_seconds INT := 0;
    v_failed_count INT := 0;
BEGIN
    -- Upsert initialization row
    INSERT INTO public.login_attempts (identifier_hash, ip_address, failed_count, last_failed_at, created_at, updated_at)
    VALUES (p_identifier_hash, p_ip_address, 0, NULL, v_now, v_now)
    ON CONFLICT (identifier_hash) DO NOTHING;

    -- Concurrency safety: acquire row-level lock
    SELECT * INTO v_row
    FROM public.login_attempts
    WHERE identifier_hash = p_identifier_hash
    FOR UPDATE;

    -- If currently locked out
    IF v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
        v_is_locked := TRUE;
        v_remaining_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_row.locked_until - v_now))::INT);
        RETURN jsonb_build_object(
            'is_locked', TRUE,
            'remaining_seconds', v_remaining_seconds,
            'remaining_minutes', CEIL(v_remaining_seconds::NUMERIC / 60)::INT,
            'failed_count', v_row.failed_count
        );
    END IF;

    -- If lock has expired, reset counters
    IF v_row.locked_until IS NOT NULL AND v_row.locked_until <= v_now THEN
        v_row.failed_count := 0;
        v_row.locked_until := NULL;
    END IF;

    IF p_is_success THEN
        -- On success, reset failures and clear lockout
        UPDATE public.login_attempts
        SET failed_count = 0,
            locked_until = NULL,
            ip_address = COALESCE(p_ip_address, ip_address),
            updated_at = v_now
        WHERE identifier_hash = p_identifier_hash;

        RETURN jsonb_build_object(
            'is_locked', FALSE,
            'remaining_seconds', 0,
            'remaining_minutes', 0,
            'failed_count', 0
        );
    ELSE
        -- On failure, increment failed count
        v_failed_count := v_row.failed_count + 1;
        IF v_failed_count >= p_max_failures THEN
            v_is_locked := TRUE;
            v_remaining_seconds := p_lockout_minutes * 60;
            UPDATE public.login_attempts
            SET failed_count = v_failed_count,
                locked_until = v_now + (p_lockout_minutes || ' minutes')::INTERVAL,
                last_failed_at = v_now,
                ip_address = COALESCE(p_ip_address, ip_address),
                updated_at = v_now
            WHERE identifier_hash = p_identifier_hash;

            RETURN jsonb_build_object(
                'is_locked', TRUE,
                'remaining_seconds', v_remaining_seconds,
                'remaining_minutes', p_lockout_minutes,
                'failed_count', v_failed_count
            );
        ELSE
            UPDATE public.login_attempts
            SET failed_count = v_failed_count,
                last_failed_at = v_now,
                ip_address = COALESCE(p_ip_address, ip_address),
                updated_at = v_now
            WHERE identifier_hash = p_identifier_hash;

            RETURN jsonb_build_object(
                'is_locked', FALSE,
                'remaining_seconds', 0,
                'remaining_minutes', 0,
                'failed_count', v_failed_count
            );
        END IF;
    END IF;
END;
$$;

-- Atomic check function without state mutation
CREATE OR REPLACE FUNCTION public.check_login_lockout(
    p_identifier_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_row public.login_attempts%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_remaining_seconds INT := 0;
BEGIN
    SELECT * INTO v_row
    FROM public.login_attempts
    WHERE identifier_hash = p_identifier_hash;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'is_locked', FALSE,
            'remaining_seconds', 0,
            'remaining_minutes', 0,
            'failed_count', 0
        );
    END IF;

    IF v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
        v_remaining_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_row.locked_until - v_now))::INT);
        RETURN jsonb_build_object(
            'is_locked', TRUE,
            'remaining_seconds', v_remaining_seconds,
            'remaining_minutes', CEIL(v_remaining_seconds::NUMERIC / 60)::INT,
            'failed_count', v_row.failed_count
        );
    END IF;

    RETURN jsonb_build_object(
        'is_locked', FALSE,
        'remaining_seconds', 0,
        'remaining_minutes', 0,
        'failed_count', v_row.failed_count
    );
END;
$$;

-- ============================================================================
-- 3. MEDIA ASSETS & DIRECT S3-COMPATIBLE STORAGE REGISTRY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.media_assets (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    provider TEXT NOT NULL DEFAULT 's3-compatible',
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    display_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 TEXT,
    owner_user_id TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_UPLOAD' CHECK (status IN ('PENDING_UPLOAD', 'AVAILABLE', 'FAILED', 'DELETED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON public.media_assets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_key ON public.media_assets(object_key);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON public.media_assets(status);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'media_assets' AND policyname = 'media_assets_select_available'
  ) THEN
    CREATE POLICY media_assets_select_available ON public.media_assets
      FOR SELECT
      USING (status = 'AVAILABLE' OR owner_user_id = auth.uid()::TEXT);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'media_assets' AND policyname = 'media_assets_insert_owner'
  ) THEN
    CREATE POLICY media_assets_insert_owner ON public.media_assets
      FOR INSERT
      WITH CHECK (owner_user_id = auth.uid()::TEXT);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'media_assets' AND policyname = 'media_assets_update_owner'
  ) THEN
    CREATE POLICY media_assets_update_owner ON public.media_assets
      FOR UPDATE
      USING (owner_user_id = auth.uid()::TEXT);
  END IF;
END $$;

-- ============================================================================
-- 4. SUPABASE GOTRUE USER SYNCHRONIZATION TRIGGER (IF AUTH SCHEMA EXISTS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_full_name TEXT;
    v_phone TEXT;
    v_raw_meta JSONB;
BEGIN
    v_raw_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    v_full_name := COALESCE(
        v_raw_meta->>'name',
        v_raw_meta->>'full_name',
        split_part(NEW.email, '@', 1)
    );
    v_phone := v_raw_meta->>'phone';

    -- Upsert profile record
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        status,
        failed_login_count,
        mfa_enabled,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        LOWER(TRIM(NEW.email)),
        v_full_name,
        v_phone,
        'ACTIVE',
        0,
        FALSE,
        NEW.created_at,
        NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE WHEN profiles.full_name IS NULL OR profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
        phone = COALESCE(profiles.phone, EXCLUDED.phone),
        updated_at = NOW();

    -- Ensure default STUDENT role assignment in public.user_roles if no role exists
    -- Security guard: raw_user_meta_data NEVER grants privileged roles (ADMIN, INSTRUCTOR)
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id::TEXT) THEN
        INSERT INTO public.user_roles (id, user_id, role, is_primary, assigned_at, assigned_by)
        VALUES (
            'role-' || gen_random_uuid()::TEXT,
            NEW.id::TEXT,
            'STUDENT',
            TRUE,
            NOW(),
            'system-gotrue-sync'
        )
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Safely bind trigger only when auth.users exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    DROP TRIGGER IF EXISTS trg_sync_auth_user_to_profile ON auth.users;
    CREATE TRIGGER trg_sync_auth_user_to_profile
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_auth_user_to_profile();
  END IF;
END $$;

