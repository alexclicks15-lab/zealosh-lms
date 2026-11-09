-- ============================================================================
-- ZEALOSH LMS — PHASE 5: DIGITAL CLASSROOM & ACADEMIC WORKSPACE
-- Migration: 20261101000012_zealosh_classroom_academic_workspace.sql
-- Architecture: ADR-002 (Defense-in-Depth RLS) & ADR-004 (Supabase Single Source of Truth)
-- Standards: OWASP Top 10, Scoped Cohort Authorization, Immutable Auditability
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Classroom Cohort Announcements Table
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
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
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
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.classroom_announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_classroom_announcements_course ON public.classroom_announcements(course_id);
CREATE INDEX IF NOT EXISTS idx_classroom_announcements_batch ON public.classroom_announcements(batch_id);
CREATE INDEX IF NOT EXISTS idx_classroom_announcements_created ON public.classroom_announcements(created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. AI Review Suggestions Column on Assignment Submissions
-- ----------------------------------------------------------------------------
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS ai_review_suggestions JSONB DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- 3. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.classroom_announcements ENABLE ROW LEVEL SECURITY;

-- Revoke public access
REVOKE ALL ON public.classroom_announcements FROM anon;
REVOKE ALL ON public.classroom_announcements FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classroom_announcements TO authenticated;
GRANT ALL ON public.classroom_announcements TO service_role;

-- SELECT policy: Enrolled learners or assigned instructors / admins
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

-- INSERT / UPDATE / DELETE policy: Assigned instructors or admins only
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

COMMIT;

