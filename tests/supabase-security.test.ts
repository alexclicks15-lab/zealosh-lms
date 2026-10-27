import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { db } from '../src/lib/store/db';
import { getSupabaseAdminClient } from '../src/lib/supabase';
import { authorizeAdmin } from '../src/lib/auth/admin-guard';
import { signToken } from '../src/lib/auth/jwt';
import { User } from '../src/types';

describe('Supabase Security & Hardened Schema Verification', () => {
  const schemaPath = path.resolve(__dirname, '../infra/supabase/schema.sql');
  const migrationSchemaPath = path.resolve(__dirname, '../supabase/migrations/20261023000000_zealosh_core_schema.sql');
  const migrationSeedPath = path.resolve(__dirname, '../supabase/migrations/20261023000001_zealosh_seed_data.sql');

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const migrationSchemaContent = fs.readFileSync(migrationSchemaPath, 'utf8');
  const migrationSeedContent = fs.readFileSync(migrationSeedPath, 'utf8');

  it('should not contain any destructive DROP, TRUNCATE, or DELETE FROM statements', () => {
    const destructivePattern = /\bDROP\s+(?:TABLE|SCHEMA|DATABASE|VIEW|FUNCTION|TRIGGER)\b|\bTRUNCATE\s+(?:TABLE\s+)?public\.|\bDELETE\s+FROM\b/i;
    expect(destructivePattern.test(migrationSchemaContent)).toBe(false);
    expect(destructivePattern.test(migrationSeedContent)).toBe(false);
    expect(destructivePattern.test(schemaContent)).toBe(false);
  });

  it('should not contain blanket grants (GRANT ALL ON ALL TABLES) to anon or authenticated', () => {
    const blanketPattern = /GRANT\s+ALL\s+(?:PRIVILEGES\s+)?ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+(?:[^;]*\b(?:anon|authenticated)\b)/i;
    expect(blanketPattern.test(migrationSchemaContent)).toBe(false);
    expect(blanketPattern.test(schemaContent)).toBe(false);
  });

  it('should enforce explicit Row Level Security (RLS) on all 19 domain tables', () => {
    const expectedTables = [
      'platform_settings',
      'branding_theme',
      'feature_flags',
      'navigation_items',
      'roles',
      'users',
      'oauth_codes',
      'courses',
      'batches',
      'lessons',
      'live_sessions',
      'attendance_records',
      'enrollments',
      'certificates',
      'exam_blueprints',
      'exam_questions',
      'exam_attempts',
      'audit_logs',
      'config_audits',
    ];

    expectedTables.forEach((table) => {
      const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, 'i');
      expect(rlsRegex.test(migrationSchemaContent)).toBe(true);
      expect(rlsRegex.test(schemaContent)).toBe(true);
    });
  });

  it('should restrict unauthenticated role (anon) to strictly public read-only tables and views', () => {
    // anon must be granted only public read assets
    const anonGrants = migrationSchemaContent.match(/GRANT\s+SELECT\s+ON\s+public\.\w+\s+TO\s+anon;/gi) || [];
    const grantedTables = anonGrants.map((g) => g.replace(/GRANT\s+SELECT\s+ON\s+public\.(\w+)\s+TO\s+anon;/i, '$1'));

    const approvedPublicTables = [
      'branding_theme',
      'feature_flags',
      'navigation_items',
      'courses',
      'batches',
      'certificates',
      'public_platform_settings',
    ];

    expect(grantedTables.sort()).toEqual(approvedPublicTables.sort());

    // Ensure anon is NEVER granted access to sensitive tables
    const forbiddenForAnon = [
      'users',
      'roles',
      'oauth_codes',
      'lessons',
      'live_sessions',
      'attendance_records',
      'enrollments',
      'exam_blueprints',
      'exam_questions',
      'exam_attempts',
      'audit_logs',
      'config_audits',
      'platform_settings', // Full settings has private secrets; anon only gets public_platform_settings
    ];

    forbiddenForAnon.forEach((t) => {
      const leakPattern = new RegExp(`GRANT\\s+[^;]*ON\\s+public\\.${t}\\s+TO\\s+[^;]*\\banon\\b`, 'i');
      expect(leakPattern.test(migrationSchemaContent)).toBe(false);
    });
  });

  it('should completely isolate oauth_codes and revoke access from public and authenticated roles', () => {
    expect(migrationSchemaContent).toContain('REVOKE ALL ON public.oauth_codes FROM PUBLIC, anon, authenticated;');
    expect(migrationSchemaContent).toContain('CREATE OR REPLACE FUNCTION public.redeem_oauth_code(');
    expect(migrationSchemaContent).toContain('FOR UPDATE;'); // Row locking
    expect(migrationSchemaContent).toContain('replay detected'); // Replay rejection
  });

  it('should define safe non-UUID identity mapping function current_user_id()', () => {
    expect(migrationSchemaContent).toContain('CREATE OR REPLACE FUNCTION public.current_user_id()');
    expect(migrationSchemaContent).toContain("->> 'sub'");
    // Verify it does NOT cast to ::uuid
    expect(migrationSchemaContent).not.toContain("->> 'sub')::uuid");
  });

  it('should shield raw exam answer keys using learner_exam_questions view and revoke answer keys', () => {
    expect(migrationSchemaContent).toContain('CREATE OR REPLACE VIEW public.learner_exam_questions');
    expect(migrationSchemaContent).toContain('REVOKE ALL ON public.exam_questions FROM PUBLIC, anon;');
    // Verify learner_exam_questions does NOT contain correct_option_ids
    const viewMatch = migrationSchemaContent.match(/CREATE OR REPLACE VIEW public\.learner_exam_questions AS([\s\S]*?)FROM public\.exam_questions;/i);
    expect(viewMatch).not.toBeNull();
    expect(viewMatch![1]).not.toContain('correct_option_ids');
    expect(viewMatch![1]).not.toContain('explanation');
  });

  it('should enforce candidate score manipulation prevention in exam_attempts RLS policy', () => {
    expect(migrationSchemaContent).toContain('total_score IS NULL');
    expect(migrationSchemaContent).toContain('passed IS NULL');
  });

  it('should prevent audit log alteration or truncation', () => {
    expect(migrationSchemaContent).toContain('REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC, anon, authenticated;');
    expect(migrationSchemaContent).toContain('REVOKE UPDATE, DELETE, TRUNCATE ON public.config_audits FROM PUBLIC, anon, authenticated;');
  });

  it('should prevent client-side execution of getSupabaseAdminClient', () => {
    // Simulate browser window
    const originalWindow = (globalThis as any).window;
    try {
      (globalThis as any).window = {};
      expect(() => getSupabaseAdminClient()).toThrow(/SECURITY VIOLATION/);
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
    }
  });

  it('should explicitly revoke execution of redeem_oauth_code from PUBLIC, anon, and authenticated roles', () => {
    expect(migrationSchemaContent).toContain('REVOKE EXECUTE ON FUNCTION public.redeem_oauth_code(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;');
    expect(migrationSchemaContent).toContain('GRANT EXECUTE ON FUNCTION public.redeem_oauth_code(TEXT, TEXT, TEXT) TO service_role;');
    expect(schemaContent).toContain('REVOKE EXECUTE ON FUNCTION public.redeem_oauth_code(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;');
  });

  it('should enforce server-side admin guard: block non-admins with 403 and allow admins', () => {
    const studentUser: User = {
      id: 'usr-std-99',
      name: 'Unauthorized Student',
      email: 'student99@zealosh.com',
      passwordHash: '',
      role: 'STUDENT',
      organizationId: 'org-zealosh',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const studentToken = signToken(studentUser);

    const studentRequest = new Request('http://localhost:3000/api/admin/config/settings', {
      headers: { authorization: `Bearer ${studentToken}` },
    });

    const studentResult = authorizeAdmin(studentRequest);
    expect('errorResponse' in studentResult).toBe(true);
    if ('errorResponse' in studentResult) {
      expect(studentResult.errorResponse.status).toBe(403);
    }

    // Admin user should be authorized
    const adminUser: User = {
      id: 'usr-admin-01',
      name: 'Super Admin',
      email: 'admin@zealosh.com',
      passwordHash: '',
      role: 'SUPER_ADMIN',
      organizationId: 'org-zealosh',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const adminToken = signToken(adminUser);

    const adminRequest = new Request('http://localhost:3000/api/admin/config/settings', {
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const adminResult = authorizeAdmin(adminRequest);
    expect('actor' in adminResult).toBe(true);
    if ('actor' in adminResult) {
      expect(adminResult.actor.role).toBe('SUPER_ADMIN');
      expect(adminResult.actor.email).toBe('admin@zealosh.com');
    }
  });

  it('should enforce single-use authorization code replay rejection in database store', async () => {
    const codeRecord = await db.createOAuthCode({
      userId: 'usr-std-01',
      clientId: 'zealosh-moodle',
      redirectUri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
    });

    expect(codeRecord.used).toBe(false);

    // First consumption succeeds
    const firstRedeem = await db.markOAuthCodeUsed(codeRecord.code);
    expect(firstRedeem).toBe(true);

    const fetched = await db.getOAuthCode(codeRecord.code);
    expect(fetched?.used).toBe(true);

    // Replay detection: checking status identifies code is already used
    expect(fetched?.used).toBe(true);
  });
});
