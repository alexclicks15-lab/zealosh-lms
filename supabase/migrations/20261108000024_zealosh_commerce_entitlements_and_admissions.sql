-- Zealosh LMS — Authoritative Database Migration
-- Phase 8 / Track 2: Commerce Decoupling, Server-Authoritative Entitlements & 14-Stage Admissions Pipeline
-- File: supabase/migrations/20261108000024_zealosh_commerce_entitlements_and_admissions.sql

-- ============================================================================
-- 1. COMMERCIAL PRODUCTS & PRODUCT OFFERINGS (Decoupled from Academic Courses)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('prod-' || gen_random_uuid()::TEXT),
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_course_id ON public.products(course_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_select_published'
  ) THEN
    CREATE POLICY products_select_published ON public.products
      FOR SELECT
      USING (status = 'PUBLISHED' OR auth.role() = 'service_role');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_offerings (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('offering-' || gen_random_uuid()::TEXT),
    product_id VARCHAR(64) NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    offering_type VARCHAR(64) NOT NULL DEFAULT 'COMPLETE',
    price_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    price_usd NUMERIC(12,2) DEFAULT 0.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    validity_days INT NOT NULL DEFAULT 365,
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    included_entitlements JSONB NOT NULL DEFAULT '["ALL"]'::jsonb,
    requires_admission_review BOOLEAN NOT NULL DEFAULT FALSE,
    features_list JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_offerings_product_id ON public.product_offerings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_offerings_course_id ON public.product_offerings(course_id);
CREATE INDEX IF NOT EXISTS idx_product_offerings_type ON public.product_offerings(offering_type);
CREATE INDEX IF NOT EXISTS idx_product_offerings_status ON public.product_offerings(status);

ALTER TABLE public.product_offerings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_offerings' AND policyname = 'offerings_select_published'
  ) THEN
    CREATE POLICY offerings_select_published ON public.product_offerings
      FOR SELECT
      USING (status = 'PUBLISHED' OR auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- 2. SERVER-AUTHORITATIVE USER ENTITLEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_entitlements (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('ent-' || gen_random_uuid()::TEXT),
    user_id TEXT NOT NULL,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    offering_id VARCHAR(64) REFERENCES public.product_offerings(id) ON DELETE SET NULL,
    feature_scope VARCHAR(64) NOT NULL DEFAULT 'ALL',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    source_order_id TEXT,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user_id ON public.user_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_course_id ON public.user_entitlements(course_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_scope ON public.user_entitlements(user_id, course_id, feature_scope);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_validity ON public.user_entitlements(user_id, status, valid_until);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_entitlements' AND policyname = 'entitlements_select_own'
  ) THEN
    CREATE POLICY entitlements_select_own ON public.user_entitlements
      FOR SELECT
      USING (user_id = auth.uid()::TEXT OR auth.role() = 'service_role');
  END IF;
END $$;

-- Atomic entitlement evaluation function
CREATE OR REPLACE FUNCTION public.evaluate_user_entitlement(
    p_user_id TEXT,
    p_course_id TEXT,
    p_feature_scope TEXT,
    p_at_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_access BOOLEAN := FALSE;
    v_valid_until TIMESTAMPTZ := NULL;
    v_active_count INT := 0;
BEGIN
    SELECT 
        COUNT(*) > 0,
        MAX(valid_until),
        COUNT(*)
    INTO 
        v_has_access,
        v_valid_until,
        v_active_count
    FROM public.user_entitlements
    WHERE user_id = p_user_id
      AND course_id = p_course_id
      AND status = 'ACTIVE'
      AND (feature_scope = 'ALL' OR feature_scope = p_feature_scope)
      AND valid_from <= p_at_time
      AND valid_until > p_at_time
      AND revoked_at IS NULL;

    RETURN jsonb_build_object(
        'hasAccess', v_has_access,
        'featureScope', p_feature_scope,
        'validUntil', v_valid_until,
        'activeCount', v_active_count,
        'evaluatedAt', p_at_time
    );
END;
$$;

-- ============================================================================
-- 3. PUBLIC LEADS & ADMISSIONS CRM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.leads (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('lead-' || gen_random_uuid()::TEXT),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    course_interest TEXT,
    offering_interest TEXT,
    source TEXT NOT NULL DEFAULT 'WEBSITE',
    campaign TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'NEW',
    assigned_to TEXT,
    notes TEXT,
    converted_application_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_course_interest ON public.leads(course_interest);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_insert_public'
  ) THEN
    CREATE POLICY leads_insert_public ON public.leads
      FOR INSERT
      WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_admin_all'
  ) THEN
    CREATE POLICY leads_admin_all ON public.leads
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- 4. APPLICANT DOCUMENTS REVIEW QUEUE (With Historical Versioning)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.applicant_documents (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('appdoc-' || gen_random_uuid()::TEXT),
    application_id VARCHAR(64) NOT NULL,
    applicant_user_id TEXT,
    document_type VARCHAR(64) NOT NULL DEFAULT 'OTHER',
    media_asset_id VARCHAR(64) REFERENCES public.media_assets(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    status VARCHAR(32) NOT NULL DEFAULT 'UPLOADED',
    rejection_reason TEXT,
    reviewer_user_id TEXT,
    reviewed_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applicant_docs_app_id ON public.applicant_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_applicant_docs_status ON public.applicant_documents(status);

ALTER TABLE public.applicant_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'applicant_documents' AND policyname = 'applicant_docs_service_role'
  ) THEN
    CREATE POLICY applicant_docs_service_role ON public.applicant_documents
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- 5. ADMISSION OFFERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admission_offers (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('offer-' || gen_random_uuid()::TEXT),
    application_id VARCHAR(64) NOT NULL,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    offering_id VARCHAR(64) REFERENCES public.product_offerings(id) ON DELETE SET NULL,
    offered_price_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    valid_until TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ISSUED',
    issued_by TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    order_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admission_offers_app_id ON public.admission_offers(application_id);
CREATE INDEX IF NOT EXISTS idx_admission_offers_status ON public.admission_offers(status);

ALTER TABLE public.admission_offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admission_offers' AND policyname = 'offers_service_role'
  ) THEN
    CREATE POLICY offers_service_role ON public.admission_offers
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- 6. RESUMABLE POST-ADMISSION PROVISIONING SAGA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.provisioning_jobs (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('prov-' || gen_random_uuid()::TEXT),
    application_id VARCHAR(64),
    user_id TEXT NOT NULL,
    order_id TEXT,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64),
    offering_id VARCHAR(64),
    idempotency_key TEXT NOT NULL UNIQUE,
    correlation_id TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    current_step VARCHAR(64) NOT NULL DEFAULT 'RESOLVE_IDENTITY',
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_idempotency ON public.provisioning_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_status ON public.provisioning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_provisioning_jobs_user_id ON public.provisioning_jobs(user_id);

ALTER TABLE public.provisioning_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.provisioning_steps (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('pstep-' || gen_random_uuid()::TEXT),
    job_id VARCHAR(64) NOT NULL REFERENCES public.provisioning_jobs(id) ON DELETE CASCADE,
    step_name VARCHAR(64) NOT NULL,
    step_order INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    input_payload JSONB,
    output_payload JSONB,
    error_message TEXT,
    attempt_count INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provisioning_steps_job ON public.provisioning_steps(job_id, step_order);

ALTER TABLE public.provisioning_steps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'provisioning_jobs' AND policyname = 'provisioning_jobs_service_role'
  ) THEN
    CREATE POLICY provisioning_jobs_service_role ON public.provisioning_jobs
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'provisioning_steps' AND policyname = 'provisioning_steps_service_role'
  ) THEN
    CREATE POLICY provisioning_steps_service_role ON public.provisioning_steps
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- 7. SEED DEFAULT PRODUCTS & OFFERINGS FOR EXISTING COURSES
-- ============================================================================

INSERT INTO public.products (id, course_id, name, slug, description, status)
VALUES 
  ('prod-asp', 'crs-asp-01', 'Associate Safety Professional (ASP) Exam Prep', 'asp-prep', 'Comprehensive ASP preparation program with expert faculty and high-fidelity exam engine.', 'PUBLISHED'),
  ('prod-csp', 'crs-csp-02', 'Certified Safety Professional (CSP) Exam Prep', 'csp-prep', 'Advanced CSP prep including risk management, industrial hygiene, and ergonomics.', 'PUBLISHED'),
  ('prod-crsp', 'crs-crsp-03', 'Canadian Registered Safety Professional (CRSP)', 'crsp-prep', 'Canadian HSE legislation and standards preparation program.', 'PUBLISHED')
ON CONFLICT (slug) DO NOTHING;

-- Seed Offerings: Complete, Video-Only, Question-Bank-Only
INSERT INTO public.product_offerings (
  id, product_id, course_id, title, offering_type, price_inr, price_usd, currency, validity_days, status, included_entitlements, requires_admission_review, features_list
)
VALUES
  (
    'offering-asp-complete',
    'prod-asp',
    'crs-asp-01',
    'ASP Complete Certification Package',
    'COMPLETE',
    28000.00,
    399.00,
    'INR',
    365,
    'PUBLISHED',
    '["ALL"]'::jsonb,
    FALSE,
    '["Live Interactive Weekend Classes", "Full Video Lesson Archive", "Downloadable Reference Documents", "1,500+ Question Bank & Explanations", "10 High-Stakes Proctored Mock Exams", "Dedicated Faculty Doubt Clearance"]'::jsonb
  ),
  (
    'offering-asp-video',
    'prod-asp',
    'crs-asp-01',
    'ASP Recorded Theory & Lessons',
    'VIDEO_ONLY',
    16000.00,
    220.00,
    'INR',
    180,
    'PUBLISHED',
    '["VIDEO_LESSONS"]'::jsonb,
    FALSE,
    '["Complete Video Lesson Archive", "Module Progress Tracking", "Stream on Any Device"]'::jsonb
  ),
  (
    'offering-asp-qbank',
    'prod-asp',
    'crs-asp-01',
    'ASP High-Stakes Question Bank & Mocks',
    'QUESTION_BANK_ONLY',
    9500.00,
    130.00,
    'INR',
    120,
    'PUBLISHED',
    '["QUESTION_BANK", "MOCK_EXAMS"]'::jsonb,
    FALSE,
    '["1,500+ Domain Questions", "Detailed Answer Rationale", "10 Timed Mock Exams", "Competency Diagnostics"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

