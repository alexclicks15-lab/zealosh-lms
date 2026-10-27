-- ============================================================================
-- ZEALOSH LMS — WORKFLOW ENGINE & NOTIFICATION TEMPLATE PERSISTENCE
-- Migration: 20261025000003_zealosh_workflows_and_templates.sql
-- Architecture: ADR-002 (Authoritative Configuration Governance)
-- Standards: OWASP Top 10, Least Privilege, Role-Based Access Control
-- ============================================================================

BEGIN;

-- 1. Workflows Definition Table
CREATE TABLE IF NOT EXISTS public.workflows (
  id VARCHAR(64) PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger VARCHAR(64) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Notification Templates Table
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id VARCHAR(64) PRIMARY KEY,
  trigger VARCHAR(64) NOT NULL,
  channel VARCHAR(16) NOT NULL, -- 'IN_APP', 'EMAIL', 'PUSH'
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON public.workflows(trigger);
CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON public.workflows(is_enabled);
CREATE INDEX IF NOT EXISTS idx_notification_templates_trigger ON public.notification_templates(trigger);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON public.notification_templates(channel);

-- Enable RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflows
DROP POLICY IF EXISTS "Public can view active workflows" ON public.workflows;
CREATE POLICY "Public can view active workflows"
  ON public.workflows FOR SELECT
  USING (is_enabled = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage workflows" ON public.workflows;
CREATE POLICY "Admins can manage workflows"
  ON public.workflows FOR ALL
  TO authenticated, service_role
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RLS Policies for notification templates
DROP POLICY IF EXISTS "Public can view active notification templates" ON public.notification_templates;
CREATE POLICY "Public can view active notification templates"
  ON public.notification_templates FOR SELECT
  USING (is_enabled = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage notification templates" ON public.notification_templates;
CREATE POLICY "Admins can manage notification templates"
  ON public.notification_templates FOR ALL
  TO authenticated, service_role
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed initial default workflow
INSERT INTO public.workflows (id, title, description, trigger, conditions, actions, is_enabled)
VALUES (
  'wf-auto-cert-issuance',
  'Automated Credential Issuance & Dispatch',
  'Automatically issue digital credentials with unique QR validation upon passing certification mock exam',
  'EXAM_PASSED',
  '[{"field": "scorePercent", "operator": "GREATER_THAN", "value": 70}]'::jsonb,
  '[{"type": "SEND_EMAIL_NOTIFICATION", "parameters": {"templateId": "tpl-exam-pass"}}, {"type": "LOG_COMPLIANCE_EVENT", "parameters": {"eventType": "CREDENTIAL_ISSUED"}}]'::jsonb,
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Seed default notification templates
INSERT INTO public.notification_templates (id, trigger, channel, title_template, body_template, variables, is_enabled)
VALUES 
(
  'tpl-exam-pass',
  'EXAM_PASSED',
  'EMAIL',
  'Congratulations! You passed the {{courseTitle}} Simulation Exam',
  'Dear {{studentName}}, congratulations on achieving {{examScore}}% on your {{courseTitle}} examination. Your official certificate is ready.',
  '["studentName", "courseTitle", "examScore"]'::jsonb,
  TRUE
),
(
  'tpl-course-enroll',
  'COURSE_ENROLLED',
  'IN_APP',
  'Welcome to {{courseTitle}} Cohort {{batchName}}',
  'Your enrollment has been secured. View the course syllabus and join the next live session.',
  '["courseTitle", "batchName"]'::jsonb,
  TRUE
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
