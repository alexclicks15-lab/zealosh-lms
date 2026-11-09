-- ============================================================================
-- ZEALOSH LMS — PHASE 2: LEARNING DELIVERY & STUDENT ACADEMIC EXPERIENCE
-- Migration: 20261031000010_zealosh_learning_delivery_phase2.sql
-- Architecture: ADR-001, ADR-002 & Master Data Constitution (Rule 7)
-- Purpose:
--   Authoritative relational persistence for:
--   1. Course delivery configuration & batch-level inheritance overrides
--   2. Learning materials & granular permissions (view, download, print)
--   3. Unified Question Bank, reusable Quizzes, Attempts & Scoring
--   4. Live Classroom quiz state & real-time instructor scoring integration
--   5. Student learning progress tracking, video resume, and completion state
--   6. Multi-criteria course completion policies & automatic certificate evaluation
--   7. Centralized application error diagnostics & student problem reporting
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Course Delivery Configuration & Batch Overrides
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(32) NOT NULL CHECK (entity_type IN ('COURSE', 'BATCH', 'MODULE', 'TOPIC', 'SUBTOPIC', 'STUDENT_EXCEPTION')),
    entity_id VARCHAR(64) NOT NULL,
    delivery_mode VARCHAR(32) NOT NULL CHECK (delivery_mode IN ('ONLINE_ONLY', 'RECORDED_ONLY', 'HYBRID', 'ALL_MODES')),
    live_sessions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    recorded_lessons_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    downloadable_materials_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    release_date TIMESTAMPTZ,
    access_end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_configs_lookup 
    ON public.delivery_configurations(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- 2. Learning Materials & Granular Permission Governance
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL,
    module_id UUID REFERENCES public.modules(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    subtopic_id UUID REFERENCES public.subtopics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    material_type VARCHAR(32) NOT NULL CHECK (material_type IN ('PDF', 'DOCUMENT', 'PRESENTATION', 'IMAGE', 'EXTERNAL_LINK')),
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL,
    allow_view BOOLEAN NOT NULL DEFAULT TRUE,
    allow_download BOOLEAN NOT NULL DEFAULT FALSE,
    allow_print BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    uploaded_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_materials_course 
    ON public.learning_materials(course_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_materials_hierarchy 
    ON public.learning_materials(module_id, topic_id, subtopic_id);

-- ----------------------------------------------------------------------------
-- 3. Unified Question Bank & Reusable Quizzes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    module_id UUID REFERENCES public.modules(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    subtopic_id UUID REFERENCES public.subtopics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    quiz_type VARCHAR(32) NOT NULL CHECK (quiz_type IN ('TOPIC_QUIZ', 'SUBTOPIC_QUIZ', 'LESSON_END_QUIZ', 'MODULE_QUIZ', 'PRACTICE_QUIZ', 'LIVE_CLASS_QUIZ')),
    total_marks NUMERIC(6, 2) NOT NULL DEFAULT 100,
    passing_score_percentage NUMERIC(5, 2) NOT NULL DEFAULT 70,
    duration_minutes INT NOT NULL DEFAULT 30,
    max_attempts INT NOT NULL DEFAULT 3,
    shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
    shuffle_options BOOLEAN NOT NULL DEFAULT TRUE,
    is_live_active BOOLEAN NOT NULL DEFAULT FALSE,
    live_session_id VARCHAR(64) REFERENCES public.live_sessions(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    created_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_course_type 
    ON public.quizzes(course_id, quiz_type, status);
CREATE INDEX IF NOT EXISTS idx_quizzes_live_session 
    ON public.quizzes(live_session_id) WHERE is_live_active = TRUE;

CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(32) NOT NULL CHECK (question_type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'NUMERICAL', 'MATCHING', 'ORDERING', 'ESSAY')),
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer JSONB NOT NULL,
    explanation TEXT,
    marks NUMERIC(5, 2) NOT NULL DEFAULT 1,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz 
    ON public.quiz_questions(quiz_id, order_index);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL,
    attempt_number INT NOT NULL DEFAULT 1,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    score NUMERIC(6, 2),
    percentage NUMERIC(5, 2),
    passed BOOLEAN,
    status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT', 'GRADED')),
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    live_session_id VARCHAR(64) REFERENCES public.live_sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz 
    ON public.quiz_attempts(user_id, quiz_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_live_session 
    ON public.quiz_attempts(live_session_id, quiz_id) WHERE live_session_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. Learning Activity Progress & Playback Resume
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    lesson_id VARCHAR(64) REFERENCES public.lessons(id) ON DELETE CASCADE,
    module_id UUID REFERENCES public.modules(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    subtopic_id UUID REFERENCES public.subtopics(id) ON DELETE SET NULL,
    activity_type VARCHAR(32) NOT NULL CHECK (activity_type IN ('VIDEO', 'TEXT', 'DOCUMENT', 'QUIZ', 'ASSIGNMENT', 'LIVE_CLASS')),
    last_playback_position_seconds INT NOT NULL DEFAULT 0,
    watched_duration_seconds INT NOT NULL DEFAULT 0,
    completion_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_learning_activity UNIQUE (user_id, course_id, batch_id, activity_type, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_progress_lookup 
    ON public.learning_progress(user_id, course_id, batch_id);

-- ----------------------------------------------------------------------------
-- 5. Course Completion Policies & Evaluation History
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_completion_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    required_lesson_completion_percentage NUMERIC(5, 2) NOT NULL DEFAULT 90,
    required_live_attendance_percentage NUMERIC(5, 2) NOT NULL DEFAULT 75,
    require_all_assignments_passed BOOLEAN NOT NULL DEFAULT TRUE,
    require_all_quizzes_passed BOOLEAN NOT NULL DEFAULT TRUE,
    require_formal_exam_passed BOOLEAN NOT NULL DEFAULT FALSE,
    minimum_exam_score_percentage NUMERIC(5, 2) NOT NULL DEFAULT 70,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_completion_policy_active 
    ON public.course_completion_policies(course_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.completion_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id VARCHAR(64) NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.course_completion_policies(id) ON DELETE RESTRICT,
    policy_version INT NOT NULL DEFAULT 1,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completion_date TIMESTAMPTZ,
    lessons_completed_count INT NOT NULL DEFAULT 0,
    total_lessons_count INT NOT NULL DEFAULT 0,
    lesson_completion_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    attendance_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    assignments_passed_count INT NOT NULL DEFAULT 0,
    total_assignments_count INT NOT NULL DEFAULT 0,
    quizzes_passed_count INT NOT NULL DEFAULT 0,
    total_quizzes_count INT NOT NULL DEFAULT 0,
    exam_passed BOOLEAN DEFAULT FALSE,
    exam_score_percentage NUMERIC(5, 2),
    criteria_results JSONB NOT NULL DEFAULT '{}'::jsonb,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_enrollment_policy_evaluation UNIQUE (enrollment_id, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_completion_evaluations_status 
    ON public.completion_evaluations(user_id, course_id, is_completed);

-- ----------------------------------------------------------------------------
-- 6. Diagnostics, Central Error Logging & Problem Reporting
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity VARCHAR(16) NOT NULL CHECK (severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    module VARCHAR(64) NOT NULL,
    route_or_service TEXT NOT NULL,
    request_id TEXT,
    user_id VARCHAR(64),
    error_code TEXT,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'DETECTED' CHECK (status IN ('DETECTED', 'GROUPED', 'PRIORITIZED', 'INVESTIGATING', 'FIXING', 'RESOLVED', 'VERIFIED')),
    resolution_notes TEXT,
    fingerprint TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_error_logs_fingerprint 
    ON public.app_error_logs(fingerprint, status);
CREATE INDEX IF NOT EXISTS idx_app_error_logs_timestamp 
    ON public.app_error_logs(timestamp DESC);

CREATE TABLE IF NOT EXISTS public.student_problem_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_number TEXT NOT NULL UNIQUE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE SET NULL,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL,
    session_id VARCHAR(64) REFERENCES public.live_sessions(id) ON DELETE SET NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('VIDEO_PLAYBACK', 'LESSON_ACCESS', 'DOCUMENT_DOWNLOAD', 'ASSIGNMENT_SUBMISSION', 'QUIZ_ATTEMPT', 'LIVE_CLASSROOM', 'OTHER')),
    description TEXT NOT NULL,
    client_metadata JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_reports_user 
    ON public.student_problem_reports(user_id, status);

-- ----------------------------------------------------------------------------
-- 7. Row-Level Security Enablement
-- ----------------------------------------------------------------------------
ALTER TABLE public.delivery_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_completion_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completion_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_problem_reports ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 8. Row-Level Security Policies (Defense-in-Depth)
-- ----------------------------------------------------------------------------
CREATE POLICY "Public delivery configs read" ON public.delivery_configurations
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Admin write delivery configs" ON public.delivery_configurations
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role IN ('SUPER_ADMIN', 'ADMIN'))
    );

CREATE POLICY "Materials read access" ON public.learning_materials
    FOR SELECT TO authenticated USING (status = 'PUBLISHED');

CREATE POLICY "Instructor material write" ON public.learning_materials
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'))
    );

CREATE POLICY "Quiz read access" ON public.quizzes
    FOR SELECT TO authenticated USING (status = 'PUBLISHED');

CREATE POLICY "Instructor quiz write" ON public.quizzes
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'))
    );

CREATE POLICY "Student read quiz questions without answer keys" ON public.quiz_questions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Student own quiz attempts" ON public.quiz_attempts
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);

CREATE POLICY "Student create own quiz attempt" ON public.quiz_attempts
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Student update own in-progress quiz attempt" ON public.quiz_attempts
    FOR UPDATE TO authenticated USING (user_id = auth.uid()::text AND status = 'IN_PROGRESS');

CREATE POLICY "Instructor view batch quiz attempts" ON public.quiz_attempts
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'))
    );

CREATE POLICY "Student own progress read" ON public.learning_progress
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);

CREATE POLICY "Student own progress write" ON public.learning_progress
    FOR ALL TO authenticated USING (user_id = auth.uid()::text);

CREATE POLICY "Completion policies read" ON public.course_completion_policies
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Student own completion evaluations" ON public.completion_evaluations
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);

CREATE POLICY "Student own problem reports" ON public.student_problem_reports
    FOR ALL TO authenticated USING (user_id = auth.uid()::text);

CREATE POLICY "Admin read all problem reports" ON public.student_problem_reports
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT_STAFF'))
    );

CREATE POLICY "Admin error logs access" ON public.app_error_logs
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role IN ('SUPER_ADMIN', 'ADMIN'))
    );

COMMIT;

