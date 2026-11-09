-- ============================================================================
-- ZEALOSH LMS — TRACK 4: CENTRAL QUESTION BANK, CERTIFICATES & VECTOR RAG
-- Migration: 20261108000026_zealosh_question_bank_certificates_and_rag.sql
-- Architecture: Version-Controlled Question Bank with Item Analytics,
--               Tamper-Evident Ed25519 Signed PDF Certificates & Offline Verification,
--               Vector RAG Document Registry & Permission-Aware Curriculum Retrieval
-- Standards: ADR-002 (Defense-in-Depth RLS), ADR-003 (Active Exam Lockout & Answer Key Isolation),
--            ADR-004 (Supabase Authoritative Single Source of Truth)
-- Brand: Zealosh Training & Consultants
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Taxonomy Domains Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.taxonomy_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_type TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    weight_percentage NUMERIC(5,2),
    topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_taxonomy_domain_code UNIQUE (certification_type, code)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_domains_cert ON public.taxonomy_domains (certification_type);

-- ----------------------------------------------------------------------------
-- 2. Question Bank Items (Stable Question Identity)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_bank_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    certification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    current_version_number INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED')),
    author_id UUID,
    author_name TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_bank_items_cert_status ON public.question_bank_items (certification_type, status);
CREATE INDEX IF NOT EXISTS idx_question_bank_items_code ON public.question_bank_items (code);

-- ----------------------------------------------------------------------------
-- 3. Question Versions (Immutable Snapshots on Publish)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_bank_item_id UUID NOT NULL REFERENCES public.question_bank_items(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    stem TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    difficulty TEXT NOT NULL DEFAULT 'MODERATE' CHECK (difficulty IN ('EASY', 'MODERATE', 'HARD')),
    cognitive_level TEXT NOT NULL DEFAULT 'APPLICATION' CHECK (cognitive_level IN ('KNOWLEDGE', 'APPLICATION', 'ANALYSIS', 'EVALUATION')),
    domain TEXT NOT NULL,
    topic TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_option_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- STRICTLY SERVER-AUTHORITATIVE
    explanation TEXT, -- STRICTLY SEVERED FROM STUDENT PROJECTIONS
    reference_source TEXT,
    points NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    rubric_criteria JSONB,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED')),
    change_summary TEXT,
    approved_by UUID,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_question_version_num UNIQUE (question_bank_item_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_question_versions_item ON public.question_versions (question_bank_item_id);
CREATE INDEX IF NOT EXISTS idx_question_versions_status ON public.question_versions (status);
CREATE INDEX IF NOT EXISTS idx_question_versions_domain_topic ON public.question_versions (domain, topic);

-- ----------------------------------------------------------------------------
-- 4. Item Analytics (Classical Test Theory p-value & Discrimination D)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_bank_item_id UUID NOT NULL REFERENCES public.question_bank_items(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    total_attempts INT NOT NULL DEFAULT 0,
    correct_attempts INT NOT NULL DEFAULT 0,
    difficulty_p_value NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    discrimination_d NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    distractor_frequencies JSONB NOT NULL DEFAULT '{}'::jsonb,
    sample_size_sufficient BOOLEAN NOT NULL DEFAULT FALSE,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_item_analytics UNIQUE (question_bank_item_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_item_analytics_item ON public.item_analytics (question_bank_item_id);

-- ----------------------------------------------------------------------------
-- 5. Certificate Signing Keys (Ed25519 Native Keys)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certificate_signing_keys (
    key_id TEXT PRIMARY KEY,
    public_key_pem TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'ed25519',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 6. Issued Certificates v2 (Authoritative Signed Records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.issued_certificates_v2 (
    id VARCHAR(64) PRIMARY KEY,
    certificate_code TEXT NOT NULL UNIQUE,
    student_id VARCHAR(64) NOT NULL,
    student_name TEXT NOT NULL,
    course_id VARCHAR(64) NOT NULL,
    course_title TEXT NOT NULL,
    certification_type TEXT NOT NULL,
    issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completion_date TIMESTAMPTZ NOT NULL,
    score_percent NUMERIC(5,2) NOT NULL,
    key_id TEXT NOT NULL REFERENCES public.certificate_signing_keys(key_id),
    signature TEXT NOT NULL,
    canonical_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'REVOKED', 'SUPERSEDED')),
    revocation_reason TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by VARCHAR(64),
    superseded_by_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issued_certs_v2_student ON public.issued_certificates_v2 (student_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_v2_course ON public.issued_certificates_v2 (course_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_v2_code ON public.issued_certificates_v2 (certificate_code);
CREATE INDEX IF NOT EXISTS idx_issued_certs_v2_status ON public.issued_certificates_v2 (status);

-- ----------------------------------------------------------------------------
-- 7. Certificate Audit Logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certificate_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_code TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('ISSUED', 'REVOKED', 'REISSUED', 'VERIFIED_OFFLINE', 'VERIFIED_ONLINE')),
    actor_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificate_audit_logs_code ON public.certificate_audit_logs (certificate_code);

-- ----------------------------------------------------------------------------
-- 8. Vector RAG Document Registry
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    doc_type TEXT NOT NULL DEFAULT 'LEARNING_MATERIAL' CHECK (doc_type IN ('SYLLABUS', 'STUDENT_HANDBOOK', 'SAFETY_STANDARD', 'LEARNING_MATERIAL', 'REGULATORY_CODE')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'UPLOADED', 'APPROVED', 'INDEXED', 'SUPERSEDED', 'ARCHIVED')),
    version INT NOT NULL DEFAULT 1,
    content_checksum TEXT NOT NULL,
    total_chunks INT NOT NULL DEFAULT 0,
    source_file_name TEXT,
    uploaded_by VARCHAR(64),
    approved_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_course_status ON public.rag_documents (course_id, status);

-- ----------------------------------------------------------------------------
-- 9. Vector RAG Document Chunks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rag_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
    course_id VARCHAR(64) NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    page_number INT,
    section_heading TEXT,
    token_count INT NOT NULL DEFAULT 0,
    embedding JSONB,
    status TEXT NOT NULL DEFAULT 'INDEXED' CHECK (status IN ('INDEXED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_document_chunks_doc ON public.rag_document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_rag_document_chunks_course_status ON public.rag_document_chunks (course_id, status);

-- ----------------------------------------------------------------------------
-- 10. Defense-in-Depth Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.taxonomy_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_signing_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issued_certificates_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_document_chunks ENABLE ROW LEVEL SECURITY;

-- Staff and Admins have full access to question bank and analytics
CREATE POLICY "Staff have full access to question bank items"
    ON public.question_bank_items FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('SUPERADMIN', 'ADMIN', 'INSTRUCTOR')
        )
    );

CREATE POLICY "Staff have full access to question versions"
    ON public.question_versions FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('SUPERADMIN', 'ADMIN', 'INSTRUCTOR')
        )
    );

CREATE POLICY "Staff have full access to item analytics"
    ON public.item_analytics FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('SUPERADMIN', 'ADMIN', 'INSTRUCTOR')
        )
    );

CREATE POLICY "Anyone can read published taxonomy domains"
    ON public.taxonomy_domains FOR SELECT
    TO authenticated
    USING (true);

-- Certificate Keys: Public key read access for offline verification
CREATE POLICY "Public read access to certificate public keys"
    ON public.certificate_signing_keys FOR SELECT
    TO authenticated, anon
    USING (status = 'ACTIVE');

-- Issued Certificates: Students can view their own, public can verify by code, staff can view all
CREATE POLICY "Students can view their own certificates"
    ON public.issued_certificates_v2 FOR SELECT
    TO authenticated
    USING (
        student_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('SUPERADMIN', 'ADMIN', 'STAFF', 'INSTRUCTOR')
        )
    );

CREATE POLICY "Public verification can lookup by certificate code"
    ON public.issued_certificates_v2 FOR SELECT
    TO anon
    USING (status IN ('ISSUED', 'REVOKED', 'SUPERSEDED'));

CREATE POLICY "Staff can manage certificates"
    ON public.issued_certificates_v2 FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('SUPERADMIN', 'ADMIN')
        )
    );

-- RAG Documents: Enrolled students can read approved/indexed curriculum chunks; staff can manage
CREATE POLICY "Enrolled students can read approved course chunks"
    ON public.rag_document_chunks FOR SELECT
    TO authenticated
    USING (
        status = 'INDEXED' AND (
            EXISTS (
                SELECT 1 FROM public.enrollments
                WHERE enrollments.user_id = auth.uid()
                AND enrollments.course_id = rag_document_chunks.course_id
                AND enrollments.status = 'ACTIVE'
            ) OR
            EXISTS (
                SELECT 1 FROM public.users
                WHERE users.id = auth.uid()
                AND users.role IN ('SUPERADMIN', 'ADMIN', 'INSTRUCTOR')
            )
        )
    );

CREATE POLICY "Staff can manage RAG documents"
    ON public.rag_documents FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('SUPERADMIN', 'ADMIN', 'INSTRUCTOR')
        )
    );

CREATE POLICY "Staff can manage RAG document chunks"
    ON public.rag_document_chunks FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('SUPERADMIN', 'ADMIN', 'INSTRUCTOR')
        )
    );

COMMIT;

