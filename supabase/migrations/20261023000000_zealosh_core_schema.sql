-- ============================================================================
-- ZEALOSH LMS — HARDENED CORE DATABASE SCHEMA & RLS POLICIES
-- Migration: 20261023000000_zealosh_core_schema.sql
-- Architecture: ADR-002 (Server-Side Authoritative & Defense-in-Depth RLS)
-- Standards: OWASP Top 10, Least Privilege, Zero Blanket Grants
-- ============================================================================

BEGIN;

-- Enable necessary cryptographic and UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. SECURITY & IDENTITY HELPER FUNCTIONS (Safe Non-UUID String Mapping)
-- ============================================================================

-- Safely extracts authenticated user ID from JWT claims as TEXT without throwing UUID cast errors
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', ''),
    nullif(current_setting('request.jwt.claim.sub', true), '')
  );
$$;

-- Safely extracts user role from JWT claims
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
    'anon'
  );
$$;

-- Determines if current caller has administrative or service-role authority
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_admin')::boolean,
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') IN ('SUPER_ADMIN', 'ORG_ADMIN', 'service_role'),
    current_user IN ('postgres', 'service_role')
  );
$$;

-- ============================================================================
-- 2. SYSTEM CONFIGURATION, BRANDING & NAVIGATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'singleton',
  platform_name TEXT NOT NULL DEFAULT 'Zealosh LMS — Enterprise HSE Learning Platform',
  organization_name TEXT NOT NULL DEFAULT 'Zealosh Training & Consultants',
  organization_email TEXT NOT NULL DEFAULT 'contact@zealosh.com',
  support_email TEXT NOT NULL DEFAULT 'support@zealosh.com',
  support_phone TEXT NOT NULL DEFAULT '+91 949 600 0000',
  default_language TEXT NOT NULL DEFAULT 'en-US',
  default_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  default_currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  time_format VARCHAR(8) NOT NULL DEFAULT '12h',
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  registration_mode VARCHAR(32) NOT NULL DEFAULT 'PUBLIC',
  session_timeout_minutes INT NOT NULL DEFAULT 1440,
  max_login_attempts INT NOT NULL DEFAULT 5,
  terms_of_service_url TEXT DEFAULT '/terms',
  privacy_policy_url TEXT DEFAULT '/privacy',
  notification_preferences JSONB NOT NULL DEFAULT '{"emailAlerts": true, "smsAlerts": false, "inAppAlerts": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.branding_theme (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'singleton',
  primary_green TEXT NOT NULL DEFAULT '#4f8c4c',
  deep_green TEXT NOT NULL DEFAULT '#3a7536',
  accent_green TEXT NOT NULL DEFAULT '#2ea033',
  dark_neutral TEXT NOT NULL DEFAULT '#252c41',
  surface_color TEXT NOT NULL DEFAULT '#ffffff',
  light_surface_color TEXT NOT NULL DEFAULT '#f7f9fc',
  secondary_surface TEXT NOT NULL DEFAULT '#eaedf5',
  font_family VARCHAR(32) NOT NULL DEFAULT 'Inter',
  border_radius VARCHAR(16) NOT NULL DEFAULT 'md',
  layout_density VARCHAR(16) NOT NULL DEFAULT 'comfortable',
  button_style VARCHAR(16) NOT NULL DEFAULT 'rounded',
  card_style VARCHAR(16) NOT NULL DEFAULT 'bordered',
  logo_url TEXT DEFAULT '/assets/brand/zealosh-logo.png',
  favicon_url TEXT DEFAULT '/favicon.ico',
  custom_css TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'singleton',
  course_catalog BOOLEAN NOT NULL DEFAULT TRUE,
  cohort_management BOOLEAN NOT NULL DEFAULT TRUE,
  instructor_portal BOOLEAN NOT NULL DEFAULT TRUE,
  student_portal BOOLEAN NOT NULL DEFAULT TRUE,
  recorded_learning BOOLEAN NOT NULL DEFAULT TRUE,
  live_classrooms BOOLEAN NOT NULL DEFAULT TRUE,
  practice_assessments BOOLEAN NOT NULL DEFAULT TRUE,
  formal_examinations BOOLEAN NOT NULL DEFAULT TRUE,
  certificate_issuance BOOLEAN NOT NULL DEFAULT TRUE,
  attendance_tracking BOOLEAN NOT NULL DEFAULT TRUE,
  assignment_submissions BOOLEAN NOT NULL DEFAULT TRUE,
  announcements BOOLEAN NOT NULL DEFAULT TRUE,
  messaging BOOLEAN NOT NULL DEFAULT TRUE,
  reports_analytics BOOLEAN NOT NULL DEFAULT TRUE,
  payment_gateway BOOLEAN NOT NULL DEFAULT TRUE,
  pwa_offline_support BOOLEAN NOT NULL DEFAULT TRUE,
  moodle_sync BOOLEAN NOT NULL DEFAULT TRUE,
  bbb_integration BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.navigation_items (
  id VARCHAR(64) PRIMARY KEY,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  icon_name VARCHAR(64) NOT NULL,
  required_role TEXT[] DEFAULT '{}',
  display_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public view isolating non-sensitive operational configuration from internal settings
CREATE OR REPLACE VIEW public.public_platform_settings AS
SELECT 
  id,
  platform_name,
  organization_name,
  support_email,
  support_phone,
  default_language,
  default_timezone,
  default_currency,
  date_format,
  time_format,
  maintenance_mode,
  terms_of_service_url,
  privacy_policy_url
FROM public.platform_settings;

-- ============================================================================
-- 3. GOVERNANCE, USERS & CENTRAL OIDC REPOSITORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF')),
  avatar_url TEXT,
  organization_id VARCHAR(64) NOT NULL DEFAULT 'org-zealosh-main',
  external_learning_id VARCHAR(64), -- Moodle Auth mapping
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OAuth2 Authorization Codes (Moodle SSO Single-Use PKCE Codes)
CREATE TABLE IF NOT EXISTS public.oauth_codes (
  code VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id VARCHAR(128) NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT DEFAULT 'openid profile email',
  state TEXT,
  nonce TEXT,
  code_challenge TEXT,
  code_challenge_method VARCHAR(16),
  expires_at BIGINT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic, single-use code redemption function with replay attack detection
CREATE OR REPLACE FUNCTION public.redeem_oauth_code(
  p_code TEXT,
  p_client_id TEXT,
  p_redirect_uri TEXT
)
RETURNS TABLE (
  user_id VARCHAR(64),
  scope TEXT,
  nonce TEXT,
  code_challenge TEXT,
  code_challenge_method VARCHAR(16)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec public.oauth_codes%ROWTYPE;
BEGIN
  -- Row-level locking to prevent race conditions during redemption
  SELECT * INTO v_rec
  FROM public.oauth_codes
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_grant: authorization code not found';
  END IF;

  IF v_rec.used THEN
    RAISE EXCEPTION 'invalid_grant: authorization code already used (replay detected)';
  END IF;

  IF v_rec.expires_at < (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint THEN
    RAISE EXCEPTION 'invalid_grant: authorization code has expired';
  END IF;

  IF v_rec.client_id <> p_client_id THEN
    RAISE EXCEPTION 'invalid_grant: client_id mismatch';
  END IF;

  IF v_rec.redirect_uri <> p_redirect_uri THEN
    RAISE EXCEPTION 'invalid_grant: redirect_uri mismatch';
  END IF;

  -- Mark atomically consumed
  UPDATE public.oauth_codes
  SET used = TRUE
  WHERE code = p_code;

  RETURN QUERY SELECT v_rec.user_id, v_rec.scope, v_rec.nonce, v_rec.code_challenge, v_rec.code_challenge_method;
END;
$$;

-- ============================================================================
-- 4. COURSES, MODULES, BATCHES & SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.courses (
  id VARCHAR(64) PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  certification_type VARCHAR(32) NOT NULL CHECK (certification_type IN ('ASP', 'CSP', 'CRSP', 'CIT', 'NEBOSH_IDIP', 'CUSTOM')),
  delivery_model VARCHAR(32) NOT NULL DEFAULT 'HYBRID' CHECK (delivery_model IN ('RECORDED', 'LIVE', 'HYBRID', 'MATERIALS_ONLY')),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED')),
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  learning_objectives TEXT[] NOT NULL DEFAULT '{}',
  prerequisites TEXT[] NOT NULL DEFAULT '{}',
  price_inr INT NOT NULL DEFAULT 0 CHECK (price_inr >= 0),
  price_usd INT NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
  duration_weeks INT NOT NULL DEFAULT 8,
  cover_image TEXT NOT NULL,
  lead_instructor_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  co_instructor_ids TEXT[] DEFAULT '{}',
  moodle_course_id INT,
  modules_count INT NOT NULL DEFAULT 0,
  total_lessons INT NOT NULL DEFAULT 0,
  total_hours INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.batches (
  id VARCHAR(64) PRIMARY KEY,
  course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  schedule_description TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 30 CHECK (capacity > 0),
  enrolled_count INT NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  lead_instructor_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_batch_capacity CHECK (enrolled_count <= capacity)
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id VARCHAR(64) PRIMARY KEY,
  course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_title TEXT NOT NULL,
  title TEXT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 45,
  video_url TEXT,
  downloadable_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_html TEXT,
  is_free_preview BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id VARCHAR(64) PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduled_start_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 120,
  instructor_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  meeting_id VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'LIVE', 'ENDED', 'RECORDING_READY')),
  recording_url TEXT,
  recording_duration_minutes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL,
  left_at TIMESTAMPTZ,
  duration_minutes INT NOT NULL DEFAULT 0,
  attended BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. ENROLLMENTS & CERTIFICATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enrollments (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  completed_lesson_ids TEXT[] NOT NULL DEFAULT '{}',
  idempotency_key VARCHAR(128) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_course_batch UNIQUE (user_id, course_id, batch_id)
);

CREATE TABLE IF NOT EXISTS public.certificates (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_number VARCHAR(64) NOT NULL UNIQUE,
  verification_code VARCHAR(64) NOT NULL UNIQUE,
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score_percent INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. EXAM SIMULATION ENGINE (Answer Key & Grading Integrity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.exam_blueprints (
  id VARCHAR(64) PRIMARY KEY,
  certification_type VARCHAR(32) NOT NULL CHECK (certification_type IN ('ASP', 'CSP', 'CRSP', 'CIT', 'NEBOSH_IDIP', 'CUSTOM')),
  title TEXT NOT NULL,
  total_questions INT NOT NULL DEFAULT 100,
  duration_minutes INT NOT NULL DEFAULT 180,
  passing_score_percent INT NOT NULL DEFAULT 70,
  domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_questions (
  id VARCHAR(64) PRIMARY KEY,
  certification_type VARCHAR(32) NOT NULL CHECK (certification_type IN ('ASP', 'CSP', 'CRSP', 'CIT', 'NEBOSH_IDIP', 'CUSTOM')),
  domain TEXT NOT NULL,
  topic TEXT NOT NULL,
  stem TEXT NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'MULTIPLE_CHOICE' CHECK (type IN ('MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'SCENARIO_BASED', 'CALCULATION')),
  difficulty VARCHAR(16) NOT NULL DEFAULT 'MODERATE' CHECK (difficulty IN ('EASY', 'MODERATE', 'HARD')),
  options JSONB NOT NULL,
  correct_option_ids TEXT[] NOT NULL, -- PROTECTED: Server-Authoritative Answer Key
  explanation TEXT NOT NULL,          -- PROTECTED: Post-Exam Review Only
  reference_source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sanitized view for exam delivery (Completely strips correct_option_ids and explanations)
CREATE OR REPLACE VIEW public.learner_exam_questions AS
SELECT 
  id,
  certification_type,
  domain,
  topic,
  stem,
  type,
  difficulty,
  options
FROM public.exam_questions;

CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blueprint_id VARCHAR(64) NOT NULL REFERENCES public.exam_blueprints(id) ON DELETE CASCADE,
  certification_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'EXPIRED')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_time TIMESTAMPTZ NOT NULL,
  completed_time TIMESTAMPTZ,
  assigned_question_ids TEXT[] NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  bookmarked_question_ids TEXT[] NOT NULL DEFAULT '{}',
  total_score INT,
  passing_score_percent INT NOT NULL,
  passed BOOLEAN,
  domain_breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. AUDIT TRAILS & GOVERNANCE LOGS (Append-Only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id VARCHAR(64) NOT NULL,
  actor_email TEXT NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.config_audits (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id VARCHAR(64) NOT NULL,
  actor_email TEXT NOT NULL,
  section VARCHAR(32) NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  change_reason TEXT,
  version INT NOT NULL DEFAULT 1,
  is_rollback BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_courses_slug ON public.courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status) WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_courses_cert ON public.courses(certification_type);

CREATE INDEX IF NOT EXISTS idx_batches_course_id ON public.batches(course_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON public.batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_instructor ON public.batches(lead_instructor_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_batch_id ON public.enrollments(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);

CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON public.lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_batch ON public.live_sessions(batch_id);

CREATE INDEX IF NOT EXISTS idx_exam_questions_cert ON public.exam_questions(certification_type);
CREATE INDEX IF NOT EXISTS idx_exam_questions_domain ON public.exam_questions(domain);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON public.exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON public.exam_attempts(status);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON public.certificates(verification_code);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES — HARDENED ACCESS CONTROL
-- ============================================================================

-- Enable RLS across every domain table
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_audits ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Public Read Policies (Anonymous and Authenticated Catalog Access)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read branding theme" ON public.branding_theme;
CREATE POLICY "Public read branding theme" 
  ON public.branding_theme FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Public read feature flags" ON public.feature_flags;
CREATE POLICY "Public read feature flags" 
  ON public.feature_flags FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Public read navigation items" ON public.navigation_items;
CREATE POLICY "Public read navigation items" 
  ON public.navigation_items FOR SELECT 
  USING (is_visible = true);

DROP POLICY IF EXISTS "Public read published courses" ON public.courses;
CREATE POLICY "Public read published courses" 
  ON public.courses FOR SELECT 
  USING (status = 'PUBLISHED');

DROP POLICY IF EXISTS "Public read active upcoming batches" ON public.batches;
CREATE POLICY "Public read active upcoming batches" 
  ON public.batches FOR SELECT 
  USING (status IN ('UPCOMING', 'ACTIVE'));

DROP POLICY IF EXISTS "Public verify certificates" ON public.certificates;
CREATE POLICY "Public verify certificates" 
  ON public.certificates FOR SELECT 
  USING (status = 'ISSUED');

DROP POLICY IF EXISTS "Public read roles definitions" ON public.roles;
CREATE POLICY "Public read roles definitions" 
  ON public.roles FOR SELECT 
  USING (true);

-- ----------------------------------------------------------------------------
-- User Profiles Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Learners read own profile" ON public.users;
CREATE POLICY "Learners read own profile" 
  ON public.users FOR SELECT 
  USING (id = public.current_user_id() OR public.is_admin());

DROP POLICY IF EXISTS "Learners update own profile" ON public.users;
CREATE POLICY "Learners update own profile" 
  ON public.users FOR UPDATE 
  USING (id = public.current_user_id())
  WITH CHECK (id = public.current_user_id() AND role = (SELECT u.role FROM public.users u WHERE u.id = id));

-- ----------------------------------------------------------------------------
-- Learner Isolation Policies (Defense-in-Depth)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Learner view own enrollments" ON public.enrollments;
CREATE POLICY "Learner view own enrollments" 
  ON public.enrollments FOR SELECT 
  USING (user_id = public.current_user_id() OR public.is_admin());

DROP POLICY IF EXISTS "Learner view enrolled lessons" ON public.lessons;
CREATE POLICY "Learner view enrolled lessons" 
  ON public.lessons FOR SELECT 
  USING (
    is_free_preview = true 
    OR EXISTS (
      SELECT 1 FROM public.enrollments e 
      WHERE e.course_id = lessons.course_id 
      AND e.user_id = public.current_user_id() 
      AND e.status = 'ACTIVE'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Learner view enrolled live sessions" ON public.live_sessions;
CREATE POLICY "Learner view enrolled live sessions" 
  ON public.live_sessions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e 
      WHERE e.batch_id = live_sessions.batch_id 
      AND e.user_id = public.current_user_id() 
      AND e.status = 'ACTIVE'
    )
    OR instructor_id = public.current_user_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Learner view own attendance" ON public.attendance_records;
CREATE POLICY "Learner view own attendance" 
  ON public.attendance_records FOR SELECT 
  USING (user_id = public.current_user_id() OR public.is_admin());

DROP POLICY IF EXISTS "Learner record own attendance" ON public.attendance_records;
CREATE POLICY "Learner record own attendance" 
  ON public.attendance_records FOR INSERT 
  WITH CHECK (user_id = public.current_user_id());

-- Exam Blueprints: Candidate visibility
DROP POLICY IF EXISTS "Candidate view blueprints" ON public.exam_blueprints;
CREATE POLICY "Candidate view blueprints" 
  ON public.exam_blueprints FOR SELECT 
  USING (true);

-- Exam Questions: Raw table is shielded. Learner can only query via learner_exam_questions view.
DROP POLICY IF EXISTS "Raw exam questions admin and instructor only" ON public.exam_questions;
CREATE POLICY "Raw exam questions admin and instructor only" 
  ON public.exam_questions FOR SELECT 
  USING (
    public.is_admin() 
    OR public.current_user_role() IN ('INSTRUCTOR', 'COURSE_MANAGER')
  );

-- Exam Attempts: Candidate can only insert in-progress attempts with NO self-assigned scores
DROP POLICY IF EXISTS "Learner view own attempts" ON public.exam_attempts;
CREATE POLICY "Learner view own attempts" 
  ON public.exam_attempts FOR SELECT 
  USING (user_id = public.current_user_id() OR public.is_admin());

DROP POLICY IF EXISTS "Learner start in-progress attempt" ON public.exam_attempts;
CREATE POLICY "Learner start in-progress attempt" 
  ON public.exam_attempts FOR INSERT 
  WITH CHECK (
    user_id = public.current_user_id()
    AND status = 'IN_PROGRESS'
    AND total_score IS NULL
    AND passed IS NULL
  );

DROP POLICY IF EXISTS "Learner save in-progress answers" ON public.exam_attempts;
CREATE POLICY "Learner save in-progress answers" 
  ON public.exam_attempts FOR UPDATE 
  USING (
    user_id = public.current_user_id() 
    AND status = 'IN_PROGRESS'
  )
  WITH CHECK (
    user_id = public.current_user_id()
    AND status = 'IN_PROGRESS'
    AND total_score IS NULL
    AND passed IS NULL
  );

-- ----------------------------------------------------------------------------
-- Instructor Policies (Scoped strictly to assigned cohorts)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Instructor view assigned batches" ON public.batches;
CREATE POLICY "Instructor view assigned batches" 
  ON public.batches FOR ALL 
  USING (lead_instructor_id = public.current_user_id() OR public.is_admin());

DROP POLICY IF EXISTS "Instructor manage assigned live sessions" ON public.live_sessions;
CREATE POLICY "Instructor manage assigned live sessions" 
  ON public.live_sessions FOR ALL 
  USING (instructor_id = public.current_user_id() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- OAuth Codes Isolation (Zero Client Access)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "OAuth codes service role only" ON public.oauth_codes;
CREATE POLICY "OAuth codes service role only" 
  ON public.oauth_codes FOR ALL 
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- Audit Trails & Config Governance (Append-Only, No Modification/Deletion)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Audit logs admin view" ON public.audit_logs;
CREATE POLICY "Audit logs admin view" 
  ON public.audit_logs FOR SELECT 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Audit logs append only" ON public.audit_logs;
CREATE POLICY "Audit logs append only" 
  ON public.audit_logs FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Config audits admin view" ON public.config_audits;
CREATE POLICY "Config audits admin view" 
  ON public.config_audits FOR SELECT 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Config audits append only" ON public.config_audits;
CREATE POLICY "Config audits append only" 
  ON public.config_audits FOR INSERT 
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Administrative Master Governance
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin manage platform settings" ON public.platform_settings;
CREATE POLICY "Admin manage platform settings" 
  ON public.platform_settings FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage branding theme" ON public.branding_theme;
CREATE POLICY "Admin manage branding theme" 
  ON public.branding_theme FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage feature flags" ON public.feature_flags;
CREATE POLICY "Admin manage feature flags" 
  ON public.feature_flags FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage navigation items" ON public.navigation_items;
CREATE POLICY "Admin manage navigation items" 
  ON public.navigation_items FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage roles" ON public.roles;
CREATE POLICY "Admin manage roles" 
  ON public.roles FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage users" ON public.users;
CREATE POLICY "Admin manage users" 
  ON public.users FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage courses" ON public.courses;
CREATE POLICY "Admin manage courses" 
  ON public.courses FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage enrollments" ON public.enrollments;
CREATE POLICY "Admin manage enrollments" 
  ON public.enrollments FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage certificates" ON public.certificates;
CREATE POLICY "Admin manage certificates" 
  ON public.certificates FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage exam blueprints" ON public.exam_blueprints;
CREATE POLICY "Admin manage exam blueprints" 
  ON public.exam_blueprints FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage exam questions" ON public.exam_questions;
CREATE POLICY "Admin manage exam questions" 
  ON public.exam_questions FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin finalize exam attempts" ON public.exam_attempts;
CREATE POLICY "Admin finalize exam attempts" 
  ON public.exam_attempts FOR ALL 
  USING (public.is_admin());

-- ============================================================================
-- 10. LEAST-PRIVILEGE POSTGRESQL OBJECT GRANTS (No Blanket Permissions)
-- ============================================================================

-- Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 1. Unauthenticated Role ('anon'): Read-only on strictly public assets
GRANT SELECT ON public.branding_theme TO anon;
GRANT SELECT ON public.feature_flags TO anon;
GRANT SELECT ON public.navigation_items TO anon;
GRANT SELECT ON public.courses TO anon;
GRANT SELECT ON public.batches TO anon;
GRANT SELECT ON public.certificates TO anon;
GRANT SELECT ON public.public_platform_settings TO anon;

-- 2. Authenticated Role ('authenticated'): Granular per-entity access
GRANT SELECT ON public.branding_theme TO authenticated;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT SELECT ON public.navigation_items TO authenticated;
GRANT SELECT ON public.courses TO authenticated;
GRANT SELECT ON public.batches TO authenticated;
GRANT SELECT ON public.certificates TO authenticated;
GRANT SELECT ON public.public_platform_settings TO authenticated;
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.lessons TO authenticated;
GRANT SELECT ON public.live_sessions TO authenticated;
GRANT SELECT, INSERT ON public.attendance_records TO authenticated;
GRANT SELECT ON public.enrollments TO authenticated;
GRANT SELECT ON public.exam_blueprints TO authenticated;
GRANT SELECT ON public.learner_exam_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exam_attempts TO authenticated;

-- Routine Execution: Permit redemption function exclusively to service_role
GRANT EXECUTE ON FUNCTION public.current_user_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.redeem_oauth_code(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_oauth_code(TEXT, TEXT, TEXT) TO service_role;

-- 3. Service Role ('service_role'): Authoritative backend server access
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Explicitly revoke destructive privileges on audit tables from ordinary roles
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.config_audits FROM PUBLIC, anon, authenticated;

-- Explicitly revoke access to oauth_codes from public and authenticated clients
REVOKE ALL ON public.oauth_codes FROM PUBLIC, anon, authenticated;

-- Explicitly revoke access to raw exam questions answer keys from ordinary authenticated learners
REVOKE ALL ON public.exam_questions FROM PUBLIC, anon;

COMMIT;
