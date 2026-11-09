-- ============================================================================
-- ZEALOSH LMS — TRACK 5: CERTIFICATION ROADMAP, REVIEWS, GAMIFICATION & GROWTH
-- Migration: 20261108000027_zealosh_career_testimonials_gamification_growth.sql
-- Architecture: Multi-Year HSE Career Certification Roadmaps,
--               Granular-Consent Student Reviews & Verified Achievement Showcases,
--               Asia/Kolkata Daily Streak & Durable Points Ledger Gamification,
--               Referral Attribution, Institutional Partner Registry & Alumni Directory
-- Standards: ADR-002 (Defense-in-Depth RLS), ADR-004 (Supabase Authoritative Source of Truth)
-- Brand: Zealosh Training & Consultants
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Certifications Catalogue (External Professional Certifications)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certifications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    awarding_org TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('BCSP', 'CRSP', 'NEBOSH', 'IOSH', 'OSHA', 'INSTITUTIONAL')),
    description TEXT NOT NULL,
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
    renewal_requirements TEXT,
    related_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certifications_cat ON public.certifications (category, status);

-- ----------------------------------------------------------------------------
-- 2. Career Pathways (Configurable Progression Blueprints)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.career_pathways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target_role TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_pathways_status ON public.career_pathways (status);

-- ----------------------------------------------------------------------------
-- 3. Career Pathway Stages (Ordered Milestones)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.career_pathway_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pathway_id UUID NOT NULL REFERENCES public.career_pathways(id) ON DELETE CASCADE,
    stage_order INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    certification_id TEXT NOT NULL REFERENCES public.certifications(id) ON DELETE RESTRICT,
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    estimated_months INT NOT NULL DEFAULT 6,
    prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pathway_stage_order UNIQUE (pathway_id, stage_order)
);

CREATE INDEX IF NOT EXISTS idx_pathway_stages_pathway ON public.career_pathway_stages (pathway_id);

-- ----------------------------------------------------------------------------
-- 4. Student Career Plans (Student-Owned Personal Plan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_career_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    pathway_id UUID NOT NULL REFERENCES public.career_pathways(id) ON DELETE RESTRICT,
    pathway_version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED')),
    target_completion_date DATE NOT NULL,
    notes TEXT,
    shared_with_tutor_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    tutor_guidance_notes TEXT,
    tutor_guidance_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_career_plans_student ON public.student_career_plans (student_id);
CREATE INDEX IF NOT EXISTS idx_student_career_plans_tutor ON public.student_career_plans (shared_with_tutor_id);

-- ----------------------------------------------------------------------------
-- 5. Student Career Milestones & External Exam Plans
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_career_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.student_career_plans(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.career_pathway_stages(id) ON DELETE RESTRICT,
    certification_id TEXT NOT NULL REFERENCES public.certifications(id) ON DELETE RESTRICT,
    target_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    completed_at TIMESTAMPTZ,
    evidence_id UUID,
    external_exam_plan JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_milestones_plan ON public.student_career_milestones (plan_id);

-- ----------------------------------------------------------------------------
-- 6. External Credential Evidence
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_credential_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES public.student_career_milestones(id) ON DELETE SET NULL,
    credential_name TEXT NOT NULL,
    issuing_body TEXT NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE,
    credential_number TEXT,
    document_asset_id UUID,
    verification_status TEXT NOT NULL DEFAULT 'SELF_REPORTED' CHECK (verification_status IN ('SELF_REPORTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'UNABLE_TO_VERIFY')),
    reviewed_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    audit_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credential_evidence_student ON public.external_credential_evidence (student_id);
CREATE INDEX IF NOT EXISTS idx_credential_evidence_status ON public.external_credential_evidence (verification_status);

-- ----------------------------------------------------------------------------
-- 7. Student Reviews
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    course_title TEXT NOT NULL,
    instructor_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    instructor_name TEXT,
    category TEXT NOT NULL CHECK (category IN ('COURSE', 'INSTRUCTOR', 'CLASSROOM', 'INSTITUTIONAL', 'ACHIEVEMENT_STORY')),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT NOT NULL,
    media_url TEXT,
    submission_status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (submission_status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'HIDDEN', 'CONSENT_REVOKED', 'ARCHIVED')),
    moderated_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMPTZ,
    moderation_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_reviews_course ON public.student_reviews (course_id, submission_status);
CREATE INDEX IF NOT EXISTS idx_student_reviews_student ON public.student_reviews (student_id);

-- ----------------------------------------------------------------------------
-- 8. Testimonial Consents (Granular Auditable Consent)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.testimonial_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.student_reviews(id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    consent_version TEXT NOT NULL DEFAULT '1.0',
    allow_internal_feedback BOOLEAN NOT NULL DEFAULT TRUE,
    allow_public_testimonial BOOLEAN NOT NULL DEFAULT FALSE,
    allow_public_display_name BOOLEAN NOT NULL DEFAULT FALSE,
    allow_public_photo BOOLEAN NOT NULL DEFAULT FALSE,
    allow_public_video BOOLEAN NOT NULL DEFAULT FALSE,
    allow_course_association BOOLEAN NOT NULL DEFAULT FALSE,
    allow_social_media BOOLEAN NOT NULL DEFAULT FALSE,
    allow_achievement_poster BOOLEAN NOT NULL DEFAULT FALSE,
    allow_promotional_campaign BOOLEAN NOT NULL DEFAULT FALSE,
    agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    revocation_reason TEXT,
    CONSTRAINT uq_review_consent UNIQUE (review_id)
);

CREATE INDEX IF NOT EXISTS idx_testimonial_consents_student ON public.testimonial_consents (student_id);

-- ----------------------------------------------------------------------------
-- 9. Achievement Showcases (Authorized Posters & Social Proof)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievement_showcases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    course_title TEXT NOT NULL,
    certificate_code TEXT NOT NULL,
    completion_date DATE NOT NULL,
    score_achieved INT,
    poster_image_url TEXT,
    consent_granted BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievement_showcases_student ON public.achievement_showcases (student_id);

-- ----------------------------------------------------------------------------
-- 10. Gamification Award Rules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gamification_rules (
    id TEXT PRIMARY KEY,
    activity_type TEXT NOT NULL UNIQUE,
    points INT NOT NULL DEFAULT 10,
    max_daily_frequency INT,
    cooldown_seconds INT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    policy_version TEXT NOT NULL DEFAULT '1.0',
    description TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 11. Points Ledger (Durable, Auditable XP Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source_event_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    points_awarded INT NOT NULL,
    award_reason TEXT NOT NULL,
    course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE SET NULL,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idempotency_key TEXT NOT NULL UNIQUE,
    policy_version TEXT NOT NULL DEFAULT '1.0',
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    awarded_by TEXT NOT NULL DEFAULT 'SYSTEM'
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_student ON public.points_ledger (student_id, earned_at);

-- ----------------------------------------------------------------------------
-- 12. Student Streaks (Asia/Kolkata Daily Boundary)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_streaks (
    student_id VARCHAR(64) PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_activity_date DATE,
    total_active_days INT NOT NULL DEFAULT 0,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 13. Badge Definitions & User Badge Awards
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.badge_definitions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('MILESTONE', 'STREAK', 'ASSESSMENT', 'COMMUNITY', 'MASTERY')),
    criteria_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.user_badge_awards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_event_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    awarded_by TEXT NOT NULL DEFAULT 'SYSTEM',
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_badge_awards_student ON public.user_badge_awards (student_id);

-- ----------------------------------------------------------------------------
-- 14. Referral Codes & Attribution Tracking
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    owner_user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    campaign_id UUID,
    target_course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
    expires_at TIMESTAMPTZ,
    click_count INT NOT NULL DEFAULT 0,
    conversion_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON public.referral_codes (owner_user_id);

CREATE TABLE IF NOT EXISTS public.referral_attributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_code TEXT NOT NULL,
    referrer_user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lead_id TEXT NOT NULL UNIQUE,
    application_id UUID,
    order_id UUID,
    status TEXT NOT NULL DEFAULT 'ATTRIBUTED' CHECK (status IN ('ATTRIBUTED', 'APPLICATION_SUBMITTED', 'CONVERTED', 'REJECTED')),
    attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    converted_at TIMESTAMPTZ,
    audit_trail JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_referrer ON public.referral_attributions (referrer_user_id);

-- ----------------------------------------------------------------------------
-- 15. Institutional Partners
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institutional_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_name TEXT NOT NULL,
    partner_type TEXT NOT NULL CHECK (partner_type IN ('ACADEMIC', 'CORPORATE', 'AGENCY')),
    contact_email TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    referral_code_id UUID REFERENCES public.referral_codes(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    agreement_ref TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 16. Institutional Marketing Campaigns
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institutional_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    objective TEXT NOT NULL,
    target_course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('WEB', 'EMAIL', 'PARTNER', 'SOCIAL')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED')),
    start_date DATE NOT NULL,
    end_date DATE,
    utm_source TEXT NOT NULL,
    utm_campaign TEXT NOT NULL,
    referral_code_id UUID REFERENCES public.referral_codes(id) ON DELETE SET NULL,
    leads_count INT NOT NULL DEFAULT 0,
    conversions_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 17. Alumni Profiles (Opt-In Directory)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alumni_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(64) NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    completed_programmes JSONB NOT NULL DEFAULT '[]'::jsonb,
    verified_credentials JSONB NOT NULL DEFAULT '[]'::jsonb,
    industry TEXT NOT NULL,
    professional_title TEXT,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    contact_preference TEXT NOT NULL DEFAULT 'PLATFORM_MESSAGE' CHECK (contact_preference IN ('PLATFORM_MESSAGE', 'NONE')),
    visibility TEXT NOT NULL DEFAULT 'ALUMNI_ONLY' CHECK (visibility IN ('ALUMNI_ONLY', 'PUBLIC')),
    is_opted_in BOOLEAN NOT NULL DEFAULT FALSE,
    consent_agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alumni_profiles_opt_in ON public.alumni_profiles (is_opted_in, visibility);

-- ----------------------------------------------------------------------------
-- Defense-in-Depth Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_pathway_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_career_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_career_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_credential_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonial_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_showcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badge_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_profiles ENABLE ROW LEVEL SECURITY;

-- Certifications and Pathways are public read when published
CREATE POLICY rls_certifications_read ON public.certifications
    FOR SELECT USING (status = 'PUBLISHED' OR auth.role() = 'authenticated');

CREATE POLICY rls_career_pathways_read ON public.career_pathways
    FOR SELECT USING (status = 'PUBLISHED' OR auth.role() = 'authenticated');

CREATE POLICY rls_career_pathway_stages_read ON public.career_pathway_stages
    FOR SELECT USING (true);

-- Student Career Plans: student owns plan; assigned tutor can read; admin can manage
CREATE POLICY rls_student_career_plans_student ON public.student_career_plans
    FOR ALL USING (auth.uid() = student_id OR auth.uid() = shared_with_tutor_id);

CREATE POLICY rls_student_career_milestones_access ON public.student_career_milestones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.student_career_plans p
            WHERE p.id = student_career_milestones.plan_id
            AND (p.student_id = auth.uid() OR p.shared_with_tutor_id = auth.uid())
        )
    );

-- Reviews: author can read/write own; moderators can manage; public can read published + consented
CREATE POLICY rls_student_reviews_student ON public.student_reviews
    FOR ALL USING (auth.uid() = student_id);

CREATE POLICY rls_student_reviews_public ON public.student_reviews
    FOR SELECT USING (
        submission_status = 'PUBLISHED'
        AND EXISTS (
            SELECT 1 FROM public.testimonial_consents c
            WHERE c.review_id = student_reviews.id
            AND c.allow_public_testimonial = true
            AND c.revoked_at IS NULL
        )
    );

-- Points Ledger: student can read own points; writes via system/admin
CREATE POLICY rls_points_ledger_student ON public.points_ledger
    FOR SELECT USING (auth.uid() = student_id);

-- Streaks: student can read own streak
CREATE POLICY rls_student_streaks_student ON public.student_streaks
    FOR SELECT USING (auth.uid() = student_id);

-- Alumni: opt-in alumni can be read by authenticated users; owner can update
CREATE POLICY rls_alumni_profiles_read ON public.alumni_profiles
    FOR SELECT USING (
        is_opted_in = true 
        AND (visibility = 'PUBLIC' OR auth.role() = 'authenticated')
    );

CREATE POLICY rls_alumni_profiles_manage ON public.alumni_profiles
    FOR ALL USING (auth.uid() = student_id);

COMMIT;

