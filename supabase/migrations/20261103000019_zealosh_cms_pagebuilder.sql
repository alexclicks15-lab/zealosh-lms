-- ============================================================================
-- ZEALOSH LMS — MILESTONE ZM-IMPL-02
-- Migration: 20261103000019_zealosh_cms_pagebuilder.sql
-- Workstream: Enterprise Visual PageBuilder, Relational CMS & Dynamic Course Engine
-- Standards: ADR-002 (Defense-in-Depth RLS) & ADR-004 (PostgreSQL Sole Source of Truth)
-- Reference: WebJET CMS wj-page-builder separation of structure and content
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CMS Pages Relational Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cms_pages (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  page_type VARCHAR(32) NOT NULL DEFAULT 'STANDARD' CHECK (
    page_type IN ('HOMEPAGE', 'STANDARD', 'COURSE_LANDING', 'ADMISSIONS', 'CAMPAIGN')
  ),
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED')
  ),
  current_draft_version_id VARCHAR(64),
  published_version_id VARCHAR(64),
  seo_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cms_page_slug_format CHECK (
    char_length(trim(slug)) > 0 AND slug !~ '^[/\\]' AND slug !~ '[/\\]$'
  )
);

-- ----------------------------------------------------------------------------
-- 2. CMS Page Versions (Immutable Revisions)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cms_page_versions (
  id VARCHAR(64) PRIMARY KEY,
  page_id VARCHAR(64) NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED')
  ),
  change_summary TEXT,
  rejection_reason TEXT,
  created_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approved_by VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cms_page_versions_version UNIQUE (page_id, version_number)
);

-- Circular foreign keys from cms_pages to cms_page_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cms_pages_current_draft'
  ) THEN
    ALTER TABLE public.cms_pages 
      ADD CONSTRAINT fk_cms_pages_current_draft 
      FOREIGN KEY (current_draft_version_id) 
      REFERENCES public.cms_page_versions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cms_pages_published_version'
  ) THEN
    ALTER TABLE public.cms_pages 
      ADD CONSTRAINT fk_cms_pages_published_version 
      FOREIGN KEY (published_version_id) 
      REFERENCES public.cms_page_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. CMS Component Nodes (Validated Hierarchical Component Tree)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cms_page_nodes (
  id VARCHAR(64) PRIMARY KEY,
  page_version_id VARCHAR(64) NOT NULL REFERENCES public.cms_page_versions(id) ON DELETE CASCADE,
  parent_id VARCHAR(64) REFERENCES public.cms_page_nodes(id) ON DELETE CASCADE,
  node_type VARCHAR(32) NOT NULL CHECK (
    node_type IN ('SECTION', 'CONTAINER', 'ROW', 'COLUMN', 'CONTENT_REGION', 'COMPONENT')
  ),
  component_type VARCHAR(64) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  styles JSONB NOT NULL DEFAULT '{}'::jsonb,
  responsive_styles JSONB NOT NULL DEFAULT '{}'::jsonb,
  dynamic_binding JSONB DEFAULT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. CMS Templates & Reusable Blocks
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cms_templates (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL DEFAULT 'GENERAL',
  template_type VARCHAR(32) NOT NULL DEFAULT 'PAGE' CHECK (
    template_type IN ('PAGE', 'SECTION')
  ),
  preview_image_url TEXT,
  nodes_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cms_reusable_blocks (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'SECTIONS',
  nodes_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. CMS Publication Records (Audited Publication History)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cms_publication_records (
  id VARCHAR(64) PRIMARY KEY,
  page_id VARCHAR(64) NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
  version_id VARCHAR(64) NOT NULL REFERENCES public.cms_page_versions(id) ON DELETE RESTRICT,
  published_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_checksum VARCHAR(64) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 6. Performance Indexes
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON public.cms_pages(slug);
CREATE INDEX IF NOT EXISTS idx_cms_pages_status ON public.cms_pages(status);
CREATE INDEX IF NOT EXISTS idx_cms_pages_page_type ON public.cms_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_cms_page_versions_page ON public.cms_page_versions(page_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_cms_page_nodes_version_pos ON public.cms_page_nodes(page_version_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_cms_page_nodes_parent ON public.cms_page_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_cms_pub_records_page ON public.cms_publication_records(page_id, published_at DESC);

-- ----------------------------------------------------------------------------
-- 7. Row-Level Security (RLS) Policies
-- ----------------------------------------------------------------------------

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_reusable_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_publication_records ENABLE ROW LEVEL SECURITY;

-- Public read access: Anyone (including anonymous) can read published pages and their nodes
DROP POLICY IF EXISTS cms_pages_public_select ON public.cms_pages;
CREATE POLICY cms_pages_public_select ON public.cms_pages
FOR SELECT TO anon, authenticated
USING (
  status = 'PUBLISHED' AND published_version_id IS NOT NULL
  OR public.is_admin()
  OR public.current_user_role() IN ('COURSE_MANAGER', 'INSTRUCTOR')
);

DROP POLICY IF EXISTS cms_page_versions_public_select ON public.cms_page_versions;
CREATE POLICY cms_page_versions_public_select ON public.cms_page_versions
FOR SELECT TO anon, authenticated
USING (
  id IN (SELECT published_version_id FROM public.cms_pages WHERE status = 'PUBLISHED')
  OR public.is_admin()
  OR public.current_user_role() IN ('COURSE_MANAGER', 'INSTRUCTOR')
);

DROP POLICY IF EXISTS cms_page_nodes_public_select ON public.cms_page_nodes;
CREATE POLICY cms_page_nodes_public_select ON public.cms_page_nodes
FOR SELECT TO anon, authenticated
USING (
  page_version_id IN (SELECT published_version_id FROM public.cms_pages WHERE status = 'PUBLISHED')
  OR public.is_admin()
  OR public.current_user_role() IN ('COURSE_MANAGER', 'INSTRUCTOR')
);

-- Staff/Admin full access for page authoring and publishing
DROP POLICY IF EXISTS cms_pages_admin_all ON public.cms_pages;
CREATE POLICY cms_pages_admin_all ON public.cms_pages
FOR ALL TO authenticated
USING (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
)
WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
);

DROP POLICY IF EXISTS cms_page_versions_admin_all ON public.cms_page_versions;
CREATE POLICY cms_page_versions_admin_all ON public.cms_page_versions
FOR ALL TO authenticated
USING (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
)
WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
);

DROP POLICY IF EXISTS cms_page_nodes_admin_all ON public.cms_page_nodes;
CREATE POLICY cms_page_nodes_admin_all ON public.cms_page_nodes
FOR ALL TO authenticated
USING (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
)
WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
);

DROP POLICY IF EXISTS cms_templates_staff_all ON public.cms_templates;
CREATE POLICY cms_templates_staff_all ON public.cms_templates
FOR ALL TO authenticated
USING (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
)
WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
);

DROP POLICY IF EXISTS cms_reusable_blocks_staff_all ON public.cms_reusable_blocks;
CREATE POLICY cms_reusable_blocks_staff_all ON public.cms_reusable_blocks
FOR ALL TO authenticated
USING (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
)
WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
);

DROP POLICY IF EXISTS cms_publication_records_admin_all ON public.cms_publication_records;
CREATE POLICY cms_publication_records_admin_all ON public.cms_publication_records
FOR ALL TO authenticated
USING (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
)
WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
);

COMMIT;

