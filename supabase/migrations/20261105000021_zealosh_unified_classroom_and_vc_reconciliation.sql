-- ============================================================================
-- ZEALOSH LMS — UNIFIED CLASSROOM, LIVE CLASSROOM & ZEALOSH VC RECONCILIATION
-- Migration: 20261105000021_zealosh_unified_classroom_and_vc_reconciliation.sql
-- Architecture: ADR-001, ADR-002, ADR-004 & Master Engineering Constitution (Rule 7)
-- Purpose:
--   Authoritative relational persistence & schema reconciliation for:
--   1. classroom_announcements: comments JSONB, scheduled_publish_at, audience_scope, status
--   2. live_sessions: 11-state lifecycle, started_at, ended_at, co_instructor_ids, moderator_ids
--   3. attendance_records: left_at, rejoin_count, connection_status, provider_participant_id
--   4. assignments: previous_due_date, deadline_updated_by, version, scheduled_publish_at
--   5. assignment_submissions: version, previous_submission_text, previous_attachment_url
--   6. learning_materials: release_condition, is_released, release_offset_minutes, scheduled_release_time, session_id
--   7. Row-Level Security (RLS) policies for cohort isolation across Online/Live, Recorded, and Hybrid delivery modes
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Classroom Cohort Announcements Table Reconciliation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classroom_announcements (
    id VARCHAR(64) PRIMARY KEY,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    author_name TEXT,
    author_role VARCHAR(32) DEFAULT 'INSTRUCTOR',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    comments JSONB DEFAULT '[]'::jsonb,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    audience_scope VARCHAR(32) NOT NULL DEFAULT 'BATCH_SPECIFIC',
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    scheduled_publish_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE CASCADE;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS author_id VARCHAR(64) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS author_role VARCHAR(32) DEFAULT 'INSTRUCTOR';
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS audience_scope VARCHAR(32) DEFAULT 'BATCH_SPECIFIC';
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'PUBLISHED';
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_classroom_announcements_course ON public.classroom_announcements(course_id);
CREATE INDEX IF NOT EXISTS idx_classroom_announcements_batch ON public.classroom_announcements(batch_id);
CREATE INDEX IF NOT EXISTS idx_classroom_announcements_created ON public.classroom_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classroom_announcements_scheduled ON public.classroom_announcements(scheduled_publish_at) WHERE scheduled_publish_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Live Sessions & 11-State Lifecycle Reconciliation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_sessions (
    id VARCHAR(64) PRIMARY KEY,
    batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scheduled_start_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 120,
    instructor_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    meeting_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
    recording_url TEXT,
    recording_duration_minutes INT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    co_instructor_ids TEXT[] DEFAULT '{}',
    moderator_ids TEXT[] DEFAULT '{}',
    provider_meeting_id VARCHAR(128),
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS co_instructor_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS moderator_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS provider_meeting_id VARCHAR(128);
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS recording_duration_minutes INT;

-- Reconcile 11-State Lifecycle Check Constraint
DO $$
BEGIN
    ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_status_check;
    ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_status_check CHECK (
        status IN (
            'DRAFT',
            'SCHEDULED',
            'STARTING',
            'LIVE',
            'ENDING',
            'ENDED',
            'CANCELLED',
            'FAILED',
            'RECORDING_PROCESSING',
            'RECORDING_READY',
            'RECORDING_FAILED'
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_live_sessions_batch ON public.live_sessions(batch_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_course ON public.live_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_scheduled ON public.live_sessions(scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_live_sessions_meeting_id ON public.live_sessions(meeting_id);

-- ----------------------------------------------------------------------------
-- 3. Attendance Records Reconciliation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    duration_minutes INT NOT NULL DEFAULT 0,
    attended BOOLEAN NOT NULL DEFAULT TRUE,
    rejoin_count INT NOT NULL DEFAULT 0,
    connection_status VARCHAR(32) NOT NULL DEFAULT 'DISCONNECTED',
    provider_participant_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS rejoin_count INT DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS connection_status VARCHAR(32) DEFAULT 'DISCONNECTED';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS provider_participant_id VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user ON public.attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_attended ON public.attendance_records(attended);

-- ----------------------------------------------------------------------------
-- 4. Assignments & Rubric Reconciliation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
    id VARCHAR(64) PRIMARY KEY,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL,
    module_id UUID,
    topic_id UUID,
    lesson_id VARCHAR(64),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions_html TEXT,
    attachment_url TEXT,
    attachment_filename TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    previous_due_date TIMESTAMPTZ,
    deadline_updated_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    max_score NUMERIC NOT NULL DEFAULT 100,
    rubric JSONB DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    scheduled_publish_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS previous_due_date TIMESTAMPTZ;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS deadline_updated_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_assignments_course_status ON public.assignments(course_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_batch ON public.assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON public.assignments(due_date);

-- ----------------------------------------------------------------------------
-- 5. Assignment Submissions & Revisions Reconciliation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id VARCHAR(64) PRIMARY KEY,
    assignment_id VARCHAR(64) NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    student_name TEXT,
    student_email TEXT,
    submission_text TEXT,
    attachment_url TEXT,
    attachment_filename TEXT,
    version INT NOT NULL DEFAULT 1,
    previous_submission_text TEXT,
    previous_attachment_url TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'GRADED', 'RESUBMISSION_REQUESTED')),
    score NUMERIC,
    feedback TEXT,
    rubric_scores JSONB DEFAULT '[]'::jsonb,
    ai_review_suggestions JSONB DEFAULT NULL,
    graded_by_user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    graded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_assignment_submission_user UNIQUE (assignment_id, user_id)
);

-- Defensive column alignment
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS previous_submission_text TEXT;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS previous_attachment_url TEXT;

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_user ON public.assignment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status ON public.assignment_submissions(status);

-- ----------------------------------------------------------------------------
-- 6. Learning Materials & Release Conditions Reconciliation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL,
    session_id VARCHAR(64) REFERENCES public.live_sessions(id) ON DELETE SET NULL,
    module_id UUID,
    topic_id UUID,
    subtopic_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    material_type VARCHAR(32) NOT NULL CHECK (material_type IN ('PDF', 'DOCUMENT', 'PRESENTATION', 'IMAGE', 'EXTERNAL_LINK')),
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL,
    allow_view BOOLEAN NOT NULL DEFAULT TRUE,
    allow_download BOOLEAN NOT NULL DEFAULT FALSE,
    allow_print BOOLEAN NOT NULL DEFAULT FALSE,
    release_condition VARCHAR(32) NOT NULL DEFAULT 'PRE_CLASS' CHECK (release_condition IN ('PRE_CLASS', 'CLASS_START', 'MANUAL', 'SCHEDULED')),
    is_released BOOLEAN NOT NULL DEFAULT TRUE,
    release_offset_minutes INT NOT NULL DEFAULT 0,
    scheduled_release_time TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    uploaded_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS session_id VARCHAR(64) REFERENCES public.live_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS release_condition VARCHAR(32) DEFAULT 'PRE_CLASS';
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS is_released BOOLEAN DEFAULT TRUE;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS release_offset_minutes INT DEFAULT 0;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS scheduled_release_time TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_learning_materials_session ON public.learning_materials(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_materials_release ON public.learning_materials(is_released, release_condition);

-- ----------------------------------------------------------------------------
-- 7. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.classroom_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classroom_announcements TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_materials TO authenticated, service_role;

GRANT SELECT ON public.classroom_announcements TO anon;
GRANT SELECT ON public.live_sessions TO anon;
GRANT SELECT ON public.assignments TO anon;
GRANT SELECT ON public.learning_materials TO anon;

-- Policies for classroom_announcements
DROP POLICY IF EXISTS announcements_read_policy ON public.classroom_announcements;
CREATE POLICY announcements_read_policy ON public.classroom_announcements
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_course_instructor(course_id, batch_id)
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.user_id = public.current_user_id()
      AND e.course_id = classroom_announcements.course_id
      AND e.status = 'ACTIVE'
      AND (classroom_announcements.batch_id IS NULL OR e.batch_id = classroom_announcements.batch_id)
  )
);

DROP POLICY IF EXISTS announcements_write_policy ON public.classroom_announcements;
CREATE POLICY announcements_write_policy ON public.classroom_announcements
FOR ALL TO authenticated
USING (
  public.is_admin()
  OR public.is_course_instructor(course_id, batch_id)
)
WITH CHECK (
  public.is_admin()
  OR public.is_course_instructor(course_id, batch_id)
);

-- Policies for live_sessions
DROP POLICY IF EXISTS live_sessions_read_policy ON public.live_sessions;
CREATE POLICY live_sessions_read_policy ON public.live_sessions
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR instructor_id = public.current_user_id()
  OR public.current_user_id() = ANY(co_instructor_ids)
  OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.user_id = public.current_user_id()
      AND e.course_id = live_sessions.course_id
      AND e.batch_id = live_sessions.batch_id
      AND e.status = 'ACTIVE'
  )
);

DROP POLICY IF EXISTS live_sessions_write_policy ON public.live_sessions;
CREATE POLICY live_sessions_write_policy ON public.live_sessions
FOR ALL TO authenticated
USING (
  public.is_admin()
  OR instructor_id = public.current_user_id()
  OR public.current_user_id() = ANY(co_instructor_ids)
)
WITH CHECK (
  public.is_admin()
  OR instructor_id = public.current_user_id()
  OR public.current_user_id() = ANY(co_instructor_ids)
);

-- Policies for attendance_records
DROP POLICY IF EXISTS attendance_read_policy ON public.attendance_records;
CREATE POLICY attendance_read_policy ON public.attendance_records
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR user_id = public.current_user_id()
  OR EXISTS (
    SELECT 1 FROM public.live_sessions ls
    WHERE ls.id = attendance_records.session_id
      AND (ls.instructor_id = public.current_user_id() OR public.current_user_id() = ANY(ls.co_instructor_ids))
  )
);

DROP POLICY IF EXISTS attendance_write_policy ON public.attendance_records;
CREATE POLICY attendance_write_policy ON public.attendance_records
FOR ALL TO authenticated
USING (
  public.is_admin()
  OR user_id = public.current_user_id()
  OR EXISTS (
    SELECT 1 FROM public.live_sessions ls
    WHERE ls.id = attendance_records.session_id
      AND (ls.instructor_id = public.current_user_id() OR public.current_user_id() = ANY(ls.co_instructor_ids))
  )
)
WITH CHECK (
  public.is_admin()
  OR user_id = public.current_user_id()
  OR EXISTS (
    SELECT 1 FROM public.live_sessions ls
    WHERE ls.id = attendance_records.session_id
      AND (ls.instructor_id = public.current_user_id() OR public.current_user_id() = ANY(ls.co_instructor_ids))
  )
);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

