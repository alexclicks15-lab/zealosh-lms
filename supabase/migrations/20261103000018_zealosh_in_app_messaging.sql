-- ============================================================================
-- ZEALOSH LMS — MILESTONE ZM-IMPL-01
-- Migration: 20261103000018_zealosh_in_app_messaging.sql
-- Workstream: Durable Direct-Message Database Persistence & Classroom Seam
-- Standards: ADR-002 (Defense-in-Depth RLS) & ADR-004 (PostgreSQL Sole Source of Truth)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Direct Messages Relational Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id VARCHAR(64) PRIMARY KEY,
  sender_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  sender_name TEXT NOT NULL,
  sender_role VARCHAR(32) NOT NULL CHECK (
    sender_role IN ('STUDENT', 'INSTRUCTOR', 'COURSE_MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF')
  ),
  recipient_id VARCHAR(64) REFERENCES public.users(id) ON DELETE RESTRICT,
  course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE RESTRICT,
  subject TEXT,
  content TEXT NOT NULL CHECK (
    char_length(trim(content)) > 0 AND char_length(content) <= 5000
  ),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  client_message_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_no_self_messaging CHECK (
    recipient_id IS NULL OR sender_id <> recipient_id
  )
);

-- ----------------------------------------------------------------------------
-- 2. Performance & Idempotency Indexes
-- ----------------------------------------------------------------------------

-- Recipient inbox & unread query optimization
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_read 
  ON public.direct_messages(recipient_id, read);

-- Sender conversation history
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender 
  ON public.direct_messages(sender_id, created_at DESC);

-- Academic course and batch conversation scoping
CREATE INDEX IF NOT EXISTS idx_direct_messages_course_batch 
  ON public.direct_messages(course_id, batch_id);

-- Chronological timeline ordering
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at 
  ON public.direct_messages(created_at ASC);

-- Idempotent submission index (scoped per sender)
CREATE UNIQUE INDEX IF NOT EXISTS idx_direct_messages_client_id 
  ON public.direct_messages(sender_id, client_message_id) 
  WHERE client_message_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can read messages they sent, messages addressed to them, or cohort broadcasts
DROP POLICY IF EXISTS direct_messages_select_policy ON public.direct_messages;
CREATE POLICY direct_messages_select_policy ON public.direct_messages
FOR SELECT TO authenticated
USING (
  sender_id = public.current_user_id()
  OR recipient_id = public.current_user_id()
  OR (
    recipient_id IS NULL AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.course_id = direct_messages.course_id
          AND e.user_id = public.current_user_id()
          AND e.status = 'ACTIVE'
      )
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = direct_messages.course_id
          AND (
            c.lead_instructor_id = public.current_user_id()
            OR public.current_user_id() = ANY(c.co_instructor_ids)
          )
      )
    )
  )
  OR public.is_admin()
);

-- INSERT Policy: Authenticated user can send messages as themselves (or admin)
DROP POLICY IF EXISTS direct_messages_insert_policy ON public.direct_messages;
CREATE POLICY direct_messages_insert_policy ON public.direct_messages
FOR INSERT TO authenticated
WITH CHECK (
  (sender_id = public.current_user_id() OR public.is_admin())
  AND (recipient_id IS NULL OR sender_id <> recipient_id)
);

-- UPDATE Policy: Only recipient (or admin) can update read status
DROP POLICY IF EXISTS direct_messages_update_policy ON public.direct_messages;
CREATE POLICY direct_messages_update_policy ON public.direct_messages
FOR UPDATE TO authenticated
USING (
  recipient_id = public.current_user_id()
  OR public.is_admin()
)
WITH CHECK (
  recipient_id = public.current_user_id()
  OR public.is_admin()
);

-- DELETE Policy: Messages are permanent institutional records; only admins can purge
DROP POLICY IF EXISTS direct_messages_delete_policy ON public.direct_messages;
CREATE POLICY direct_messages_delete_policy ON public.direct_messages
FOR DELETE TO authenticated
USING (
  public.is_admin()
);

COMMIT;

