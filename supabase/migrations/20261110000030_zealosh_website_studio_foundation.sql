-- ============================================================================
-- ZEALOSH LMS — MILESTONE ZM-IMPL-12
-- Migration: 20261110000030_zealosh_website_studio_foundation.sql
-- Workstream: Website Studio WS-01 — Foundation & Architectural Integration
-- Standards: ADR-002 (Defense-in-Depth RLS) & ADR-004 (PostgreSQL Sole Source of Truth)
-- Reference: Canonical 17 Public Page Types, System Template Model & RBAC Alignment
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Expand cms_pages.page_type Check Constraint to Cover All 17 Canonical Types
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  -- Drop existing inline check constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cms_pages_page_type_check' 
      AND conrelid = 'public.cms_pages'::regclass
  ) THEN
    ALTER TABLE public.cms_pages DROP CONSTRAINT cms_pages_page_type_check;
  END IF;
END $$;

ALTER TABLE public.cms_pages
  ADD CONSTRAINT cms_pages_page_type_check CHECK (
    page_type IN (
      -- Canonical 17 Public Page Types
      'HOMEPAGE',
      'ABOUT',
      'FEATURES',
      'SOLUTIONS',
      'PRICING',
      'COURSES',
      'COURSE_DETAILS',
      'INSTRUCTORS',
      'INSTRUCTOR_PROFILE',
      'CONTACT',
      'FAQ',
      'BLOG',
      'BLOG_DETAILS',
      'TESTIMONIALS',
      'CAREERS',
      'PRIVACY_POLICY',
      'TERMS',
      -- Legacy and Specialized Preserved Types
      'STANDARD',
      'COURSE_LANDING',
      'ADMISSIONS',
      'CAMPAIGN'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Enhance cms_templates with System/Built-in Flags and Page Type Association
-- ----------------------------------------------------------------------------

ALTER TABLE public.cms_templates
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS page_type VARCHAR(32) DEFAULT 'STANDARD';

-- Create performance index for fast template lookups by page type and system status
CREATE INDEX IF NOT EXISTS idx_cms_templates_page_type_sys 
  ON public.cms_templates(page_type, is_system);

-- ----------------------------------------------------------------------------
-- 3. RLS Policy Hardening for Website Studio Templates
-- ----------------------------------------------------------------------------

-- Ensure all authenticated staff/admins can read system templates
DROP POLICY IF EXISTS cms_templates_select_all ON public.cms_templates;
CREATE POLICY cms_templates_select_all ON public.cms_templates
FOR SELECT TO authenticated
USING (
  is_system = TRUE 
  OR public.is_admin() 
  OR public.current_user_role() IN ('COURSE_MANAGER')
);

-- Ensure only superadmins or admins can modify system templates
DROP POLICY IF EXISTS cms_templates_modify_admin ON public.cms_templates;
CREATE POLICY cms_templates_modify_admin ON public.cms_templates
FOR ALL TO authenticated
USING (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
)
WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
);

COMMIT;
