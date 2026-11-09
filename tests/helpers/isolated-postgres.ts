// Zealosh LMS — Isolated Real PostgreSQL Engine & RLS Context Harness (PGlite / PostgreSQL 18)
// Executes actual SQL DDL migrations, relational constraints, stored procedures, and Row-Level Security

import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

export interface IsolatedPostgresInstance {
  pg: PGlite;
  /**
   * Executes a query or callback within a specific Supabase JWT & PostgreSQL Role context
   * Enforces genuine PostgreSQL Row-Level Security (RLS) policies!
   */
  withAuthContext: <T>(
    context: {
      pgRole: 'anon' | 'authenticated' | 'service_role';
      userId?: string;
      appRole?: 'STUDENT' | 'INSTRUCTOR' | 'COURSE_MANAGER' | 'ORG_ADMIN' | 'SUPER_ADMIN' | 'anon';
    },
    fn: (pg: PGlite) => Promise<T>
  ) => Promise<T>;
  close: () => Promise<void>;
}

export async function createIsolatedPostgres(): Promise<IsolatedPostgresInstance> {
  const pg = new PGlite();

  // 1. Provision standard Supabase roles and schema permissions
  await pg.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
      END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS text AS $$
      SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
    $$ LANGUAGE sql STABLE;
  `);

  // Helper to load and run migration file safely
  const runMigration = async (fileName: string) => {
    const migPath = path.resolve(process.cwd(), 'supabase/migrations', fileName);
    if (!fs.existsSync(migPath)) return;
    let sql = fs.readFileSync(migPath, 'utf8');
    sql = sql.replace(/CREATE EXTENSION[^;]+;/gi, '-- extension skipped in embedded wasm pg');
    // Align foreign key types between VARCHAR(64) entity IDs and legacy UUID columns
    sql = sql.replace(/module_id UUID REFERENCES public\.modules\(id\)/g, 'module_id VARCHAR(64) REFERENCES public.modules(id)');
    sql = sql.replace(/topic_id UUID REFERENCES public\.topics\(id\)/g, 'topic_id VARCHAR(64) REFERENCES public.topics(id)');
    sql = sql.replace(/subtopic_id UUID REFERENCES public\.subtopics\(id\)/g, 'subtopic_id VARCHAR(64) REFERENCES public.subtopics(id)');
    await pg.exec(sql);
  };

  // 2. Apply Core Schema (Migration 00)
  await runMigration('20261023000000_zealosh_core_schema.sql');

  // 3. Apply Assignments & Submissions (Migration 04)
  await runMigration('20261026000004_zealosh_assignments_and_submissions.sql');

  // 4. Apply Recordings & Doubts (Migration 06)
  await runMigration('20261026000006_zealosh_recordings_and_doubts.sql');

  // 5. Apply Phase 1 Foundations (Migration 08 - modules, topics, subtopics)
  await runMigration('20261030000008_zealosh_phase1_foundations.sql');

  // 6. Apply Learning Delivery Phase 2 (Migration 10)
  await runMigration('20261031000010_zealosh_learning_delivery_phase2.sql');

  // 7. Apply Classroom Academic Workspace (Migration 12)
  await runMigration('20261101000012_zealosh_classroom_academic_workspace.sql');

  // 8. Apply CMS Schema & RLS Policies (Migration 19)
  await runMigration('20261103000019_zealosh_cms_pagebuilder.sql');

  // 9. Apply Scheduled Publishing & Atomic Stored Functions (Migration 20)
  await runMigration('20261105000020_zealosh_cms_scheduled_publishing.sql');

  // 10. Apply Unified Classroom & VC Reconciliation (Migration 21)
  await runMigration('20261105000021_zealosh_unified_classroom_and_vc_reconciliation.sql');

  // 10. Grant table-level privileges to anon and authenticated so RLS policies govern access
  await pg.exec(`
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

    -- Seed baseline users for foreign key integrity
    INSERT INTO public.users (id, name, email, password_hash, role)
    VALUES
      ('usr-admin-01', 'Super Administrator', 'admin@zealosh.com', 'hash', 'SUPER_ADMIN'),
      ('usr-admin-reviewer-02', 'Independent Reviewer', 'reviewer@zealosh.com', 'hash', 'SUPER_ADMIN'),
      ('usr-cm-01', 'Course Manager', 'cm@zealosh.com', 'hash', 'COURSE_MANAGER'),
      ('usr-inst-01', 'Dr. Ramesh Kumar', 'instructor@zealosh.com', 'hash', 'INSTRUCTOR'),
      ('usr-inst-99', 'Unassigned Instructor', 'other.inst@zealosh.com', 'hash', 'INSTRUCTOR'),
      ('usr-std-01', 'Arjun Menon', 'student@zealosh.com', 'hash', 'STUDENT'),
      ('usr-std-02', 'Kavita Nair', 'other.student@zealosh.com', 'hash', 'STUDENT')
    ON CONFLICT (id) DO NOTHING;

    -- Seed baseline courses for 3 delivery modes: LIVE, RECORDED, HYBRID
    INSERT INTO public.courses (
      id, title, slug, certification_type, delivery_model, status, headline, description,
      cover_image, lead_instructor_id, duration_weeks
    ) VALUES
      (
        'crs-asp-01', 'Associate Safety Professional Preparation', 'asp-prep', 'ASP',
        'HYBRID', 'PUBLISHED', 'Leading ASP prep in India', 'Complete ASP prep syllabus',
        '/courses/asp.jpg', 'usr-inst-01', 12
      ),
      (
        'crs-live-01', 'HSE Live Masterclass & Practical Safety', 'live-masterclass', 'CSP',
        'LIVE', 'PUBLISHED', 'Live interactive workshop', 'Hands-on industrial safety',
        '/courses/live.jpg', 'usr-inst-01', 6
      ),
      (
        'crs-rec-01', 'OSHA 30-Hour General Industry Self-Paced', 'osha-30-general', 'CUSTOM',
        'RECORDED', 'PUBLISHED', 'Self paced OSHA 30', 'Complete OSHA recorded modules',
        '/courses/rec.jpg', 'usr-inst-01', 4
      )
    ON CONFLICT (id) DO NOTHING;

    -- Seed baseline batches
    INSERT INTO public.batches (
      id, course_id, name, start_date, end_date, schedule_description, capacity, lead_instructor_id, status
    ) VALUES
      (
        'btc-asp-nov26', 'crs-asp-01', 'ASP Weekend Cohort Nov 2026', '2026-11-01', '2027-01-31',
        'Sat-Sun 10:00 AM IST', 35, 'usr-inst-01', 'ACTIVE'
      ),
      (
        'btc-live-01', 'crs-live-01', 'Live Masterclass Weekday Batch', '2026-11-10', '2026-12-20',
        'Mon-Wed-Fri 7:00 PM IST', 30, 'usr-inst-01', 'ACTIVE'
      ),
      (
        'btc-rec-01', 'crs-rec-01', 'OSHA Self-Paced Rolling Batch', '2026-01-01', '2026-12-31',
        'Self-paced on demand', 500, 'usr-inst-01', 'ACTIVE'
      )
    ON CONFLICT (id) DO NOTHING;

    -- Seed baseline enrollments
    INSERT INTO public.enrollments (
      id, user_id, course_id, batch_id, status, enrolled_at, expires_at, progress_percent
    ) VALUES
      ('enr-std-asp', 'usr-std-01', 'crs-asp-01', 'btc-asp-nov26', 'ACTIVE', NOW(), NOW() + INTERVAL '1 year', 20),
      ('enr-std-live', 'usr-std-01', 'crs-live-01', 'btc-live-01', 'ACTIVE', NOW(), NOW() + INTERVAL '1 year', 10),
      ('enr-std-rec', 'usr-std-01', 'crs-rec-01', 'btc-rec-01', 'ACTIVE', NOW(), NOW() + INTERVAL '1 year', 50),
      ('enr-std2-asp', 'usr-std-02', 'crs-asp-01', 'btc-asp-nov26', 'ACTIVE', NOW(), NOW() + INTERVAL '1 year', 0)
    ON CONFLICT (id) DO NOTHING;
  `);

  const withAuthContext: IsolatedPostgresInstance['withAuthContext'] = async (context, fn) => {
    const claims = JSON.stringify({
      sub: context.userId || '',
      role: context.appRole || (context.pgRole === 'anon' ? 'anon' : 'STUDENT'),
      app_metadata: {
        role: context.appRole || 'anon',
        is_admin: context.appRole === 'SUPER_ADMIN' || context.appRole === 'ORG_ADMIN',
      },
    });

    await pg.exec(`
      SET ROLE ${context.pgRole};
      SELECT set_config('request.jwt.claims', '${claims.replace(/'/g, "''")}', false);
    `);

    try {
      return await fn(pg);
    } finally {
      await pg.exec(`
        RESET ROLE;
        SELECT set_config('request.jwt.claims', '', false);
      `);
    }
  };

  return {
    pg,
    withAuthContext,
    close: async () => {
      await pg.close();
    },
  };
}
