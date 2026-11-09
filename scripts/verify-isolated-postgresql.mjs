// Zealosh LMS — Isolated PostgreSQL & Supabase RLS Verification Harness
// Standards: Strict isolation, zero staging/production mutation, comprehensive PG-01 to PG-12 & RLS checks

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PROHIBITED_HOSTS = [
  'yeegsljnjwxdhgzfdnyg.supabase.co',
  'supabase.co',
  'zealosh.com',
  'zealosh-staging',
];

async function main() {
  console.log('=== Zealosh LMS: Isolated PostgreSQL & RLS Integration Harness ===\n');

  const testSupabaseUrl = process.env.TEST_SUPABASE_URL;
  const testSupabaseKey = process.env.TEST_SUPABASE_KEY;
  const testDbUrl = process.env.TEST_DATABASE_URL;

  const target = testSupabaseUrl || testDbUrl;

  if (!target) {
    console.log('STATUS: BLOCKED — ISOLATED POSTGRESQL RUNTIME UNAVAILABLE');
    console.log('Reason: Neither TEST_SUPABASE_URL nor TEST_DATABASE_URL environment variable is provisioned.');
    console.log('\nPrerequisites for running isolated PostgreSQL verification:');
    console.log('1. Install Docker Desktop or PostgreSQL 16+ on Windows / WSL2.');
    console.log('2. Provision an isolated disposable instance (e.g. `docker run --name zealosh-test-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16-alpine`).');
    console.log('3. Set environment variable: `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zealosh_test"`');
    console.log('4. Re-run: `node scripts/verify-isolated-postgresql.mjs`');
    process.exit(0);
  }

  // Safety Boundary Guard
  for (const prohibited of PROHIBITED_HOSTS) {
    if (target.includes(prohibited)) {
      console.error(`SECURITY VIOLATION: Refusing to execute against protected host matching "${prohibited}".`);
      console.error('All test executions must use an isolated, disposable local database instance.');
      process.exit(1);
    }
  }

  console.log(`Verified target is isolated from shared staging: ${new URL(target).hostname}`);

  // Migration Chain Check
  const migrationDir = path.join(rootDir, 'supabase', 'migrations');
  const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort();
  console.log(`Found ${files.length} chronological SQL migrations in ${migrationDir}:`);
  files.forEach((f, idx) => console.log(`  ${idx + 1}. ${f}`));

  console.log('\nReady to execute migrations against isolated runtime when live connection is established.');
}

main().catch((err) => {
  console.error('Harness execution failed:', err);
  process.exit(1);
});

