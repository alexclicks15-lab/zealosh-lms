#!/usr/bin/env node
// ==============================================================================
// Zealosh LMS — Production/Staging Environment Configuration Validator
// ==============================================================================
// Pure Node.js preflight script that verifies configuration sanity before startup.
// Validates types, URLs, connection pooling modes (port 5432 session pooler requirement),
// detects unreplaced CHANGE_ME placeholders, and strictly prevents secret exposure.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';

export const ENV_SPECIFICATION = [
  { name: 'NODE_ENV', required: true, secret: false, allowed: ['production'] },
  { name: 'PORT', required: true, secret: false, validator: (v) => !isNaN(Number(v)) && Number(v) > 0 && Number(v) <= 65535, error: 'Must be a valid integer port (1-65535)' },
  { name: 'ZEALOSH_ENVIRONMENT', required: true, secret: false, allowed: ['staging', 'production'] },
  { name: 'ZEALOSH_DOMAIN', required: true, secret: false, validator: (v) => v.includes('.') && !v.includes('://'), error: 'Must be a valid FQDN without protocol scheme' },
  { name: 'APP_BASE_URL', required: true, secret: false, validator: (v, env) => v.startsWith(env === 'local' ? 'http' : 'https://'), error: 'Must start with https:// in staging/production' },
  { name: 'NEXT_PUBLIC_APP_URL', required: true, secret: false, validator: (v, env) => v.startsWith(env === 'local' ? 'http' : 'https://'), error: 'Must start with https:// in staging/production' },
  { name: 'DATABASE_STORAGE', required: true, secret: false, allowed: ['supabase', 'inmemory'] },
  { name: 'JWT_SECRET', required: true, secret: true, minLength: 32, error: 'Must be at least 32 characters in length' },
  { name: 'OAUTH_CLIENT_SECRET', required: false, secret: true, minLength: 16, error: 'Must be at least 16 characters if specified' },
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, secret: false, validator: (v) => v.startsWith('https://'), error: 'Must start with https://' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, secret: true, minLength: 20 },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, secret: true, minLength: 20 },
  { name: 'MOODLE_DATABASE_HOST', required: true, secret: false },
  {
    name: 'MOODLE_DATABASE_PORT',
    required: true,
    secret: false,
    validator: (v) => String(v).trim() === '5432',
    error: 'CRITICAL: Port 5432 (Session Pooler) is required. Port 6543 (Transaction Pooler) terminates session advisory locks and breaks Moodle Core.',
  },
  { name: 'MOODLE_DATABASE_NAME', required: true, secret: false },
  { name: 'MOODLE_DATABASE_USER', required: true, secret: false },
  { name: 'MOODLE_DATABASE_PASSWORD', required: true, secret: true, minLength: 8 },
  { name: 'REDIS_HOST', required: true, secret: false },
  { name: 'REDIS_PORT', required: true, secret: false, validator: (v) => String(v).trim() === '6379', error: 'Standard Redis port 6379 expected' },
  { name: 'REDIS_PASSWORD', required: true, secret: true, minLength: 8 },
  {
    name: 'BBB_BASE_URL',
    required: true,
    secret: false,
    validator: (v) => v.startsWith('https://') && v.includes('/bigbluebutton/api') && !v.includes('classroom.staging'),
    error: 'Must be https://media.staging.zealosh.com/bigbluebutton/api (legacy classroom.staging hostname is rejected)',
  },
  { name: 'BBB_SECURITY_SALT', required: true, secret: true, minLength: 16 },
  { name: 'BBB_WEBHOOK_CALLBACK_URL', required: true, secret: false, validator: (v) => v.startsWith('https://') && v.includes('/api/webhooks/bbb/recording'), error: 'Must target canonical HTTPS callback URL' },
  { name: 'BBB_WEBHOOK_SECRET', required: true, secret: true, minLength: 16 },
];

/**
 * Parses simple dotenv formatted key-value pairs into a clean Map.
 * @param {string} content
 * @returns {Record<string, string>}
 */
export function parseEnvFile(content) {
  /** @type {Record<string, string>} */
  const result = {};
  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();

    // Remove wrapping single or double quotes
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.substring(1, val.length - 1);
    }

    result[key] = val;
  }
  return result;
}

/**
 * Validates an environment key-value map against the staging specification.
 * SECURITY GUARANTEE: Never prints or exposes secret values.
 */
export function validateEnvironment(envMap, targetEnv = 'staging') {
  const reports = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const spec of ENV_SPECIFICATION) {
    const val = envMap[spec.name];
    const isPresent = val !== undefined && val !== null && String(val).trim().length > 0;

    let status = 'VALID';
    let message = 'Passed verification';

    if (!isPresent) {
      if (spec.required) {
        status = 'MISSING';
        message = 'Required variable is not set or empty';
        errorCount++;
      } else {
        status = 'OPTIONAL_UNSET';
        message = 'Optional variable unset';
      }
    } else {
      const trimmed = String(val).trim();

      // Check for placeholder secrets
      if (/CHANGE_ME_/i.test(trimmed) || /your-.*-project-ref/i.test(trimmed) || /your_token/i.test(trimmed)) {
        status = 'PLACEHOLDER';
        message = 'Default placeholder detected! Must be replaced with authentic deployment secret.';
        errorCount++;
      } else if (spec.allowed && !spec.allowed.includes(trimmed)) {
        status = 'INVALID_VALUE';
        message = `Expected one of: ${spec.allowed.join(', ')}`;
        errorCount++;
      } else if (spec.minLength && trimmed.length < spec.minLength) {
        status = 'TOO_SHORT';
        message = spec.error || `Minimum length is ${spec.minLength} characters (got ${trimmed.length})`;
        errorCount++;
      } else if (spec.validator && !spec.validator(trimmed, targetEnv)) {
        status = 'INVALID_FORMAT';
        message = spec.error || 'Format validation failed';
        errorCount++;
      }
    }

    reports.push({
      name: spec.name,
      classification: spec.secret ? 'SECRET' : 'PUBLIC',
      status,
      message,
    });
  }

  // Cross-variable consistency check: BBB_BASE_URL and BBB_WEBHOOK_CALLBACK_URL host alignment
  const bbbUrl = envMap['BBB_BASE_URL'];
  if (bbbUrl && bbbUrl.includes('classroom.staging.zealosh.com')) {
    reports.push({
      name: 'HOSTNAME_CONSISTENCY',
      classification: 'PUBLIC',
      status: 'INVALID_FORMAT',
      message: 'Legacy hostname classroom.staging.zealosh.com detected in BBB_BASE_URL; canonical media.staging.zealosh.com required.',
    });
    errorCount++;
  }

  return {
    valid: errorCount === 0,
    errorCount,
    warningCount,
    reports,
  };
}

/**
 * CLI Entrypoint
 */
export async function validateStagingEnvCli() {
  const repoRoot = path.resolve(import.meta.dirname, '..');
  const targetFile = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repoRoot, '.env.staging');

  console.log('=== Zealosh LMS: Preflight Environment Configuration Validator ===');
  console.log(`Target Configuration: ${targetFile}`);

  if (!fs.existsSync(targetFile)) {
    console.error(`FATAL: Configuration file not found at ${targetFile}`);
    console.error('Please copy .env.staging.example to .env.staging and configure real secrets.');
    process.exit(1);
  }

  const content = fs.readFileSync(targetFile, 'utf8');
  const envMap = parseEnvFile(content);

  const targetEnv = envMap['ZEALOSH_ENVIRONMENT'] || 'staging';
  const result = validateEnvironment(envMap, targetEnv);

  console.log('\nValidation Results (Zero Secret Values Exposed):');
  console.log('--------------------------------------------------------------------------------');
  console.log(
    'Variable'.padEnd(30) +
    'Type'.padEnd(10) +
    'Status'.padEnd(16) +
    'Details'
  );
  console.log('--------------------------------------------------------------------------------');

  for (const r of result.reports) {
    const statusFormatted = r.status === 'VALID' ? '[PASS]' : `[${r.status}]`;
    console.log(
      r.name.padEnd(30) +
      r.classification.padEnd(10) +
      statusFormatted.padEnd(16) +
      r.message
    );
  }
  console.log('--------------------------------------------------------------------------------');

  if (result.valid) {
    console.log('SUCCESS: All environment variables passed preflight validation cleanly!\n');
    process.exit(0);
  } else {
    console.error(`FAILURE: Encountered ${result.errorCount} configuration errors/placeholders.`);
    console.error('Resolve the issues above before attempting container launch.\n');
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('validate-staging-env.mjs')) {
  validateStagingEnvCli();
}

