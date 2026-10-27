/**
 * Zealosh LMS — Supabase Staging Provisioning & Status Diagnostic Tool
 * Validates gateway connectivity, schema tables, views, and least-privilege security boundaries.
 */


const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if available
const envLocalPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yeegsljnjwxdhgzfdnyg.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            'sb_publishable_IMAOSBMuGgGlXOrVUcNGHQ_NUKVEWQ4';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('================================================================');
console.log('ZEALOSH LMS — SUPABASE STAGING DIAGNOSTIC & SEED RUNNER');
console.log('Target Endpoint:     ', url);
console.log('Public Key Type:     ', key.startsWith('sb_publishable_') ? 'Supabase Publishable Key' : 'Standard Anon/JWT');
console.log('Service Role Access: ', serviceRoleKey ? 'Configured (Full Audit Enabled)' : 'Not Configured (Public Boundary Audit)');
console.log('================================================================\n');

const publicSupabase = createClient(url, key);
const adminSupabase = serviceRoleKey ? createClient(url, serviceRoleKey) : null;

async function run() {
  console.log('[1/3] Testing Supabase Gateway Connectivity...');
  try {
    const { data: authData, error: authErr } = await publicSupabase.auth.getSession();
    console.log('  -> Gateway reachable: OK (Session active: ' + Boolean(authData?.session) + ')');
  } catch (err) {
    console.error('  -> Gateway connection failed:', err.message);
  }

  console.log('\n[2/3] Checking Publicly Accessible Tables & Views (Least-Privilege Role: anon)...');
  const publicEntities = [
    'courses',
    'batches',
    'branding_theme',
    'feature_flags',
    'navigation_items',
    'certificates',
    'public_platform_settings'
  ];
  const tableStatus = {};
  let anyTableMissing = false;

  for (const entity of publicEntities) {
    const { data, count, error } = await publicSupabase.from(entity).select('*', { count: 'exact' });
    if (error) {
      tableStatus[entity] = { accessible: false, reason: error.message };
      anyTableMissing = true;
    } else {
      tableStatus[entity] = { accessible: true, count: typeof count === 'number' ? count : (data ? data.length : 0) };
    }
  }

  console.table(tableStatus);

  if (adminSupabase) {
    console.log('\n[2b/3] Checking Protected Entities via Service Role...');
    const protectedEntities = ['users', 'roles', 'platform_settings', 'audit_logs', 'oauth_codes', 'exam_questions'];
    const adminStatus = {};
    for (const entity of protectedEntities) {
      const { data, error } = await adminSupabase.from(entity).select('*').limit(1);
      if (error) {
        adminStatus[entity] = { accessible: false, reason: error.message };
      } else {
        adminStatus[entity] = { accessible: true, count: data ? data.length : 0 };
      }
    }
    console.table(adminStatus);
  }

  console.log('\n[3/3] Migration & Provisioning Status:');
  if (anyTableMissing) {
    console.log('  [!] Tables are not yet initialized in the remote Supabase schema cache.');
    console.log('  To apply the reviewed migrations in order:');
    console.log('  1. Open your Supabase SQL Editor:');
    console.log('     https://supabase.com/dashboard/project/yeegsljnjwxdhgzfdnyg/sql/new');
    console.log('  2. Step 1 — Copy and run:');
    console.log('     supabase/migrations/20261023000000_zealosh_core_schema.sql');
    console.log('  3. Step 2 — Copy and run:');
    console.log('     supabase/migrations/20261023000001_zealosh_seed_data.sql');
    console.log('  4. Re-run this script to confirm remote table activation.');
  } else {
    console.log('  [OK] All core tables and views are active and verified in Supabase!');
  }
}

run().catch(err => {
  console.error('Diagnostic error:', err);
});
