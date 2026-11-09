-- ============================================================================
-- ZEALOSH LMS — MILESTONE ZM-IMPL-08G: TRACK 6 ENTERPRISE OPERATIONS & OUTBOX
-- Migration: 20261108000028_zealosh_enterprise_operations_pwa_and_event_outbox.sql
-- Single-Institution Enterprise Operations, Central Transactional Event Outbox,
-- Multi-Worker Dispatcher, Consumer Inbox, Domain Reconciliation,
-- Administrative Maintenance Mode, Institutional Audit Archives, and PWA Offline Sync
-- ============================================================================

-- 1. Domain Registry (Authoritative 20-Domain Inventory)
CREATE TABLE IF NOT EXISTS public.domain_registry (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    owner TEXT NOT NULL,
    authoritative_tables TEXT[] NOT NULL DEFAULT '{}',
    permitted_publishers TEXT[] NOT NULL DEFAULT '{}',
    permitted_consumers TEXT[] NOT NULL DEFAULT '{}',
    supported_event_types TEXT[] NOT NULL DEFAULT '{}',
    contract_versions TEXT[] NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    operational_health TEXT NOT NULL DEFAULT 'HEALTHY' CHECK (operational_health IN ('HEALTHY', 'DEGRADED', 'DOWN', 'UNCONFIGURED', 'MAINTENANCE')),
    last_successful_processing_time TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed authoritative 20 institutional domains
INSERT INTO public.domain_registry (id, display_name, owner, authoritative_tables, permitted_publishers, permitted_consumers, supported_event_types, contract_versions, enabled, operational_health)
VALUES
    ('IDENTITY', 'GoTrue Identity & Profiles', 'Security & Directory Services', ARRAY['profiles', 'user_sessions'], ARRAY['IDENTITY'], ARRAY['ACADEMIC', 'ADMISSIONS', 'COMMERCE', 'NOTIFICATIONS', 'AUDIT'], ARRAY['identity.user.created', 'identity.user.updated', 'identity.role.changed', 'identity.session.revoked'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('ACADEMIC', 'Academic Core & Curriculum', 'Academic Directorate', ARRAY['courses', 'batches', 'modules', 'topics', 'lessons'], ARRAY['ACADEMIC'], ARRAY['CLASSROOM', 'ADMISSIONS', 'COMMERCE', 'ASSESSMENT', 'NOTIFICATIONS'], ARRAY['academic.course.published', 'academic.batch.created', 'academic.lesson.completed'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('ADMISSIONS', '14-Stage Admissions Pipeline', 'Admissions Directorate', ARRAY['leads', 'applicant_documents', 'admission_offers', 'admissions_pipeline'], ARRAY['ADMISSIONS'], ARRAY['ACADEMIC', 'ENTITLEMENTS', 'COMMERCE', 'NOTIFICATIONS', 'AUDIT'], ARRAY['admissions.lead.captured', 'admissions.stage.changed', 'admissions.student.admitted'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('COMMERCE', 'Decoupled Products & Orders', 'Finance & Bursary', ARRAY['products', 'product_offerings', 'payment_orders', 'invoices'], ARRAY['COMMERCE'], ARRAY['ENTITLEMENTS', 'ADMISSIONS', 'GROWTH', 'NOTIFICATIONS', 'AUDIT'], ARRAY['commerce.order.created', 'commerce.order.paid', 'commerce.order.refunded'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('ENTITLEMENTS', 'Server-Authoritative Entitlements', 'Registrar & Access Control', ARRAY['user_entitlements'], ARRAY['COMMERCE', 'ADMISSIONS', 'ENTITLEMENTS'], ARRAY['ACADEMIC', 'MEDIA', 'CLASSROOM', 'ASSESSMENT'], ARRAY['entitlements.access.granted', 'entitlements.access.revoked', 'entitlements.access.suspended'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('SCHEDULING', 'Institutional Master Calendar', 'Academic Operations & Scheduling', ARRAY['institutional_holidays', 'course_orientation_configs', 'orientation_sessions', 'orientation_bookings'], ARRAY['SCHEDULING'], ARRAY['CLASSROOM', 'ADMISSIONS', 'NOTIFICATIONS'], ARRAY['scheduling.session.created', 'scheduling.session.rescheduled', 'scheduling.orientation.booked'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('CLASSROOM', 'Live Academic Classroom Sync', 'Live Teaching Faculty', ARRAY['live_sessions', 'attendance_records'], ARRAY['CLASSROOM'], ARRAY['SCHEDULING', 'NOTIFICATIONS', 'GAMIFICATION', 'AUDIT'], ARRAY['classroom.session.started', 'classroom.session.ended', 'classroom.attendance.marked'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('ZEALOSH_VC', 'Virtual Conferencing Engine', 'WebRTC Infrastructure', ARRAY['recording_batch_access'], ARRAY['ZEALOSH_VC'], ARRAY['CLASSROOM', 'MEDIA', 'AUDIT'], ARRAY['vc.meeting.provisioned', 'vc.recording.ready'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('MESSAGING', 'Isolated Institutional Channels', 'Communication & Moderation', ARRAY['conversations', 'conversation_members', 'channel_messages', 'channel_moderation_reports'], ARRAY['MESSAGING'], ARRAY['NOTIFICATIONS', 'AUDIT'], ARRAY['messaging.channel.created', 'messaging.message.posted', 'messaging.report.filed'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('MEDIA', 'Secure Object Storage Registry', 'Media & Content Infrastructure', ARRAY['media_assets', 'class_recordings'], ARRAY['MEDIA'], ARRAY['ACADEMIC', 'CLASSROOM', 'AUDIT'], ARRAY['media.asset.uploaded', 'media.recording.ingested', 'media.asset.deleted'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('CMS', 'Public Content & PageBuilder', 'Communications & Editorial', ARRAY['cms_pages', 'cms_page_revisions', 'cms_scheduled_jobs'], ARRAY['CMS'], ARRAY['GROWTH', 'AUDIT'], ARRAY['cms.page.published', 'cms.page.unpublished'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('ASSESSMENT', 'Question Bank & High-Stakes Exams', 'Examination Board', ARRAY['question_bank_items', 'question_versions', 'exams', 'exam_attempts', 'assignments', 'assignment_submissions'], ARRAY['ASSESSMENT'], ARRAY['CREDENTIALS', 'CAREER', 'GAMIFICATION', 'NOTIFICATIONS', 'AUDIT'], ARRAY['assessment.quiz.completed', 'assessment.assignment.submitted', 'assessment.exam.passed'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('CREDENTIALS', 'Tamper-Evident Ed25519 Certificates', 'Institutional Registrar', ARRAY['certificates', 'certificate_signers'], ARRAY['CREDENTIALS'], ARRAY['CAREER', 'TESTIMONIALS', 'GAMIFICATION', 'NOTIFICATIONS', 'AUDIT'], ARRAY['credentials.certificate.issued', 'credentials.certificate.revoked'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('CAREER', 'HSE Career Roadmap & Milestones', 'Career Development Centre', ARRAY['certifications', 'career_pathways', 'career_pathway_stages', 'student_career_plans', 'external_credential_evidence'], ARRAY['CAREER'], ARRAY['NOTIFICATIONS', 'AUDIT'], ARRAY['career.plan.created', 'career.milestone.completed', 'career.evidence.verified'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('TESTIMONIALS', 'Verified Reviews & Granular Consent', 'Quality Assurance & Marketing', ARRAY['student_reviews', 'testimonial_consents', 'achievement_showcases'], ARRAY['TESTIMONIALS'], ARRAY['CMS', 'GROWTH', 'AUDIT'], ARRAY['testimonials.review.submitted', 'testimonials.review.published', 'testimonials.consent.revoked'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('GAMIFICATION', 'Academic XP Ledger & Streaks', 'Student Engagement & Motivation', ARRAY['gamification_rules', 'points_ledger', 'student_streaks', 'badge_definitions', 'user_badge_awards'], ARRAY['GAMIFICATION'], ARRAY['NOTIFICATIONS'], ARRAY['gamification.xp.awarded', 'gamification.streak.incremented', 'gamification.badge.awarded'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('GROWTH', 'Referrals, Partners & Alumni', 'Institutional Relations & Advancement', ARRAY['referral_codes', 'referral_attributions', 'institutional_partners', 'institutional_campaigns', 'alumni_profiles'], ARRAY['GROWTH'], ARRAY['ADMISSIONS', 'COMMERCE', 'AUDIT'], ARRAY['growth.referral.created', 'growth.referral.converted', 'growth.partner.registered'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('NOTIFICATIONS', 'Multi-Channel Alert Outbox', 'Operations & Communications', ARRAY['notifications', 'email_outbox', 'email_delivery_events'], ARRAY['NOTIFICATIONS'], ARRAY['AUDIT'], ARRAY['notifications.in_app.queued', 'notifications.email.dispatched'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('SUPPORT', 'Service Desk & Helpdesk Tickets', 'Student & Faculty Support Services', ARRAY['support_tickets', 'support_ticket_messages'], ARRAY['SUPPORT'], ARRAY['NOTIFICATIONS', 'AUDIT'], ARRAY['support.ticket.opened', 'support.ticket.resolved'], ARRAY['v1.0.0'], true, 'HEALTHY'),
    ('AUDIT', 'Institutional Compliance Audit', 'Internal Audit & Governance', ARRAY['audit_logs', 'institutional_audit_archives'], ARRAY['AUDIT'], ARRAY[]::TEXT[], ARRAY['audit.archive.generated', 'audit.security.alert'], ARRAY['v1.0.0'], true, 'HEALTHY')
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    owner = EXCLUDED.owner,
    authoritative_tables = EXCLUDED.authoritative_tables,
    permitted_publishers = EXCLUDED.permitted_publishers,
    permitted_consumers = EXCLUDED.permitted_consumers,
    supported_event_types = EXCLUDED.supported_event_types,
    contract_versions = EXCLUDED.contract_versions,
    updated_at = timezone('utc'::text, now());

-- 2. Transactional Event Outbox
CREATE TABLE IF NOT EXISTS public.event_outbox (
    id TEXT PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    schema_version TEXT NOT NULL DEFAULT 'v1.0.0',
    source_domain TEXT NOT NULL REFERENCES public.domain_registry(id),
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    aggregate_version INTEGER NOT NULL DEFAULT 1,
    occurred_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    correlation_id TEXT NOT NULL,
    causation_id TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    actor_type TEXT NOT NULL DEFAULT 'SYSTEM' CHECK (actor_type IN ('SYSTEM', 'USER', 'ADMIN', 'CRON', 'WEBHOOK')),
    actor_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_classification TEXT NOT NULL DEFAULT 'INTERNAL' CHECK (data_classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_event_outbox_source_domain ON public.event_outbox(source_domain);
CREATE INDEX IF NOT EXISTS idx_event_outbox_event_type ON public.event_outbox(event_type);
CREATE INDEX IF NOT EXISTS idx_event_outbox_correlation_id ON public.event_outbox(correlation_id);
CREATE INDEX IF NOT EXISTS idx_event_outbox_aggregate ON public.event_outbox(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_event_outbox_status_created ON public.event_outbox(status, created_at);

-- 3. Event Deliveries (Per-Consumer Tracking & Leases)
CREATE TABLE IF NOT EXISTS public.event_deliveries (
    id TEXT PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.event_outbox(event_id) ON DELETE CASCADE,
    consumer_domain TEXT NOT NULL REFERENCES public.domain_registry(id),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CLAIMED', 'PROCESSING', 'DELIVERED', 'RETRY_SCHEDULED', 'FAILED', 'DEAD_LETTERED', 'CANCELLED')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    last_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    delivered_at TIMESTAMPTZ,
    dead_letter_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_event_delivery_consumer UNIQUE (event_id, consumer_domain)
);

CREATE INDEX IF NOT EXISTS idx_event_deliveries_claim ON public.event_deliveries(status, next_attempt_at, locked_at) WHERE status IN ('PENDING', 'RETRY_SCHEDULED');
CREATE INDEX IF NOT EXISTS idx_event_deliveries_consumer ON public.event_deliveries(consumer_domain, status);

-- 4. Consumer Inbox (Deduplication & Stale-Event Guard)
CREATE TABLE IF NOT EXISTS public.event_inbox (
    id TEXT PRIMARY KEY,
    consumer_domain TEXT NOT NULL REFERENCES public.domain_registry(id),
    event_id UUID NOT NULL,
    aggregate_id TEXT NOT NULL,
    aggregate_version INTEGER NOT NULL DEFAULT 1,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSED', 'SKIPPED_DUPLICATE', 'SKIPPED_STALE', 'FAILED')),
    result_summary TEXT,
    CONSTRAINT uq_consumer_inbox_event UNIQUE (consumer_domain, event_id)
);

CREATE INDEX IF NOT EXISTS idx_consumer_inbox_aggregate ON public.event_inbox(consumer_domain, aggregate_id, aggregate_version);

-- 5. Dead-Letter Events
CREATE TABLE IF NOT EXISTS public.dead_letter_events (
    id TEXT PRIMARY KEY,
    delivery_id TEXT NOT NULL REFERENCES public.event_deliveries(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.event_outbox(event_id),
    consumer_domain TEXT NOT NULL REFERENCES public.domain_registry(id),
    failure_classification TEXT NOT NULL CHECK (failure_classification IN ('VALIDATION_ERROR', 'AUTHENTICATION_FAILURE', 'AUTHORIZATION_DENIED', 'SCHEMA_INCOMPATIBLE', 'HANDLER_EXCEPTION', 'MAX_RETRIES_EXCEEDED')),
    error_message TEXT NOT NULL,
    attempt_count INTEGER NOT NULL,
    first_failed_at TIMESTAMPTZ NOT NULL,
    last_failed_at TIMESTAMPTZ NOT NULL,
    correlation_id TEXT NOT NULL,
    resolution_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (resolution_status IN ('PENDING_REVIEW', 'REPLAY_QUEUED', 'RESOLVED_IGNORED', 'RESOLVED_REPLAYED')),
    resolved_by TEXT,
    resolution_reason TEXT,
    replay_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_resolution ON public.dead_letter_events(resolution_status, created_at);

-- 6. Domain Reconciliation Runs & Results
CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
    id TEXT PRIMARY KEY,
    rule_name TEXT NOT NULL,
    source_domain TEXT NOT NULL REFERENCES public.domain_registry(id),
    target_domain TEXT NOT NULL REFERENCES public.domain_registry(id),
    checked_count INTEGER NOT NULL DEFAULT 0,
    mismatch_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.reconciliation_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
    rule_name TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING_SYNC' CHECK (status IN ('MATCHED', 'PENDING_SYNC', 'MISMATCH', 'RESOLUTION_REQUIRED', 'RESOLVED', 'EXEMPTED_BY_POLICY')),
    details TEXT NOT NULL,
    suggested_action TEXT NOT NULL DEFAULT 'MANUAL_REVIEW' CHECK (suggested_action IN ('REPLAY_OUTBOX', 'MANUAL_REVIEW', 'SYNC_PROJECTION', 'EXEMPT')),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Administrative Maintenance Configuration & History
CREATE TABLE IF NOT EXISTS public.maintenance_config (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mode TEXT NOT NULL DEFAULT 'NORMAL' CHECK (mode IN ('NORMAL', 'READ_ONLY', 'FULL_MAINTENANCE')),
    maintenance_message TEXT NOT NULL DEFAULT '',
    public_explanation TEXT NOT NULL DEFAULT '',
    scheduled_start_time TIMESTAMPTZ,
    scheduled_end_time TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    affected_scope TEXT NOT NULL DEFAULT 'ALL' CHECK (affected_scope IN ('ALL', 'STUDENT_PORTAL', 'ADMISSIONS', 'ASSESSMENTS')),
    reason TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL DEFAULT 'system',
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.maintenance_config (id, enabled, mode, maintenance_message, public_explanation, affected_scope, reason, updated_by, version)
VALUES ('primary', false, 'NORMAL', 'Platform operating normally.', 'All systems active.', 'ALL', 'Initial state', 'system', 1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.maintenance_history (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('SCHEDULED', 'ACTIVATED', 'EXTENDED', 'COMPLETED', 'CANCELLED')),
    reason TEXT NOT NULL,
    actor TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Institutional Audit Archives (Single Institution)
CREATE TABLE IF NOT EXISTS public.institutional_audit_archives (
    id TEXT PRIMARY KEY,
    archive_period TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'ALL',
    included_event_types TEXT[] NOT NULL DEFAULT '{}',
    source_record_count INTEGER NOT NULL DEFAULT 0,
    format TEXT NOT NULL DEFAULT 'JSONL' CHECK (format IN ('JSONL', 'CSV')),
    content_checksum TEXT NOT NULL,
    manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    integrity_status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (integrity_status IN ('VERIFIED', 'TAMPER_DETECTED', 'UNVERIFIED')),
    retention_status TEXT NOT NULL DEFAULT 'RETENTION_POLICY_UNCONFIGURED' CHECK (retention_status IN ('RETENTION_POLICY_UNCONFIGURED', 'ACTIVE')),
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    download_count INTEGER NOT NULL DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    tampered_at TIMESTAMPTZ
);

-- 9. PWA Offline Progress Events & Subscriptions
CREATE TABLE IF NOT EXISTS public.pwa_offline_events (
    id TEXT PRIMARY KEY,
    client_event_id TEXT NOT NULL UNIQUE,
    student_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    sync_status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (sync_status IN ('QUEUED', 'SYNCED', 'CONFLICT', 'REJECTED')),
    conflict_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.pwa_push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Row-Level Security (RLS) Configuration
ALTER TABLE public.domain_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dead_letter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_audit_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pwa_offline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pwa_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anonymous: read maintenance status only
CREATE POLICY "anon_read_maintenance_status" ON public.maintenance_config FOR SELECT TO anon USING (true);

-- Authenticated: read maintenance status and domain registry
CREATE POLICY "auth_read_maintenance_status" ON public.maintenance_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_domain_registry" ON public.domain_registry FOR SELECT TO authenticated USING (true);

-- PWA offline events: users can only insert and read their own queued events
CREATE POLICY "users_manage_own_offline_events" ON public.pwa_offline_events FOR ALL TO authenticated USING (student_id = auth.uid()::text) WITH CHECK (student_id = auth.uid()::text);
CREATE POLICY "users_manage_own_push_subs" ON public.pwa_push_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

-- Service role & Admin: full access for background dispatcher, workers, and administrative operations
CREATE POLICY "service_role_all_domain_registry" ON public.domain_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_event_outbox" ON public.event_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_event_deliveries" ON public.event_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_event_inbox" ON public.event_inbox FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_dead_letter" ON public.dead_letter_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_reconciliation_runs" ON public.reconciliation_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_reconciliation_results" ON public.reconciliation_results FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_maintenance_config" ON public.maintenance_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_maintenance_history" ON public.maintenance_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_audit_archives" ON public.institutional_audit_archives FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_pwa_offline" ON public.pwa_offline_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_pwa_push" ON public.pwa_push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

