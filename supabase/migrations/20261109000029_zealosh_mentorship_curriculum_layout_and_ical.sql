-- ============================================================================
-- ZEALOSH LMS — MIGRATION 29
-- Milestone: ZM-IMPL-11 — Product Gap Closure
-- Entities:
--   1. Syllabus Versions & Historical Curriculum Snapshots
--   2. Protected Workspace Layout Customization
--   3. Instructor Office Hours & 1-on-1 Mentorship Appointments
--   4. iCal Calendar Subscription Feed Tokens
--   5. Official Meta WhatsApp Business API Opt-Ins & Message Audit
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SYLLABUS VERSIONS & HISTORICAL CURRICULUM SNAPSHOTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.syllabus_versions (
    id VARCHAR(64) PRIMARY KEY,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    changelog TEXT,
    tree_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    created_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_syllabus_versions_course_version UNIQUE (course_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_syllabus_versions_course_id ON public.syllabus_versions(course_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_versions_status ON public.syllabus_versions(status);

ALTER TABLE public.syllabus_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'syllabus_versions' AND policyname = 'syllabus_versions_read_policy'
    ) THEN
        CREATE POLICY syllabus_versions_read_policy ON public.syllabus_versions
            FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'syllabus_versions' AND policyname = 'syllabus_versions_admin_write'
    ) THEN
        CREATE POLICY syllabus_versions_admin_write ON public.syllabus_versions
            FOR ALL USING (
                auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR')
            );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. PROTECTED WORKSPACE LAYOUT CUSTOMIZATION
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_layouts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    layout_name VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
    widgets_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_layouts_user_layout UNIQUE (user_id, layout_name)
);

CREATE INDEX IF NOT EXISTS idx_workspace_layouts_user_id ON public.workspace_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_layouts_role ON public.workspace_layouts(role);

ALTER TABLE public.workspace_layouts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'workspace_layouts' AND policyname = 'workspace_layouts_owner_policy'
    ) THEN
        CREATE POLICY workspace_layouts_owner_policy ON public.workspace_layouts
            FOR ALL USING (
                auth.uid()::text = user_id OR
                auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ORG_ADMIN')
            );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. INSTRUCTOR OFFICE HOURS & 1-ON-1 MENTORSHIP APPOINTMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instructor_office_hours (
    id VARCHAR(64) PRIMARY KEY,
    instructor_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time VARCHAR(8) NOT NULL,
    end_time VARCHAR(8) NOT NULL,
    slot_duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_duration_minutes IN (15, 30, 45, 60)),
    max_students_per_slot INTEGER NOT NULL DEFAULT 1 CHECK (max_students_per_slot >= 1),
    location_type VARCHAR(32) NOT NULL DEFAULT 'VIRTUAL' CHECK (location_type IN ('VIRTUAL', 'IN_PERSON', 'HYBRID')),
    meeting_instructions TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instructor_office_hours_instructor ON public.instructor_office_hours(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_office_hours_course ON public.instructor_office_hours(course_id);

ALTER TABLE public.instructor_office_hours ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'instructor_office_hours' AND policyname = 'instructor_office_hours_read'
    ) THEN
        CREATE POLICY instructor_office_hours_read ON public.instructor_office_hours
            FOR SELECT USING (is_active = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'instructor_office_hours' AND policyname = 'instructor_office_hours_write'
    ) THEN
        CREATE POLICY instructor_office_hours_write ON public.instructor_office_hours
            FOR ALL USING (
                auth.uid()::text = instructor_id OR
                auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ORG_ADMIN')
            );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mentorship_appointments (
    id VARCHAR(64) PRIMARY KEY,
    office_hour_id VARCHAR(64) REFERENCES public.instructor_office_hours(id) ON DELETE SET NULL,
    instructor_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE SET NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(32) NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW')),
    meeting_room_id VARCHAR(128),
    student_notes TEXT,
    instructor_feedback TEXT,
    cancellation_reason TEXT,
    cancelled_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_mentorship_time_validity CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX IF NOT EXISTS idx_mentorship_appointments_instructor ON public.mentorship_appointments(instructor_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_mentorship_appointments_student ON public.mentorship_appointments(student_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_mentorship_appointments_status ON public.mentorship_appointments(status);

ALTER TABLE public.mentorship_appointments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'mentorship_appointments' AND policyname = 'mentorship_appointments_participant_policy'
    ) THEN
        CREATE POLICY mentorship_appointments_participant_policy ON public.mentorship_appointments
            FOR ALL USING (
                auth.uid()::text = student_id OR
                auth.uid()::text = instructor_id OR
                auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ORG_ADMIN')
            );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. iCAL CALENDAR SUBSCRIPTION FEED TOKENS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_feed_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token VARCHAR(128) NOT NULL UNIQUE,
    feed_name VARCHAR(100) NOT NULL DEFAULT 'Zealosh Institutional Calendar',
    scope VARCHAR(32) NOT NULL DEFAULT 'ALL' CHECK (scope IN ('ALL', 'CLASSES', 'EXAMS', 'MENTORSHIP')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_accessed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_feed_tokens_user ON public.calendar_feed_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_feed_tokens_token ON public.calendar_feed_tokens(token);

ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'calendar_feed_tokens' AND policyname = 'calendar_feed_tokens_user_policy'
    ) THEN
        CREATE POLICY calendar_feed_tokens_user_policy ON public.calendar_feed_tokens
            FOR ALL USING (
                auth.uid()::text = user_id OR
                auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ORG_ADMIN')
            );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. OFFICIAL META WHATSAPP BUSINESS API (WABA) OPT-INS & AUDIT
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_opt_ins (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    phone_number VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(16) NOT NULL DEFAULT 'OPTED_IN' CHECK (status IN ('OPTED_IN', 'OPTED_OUT')),
    opt_in_source VARCHAR(64) NOT NULL DEFAULT 'ENQUIRY_FORM',
    consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opt_out_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_ins_phone ON public.whatsapp_opt_ins(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_ins_status ON public.whatsapp_opt_ins(status);

ALTER TABLE public.whatsapp_opt_ins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_opt_ins' AND policyname = 'whatsapp_opt_ins_admin_policy'
    ) THEN
        CREATE POLICY whatsapp_opt_ins_admin_policy ON public.whatsapp_opt_ins
            FOR ALL USING (
                auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ORG_ADMIN', 'ADMISSIONS_OFFICER')
            );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    phone_number VARCHAR(32) NOT NULL,
    template_name VARCHAR(64) NOT NULL,
    direction VARCHAR(16) NOT NULL DEFAULT 'OUTBOUND' CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
    wamid VARCHAR(128),
    payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_phone ON public.whatsapp_message_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_status ON public.whatsapp_message_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_wamid ON public.whatsapp_message_logs(wamid);

ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_message_logs' AND policyname = 'whatsapp_message_logs_admin_policy'
    ) THEN
        CREATE POLICY whatsapp_message_logs_admin_policy ON public.whatsapp_message_logs
            FOR ALL USING (
                auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ORG_ADMIN', 'ADMISSIONS_OFFICER', 'SUPPORT_AGENT')
            );
    END IF;
END $$;

