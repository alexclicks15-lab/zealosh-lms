-- ============================================================================
-- ZEALOSH LMS — PHASE 1: CORE FOUNDATIONS MIGRATION
-- Migration: 20261030000008_zealosh_phase1_foundations.sql
-- Architecture: ADR-002 (Server-Side Authoritative & Defense-in-Depth RLS)
-- Target: Core Hub Project 1 (PostgreSQL 17)
-- Workstreams:
--   1. Supabase Auth & Application Profiles (profiles, student_profiles, instructor_profiles, user_roles)
--   2. Relational Academic Hierarchy (academic_years, departments, programmes, modules, topics, subtopics)
--   3. Admissions & Student Lifecycle (admission_applications, application_documents, enrollment_transfers, enrollment_withdrawals)
-- Standards: OWASP Top 10, Least Privilege, Zero Cross-Tenant Artifacts (Single-Institution Model)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. WORKSTREAM 1: PROFILES & MULTI-ROLE RECONCILIATION
-- ============================================================================

-- Application Profile Table (Links to auth.users.id)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION')),
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student-Specific Profiles
CREATE TABLE IF NOT EXISTS public.student_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL UNIQUE,
    emergency_contact TEXT,
    educational_background TEXT,
    professional_affiliation TEXT,
    id_card_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Instructor-Specific Profiles
CREATE TABLE IF NOT EXISTS public.instructor_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL UNIQUE,
    biography TEXT,
    specializations TEXT[] NOT NULL DEFAULT '{}',
    credentials TEXT[] NOT NULL DEFAULT '{}',
    office_hours TEXT,
    max_weekly_hours INT NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Multi-Role Assignment Table (Decouples single user string to multi-role capabilities)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id VARCHAR(64) PRIMARY KEY,
    user_id TEXT NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF')),
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by TEXT,
    CONSTRAINT uq_user_role UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ============================================================================
-- 2. WORKSTREAM 2: RELATIONAL ACADEMIC HIERARCHY
-- ============================================================================

-- Academic Years
CREATE TABLE IF NOT EXISTS public.academic_years (
    id VARCHAR(64) PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- e.g. "2026-2027"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNING' CHECK (status IN ('PLANNING', 'ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_academic_year_dates CHECK (end_date > start_date)
);

-- Academic Departments / Divisions
CREATE TABLE IF NOT EXISTS public.departments (
    id VARCHAR(64) PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- e.g. "Occupational Health & Safety"
    code VARCHAR(32) NOT NULL UNIQUE, -- e.g. "OHS"
    description TEXT,
    head_instructor_id TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Academic Programmes
CREATE TABLE IF NOT EXISTS public.programmes (
    id VARCHAR(64) PRIMARY KEY,
    department_id VARCHAR(64) NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    name TEXT NOT NULL, -- e.g. "HSE Professional Certification"
    code VARCHAR(32) NOT NULL UNIQUE, -- e.g. "HSE-PRO"
    description TEXT,
    duration_months INT NOT NULL DEFAULT 12 CHECK (duration_months > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Course Modules (Normalizes course curriculum)
CREATE TABLE IF NOT EXISTS public.modules (
    id VARCHAR(64) PRIMARY KEY,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    delivery_mode VARCHAR(32) NOT NULL DEFAULT 'HYBRID' CHECK (delivery_mode IN ('RECORDED', 'LIVE', 'HYBRID', 'MATERIALS_ONLY')),
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Module Topics
CREATE TABLE IF NOT EXISTS public.topics (
    id VARCHAR(64) PRIMARY KEY,
    module_id VARCHAR(64) NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Topic Subtopics
CREATE TABLE IF NOT EXISTS public.subtopics (
    id VARCHAR(64) PRIMARY KEY,
    topic_id VARCHAR(64) NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment on existing academic tables
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS department_id VARCHAR(64) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS programme_id VARCHAR(64) REFERENCES public.programmes(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS academic_year_id VARCHAR(64) REFERENCES public.academic_years(id) ON DELETE SET NULL;

ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS module_id VARCHAR(64) REFERENCES public.modules(id) ON DELETE SET NULL;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS topic_id VARCHAR(64) REFERENCES public.topics(id) ON DELETE SET NULL;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS subtopic_id VARCHAR(64) REFERENCES public.subtopics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_academic_years_status ON public.academic_years(status);
CREATE INDEX IF NOT EXISTS idx_departments_code ON public.departments(code);
CREATE INDEX IF NOT EXISTS idx_programmes_dept ON public.programmes(department_id);
CREATE INDEX IF NOT EXISTS idx_modules_course ON public.modules(course_id);
CREATE INDEX IF NOT EXISTS idx_topics_module ON public.topics(module_id);
CREATE INDEX IF NOT EXISTS idx_subtopics_topic ON public.subtopics(topic_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON public.lessons(module_id);

-- ============================================================================
-- 3. WORKSTREAM 3: ADMISSIONS & STUDENT LIFECYCLE
-- ============================================================================

-- Formal Admission Applications
CREATE TABLE IF NOT EXISTS public.admission_applications (
    id VARCHAR(64) PRIMARY KEY,
    user_id TEXT,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_phone TEXT,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
    preferred_batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL,
    statement_of_purpose TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_enrollment_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admission Application Supporting Documents
CREATE TABLE IF NOT EXISTS public.application_documents (
    id VARCHAR(64) PRIMARY KEY,
    application_id VARCHAR(64) NOT NULL REFERENCES public.admission_applications(id) ON DELETE CASCADE,
    document_type VARCHAR(32) NOT NULL CHECK (document_type IN ('ID_PROOF', 'DEGREE_CERTIFICATE', 'EXPERIENCE_LETTER', 'OTHER')),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
    mime_type VARCHAR(128) NOT NULL DEFAULT 'application/pdf',
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE
);

-- Cohort / Batch Transfers (Concurrency-safe transfer tracking)
CREATE TABLE IF NOT EXISTS public.enrollment_transfers (
    id VARCHAR(64) PRIMARY KEY,
    enrollment_id VARCHAR(64) NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    course_id VARCHAR(64) NOT NULL,
    source_batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
    target_batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    transferred_by TEXT NOT NULL,
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REVERTED'))
);

-- Student Academic Withdrawals
CREATE TABLE IF NOT EXISTS public.enrollment_withdrawals (
    id VARCHAR(64) PRIMARY KEY,
    enrollment_id VARCHAR(64) NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    course_id VARCHAR(64) NOT NULL,
    batch_id VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    withdrawn_by TEXT NOT NULL,
    withdrawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_date DATE NOT NULL
);

ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS admission_application_id VARCHAR(64) REFERENCES public.admission_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admissions_course ON public.admission_applications(course_id);
CREATE INDEX IF NOT EXISTS idx_admissions_email ON public.admission_applications(applicant_email);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON public.admission_applications(status);
CREATE INDEX IF NOT EXISTS idx_app_documents_app ON public.application_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_transfers_enrollment ON public.enrollment_transfers(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_enrollment ON public.enrollment_withdrawals(enrollment_id);

-- ============================================================================
-- 4. DETERMINISTIC LEGACY LESSON MODULE MIGRATION PROCEDURE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.migrate_legacy_lesson_modules()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rec RECORD;
    v_module_id VARCHAR(64);
    v_migrated_count INT := 0;
BEGIN
    FOR v_rec IN 
        SELECT DISTINCT course_id, module_title 
        FROM public.lessons 
        WHERE module_title IS NOT NULL AND module_title <> '' AND module_id IS NULL
    LOOP
        v_module_id := 'mod-' || substr(md5(v_rec.course_id || ':' || v_rec.module_title), 1, 16);
        
        -- Insert module if not existing
        INSERT INTO public.modules (id, course_id, title, description, display_order, status)
        VALUES (v_module_id, v_rec.course_id, v_rec.module_title, 'Migrated from legacy lessons', 0, 'ACTIVE')
        ON CONFLICT (id) DO NOTHING;
        
        -- Update lessons
        UPDATE public.lessons
        SET module_id = v_module_id
        WHERE course_id = v_rec.course_id AND module_title = v_rec.module_title AND module_id IS NULL;
        
        v_migrated_count := v_migrated_count + 1;
    END LOOP;
    
    RETURN v_migrated_count;
END;
$$;

-- ============================================================================
-- 5. ATOMIC BATCH TRANSFER STORED PROCEDURE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transfer_student_batch_atomic(
    p_enrollment_id TEXT,
    p_target_batch_id TEXT,
    p_reason TEXT,
    p_actor_id TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    transfer_id VARCHAR(64),
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enrollment public.enrollments%ROWTYPE;
    v_source_batch public.batches%ROWTYPE;
    v_target_batch public.batches%ROWTYPE;
    v_transfer_id VARCHAR(64);
BEGIN
    -- Row-level lock on enrollment
    SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::VARCHAR(64), 'Enrollment not found';
        RETURN;
    END IF;

    IF v_enrollment.status <> 'ACTIVE' THEN
        RETURN QUERY SELECT false, NULL::VARCHAR(64), 'Cannot transfer inactive enrollment';
        RETURN;
    END IF;

    IF v_enrollment.batch_id = p_target_batch_id THEN
        RETURN QUERY SELECT false, NULL::VARCHAR(64), 'Student is already enrolled in target batch';
        RETURN;
    END IF;

    -- Row-level lock on source batch
    SELECT * INTO v_source_batch FROM public.batches WHERE id = v_enrollment.batch_id FOR UPDATE;
    
    -- Row-level lock on target batch
    SELECT * INTO v_target_batch FROM public.batches WHERE id = p_target_batch_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::VARCHAR(64), 'Target batch not found';
        RETURN;
    END IF;

    IF v_target_batch.course_id <> v_enrollment.course_id THEN
        RETURN QUERY SELECT false, NULL::VARCHAR(64), 'Target batch belongs to a different course';
        RETURN;
    END IF;

    IF v_target_batch.status = 'CANCELLED' OR v_target_batch.status = 'COMPLETED' THEN
        RETURN QUERY SELECT false, NULL::VARCHAR(64), 'Target batch is not accepting transfers';
        RETURN;
    END IF;

    -- Check target batch capacity
    IF v_target_batch.enrolled_count >= v_target_batch.capacity THEN
        RETURN QUERY SELECT false, NULL::VARCHAR(64), 'Target batch capacity reached';
        RETURN;
    END IF;

    -- Update batch counters
    UPDATE public.batches
    SET enrolled_count = GREATEST(enrolled_count - 1, 0), updated_at = NOW()
    WHERE id = v_source_batch.id;

    UPDATE public.batches
    SET enrolled_count = enrolled_count + 1, updated_at = NOW()
    WHERE id = v_target_batch.id;

    -- Update enrollment record
    UPDATE public.enrollments
    SET batch_id = p_target_batch_id, updated_at = NOW()
    WHERE id = p_enrollment_id;

    -- Record transfer log
    v_transfer_id := 'xfer-' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
    INSERT INTO public.enrollment_transfers (
        id, enrollment_id, user_id, course_id, source_batch_id, target_batch_id, reason, transferred_by, transferred_at, status
    ) VALUES (
        v_transfer_id, p_enrollment_id, v_enrollment.user_id, v_enrollment.course_id, v_source_batch.id, p_target_batch_id, p_reason, p_actor_id, NOW(), 'COMPLETED'
    );

    RETURN QUERY SELECT true, v_transfer_id, NULL::TEXT;
END;
$$;

-- ============================================================================
-- 6. ROW-LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_withdrawals ENABLE ROW LEVEL SECURITY;

-- Profiles: Users read own profile; Admins read all
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (id::text = public.current_user_id() OR public.is_admin());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (id::text = public.current_user_id() OR public.is_admin());
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- Academic Hierarchy: Public/enrolled read published structure; Staff manage
CREATE POLICY "Public read academic years" ON public.academic_years FOR SELECT USING (true);
CREATE POLICY "Staff manage academic years" ON public.academic_years FOR ALL USING (public.is_admin());

CREATE POLICY "Public read departments" ON public.departments FOR SELECT USING (status = 'ACTIVE' OR public.is_admin());
CREATE POLICY "Staff manage departments" ON public.departments FOR ALL USING (public.is_admin());

CREATE POLICY "Public read programmes" ON public.programmes FOR SELECT USING (status = 'ACTIVE' OR public.is_admin());
CREATE POLICY "Staff manage programmes" ON public.programmes FOR ALL USING (public.is_admin());

CREATE POLICY "Public read modules" ON public.modules FOR SELECT USING (true);
CREATE POLICY "Staff manage modules" ON public.modules FOR ALL USING (public.is_admin());

CREATE POLICY "Public read topics" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Staff manage topics" ON public.topics FOR ALL USING (public.is_admin());

CREATE POLICY "Public read subtopics" ON public.subtopics FOR SELECT USING (true);
CREATE POLICY "Staff manage subtopics" ON public.subtopics FOR ALL USING (public.is_admin());

-- Admissions: Applicants view/create own application; Staff review and manage
CREATE POLICY "Applicants view own application" ON public.admission_applications FOR SELECT 
    USING (applicant_email = current_setting('request.jwt.claims', true)::jsonb ->> 'email' OR user_id = public.current_user_id() OR public.is_admin());
CREATE POLICY "Applicants submit application" ON public.admission_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff manage admissions" ON public.admission_applications FOR ALL USING (public.is_admin());

CREATE POLICY "Applicants view own documents" ON public.application_documents FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.admission_applications a WHERE a.id = application_id AND (a.user_id = public.current_user_id() OR public.is_admin())));
CREATE POLICY "Staff manage application documents" ON public.application_documents FOR ALL USING (public.is_admin());

COMMIT;

