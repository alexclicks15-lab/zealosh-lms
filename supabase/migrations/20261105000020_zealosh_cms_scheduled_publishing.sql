-- ============================================================================
-- ZEALOSH LMS — MILESTONE ZM-IMPL-02H
-- Migration: 20261105000020_zealosh_cms_scheduled_publishing.sql
-- Workstream: Scheduled Publishing Engine, Durable Outbox & Atomic Stored Procedures
-- Standards: ADR-002 (Defense-in-Depth RLS) & ADR-004 (PostgreSQL Sole Source of Truth)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Align cms_pages with Scheduled Publishing Fields
-- ----------------------------------------------------------------------------
ALTER TABLE public.cms_pages 
  ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_version_id VARCHAR(64);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cms_pages_scheduled_version'
  ) THEN
    ALTER TABLE public.cms_pages 
      ADD CONSTRAINT fk_cms_pages_scheduled_version 
      FOREIGN KEY (scheduled_version_id) 
      REFERENCES public.cms_page_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Align cms_page_versions with Scheduled Publishing Fields
-- ----------------------------------------------------------------------------
ALTER TABLE public.cms_page_versions 
  ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 3. CMS Scheduled Publications Durable Job Outbox Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cms_scheduled_publications (
  id VARCHAR(64) PRIMARY KEY,
  page_id VARCHAR(64) NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
  version_id VARCHAR(64) NOT NULL REFERENCES public.cms_page_versions(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  scheduled_by VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'QUEUED' CHECK (
    status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')
  ),
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(64),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cms_sched_pub_due 
  ON public.cms_scheduled_publications(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_cms_sched_pub_page 
  ON public.cms_scheduled_publications(page_id, status);

-- ----------------------------------------------------------------------------
-- 4. Row-Level Security (RLS) Policies on cms_scheduled_publications
-- ----------------------------------------------------------------------------
ALTER TABLE public.cms_scheduled_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cms_sched_pub_admin_all ON public.cms_scheduled_publications;
CREATE POLICY cms_sched_pub_admin_all ON public.cms_scheduled_publications
FOR ALL TO authenticated
USING (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
)
WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('COURSE_MANAGER')
);

-- ----------------------------------------------------------------------------
-- 5. Stored Function: Genuinely Atomic Publication Procedure
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_cms_page_version(
  p_page_id VARCHAR,
  p_version_id VARCHAR,
  p_actor_id VARCHAR,
  p_checksum VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page public.cms_pages%ROWTYPE;
  v_version public.cms_page_versions%ROWTYPE;
  v_pub_record_id VARCHAR(64);
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Lock and verify the target page
  SELECT * INTO v_page
  FROM public.cms_pages
  WHERE id = p_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page not found: %', p_page_id;
  END IF;

  -- 2. Lock and verify the target version
  SELECT * INTO v_version
  FROM public.cms_page_versions
  WHERE id = p_version_id AND page_id = p_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found: %', p_version_id;
  END IF;

  -- 3. Demote previously published version if any
  IF v_page.published_version_id IS NOT NULL AND v_page.published_version_id <> p_version_id THEN
    UPDATE public.cms_page_versions
    SET status = 'ARCHIVED', updated_at = v_now
    WHERE id = v_page.published_version_id;
  END IF;

  -- 4. Mark target version as PUBLISHED
  UPDATE public.cms_page_versions
  SET status = 'PUBLISHED',
      published_at = v_now,
      updated_at = v_now
  WHERE id = p_version_id
  RETURNING * INTO v_version;

  -- 5. Update cms_pages pointers
  UPDATE public.cms_pages
  SET status = 'PUBLISHED',
      published_version_id = p_version_id,
      scheduled_publish_at = NULL,
      scheduled_version_id = NULL,
      updated_by = p_actor_id,
      updated_at = v_now
  WHERE id = p_page_id
  RETURNING * INTO v_page;

  -- 6. Insert publication audit record
  v_pub_record_id := 'pub-' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
  INSERT INTO public.cms_publication_records (
    id, page_id, version_id, published_by, published_at, snapshot_checksum
  ) VALUES (
    v_pub_record_id, p_page_id, p_version_id, p_actor_id, v_now, p_checksum
  );

  -- 7. Mark any scheduled publication job as completed
  UPDATE public.cms_scheduled_publications
  SET status = 'COMPLETED', completed_at = v_now, updated_at = v_now
  WHERE page_id = p_page_id AND version_id = p_version_id AND status IN ('QUEUED', 'PROCESSING');

  RETURN jsonb_build_object(
    'success', true,
    'page', to_jsonb(v_page),
    'version', to_jsonb(v_version),
    'publicationRecordId', v_pub_record_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Stored Function: Genuinely Atomic Rollback Procedure
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rollback_cms_page_version(
  p_page_id VARCHAR,
  p_source_version_id VARCHAR,
  p_new_version_id VARCHAR,
  p_actor_id VARCHAR,
  p_change_summary TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page public.cms_pages%ROWTYPE;
  v_source_version public.cms_page_versions%ROWTYPE;
  v_new_version_number INT;
  v_now TIMESTAMPTZ := NOW();
  v_new_version public.cms_page_versions%ROWTYPE;
  v_node RECORD;
  v_new_node_id VARCHAR(64);
BEGIN
  -- 1. Verify page exists
  SELECT * INTO v_page
  FROM public.cms_pages
  WHERE id = p_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page not found: %', p_page_id;
  END IF;

  -- 2. Verify source version exists
  SELECT * INTO v_source_version
  FROM public.cms_page_versions
  WHERE id = p_source_version_id AND page_id = p_page_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source version not found: %', p_source_version_id;
  END IF;

  -- 3. Compute next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_new_version_number
  FROM public.cms_page_versions
  WHERE page_id = p_page_id;

  -- 4. Create new draft version
  INSERT INTO public.cms_page_versions (
    id, page_id, version_number, status, change_summary, created_by, created_at, updated_at
  ) VALUES (
    p_new_version_id, p_page_id, v_new_version_number, 'DRAFT', p_change_summary, p_actor_id, v_now, v_now
  )
  RETURNING * INTO v_new_version;

  -- 5. Deep clone nodes from source version with mapping table for parent-child hierarchy
  CREATE TEMP TABLE IF NOT EXISTS _node_id_map (
    old_id VARCHAR(64) PRIMARY KEY,
    new_id VARCHAR(64) NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE _node_id_map;

  FOR v_node IN 
    SELECT id, component_type 
    FROM public.cms_page_nodes 
    WHERE page_version_id = p_source_version_id
  LOOP
    v_new_node_id := 'node-' || substr(md5(random()::text || clock_timestamp()::text || v_node.id), 1, 16);
    INSERT INTO _node_id_map (old_id, new_id) VALUES (v_node.id, v_new_node_id);
  END LOOP;

  INSERT INTO public.cms_page_nodes (
    id, page_version_id, parent_id, node_type, component_type, position,
    props, styles, responsive_styles, dynamic_binding, enabled, created_at, updated_at
  )
  SELECT 
    m.new_id,
    p_new_version_id,
    pm.new_id,
    n.node_type,
    n.component_type,
    n.position,
    n.props,
    n.styles,
    n.responsive_styles,
    n.dynamic_binding,
    n.enabled,
    v_now,
    v_now
  FROM public.cms_page_nodes n
  JOIN _node_id_map m ON n.id = m.old_id
  LEFT JOIN _node_id_map pm ON n.parent_id = pm.old_id
  WHERE n.page_version_id = p_source_version_id;

  -- 6. Update current draft pointer on page
  UPDATE public.cms_pages
  SET current_draft_version_id = p_new_version_id,
      updated_by = p_actor_id,
      updated_at = v_now
  WHERE id = p_page_id
  RETURNING * INTO v_page;

  RETURN jsonb_build_object(
    'success', true,
    'page', to_jsonb(v_page),
    'version', to_jsonb(v_new_version)
  );
END;
$$;

COMMIT;

