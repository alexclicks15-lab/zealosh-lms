-- ============================================================================
-- ZEALOSH LMS — PHASE 5C.3: SUPPORT TICKETING, STUDENT HELPDESK & SERVICE OPERATIONS
-- Migration: 20261101000017_zealosh_support_ticketing_and_helpdesk.sql
-- Architecture: ADR-004 (Supabase PostgreSQL as Sole Authoritative Application Database)
-- Principle: Multi-Tenant Scoping, Role-Enforced RLS, Immutable Audit History & Concurrency Safety
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Preflight Fix: Diagnostic Event Permanent Immutability Trigger (Preflight 5.1)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_prevent_diagnostic_event_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'diagnostic_events is strictly immutable and append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_diagnostic_events ON public.diagnostic_events;
CREATE TRIGGER trg_protect_diagnostic_events
BEFORE UPDATE OR DELETE ON public.diagnostic_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_prevent_diagnostic_event_modification();

-- ----------------------------------------------------------------------------
-- 2. Concurrency-Safe Ticket Number Sequence & Helper Function
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_number_seq START 1001;

CREATE OR REPLACE FUNCTION public.next_support_ticket_number()
RETURNS TEXT AS $$
DECLARE
    seq_val BIGINT;
    year_val TEXT;
BEGIN
    seq_val := nextval('public.support_ticket_number_seq');
    year_val := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'ZL-' || year_val || '-' || lpad(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. Support Categories Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_categories (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL DEFAULT 'org-zealosh-main',
    name VARCHAR(128) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    requires_academic_context BOOLEAN NOT NULL DEFAULT FALSE,
    allow_attachments BOOLEAN NOT NULL DEFAULT TRUE,
    default_priority VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    default_team_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_categories_org_slug ON public.support_categories(organization_id, slug);

-- ----------------------------------------------------------------------------
-- 4. Support Teams Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_teams (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL DEFAULT 'org-zealosh-main',
    name VARCHAR(128) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    description TEXT,
    lead_user_id VARCHAR(64),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_teams_org_slug ON public.support_teams(organization_id, slug);

-- ----------------------------------------------------------------------------
-- 5. Support Team Members Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_team_members (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL DEFAULT 'org-zealosh-main',
    team_id VARCHAR(64) NOT NULL REFERENCES public.support_teams(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    membership_role VARCHAR(32) NOT NULL DEFAULT 'AGENT',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_team_members_unique ON public.support_team_members(team_id, user_id);
CREATE INDEX IF NOT EXISTS idx_support_team_members_user ON public.support_team_members(user_id);

-- ----------------------------------------------------------------------------
-- 6. Support SLA Policies Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_sla_policies (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL DEFAULT 'org-zealosh-main',
    name VARCHAR(128) NOT NULL,
    category_id VARCHAR(64) REFERENCES public.support_categories(id) ON DELETE SET NULL,
    priority VARCHAR(32) NOT NULL,
    first_response_target_hours NUMERIC(6, 2) NOT NULL DEFAULT 24.00,
    resolution_target_hours NUMERIC(6, 2) NOT NULL DEFAULT 72.00,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_sla_org_priority ON public.support_sla_policies(organization_id, priority, is_active);

-- ----------------------------------------------------------------------------
-- 7. Support Tickets Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL DEFAULT 'org-zealosh-main',
    ticket_number VARCHAR(32) NOT NULL,
    requester_user_id VARCHAR(64) NOT NULL,
    requester_role VARCHAR(32) NOT NULL DEFAULT 'STUDENT',
    requester_name VARCHAR(128) NOT NULL,
    requester_email VARCHAR(255) NOT NULL,
    category_id VARCHAR(64) NOT NULL REFERENCES public.support_categories(id) ON DELETE RESTRICT,
    category_name VARCHAR(128) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'NEW',
    priority VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    impact VARCHAR(32) DEFAULT 'MEDIUM',
    assigned_team_id VARCHAR(64) REFERENCES public.support_teams(id) ON DELETE SET NULL,
    assigned_team_name VARCHAR(128),
    assigned_agent_user_id VARCHAR(64),
    assigned_agent_name VARCHAR(128),
    assigned_agent_email VARCHAR(255),
    related_course_id VARCHAR(64),
    related_course_title VARCHAR(255),
    related_batch_id VARCHAR(64),
    related_batch_name VARCHAR(128),
    related_session_id VARCHAR(64),
    related_assignment_id VARCHAR(64),
    related_exam_attempt_id VARCHAR(64),
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by_user_id VARCHAR(64),
    closed_at TIMESTAMPTZ,
    closed_by_user_id VARCHAR(64),
    reopened_at TIMESTAMPTZ,
    reopened_by_user_id VARCHAR(64),
    reopen_count INTEGER NOT NULL DEFAULT 0,
    sla_policy_id VARCHAR(64) REFERENCES public.support_sla_policies(id) ON DELETE SET NULL,
    sla_status VARCHAR(32) NOT NULL DEFAULT 'NOT_CONFIGURED',
    first_response_due_at TIMESTAMPTZ,
    resolution_due_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraints on status and priority
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS chk_support_ticket_status;
ALTER TABLE public.support_tickets
    ADD CONSTRAINT chk_support_ticket_status
    CHECK (status IN ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED'));

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS chk_support_ticket_priority;
ALTER TABLE public.support_tickets
    ADD CONSTRAINT chk_support_ticket_priority
    CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'));

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS chk_support_ticket_sla_status;
ALTER TABLE public.support_tickets
    ADD CONSTRAINT chk_support_ticket_sla_status
    CHECK (sla_status IN ('NOT_CONFIGURED', 'WITHIN_SLA', 'WARNING', 'BREACHED', 'PAUSED'));

-- Indexes for lightning queue queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_org_number ON public.support_tickets(organization_id, ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_status_updated ON public.support_tickets(organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_team_status ON public.support_tickets(organization_id, assigned_team_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_agent_status ON public.support_tickets(organization_id, assigned_agent_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_requester ON public.support_tickets(organization_id, requester_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_category ON public.support_tickets(organization_id, category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_idempotency ON public.support_tickets(organization_id, idempotency_key);

-- ----------------------------------------------------------------------------
-- 8. Support Ticket Messages Table (Public Replies & Private Internal Notes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL DEFAULT 'org-zealosh-main',
    ticket_id VARCHAR(64) NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    author_user_id VARCHAR(64) NOT NULL,
    author_name VARCHAR(128) NOT NULL,
    author_role VARCHAR(32) NOT NULL DEFAULT 'STUDENT',
    visibility VARCHAR(32) NOT NULL DEFAULT 'PUBLIC',
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_ticket_messages DROP CONSTRAINT IF EXISTS chk_support_message_visibility;
ALTER TABLE public.support_ticket_messages
    ADD CONSTRAINT chk_support_message_visibility
    CHECK (visibility IN ('PUBLIC', 'INTERNAL'));

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_ticket_messages(ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_visibility ON public.support_ticket_messages(ticket_id, visibility, created_at ASC);

-- ----------------------------------------------------------------------------
-- 9. Support Ticket Events Table (Immutable Lifecycle & Audit Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_ticket_events (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL DEFAULT 'org-zealosh-main',
    ticket_id VARCHAR(64) NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    actor_user_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(128) NOT NULL,
    actor_role VARCHAR(32) NOT NULL DEFAULT 'STUDENT',
    event_type VARCHAR(64) NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_events_ticket ON public.support_ticket_events(ticket_id, created_at ASC);

-- Event immutability trigger
CREATE OR REPLACE FUNCTION public.trg_prevent_support_event_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'support_ticket_events is strictly immutable and append-only. Modification and deletion are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_support_events ON public.support_ticket_events;
CREATE TRIGGER trg_protect_support_events
BEFORE UPDATE OR DELETE ON public.support_ticket_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_prevent_support_event_modification();

-- ----------------------------------------------------------------------------
-- 10. Support Ticket Attachments Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_ticket_attachments (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL DEFAULT 'org-zealosh-main',
    ticket_id VARCHAR(64) NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    message_id VARCHAR(64) REFERENCES public.support_ticket_messages(id) ON DELETE CASCADE,
    uploaded_by_user_id VARCHAR(64) NOT NULL,
    storage_provider VARCHAR(32) NOT NULL DEFAULT 'SUPABASE_STORAGE',
    storage_bucket VARCHAR(64) NOT NULL DEFAULT 'support-attachments',
    storage_key VARCHAR(512) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    sanitized_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(128) NOT NULL,
    file_size INTEGER NOT NULL,
    checksum VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket ON public.support_ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_attachments_message ON public.support_ticket_attachments(message_id);

-- ----------------------------------------------------------------------------
-- 11. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.support_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Helper function: checks if user is in an active support team
CREATE OR REPLACE FUNCTION public.is_support_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.support_team_members
            WHERE user_id = auth.uid()::text
              AND is_active = TRUE
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11a. Categories: All authenticated can view active; admins can manage
CREATE POLICY support_categories_read_policy ON public.support_categories
FOR SELECT TO authenticated
USING (is_active = TRUE OR public.is_admin());

CREATE POLICY support_categories_admin_policy ON public.support_categories
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 11b. Teams: Authenticated can view active; admins can manage
CREATE POLICY support_teams_read_policy ON public.support_teams
FOR SELECT TO authenticated
USING (is_active = TRUE OR public.is_admin());

CREATE POLICY support_teams_admin_policy ON public.support_teams
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 11c. Tickets:
-- Requester can view own tickets
-- Support staff can view tickets in their organization
-- Admins have full access
CREATE POLICY support_tickets_select_policy ON public.support_tickets
FOR SELECT TO authenticated
USING (
    requester_user_id = auth.uid()::text
    OR public.is_support_staff()
    OR public.is_admin()
);

CREATE POLICY support_tickets_insert_policy ON public.support_tickets
FOR INSERT TO authenticated
WITH CHECK (
    requester_user_id = auth.uid()::text
    OR public.is_admin()
);

CREATE POLICY support_tickets_update_policy ON public.support_tickets
FOR UPDATE TO authenticated
USING (
    public.is_support_staff()
    OR public.is_admin()
    OR (requester_user_id = auth.uid()::text AND status IN ('WAITING_FOR_REQUESTER', 'RESOLVED'))
)
WITH CHECK (
    public.is_support_staff()
    OR public.is_admin()
    OR (requester_user_id = auth.uid()::text)
);

-- 11d. Messages:
-- Requester CANNOT see INTERNAL notes under any circumstance!
CREATE POLICY support_messages_select_policy ON public.support_ticket_messages
FOR SELECT TO authenticated
USING (
    (
        visibility = 'PUBLIC'
        AND EXISTS (
            SELECT 1 FROM public.support_tickets t
            WHERE t.id = ticket_id AND t.requester_user_id = auth.uid()::text
        )
    )
    OR public.is_support_staff()
    OR public.is_admin()
);

CREATE POLICY support_messages_insert_policy ON public.support_ticket_messages
FOR INSERT TO authenticated
WITH CHECK (
    (
        visibility = 'PUBLIC'
        AND EXISTS (
            SELECT 1 FROM public.support_tickets t
            WHERE t.id = ticket_id AND t.requester_user_id = auth.uid()::text
        )
    )
    OR (
        (visibility IN ('PUBLIC', 'INTERNAL'))
        AND (public.is_support_staff() OR public.is_admin())
    )
);

-- 11e. Events: Requesters see lifecycle events except internal notes and internal SLA escalations
CREATE POLICY support_events_select_policy ON public.support_ticket_events
FOR SELECT TO authenticated
USING (
    (
        event_type NOT IN ('INTERNAL_NOTE_ADDED', 'SLA_WARNING', 'SLA_BREACHED', 'ESCALATED')
        AND EXISTS (
            SELECT 1 FROM public.support_tickets t
            WHERE t.id = ticket_id AND t.requester_user_id = auth.uid()::text
        )
    )
    OR public.is_support_staff()
    OR public.is_admin()
);

CREATE POLICY support_events_insert_policy ON public.support_ticket_events
FOR INSERT TO authenticated
WITH CHECK (
    public.is_support_staff()
    OR public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = ticket_id AND t.requester_user_id = auth.uid()::text
    )
);

-- Database Grants
GRANT ALL ON public.support_categories TO service_role;
GRANT SELECT ON public.support_categories TO authenticated;
GRANT ALL ON public.support_categories TO postgres;

GRANT ALL ON public.support_teams TO service_role;
GRANT SELECT ON public.support_teams TO authenticated;

GRANT ALL ON public.support_team_members TO service_role;
GRANT SELECT ON public.support_team_members TO authenticated;

GRANT ALL ON public.support_sla_policies TO service_role;
GRANT SELECT ON public.support_sla_policies TO authenticated;

GRANT ALL ON public.support_tickets TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;

GRANT ALL ON public.support_ticket_messages TO service_role;
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;

GRANT ALL ON public.support_ticket_events TO service_role;
GRANT SELECT, INSERT ON public.support_ticket_events TO authenticated;

GRANT ALL ON public.support_ticket_attachments TO service_role;
GRANT SELECT, INSERT ON public.support_ticket_attachments TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE public.support_ticket_number_seq TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 12. Standard Institutional Seed Categories
-- ----------------------------------------------------------------------------
INSERT INTO public.support_categories (id, organization_id, name, slug, description, is_active, requires_academic_context, allow_attachments, default_priority)
VALUES
    ('cat_acc_access', 'org-zealosh-main', 'Account & Login Access', 'account-access', 'Issues logging in, password reset, profile verification, or multi-factor authentication.', TRUE, FALSE, TRUE, 'NORMAL'),
    ('cat_crs_cohort', 'org-zealosh-main', 'Course & Cohort Batch', 'course-cohort', 'Cohort batch allocation, timetable schedule, course materials, or enrollment transfer inquiries.', TRUE, TRUE, TRUE, 'NORMAL'),
    ('cat_assignments', 'org-zealosh-main', 'Assignments & Classwork', 'assignments-classwork', 'Questions regarding assignment instructions, rubric criteria, submission attachments, or resubmission requests.', TRUE, TRUE, TRUE, 'NORMAL'),
    ('cat_formative_quiz', 'org-zealosh-main', 'Formative Practice Quizzes', 'formative-quizzes', 'Inquiries regarding module review quizzes, formative scoring, or question explanations.', TRUE, TRUE, TRUE, 'LOW'),
    ('cat_hse_exams', 'org-zealosh-main', 'HSE Certification Examinations', 'hse-examinations', 'Technical inquiries during formal timed exams, blueprint coverage, proctoring issues, or manual evaluations.', TRUE, TRUE, TRUE, 'HIGH'),
    ('cat_live_class', 'org-zealosh-main', 'Live Classroom & WebRTC', 'live-classroom', 'Audio, microphone, webcam, screen-sharing, or connection issues in live interactive classrooms.', TRUE, TRUE, TRUE, 'HIGH'),
    ('cat_certificates', 'org-zealosh-main', 'Certificates & Credentials', 'certificates', 'Issuance, verification, credential download, or name correction on certificates.', TRUE, TRUE, TRUE, 'NORMAL'),
    ('cat_technical', 'org-zealosh-main', 'Technical Issues & Bugs', 'technical-issues', 'Application crashes, browser compatibility issues, mobile responsiveness, or broken buttons.', TRUE, FALSE, TRUE, 'NORMAL'),
    ('cat_payment_query', 'org-zealosh-main', 'Payment or Invoice Query (Intake Only)', 'payment-invoice-query', 'General questions regarding receipt access, invoice references, or payment status. Support intake only; no financial modifications.', TRUE, FALSE, TRUE, 'NORMAL'),
    ('cat_institutional', 'org-zealosh-main', 'General Institutional Inquiries', 'general-institutional', 'Administrative policies, academic advisory, consulting services, and general support.', TRUE, FALSE, TRUE, 'LOW')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- Standard Support Teams
INSERT INTO public.support_teams (id, organization_id, name, slug, description, is_active)
VALUES
    ('team_student_services', 'org-zealosh-main', 'Student Academic Services', 'student-services', 'Handles student enrollment, cohort batches, attendance, and coursework inquiries.', TRUE),
    ('team_technical_ops', 'org-zealosh-main', 'Technical Operations & Infrastructure', 'tech-ops', 'Handles platform errors, live classroom connectivity, video streaming, and system bugs.', TRUE),
    ('team_exam_governance', 'org-zealosh-main', 'Examination & Certification Board', 'exam-board', 'Specialized team handling HSE high-stakes examination integrity, evaluation review, and certificate issuance.', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

COMMIT;
