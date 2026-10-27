-- ============================================================================
-- ZEALOSH LMS — PHASE 2: RECONCILED COURSEWORK & SUBMISSIONS MIGRATION
-- Migration: 20261026000004_zealosh_assignments_and_submissions.sql
-- Architecture: ADR-002 (Server-Side Authoritative & Defense-in-Depth RLS)
-- Target: Core Hub Project 1 (yeegsljnjwxdhgzfdnyg)
-- Standards: OWASP Top 10, Least Privilege, Scoped Instructor RBAC
-- Invariants:
--   1. Zero redundant/contradictory course_id/batch_id in submissions
--   2. Strict learner enrollment-eligibility and published assignment checks
--   3. Course-scoped instructor permissions (no cross-course authoring/grading)
--   4. Zero public/anonymous visibility of assignments and rubrics
--   5. Defense-in-depth reconciliation with existing courses/batches/users
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Helper Function: Course-Scoped Instructor Authorization
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_course_instructor(p_course_id TEXT, p_batch_id TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    public.is_admin(),
    false
  ) OR EXISTS (
    SELECT 1 FROM public.courses c
    LEFT JOIN public.batches b ON b.id = p_batch_id
    WHERE c.id = p_course_id
      AND (
        c.lead_instructor_id = public.current_user_id()
        OR public.current_user_id() = ANY(c.co_instructor_ids)
        OR (p_batch_id IS NOT NULL AND b.lead_instructor_id = public.current_user_id())
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Coursework Assignments Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
    id VARCHAR(64) PRIMARY KEY,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions_html TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    max_score NUMERIC NOT NULL DEFAULT 100,
    rubric JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment for existing table reconciliation
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS instructions_html TEXT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 100;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS rubric JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'PUBLISHED';
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_batch_id ON public.assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);

-- ----------------------------------------------------------------------------
-- 3. Assignment Submissions Table (Zero Redundant course_id / batch_id)
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
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'GRADED', 'RESUBMISSION_REQUESTED')),
    score NUMERIC,
    feedback TEXT,
    rubric_scores JSONB DEFAULT '[]'::jsonb,
    graded_by_user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    graded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_assignment_submission_user UNIQUE (assignment_id, user_id)
);

-- Defensive column alignment for existing table reconciliation
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS assignment_id VARCHAR(64) REFERENCES public.assignments(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS student_email TEXT;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS submission_text TEXT;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS attachment_filename TEXT;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'SUBMITTED';
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS score NUMERIC;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS rubric_scores JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS graded_by_user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.assignment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_graded_by_user_id ON public.assignment_submissions(graded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.assignment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_user ON public.assignment_submissions(assignment_id, user_id);

-- ----------------------------------------------------------------------------
-- 4. Enable Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. Hardened RLS Policies for Assignments
-- ----------------------------------------------------------------------------

-- SELECT: Enrolled students (published only) OR assigned instructors OR admins. Anonymous blocked.
DROP POLICY IF EXISTS assignments_read_policy ON public.assignments;
CREATE POLICY assignments_read_policy ON public.assignments
    FOR SELECT TO authenticated, service_role
    USING (
        public.is_admin()
        OR public.is_course_instructor(course_id, batch_id)
        OR (
            status = 'PUBLISHED'
            AND EXISTS (
                SELECT 1 FROM public.enrollments e
                WHERE e.course_id = assignments.course_id
                  AND e.user_id = public.current_user_id()
                  AND e.status = 'ACTIVE'
                  AND (assignments.batch_id IS NULL OR e.batch_id = assignments.batch_id)
            )
        )
    );

-- INSERT / UPDATE / DELETE: Assigned course instructors OR admins only
DROP POLICY IF EXISTS assignments_admin_policy ON public.assignments;
CREATE POLICY assignments_admin_policy ON public.assignments
    FOR ALL TO authenticated, service_role
    USING (
        public.is_admin()
        OR public.is_course_instructor(course_id, batch_id)
    )
    WITH CHECK (
        public.is_admin()
        OR public.is_course_instructor(course_id, batch_id)
    );

-- ----------------------------------------------------------------------------
-- 6. Hardened RLS Policies for Assignment Submissions
-- ----------------------------------------------------------------------------

-- SELECT: Student reads own submission OR assigned instructor reads submissions for their courses OR admin
DROP POLICY IF EXISTS submissions_read_policy ON public.assignment_submissions;
CREATE POLICY submissions_read_policy ON public.assignment_submissions
    FOR SELECT TO authenticated, service_role
    USING (
        user_id = public.current_user_id()
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.id = assignment_submissions.assignment_id
              AND public.is_course_instructor(a.course_id, a.batch_id)
        )
    );

-- INSERT: Student inserts own submission IF actively enrolled in the course/cohort AND assignment is PUBLISHED
DROP POLICY IF EXISTS submissions_student_insert_own ON public.assignment_submissions;
CREATE POLICY submissions_student_insert_own ON public.assignment_submissions
    FOR INSERT TO authenticated, service_role
    WITH CHECK (
        (
            user_id = public.current_user_id()
            AND EXISTS (
                SELECT 1 FROM public.assignments a
                JOIN public.enrollments e 
                  ON e.course_id = a.course_id 
                  AND e.user_id = public.current_user_id()
                  AND e.status = 'ACTIVE'
                  AND (a.batch_id IS NULL OR e.batch_id = a.batch_id)
                WHERE a.id = assignment_submissions.assignment_id
                  AND a.status = 'PUBLISHED'
            )
        )
        OR public.is_admin()
    );

-- UPDATE: Students can update unfinalized submissions (resubmission) without altering grade; Instructors can grade assigned courses
DROP POLICY IF EXISTS submissions_update_policy ON public.assignment_submissions;
CREATE POLICY submissions_update_policy ON public.assignment_submissions
    FOR UPDATE TO authenticated, service_role
    USING (
        user_id = public.current_user_id()
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.id = assignment_submissions.assignment_id
              AND public.is_course_instructor(a.course_id, a.batch_id)
        )
    )
    WITH CHECK (
        (
            user_id = public.current_user_id()
            AND status IN ('SUBMITTED', 'RESUBMISSION_REQUESTED')
            AND score IS NULL
            AND graded_by_user_id IS NULL
        )
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.id = assignment_submissions.assignment_id
              AND public.is_course_instructor(a.course_id, a.batch_id)
        )
    );

-- ----------------------------------------------------------------------------
-- 7. Role Grants (Zero Anonymous Grants)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.assignments FROM anon, public;
REVOKE ALL ON public.assignment_submissions FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;
GRANT ALL ON public.assignments TO service_role;
GRANT ALL ON public.assignment_submissions TO service_role;

COMMIT;
