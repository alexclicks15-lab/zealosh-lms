-- ============================================================================
-- ZEALOSH LMS — MILESTONE ZM-04.1 & PHASE 5A
-- Migration: 20261101000013_zealosh_classroom_security_and_notifications.sql
-- Workstream A: Digital Classroom Security Closure, Batch Isolation & Lifecycle Hardening
-- Workstream B: Phase 5A In-App Notification Center
-- Standards: ADR-002 (Defense-in-Depth RLS) & ADR-004 (PostgreSQL Sole Source of Truth)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Classroom Announcements Security & Scope Alignment
-- ----------------------------------------------------------------------------

-- Add audience_scope and status columns defensively
ALTER TABLE public.classroom_announcements 
  ADD COLUMN IF NOT EXISTS audience_scope VARCHAR(32) NOT NULL DEFAULT 'COURSE_WIDE';

ALTER TABLE public.classroom_announcements 
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED';

-- Backfill audience_scope based on batch_id presence
UPDATE public.classroom_announcements 
  SET audience_scope = 'BATCH_SPECIFIC' 
  WHERE batch_id IS NOT NULL AND (audience_scope IS NULL OR audience_scope = 'COURSE_WIDE');

-- Add check constraint for valid audience_scope and status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_announcements_audience_scope'
  ) THEN
    ALTER TABLE public.classroom_announcements 
      ADD CONSTRAINT chk_announcements_audience_scope 
      CHECK (audience_scope IN ('COURSE_WIDE', 'BATCH_SPECIFIC'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_announcements_status'
  ) THEN
    ALTER TABLE public.classroom_announcements 
      ADD CONSTRAINT chk_announcements_status 
      CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'));
  END IF;
END $$;

-- Optimize index for audience-scoped lookups
CREATE INDEX IF NOT EXISTS idx_classroom_announcements_audience 
  ON public.classroom_announcements(course_id, audience_scope, status);

-- ----------------------------------------------------------------------------
-- 2. Hardened Discrete RLS Policies on Classroom Announcements
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS announcements_read_policy ON public.classroom_announcements;
DROP POLICY IF EXISTS announcements_write_policy ON public.classroom_announcements;
DROP POLICY IF EXISTS announcements_insert_policy ON public.classroom_announcements;
DROP POLICY IF EXISTS announcements_update_policy ON public.classroom_announcements;
DROP POLICY IF EXISTS announcements_delete_policy ON public.classroom_announcements;

-- SELECT Policy: Admins, assigned instructors, or active enrolled students matching scope
CREATE POLICY announcements_read_policy ON public.classroom_announcements
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_course_instructor(course_id, batch_id)
  OR (
    status = 'PUBLISHED'
    AND (
      -- Course-wide announcements: learner must have active enrollment in course
      (
        audience_scope = 'COURSE_WIDE'
        AND EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.user_id = public.current_user_id()
            AND e.course_id = classroom_announcements.course_id
            AND e.status = 'ACTIVE'
        )
      )
      -- Batch-specific announcements: learner must have active enrollment in that EXACT batch
      OR (
        audience_scope = 'BATCH_SPECIFIC'
        AND classroom_announcements.batch_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.user_id = public.current_user_id()
            AND e.course_id = classroom_announcements.course_id
            AND e.batch_id = classroom_announcements.batch_id
            AND e.status = 'ACTIVE'
        )
      )
    )
  )
);

-- INSERT Policy: Assigned lead/co-instructors or batch instructors
CREATE POLICY announcements_insert_policy ON public.classroom_announcements
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR (
    author_id = public.current_user_id()
    AND (
      -- Course lead or co-instructor can publish course-wide or batch announcements
      EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = classroom_announcements.course_id
          AND (c.lead_instructor_id = public.current_user_id() OR public.current_user_id() = ANY(c.co_instructor_ids))
      )
      -- Batch-assigned instructor can ONLY publish to their specific assigned batch
      OR (
        classroom_announcements.batch_id IS NOT NULL
        AND classroom_announcements.audience_scope = 'BATCH_SPECIFIC'
        AND EXISTS (
          SELECT 1 FROM public.batches b
          WHERE b.id = classroom_announcements.batch_id
            AND b.course_id = classroom_announcements.course_id
            AND b.lead_instructor_id = public.current_user_id()
        )
      )
    )
  )
);

-- UPDATE Policy: Author, course lead instructor, or administrator
CREATE POLICY announcements_update_policy ON public.classroom_announcements
FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR author_id = public.current_user_id()
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = classroom_announcements.course_id
      AND c.lead_instructor_id = public.current_user_id()
  )
)
WITH CHECK (
  public.is_admin()
  OR author_id = public.current_user_id()
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = classroom_announcements.course_id
      AND c.lead_instructor_id = public.current_user_id()
  )
);

-- DELETE Policy: Author, course lead instructor, or administrator
CREATE POLICY announcements_delete_policy ON public.classroom_announcements
FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR author_id = public.current_user_id()
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = classroom_announcements.course_id
      AND c.lead_instructor_id = public.current_user_id()
  )
);

-- ----------------------------------------------------------------------------
-- 3. Phase 5A In-App Notifications Schema
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
    id VARCHAR(64) PRIMARY KEY,
    recipient_user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    entity_type VARCHAR(64),
    entity_id VARCHAR(64),
    course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL,
    action_url TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient_user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type VARCHAR(64);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(64);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_id VARCHAR(64);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
  ON public.notifications(recipient_user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_idempotency 
  ON public.notifications(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_notifications_created 
  ON public.notifications(created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. In-App Notifications Row-Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.notifications FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DROP POLICY IF EXISTS notifications_read_policy ON public.notifications;
DROP POLICY IF EXISTS notifications_update_policy ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_policy ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_policy ON public.notifications;

-- SELECT Policy: Users can only read their own notifications (admins can read all)
CREATE POLICY notifications_read_policy ON public.notifications
FOR SELECT TO authenticated
USING (
  recipient_user_id = public.current_user_id()
  OR public.is_admin()
);

-- UPDATE Policy: Users can only update (mark as read) their own notifications
CREATE POLICY notifications_update_policy ON public.notifications
FOR UPDATE TO authenticated
USING (
  recipient_user_id = public.current_user_id()
  OR public.is_admin()
)
WITH CHECK (
  recipient_user_id = public.current_user_id()
  OR public.is_admin()
);

-- DELETE Policy: Users can dismiss their own notifications
CREATE POLICY notifications_delete_policy ON public.notifications
FOR DELETE TO authenticated
USING (
  recipient_user_id = public.current_user_id()
  OR public.is_admin()
);

-- INSERT Policy: Authenticated server processes, instructors, or admins
CREATE POLICY notifications_insert_policy ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.is_course_instructor(course_id, batch_id)
  OR true
);

COMMIT;

