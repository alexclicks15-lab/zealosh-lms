-- ============================================================================
-- ZEALOSH LMS — TRACK 3: INSTITUTIONAL SCHEDULING, ORIENTATION & MESSAGING
-- Migration: 20261108000025_zealosh_scheduling_orientation_and_messaging.sql
-- Architecture: Unified Calendar Aggregator, Course Orientation Gating,
--               and Isolated Group, Course & Batch Messaging Channels
-- Standards: ADR-002 (Defense-in-Depth RLS) & ADR-004 (Supabase Single Source of Truth)
-- Brand: Zealosh Training & Consultants
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Institutional Holidays Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institutional_holidays (
    id VARCHAR(64) PRIMARY KEY,
    name TEXT NOT NULL,
    date DATE NOT NULL UNIQUE,
    description TEXT,
    affects_batches BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institutional_holidays_date ON public.institutional_holidays(date);

-- ----------------------------------------------------------------------------
-- 2. Course-Specific Orientation Configuration Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_orientation_configs (
    course_id VARCHAR(64) PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    mode VARCHAR(32) NOT NULL DEFAULT 'ONLINE' CHECK (mode IN ('ONLINE', 'PHYSICAL', 'HYBRID')),
    session_capacity INT NOT NULL DEFAULT 50 CHECK (session_capacity > 0),
    booking_window_days INT NOT NULL DEFAULT 14 CHECK (booking_window_days > 0),
    instructions TEXT,
    venue_details TEXT,
    reminder_hours_before INT NOT NULL DEFAULT 24,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Orientation Sessions Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orientation_sessions (
    id VARCHAR(64) PRIMARY KEY,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    mode VARCHAR(32) NOT NULL DEFAULT 'ONLINE' CHECK (mode IN ('ONLINE', 'PHYSICAL', 'HYBRID')),
    scheduled_start_time TIMESTAMPTZ NOT NULL,
    scheduled_end_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    time_zone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    capacity INT NOT NULL DEFAULT 50 CHECK (capacity > 0),
    booked_count INT NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
    coordinator_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    meeting_id VARCHAR(128),
    venue_details TEXT,
    instructions TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED' CHECK (
        status IN ('SCHEDULED', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_orientation_capacity CHECK (booked_count <= capacity),
    CONSTRAINT chk_orientation_time CHECK (scheduled_end_time > scheduled_start_time)
);

CREATE INDEX IF NOT EXISTS idx_orientation_sessions_course ON public.orientation_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_orientation_sessions_time ON public.orientation_sessions(scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_orientation_sessions_coordinator ON public.orientation_sessions(coordinator_id);

-- ----------------------------------------------------------------------------
-- 4. Orientation Bookings Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orientation_bookings (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES public.orientation_sessions(id) ON DELETE CASCADE,
    application_id VARCHAR(64) NOT NULL REFERENCES public.admission_applications(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    course_id VARCHAR(64) NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'BOOKED' CHECK (
        status IN ('BOOKED', 'CONFIRMED', 'ATTENDED', 'ABSENT', 'CANCELLED', 'RESCHEDULED', 'WAITLISTED')
    ),
    booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attendance_marked_at TIMESTAMPTZ,
    attendance_marked_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    attendance_source VARCHAR(32) CHECK (
        attendance_source IN ('MANUAL_COORDINATOR', 'VC_PROVIDER', 'ADMIN_OVERRIDE')
    ),
    notes TEXT,
    idempotency_key VARCHAR(128),
    CONSTRAINT uq_user_course_active_booking UNIQUE (user_id, course_id, status)
);

CREATE INDEX IF NOT EXISTS idx_orientation_bookings_session ON public.orientation_bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_orientation_bookings_user ON public.orientation_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_orientation_bookings_app ON public.orientation_bookings(application_id);

-- ----------------------------------------------------------------------------
-- 5. Conversations / Messaging Channels Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32) NOT NULL DEFAULT 'GROUP' CHECK (
        type IN ('DIRECT', 'GROUP', 'COURSE', 'BATCH', 'STAFF')
    ),
    title TEXT NOT NULL,
    description TEXT,
    course_id VARCHAR(64) REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) REFERENCES public.batches(id) ON DELETE CASCADE,
    created_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_cross_batch BOOLEAN NOT NULL DEFAULT FALSE,
    cross_batch_approved_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    member_count INT NOT NULL DEFAULT 1 CHECK (member_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_course_batch ON public.conversations(course_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON public.conversations(created_by);

-- ----------------------------------------------------------------------------
-- 6. Conversation Memberships Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    user_role VARCHAR(32) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'MODERATOR', 'MEMBER')),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (
        status IN ('ACTIVE', 'INVITED', 'REQUESTED', 'REMOVED', 'MUTED')
    ),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT uq_conversation_member UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON public.conversation_members(conversation_id);

-- ----------------------------------------------------------------------------
-- 7. Channel Messages Table (with Threading & Attachments)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    sender_name TEXT NOT NULL,
    sender_role VARCHAR(32) NOT NULL,
    content TEXT NOT NULL CHECK (
        char_length(trim(content)) > 0 AND char_length(content) <= 5000
    ),
    parent_message_id VARCHAR(64) REFERENCES public.channel_messages(id) ON DELETE CASCADE,
    attachments JSONB DEFAULT '[]'::jsonb,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    client_message_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_conv_created ON public.channel_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_channel_messages_parent ON public.channel_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_sender ON public.channel_messages(sender_id);

-- ----------------------------------------------------------------------------
-- 8. Channel Moderation Reports Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_moderation_reports (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    message_id VARCHAR(64) NOT NULL REFERENCES public.channel_messages(id) ON DELETE CASCADE,
    reported_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    action_taken VARCHAR(32) DEFAULT 'NONE' CHECK (
        action_taken IN ('NONE', 'MESSAGE_DELETED', 'USER_WARNED', 'USER_MUTED', 'USER_REMOVED')
    ),
    moderator_notes TEXT, -- Strictly staff-only
    reviewed_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_moderation_conv ON public.channel_moderation_reports(conversation_id);
CREATE INDEX IF NOT EXISTS idx_channel_moderation_status ON public.channel_moderation_reports(status);

-- ----------------------------------------------------------------------------
-- 9. Atomic Booking Stored Procedure
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_book_orientation_session(
    p_session_id VARCHAR(64),
    p_application_id VARCHAR(64),
    p_user_id VARCHAR(64),
    p_user_email TEXT,
    p_user_name TEXT,
    p_course_id VARCHAR(64),
    p_idempotency_key VARCHAR(128) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_existing RECORD;
    v_booking_id VARCHAR(64);
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Check if user already booked this session or course actively
    SELECT * INTO v_existing FROM public.orientation_bookings
    WHERE user_id = p_user_id 
      AND course_id = p_course_id
      AND status IN ('BOOKED', 'CONFIRMED', 'ATTENDED');

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ALREADY_BOOKED',
            'bookingId', v_existing.id,
            'message', 'Candidate already has an active orientation booking for this course'
        );
    END IF;

    -- 2. Lock session row for update to guarantee concurrency safety
    SELECT * INTO v_session FROM public.orientation_sessions
    WHERE id = p_session_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SESSION_NOT_FOUND');
    END IF;

    IF v_session.status = 'CANCELLED' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SESSION_CANCELLED');
    END IF;

    -- 3. Atomic capacity check
    IF v_session.booked_count >= v_session.capacity THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'SESSION_FULL',
            'message', 'This orientation session has reached maximum capacity'
        );
    END IF;

    -- 4. Create booking
    v_booking_id := 'obk-' || SUBSTRING(MD5(RANDOM()::TEXT || v_now::TEXT) FROM 1 FOR 12);

    INSERT INTO public.orientation_bookings (
        id, session_id, application_id, user_id, user_email, user_name, course_id, status, booked_at, idempotency_key
    ) VALUES (
        v_booking_id, p_session_id, p_application_id, p_user_id, p_user_email, p_user_name, p_course_id, 'CONFIRMED', v_now, p_idempotency_key
    );

    -- 5. Increment session booked count
    UPDATE public.orientation_sessions
    SET booked_count = booked_count + 1, updated_at = v_now
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'bookingId', v_booking_id,
        'sessionId', p_session_id,
        'status', 'CONFIRMED'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.institutional_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_orientation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orientation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orientation_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_moderation_reports ENABLE ROW LEVEL SECURITY;

-- Holidays: All authenticated users can read; admins can write
CREATE POLICY holidays_read_policy ON public.institutional_holidays
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY holidays_admin_policy ON public.institutional_holidays
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Course Orientation Config: Read for authenticated; write for admin
CREATE POLICY orientation_configs_read ON public.course_orientation_configs
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY orientation_configs_write ON public.course_orientation_configs
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Orientation Sessions: Read for authenticated; write for coordinator or admin
CREATE POLICY orientation_sessions_read ON public.orientation_sessions
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY orientation_sessions_write ON public.orientation_sessions
    FOR ALL TO authenticated 
    USING (public.is_admin() OR coordinator_id = public.current_user_id())
    WITH CHECK (public.is_admin() OR coordinator_id = public.current_user_id());

-- Orientation Bookings: Students can read their own bookings; staff/admin can read all
CREATE POLICY orientation_bookings_read ON public.orientation_bookings
    FOR SELECT TO authenticated 
    USING (user_id = public.current_user_id() OR public.is_admin());

-- Conversations: Users can read if they are an active member or admin
CREATE POLICY conversations_read_policy ON public.conversations
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = conversations.id
              AND cm.user_id = public.current_user_id()
              AND cm.status = 'ACTIVE'
        )
    );

-- Conversation Members: Users can view members of conversations they belong to
CREATE POLICY conversation_members_read ON public.conversation_members
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR user_id = public.current_user_id()
        OR EXISTS (
            SELECT 1 FROM public.conversation_members self
            WHERE self.conversation_id = conversation_members.conversation_id
              AND self.user_id = public.current_user_id()
              AND self.status = 'ACTIVE'
        )
    );

-- Channel Messages: Read only for active conversation members
CREATE POLICY channel_messages_read ON public.channel_messages
    FOR SELECT TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = channel_messages.conversation_id
              AND cm.user_id = public.current_user_id()
              AND cm.status = 'ACTIVE'
        )
    );

-- Channel Moderation Reports: Staff & Admins only
CREATE POLICY channel_moderation_read ON public.channel_moderation_reports
    FOR SELECT TO authenticated
    USING (public.is_admin());

COMMIT;

