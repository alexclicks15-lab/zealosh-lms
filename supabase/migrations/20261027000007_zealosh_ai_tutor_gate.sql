-- Zealosh LMS — Authoritative Database Migration
-- Architecture: ADR-003 (Optional AI Tutor Feature Gate & Minimal Integration Boundary)
-- Status: OPTIONAL / PROPOSED / NOT YET APPROVED
-- Default state: FALSE (Strictly disabled)

ALTER TABLE public.feature_flags 
  ADD COLUMN IF NOT EXISTS ai_tutor_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure singleton row remains strictly disabled
UPDATE public.feature_flags 
SET ai_tutor_enabled = FALSE 
WHERE id = 'singleton' AND ai_tutor_enabled IS NULL;

COMMENT ON COLUMN public.feature_flags.ai_tutor_enabled IS 
  'Feature gate for proposed Zealosh AI Tutor. Default false. Unapproved for production enablement.';
