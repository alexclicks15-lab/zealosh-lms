// Zealosh LMS — Real Isolated PostgreSQL 18 Engine, Stored Procedures & Row-Level Security Suite (PG-01 to PG-17)
// Executes genuine SQL DDL, relational constraints, PL/pgSQL stored functions, and RLS policies in PGlite

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedPostgres, IsolatedPostgresInstance } from './helpers/isolated-postgres';

describe('Zealosh CMS — Real Isolated PostgreSQL, Stored Procedures & RLS Integration Suite (PG-01 to PG-17)', () => {
  let dbInstance: IsolatedPostgresInstance;

  beforeAll(async () => {
    dbInstance = await createIsolatedPostgres();
  }, 30000);

  afterAll(async () => {
    if (dbInstance) {
      await dbInstance.close();
    }
  });

  it('PG-01: should connect to isolated PostgreSQL engine and verify server version', async () => {
    const res = await dbInstance.pg.query<{ version: string }>('SELECT version();');
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].version).toContain('PostgreSQL');
  });

  it('PG-02: should verify all 7 CMS tables and relational indexes exist in pg_catalog', async () => {
    const tablesRes = await dbInstance.pg.query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'cms_%'
      ORDER BY table_name;
    `);
    const tableNames = tablesRes.rows.map((r) => r.table_name);
    expect(tableNames).toEqual([
      'cms_page_nodes',
      'cms_page_versions',
      'cms_pages',
      'cms_publication_records',
      'cms_reusable_blocks',
      'cms_scheduled_publications',
      'cms_templates',
    ]);

    const idxRes = await dbInstance.pg.query<{ indexname: string }>(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname LIKE 'idx_cms_%';
    `);
    const idxNames = idxRes.rows.map((r) => r.indexname);
    expect(idxNames).toContain('idx_cms_pages_slug');
    expect(idxNames).toContain('idx_cms_page_nodes_version_pos');
    expect(idxNames).toContain('idx_cms_sched_pub_due');
  });

  it('PG-03: should insert a CMS page into public.cms_pages and verify default values', async () => {
    const res = await dbInstance.pg.query<{
      id: string;
      slug: string;
      status: string;
      page_type: string;
    }>(`
      INSERT INTO public.cms_pages (id, slug, title, created_by, updated_by)
      VALUES ('pg-page-01', 'nebosh-igc-certification', 'NEBOSH IGC Certification', 'usr-admin-01', 'usr-admin-01')
      RETURNING id, slug, status, page_type;
    `);
    expect(res.rows[0]).toEqual({
      id: 'pg-page-01',
      slug: 'nebosh-igc-certification',
      status: 'DRAFT',
      page_type: 'STANDARD',
    });
  });

  it('PG-04: should insert an initial Draft version into public.cms_page_versions with foreign key', async () => {
    const res = await dbInstance.pg.query<{
      id: string;
      page_id: string;
      version_number: number;
      status: string;
    }>(`
      INSERT INTO public.cms_page_versions (id, page_id, version_number, status, change_summary, created_by)
      VALUES ('pg-ver-01', 'pg-page-01', 1, 'DRAFT', 'Initial PostgreSQL version', 'usr-admin-01')
      RETURNING id, page_id, version_number, status;
    `);
    expect(res.rows[0].id).toBe('pg-ver-01');
    expect(res.rows[0].version_number).toBe(1);

    await dbInstance.pg.query(`
      UPDATE public.cms_pages SET current_draft_version_id = 'pg-ver-01' WHERE id = 'pg-page-01';
    `);
  });

  it('PG-05: should insert hierarchical layout nodes (Section -> Container -> Row -> Column -> Heading)', async () => {
    await dbInstance.pg.exec(`
      INSERT INTO public.cms_page_nodes (id, page_version_id, parent_id, node_type, component_type, position, props)
      VALUES
        ('pg-node-sec', 'pg-ver-01', NULL, 'SECTION', 'section', 0, '{"tag": "section"}'::jsonb),
        ('pg-node-cont', 'pg-ver-01', 'pg-node-sec', 'CONTAINER', 'container', 0, '{"maxWidth": "1280px"}'::jsonb),
        ('pg-node-row', 'pg-ver-01', 'pg-node-cont', 'ROW', 'row', 0, '{"gap": "1.5rem"}'::jsonb),
        ('pg-node-col', 'pg-ver-01', 'pg-node-row', 'COLUMN', 'column', 0, '{"colSpan": 12}'::jsonb),
        ('pg-node-h1', 'pg-ver-01', 'pg-node-col', 'COMPONENT', 'heading', 0, '{"text": "NEBOSH Excellence", "level": "h1"}'::jsonb),
        ('pg-node-p1', 'pg-ver-01', 'pg-node-col', 'COMPONENT', 'paragraph', 1, '{"text": "Accredited Safety Training"}'::jsonb);
    `);

    const countRes = await dbInstance.pg.query<{ count: string }>(`
      SELECT count(*) as count FROM public.cms_page_nodes WHERE page_version_id = 'pg-ver-01';
    `);
    expect(Number(countRes.rows[0].count)).toBe(6);
  });

  it('PG-06: should query page by slug and resolve JSONB seo_metadata', async () => {
    await dbInstance.pg.query(`
      UPDATE public.cms_pages 
      SET seo_metadata = '{"title": "NEBOSH IGC | Zealosh", "noIndex": false}'::jsonb
      WHERE slug = 'nebosh-igc-certification';
    `);

    const res = await dbInstance.pg.query<{ id: string; seo_metadata: any }>(`
      SELECT id, seo_metadata FROM public.cms_pages WHERE slug = 'nebosh-igc-certification';
    `);
    expect(res.rows[0].id).toBe('pg-page-01');
    expect(res.rows[0].seo_metadata.title).toBe('NEBOSH IGC | Zealosh');
  });

  it('PG-07: should query page nodes ordered deterministically by position ASC', async () => {
    const res = await dbInstance.pg.query<{ id: string; position: number }>(`
      SELECT id, position 
      FROM public.cms_page_nodes 
      WHERE page_version_id = 'pg-ver-01' AND parent_id = 'pg-node-col'
      ORDER BY position ASC;
    `);
    expect(res.rows.map((r) => r.id)).toEqual(['pg-node-h1', 'pg-node-p1']);
  });

  it('PG-08: should reject duplicate page slug insertion with PostgreSQL 23505 unique_violation', async () => {
    await expect(
      dbInstance.pg.query(`
        INSERT INTO public.cms_pages (id, slug, title, created_by, updated_by)
        VALUES ('pg-page-dup', 'nebosh-igc-certification', 'Duplicate Slug', 'usr-admin-01', 'usr-admin-01');
      `)
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it('PG-09: should reject invalid foreign key references (23503) and invalid check constraints (23514)', async () => {
    // Non-existent user foreign key
    await expect(
      dbInstance.pg.query(`
        INSERT INTO public.cms_pages (id, slug, title, created_by, updated_by)
        VALUES ('pg-page-bad-fk', 'valid-slug', 'Bad FK', 'usr-non-existent', 'usr-admin-01');
      `)
    ).rejects.toThrow(/violates foreign key constraint/);

    // Invalid slug with leading slash (chk_cms_page_slug_format)
    await expect(
      dbInstance.pg.query(`
        INSERT INTO public.cms_pages (id, slug, title, created_by, updated_by)
        VALUES ('pg-page-bad-slug', '/invalid-leading-slash', 'Bad Slug', 'usr-admin-01', 'usr-admin-01');
      `)
    ).rejects.toThrow(/violates check constraint "chk_cms_page_slug_format"/);
  });

  it('PG-10: should enforce composite unique constraint (page_id, version_number)', async () => {
    await expect(
      dbInstance.pg.query(`
        INSERT INTO public.cms_page_versions (id, page_id, version_number, status, created_by)
        VALUES ('pg-ver-dup', 'pg-page-01', 1, 'DRAFT', 'usr-admin-01');
      `)
    ).rejects.toThrow(/duplicate key value violates unique constraint "uq_cms_page_versions_version"/);
  });

  it('PG-11: should transition version workflow state (DRAFT -> PENDING_REVIEW -> APPROVED)', async () => {
    await dbInstance.pg.query(`
      UPDATE public.cms_page_versions 
      SET status = 'PENDING_REVIEW', change_summary = 'Ready for review'
      WHERE id = 'pg-ver-01';
    `);

    const revRes = await dbInstance.pg.query<{ status: string; approved_by: string }>(`
      UPDATE public.cms_page_versions 
      SET status = 'APPROVED', approved_by = 'usr-admin-reviewer-02'
      WHERE id = 'pg-ver-01'
      RETURNING status, approved_by;
    `);
    expect(revRes.rows[0].status).toBe('APPROVED');
    expect(revRes.rows[0].approved_by).toBe('usr-admin-reviewer-02');
  });

  it('PG-12: should execute atomic stored procedure public.publish_cms_page_version()', async () => {
    const pubRes = await dbInstance.pg.query<{ result: any }>(`
      SELECT public.publish_cms_page_version(
        'pg-page-01',
        'pg-ver-01',
        'usr-admin-01',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      ) as result;
    `);

    const outcome = pubRes.rows[0].result;
    expect(outcome.success).toBe(true);
    expect(outcome.page.status).toBe('PUBLISHED');
    expect(outcome.page.published_version_id).toBe('pg-ver-01');
    expect(outcome.version.status).toBe('PUBLISHED');
    expect(outcome.publicationRecordId).toMatch(/^pub-/);

    // Verify audit record in cms_publication_records
    const recRes = await dbInstance.pg.query<{ snapshot_checksum: string }>(`
      SELECT snapshot_checksum FROM public.cms_publication_records WHERE page_id = 'pg-page-01';
    `);
    expect(recRes.rows.length).toBe(1);
    expect(recRes.rows[0].snapshot_checksum).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('PG-13: should execute atomic stored procedure public.rollback_cms_page_version() and deep-clone hierarchy', async () => {
    const rollRes = await dbInstance.pg.query<{ result: any }>(`
      SELECT public.rollback_cms_page_version(
        'pg-page-01',
        'pg-ver-01',
        'pg-ver-02',
        'usr-admin-01',
        'Rollback from v1'
      ) as result;
    `);

    const outcome = rollRes.rows[0].result;
    expect(outcome.success).toBe(true);
    expect(outcome.version.id).toBe('pg-ver-02');
    expect(outcome.version.version_number).toBe(2);
    expect(outcome.version.status).toBe('DRAFT');
    expect(outcome.page.current_draft_version_id).toBe('pg-ver-02');
    // Historical published version remains untouched
    expect(outcome.page.published_version_id).toBe('pg-ver-01');

    // Verify all 6 nodes were cloned into pg-ver-02 with intact parent-child hierarchy
    const clonedNodes = await dbInstance.pg.query<{
      id: string;
      parent_id: string | null;
      component_type: string;
    }>(`
      SELECT id, parent_id, component_type 
      FROM public.cms_page_nodes 
      WHERE page_version_id = 'pg-ver-02';
    `);
    expect(clonedNodes.rows.length).toBe(6);

    const sec = clonedNodes.rows.find((n) => n.component_type === 'section');
    const cont = clonedNodes.rows.find((n) => n.component_type === 'container');
    const row = clonedNodes.rows.find((n) => n.component_type === 'row');
    const col = clonedNodes.rows.find((n) => n.component_type === 'column');
    const h1 = clonedNodes.rows.find((n) => n.component_type === 'heading');

    expect(sec?.id).not.toBe('pg-node-sec');
    expect(cont?.parent_id).toBe(sec?.id);
    expect(row?.parent_id).toBe(cont?.id);
    expect(col?.parent_id).toBe(row?.id);
    expect(h1?.parent_id).toBe(col?.id);
  });

  it('PG-14: should cascade delete child nodes when a draft version is deleted', async () => {
    await dbInstance.pg.query(`DELETE FROM public.cms_page_versions WHERE id = 'pg-ver-02';`);

    const remainingNodes = await dbInstance.pg.query<{ count: string }>(`
      SELECT count(*) as count FROM public.cms_page_nodes WHERE page_version_id = 'pg-ver-02';
    `);
    expect(Number(remainingNodes.rows[0].count)).toBe(0);
  });

  it('PG-15: should enforce ON DELETE RESTRICT preventing deletion of a user who authored CMS pages', async () => {
    await expect(
      dbInstance.pg.query(`DELETE FROM public.users WHERE id = 'usr-admin-01';`)
    ).rejects.toThrow(/foreign key constraint/);
  });

  it('PG-16: should enforce real PostgreSQL RLS for anonymous (anon) role: read published only, block drafts and writes', async () => {
    // Create a secret draft page as admin
    await dbInstance.pg.query(`
      INSERT INTO public.cms_pages (id, slug, title, status, created_by, updated_by)
      VALUES ('pg-page-secret-draft', 'secret-draft-course', 'Secret Draft', 'DRAFT', 'usr-admin-01', 'usr-admin-01');
    `);

    await dbInstance.withAuthContext({ pgRole: 'anon', appRole: 'anon' }, async (pg) => {
      // 1. Anon SELECT should see published 'pg-page-01', but NOT 'pg-page-secret-draft'
      const pagesRes = await pg.query<{ id: string; status: string }>(`
        SELECT id, status FROM public.cms_pages;
      `);
      const ids = pagesRes.rows.map((r) => r.id);
      expect(ids).toContain('pg-page-01');
      expect(ids).not.toContain('pg-page-secret-draft');

      // 2. Anon INSERT must be rejected by PostgreSQL RLS policy
      await expect(
        pg.query(`
          INSERT INTO public.cms_pages (id, slug, title, created_by, updated_by)
          VALUES ('pg-anon-hack', 'anon-hack', 'Hack', 'usr-admin-01', 'usr-admin-01');
        `)
      ).rejects.toThrow(/new row violates row-level security policy/);
    });
  });

  it('PG-17: should enforce real PostgreSQL RLS for authenticated STUDENT vs COURSE_MANAGER & SUPER_ADMIN', async () => {
    // 1. Authenticated STUDENT cannot insert pages or read unpublished drafts
    await dbInstance.withAuthContext(
      { pgRole: 'authenticated', userId: 'usr-std-01', appRole: 'STUDENT' },
      async (pg) => {
        const pagesRes = await pg.query<{ id: string }>(`SELECT id FROM public.cms_pages;`);
        const ids = pagesRes.rows.map((r) => r.id);
        expect(ids).toContain('pg-page-01');
        expect(ids).not.toContain('pg-page-secret-draft');

        await expect(
          pg.query(`
            INSERT INTO public.cms_pages (id, slug, title, created_by, updated_by)
            VALUES ('pg-student-write', 'student-write', 'Student Page', 'usr-std-01', 'usr-std-01');
          `)
        ).rejects.toThrow(/new row violates row-level security policy/);
      }
    );

    // 2. Authenticated COURSE_MANAGER can read drafts and create new pages
    await dbInstance.withAuthContext(
      { pgRole: 'authenticated', userId: 'usr-cm-01', appRole: 'COURSE_MANAGER' },
      async (pg) => {
        const pagesRes = await pg.query<{ id: string }>(`SELECT id FROM public.cms_pages;`);
        const ids = pagesRes.rows.map((r) => r.id);
        expect(ids).toContain('pg-page-01');
        expect(ids).toContain('pg-page-secret-draft');

        const insertRes = await pg.query<{ id: string }>(`
          INSERT INTO public.cms_pages (id, slug, title, created_by, updated_by)
          VALUES ('pg-cm-created', 'cm-managed-course', 'CM Managed Course', 'usr-cm-01', 'usr-cm-01')
          RETURNING id;
        `);
        expect(insertRes.rows[0].id).toBe('pg-cm-created');
      }
    );
  });
});
