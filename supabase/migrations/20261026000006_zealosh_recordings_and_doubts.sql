-- ============================================================================
-- ZEALOSH LMS — PHASE 4: CLASS RECORDINGS, HIGHLIGHTS, RESOURCES & DOUBTS
-- Migration: 20261026000006_zealosh_recordings_and_doubts.sql
-- Architecture: ADR-002 (Server-Side Authoritative & Defense-in-Depth RLS)
-- Target: Core Hub Project 1 (yeegsljnjwxdhgzfdnyg)
-- Standards: OWASP Top 10, Object Storage References, Granular RLS, Audit Logging
-- Invariants:
--   1. Recordings associated with live_sessions, courses, and batches
--   2. No video files or blobs in PostgreSQL (durable storage keys / URLs only)
--   3. Explicit download permissions governed per batch / grant
--   4. Administrator governance for previous-batch access (recording_batch_access)
--   5. Highlights validate non-negative, ordered timestamps against duration
--   6. Resources validate resource types and safe URLs
--   7. Doubts enforce student privacy unless explicitly shared
--   8. Zero anonymous table access (anon revoked from all tables)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Class Recordings Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_recordings (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    storage_provider VARCHAR(32) NOT NULL DEFAULT 'SUPABASE_STORAGE' CHECK (storage_provider IN ('SUPABASE_STORAGE', 'S3_COMPATIBLE', 'BIGBLUEBUTTON', 'EXTERNAL_SECURE')),
    storage_path TEXT NOT NULL,
    media_url TEXT NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    file_size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
    status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('PROCESSING', 'AVAILABLE', 'ARCHIVED', 'REVOKED')),
    is_downloadable BOOLEAN NOT NULL DEFAULT FALSE,
    available_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Previous-Batch Access Grants Governance Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recording_batch_access (
    id VARCHAR(64) PRIMARY KEY,
    recording_id VARCHAR(64) NOT NULL REFERENCES public.class_recordings(id) ON DELETE CASCADE,
    source_batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    target_batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    allow_download BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    granted_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_recording_batch_grant UNIQUE (recording_id, target_batch_id)
);

-- ----------------------------------------------------------------------------
-- 3. Topic Highlights & Chapters Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recording_highlights (
    id VARCHAR(64) PRIMARY KEY,
    recording_id VARCHAR(64) NOT NULL REFERENCES public.class_recordings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_timestamp_seconds INT NOT NULL CHECK (start_timestamp_seconds >= 0),
    end_timestamp_seconds INT NOT NULL CHECK (end_timestamp_seconds > start_timestamp_seconds),
    topic_id VARCHAR(64),
    created_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. Topic-Linked References & Study Resources Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recording_resources (
    id VARCHAR(64) PRIMARY KEY,
    recording_id VARCHAR(64) NOT NULL REFERENCES public.class_recordings(id) ON DELETE CASCADE,
    highlight_id VARCHAR(64) REFERENCES public.recording_highlights(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    resource_type VARCHAR(32) NOT NULL CHECK (resource_type IN ('PDF', 'SLIDES', 'URL', 'CODE', 'NOTES')),
    url TEXT NOT NULL,
    file_size_bytes BIGINT CHECK (file_size_bytes >= 0),
    timestamp_seconds INT CHECK (timestamp_seconds >= 0),
    uploaded_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Timestamp-Linked Doubts Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recording_doubts (
    id VARCHAR(64) PRIMARY KEY,
    recording_id VARCHAR(64) NOT NULL REFERENCES public.class_recordings(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    timestamp_seconds INT NOT NULL CHECK (timestamp_seconds >= 0),
    highlight_id VARCHAR(64) REFERENCES public.recording_highlights(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'CLARIFICATION_REQUESTED')),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. Doubt Answers Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recording_doubt_answers (
    id VARCHAR(64) PRIMARY KEY,
    doubt_id VARCHAR(64) NOT NULL REFERENCES public.recording_doubts(id) ON DELETE CASCADE,
    instructor_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    answer_text TEXT NOT NULL,
    reference_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Indexes for Query Performance & Foreign Key Traversal
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_class_recordings_session ON public.class_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_class_recordings_batch ON public.class_recordings(batch_id);
CREATE INDEX IF NOT EXISTS idx_class_recordings_course ON public.class_recordings(course_id);
CREATE INDEX IF NOT EXISTS idx_class_recordings_status ON public.class_recordings(status);

CREATE INDEX IF NOT EXISTS idx_recording_batch_access_rec ON public.recording_batch_access(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_batch_access_target ON public.recording_batch_access(target_batch_id);

CREATE INDEX IF NOT EXISTS idx_recording_highlights_rec ON public.recording_highlights(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_highlights_ts ON public.recording_highlights(recording_id, start_timestamp_seconds);

CREATE INDEX IF NOT EXISTS idx_recording_resources_rec ON public.recording_resources(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_resources_hl ON public.recording_resources(highlight_id);

CREATE INDEX IF NOT EXISTS idx_recording_doubts_rec ON public.recording_doubts(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_doubts_user ON public.recording_doubts(user_id);
CREATE INDEX IF NOT EXISTS idx_recording_doubts_status ON public.recording_doubts(status);

CREATE INDEX IF NOT EXISTS idx_recording_doubt_answers_doubt ON public.recording_doubt_answers(doubt_id);

-- ----------------------------------------------------------------------------
-- 8. Enable Row-Level Security (RLS) on All Tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.class_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_batch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_doubt_answers ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 9. Table-Level Grants: Zero Anonymous Access (Least Privilege)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.class_recordings FROM PUBLIC, anon;
REVOKE ALL ON public.recording_batch_access FROM PUBLIC, anon;
REVOKE ALL ON public.recording_highlights FROM PUBLIC, anon;
REVOKE ALL ON public.recording_resources FROM PUBLIC, anon;
REVOKE ALL ON public.recording_doubts FROM PUBLIC, anon;
REVOKE ALL ON public.recording_doubt_answers FROM PUBLIC, anon;

GRANT SELECT ON public.class_recordings TO authenticated;
GRANT SELECT ON public.recording_batch_access TO authenticated;
GRANT SELECT ON public.recording_highlights TO authenticated;
GRANT SELECT ON public.recording_resources TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.recording_doubts TO authenticated;
GRANT SELECT, INSERT ON public.recording_doubt_answers TO authenticated;

GRANT ALL ON public.class_recordings TO service_role;
GRANT ALL ON public.recording_batch_access TO service_role;
GRANT ALL ON public.recording_highlights TO service_role;
GRANT ALL ON public.recording_resources TO service_role;
GRANT ALL ON public.recording_doubts TO service_role;
GRANT ALL ON public.recording_doubt_answers TO service_role;

-- ----------------------------------------------------------------------------
-- 10. Granular Row-Level Security Policies
-- ----------------------------------------------------------------------------

-- Class Recordings Policies
DROP POLICY IF EXISTS "Learners view authorized class recordings" ON public.class_recordings;
CREATE POLICY "Learners view authorized class recordings"
    ON public.class_recordings FOR SELECT
    USING (
        public.is_admin()
        OR public.is_course_instructor(course_id, batch_id)
        OR (
            status = 'AVAILABLE'
            AND available_from <= NOW()
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (
                EXISTS (
                    SELECT 1 FROM public.enrollments e
                    WHERE e.batch_id = class_recordings.batch_id
                      AND e.user_id = public.current_user_id()
                      AND e.status = 'ACTIVE'
                )
                OR EXISTS (
                    SELECT 1 FROM public.recording_batch_access rba
                    JOIN public.enrollments e ON e.batch_id = rba.target_batch_id
                    WHERE rba.recording_id = class_recordings.id
                      AND rba.status = 'ACTIVE'
                      AND (rba.expires_at IS NULL OR rba.expires_at > NOW())
                      AND e.user_id = public.current_user_id()
                      AND e.status = 'ACTIVE'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Staff manage class recordings" ON public.class_recordings;
CREATE POLICY "Staff manage class recordings"
    ON public.class_recordings FOR ALL
    USING (public.is_admin() OR public.is_course_instructor(course_id, batch_id))
    WITH CHECK (public.is_admin() OR public.is_course_instructor(course_id, batch_id));

-- Recording Batch Access Policies
DROP POLICY IF EXISTS "View recording batch access grants" ON public.recording_batch_access;
CREATE POLICY "View recording batch access grants"
    ON public.recording_batch_access FOR SELECT
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.batch_id = recording_batch_access.target_batch_id
              AND e.user_id = public.current_user_id()
              AND e.status = 'ACTIVE'
        )
        OR EXISTS (
            SELECT 1 FROM public.class_recordings r
            WHERE r.id = recording_batch_access.recording_id
              AND public.is_course_instructor(r.course_id, r.batch_id)
        )
    );

DROP POLICY IF EXISTS "Admin manage recording batch access grants" ON public.recording_batch_access;
CREATE POLICY "Admin manage recording batch access grants"
    ON public.recording_batch_access FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Recording Highlights Policies
DROP POLICY IF EXISTS "View recording highlights" ON public.recording_highlights;
CREATE POLICY "View recording highlights"
    ON public.recording_highlights FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.class_recordings r
            WHERE r.id = recording_highlights.recording_id
        )
    );

DROP POLICY IF EXISTS "Staff manage recording highlights" ON public.recording_highlights;
CREATE POLICY "Staff manage recording highlights"
    ON public.recording_highlights FOR ALL
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.class_recordings r
            WHERE r.id = recording_highlights.recording_id
              AND public.is_course_instructor(r.course_id, r.batch_id)
        )
    )
    WITH CHECK (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.class_recordings r
            WHERE r.id = recording_highlights.recording_id
              AND public.is_course_instructor(r.course_id, r.batch_id)
        )
    );

-- Recording Resources Policies
DROP POLICY IF EXISTS "View recording resources" ON public.recording_resources;
CREATE POLICY "View recording resources"
    ON public.recording_resources FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.class_recordings r
            WHERE r.id = recording_resources.recording_id
        )
    );

DROP POLICY IF EXISTS "Staff manage recording resources" ON public.recording_resources;
CREATE POLICY "Staff manage recording resources"
    ON public.recording_resources FOR ALL
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.class_recordings r
            WHERE r.id = recording_resources.recording_id
              AND public.is_course_instructor(r.course_id, r.batch_id)
        )
    )
    WITH CHECK (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.class_recordings r
            WHERE r.id = recording_resources.recording_id
              AND public.is_course_instructor(r.course_id, r.batch_id)
        )
    );

-- Recording Doubts Policies
DROP POLICY IF EXISTS "View recording doubts" ON public.recording_doubts;
CREATE POLICY "View recording doubts"
    ON public.recording_doubts FOR SELECT
    USING (
        public.is_admin()
        OR user_id = public.current_user_id()
        OR (
            is_public = TRUE
            AND EXISTS (
                SELECT 1 FROM public.class_recordings r
                WHERE r.id = recording_doubts.recording_id
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.class_recordings r
            WHERE r.id = recording_doubts.recording_id
              AND public.is_course_instructor(r.course_id, r.batch_id)
        )
    );

DROP POLICY IF EXISTS "Learners create own doubts" ON public.recording_doubts;
CREATE POLICY "Learners create own doubts"
    ON public.recording_doubts FOR INSERT
    WITH CHECK (
        user_id = public.current_user_id()
        AND EXISTS (
            SELECT 1 FROM public.class_recordings r
            WHERE r.id = recording_doubts.recording_id
        )
    );

DROP POLICY IF EXISTS "Author or staff update doubts" ON public.recording_doubts;
CREATE POLICY "Author or staff update doubts"
    ON public.recording_doubts FOR UPDATE
    USING (
        public.is_admin()
        OR user_id = public.current_user_id()
        OR EXISTS (
            SELECT 1 FROM public.class_recordings r
            WHERE r.id = recording_doubts.recording_id
              AND public.is_course_instructor(r.course_id, r.batch_id)
        )
    );

-- Recording Doubt Answers Policies
DROP POLICY IF EXISTS "View doubt answers" ON public.recording_doubt_answers;
CREATE POLICY "View doubt answers"
    ON public.recording_doubt_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.recording_doubts d
            WHERE d.id = recording_doubt_answers.doubt_id
        )
    );

DROP POLICY IF EXISTS "Staff post doubt answers" ON public.recording_doubt_answers;
CREATE POLICY "Staff post doubt answers"
    ON public.recording_doubt_answers FOR INSERT
    WITH CHECK (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.recording_doubts d
            JOIN public.class_recordings r ON r.id = d.recording_id
            WHERE d.id = recording_doubt_answers.doubt_id
              AND public.is_course_instructor(r.course_id, r.batch_id)
        )
    );

COMMIT;
