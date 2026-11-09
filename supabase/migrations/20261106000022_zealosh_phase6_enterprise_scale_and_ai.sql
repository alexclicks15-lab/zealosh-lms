-- Zealosh LMS — Authoritative Database Migration
-- Phase 6: Advanced Academic Workflows, Enterprise Scale & AI Seams
-- File: supabase/migrations/20261106000022_zealosh_phase6_enterprise_scale_and_ai.sql

-- 1. Academic Interventions Table
CREATE TABLE IF NOT EXISTS public.academic_interventions (
  id VARCHAR(64) PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  instructor_id VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  intervention_type VARCHAR(32) NOT NULL DEFAULT 'PROGRESS_BEHIND',
  notes TEXT,
  action_taken TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT fk_interventions_batch FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_interventions_course FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_interventions_student FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_interventions_instructor FOREIGN KEY (instructor_id) REFERENCES public.users(id) ON DELETE RESTRICT
);

-- 2. AI Tutor Sessions and Messages
CREATE TABLE IF NOT EXISTS public.ai_tutor_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ai_sessions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_sessions_course FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.ai_tutor_messages (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  citations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ai_messages_session FOREIGN KEY (session_id) REFERENCES public.ai_tutor_sessions(id) ON DELETE CASCADE
);

-- 3. Composite Performance & Concurrency Indexes (Enterprise Scale)
CREATE INDEX IF NOT EXISTS idx_enrollments_user_course_status 
  ON public.enrollments (user_id, course_id, status);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz_status 
  ON public.quiz_attempts (user_id, quiz_id, status);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_user 
  ON public.assignment_submissions (assignment_id, user_id);

CREATE INDEX IF NOT EXISTS idx_academic_interventions_batch_student 
  ON public.academic_interventions (batch_id, student_id);

CREATE INDEX IF NOT EXISTS idx_academic_interventions_status 
  ON public.academic_interventions (status);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_sessions_user_course 
  ON public.ai_tutor_sessions (user_id, course_id);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_messages_session_created 
  ON public.ai_tutor_messages (session_id, created_at ASC);

-- 4. Row-Level Security (RLS) Enablement & Isolation
ALTER TABLE public.academic_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tutor_messages ENABLE ROW LEVEL SECURITY;

-- Learners can only view their own interventions
CREATE POLICY rls_interventions_student_select ON public.academic_interventions
  FOR SELECT USING (student_id = auth.uid()::text);

-- Instructors and Admins have full access to interventions
CREATE POLICY rls_interventions_staff_all ON public.academic_interventions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid()::text 
        AND u.role IN ('INSTRUCTOR', 'ORG_ADMIN', 'SUPER_ADMIN')
    )
  );

-- Learners can only access their own AI Tutor sessions
CREATE POLICY rls_ai_sessions_owner ON public.ai_tutor_sessions
  FOR ALL USING (user_id = auth.uid()::text);

-- Learners can only access messages in their own sessions
CREATE POLICY rls_ai_messages_owner ON public.ai_tutor_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.ai_tutor_sessions s
      WHERE s.id = ai_tutor_messages.session_id
        AND s.user_id = auth.uid()::text
    )
  );

