// ==============================================================================
// Zealosh LMS — Staging Environment Validation & Secret Hygiene Test Suite
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  validateEnvironment,
  parseEnvFile,
  ENV_SPECIFICATION,
} from '../deploy/validate-staging-env.mjs';

describe('Zealosh LMS — Staging Environment Validation & Secret Safety', () => {
  const validStagingConfig = {
    NODE_ENV: 'production',
    PORT: '3000',
    ZEALOSH_ENVIRONMENT: 'staging',
    ZEALOSH_DOMAIN: 'lms.staging.zealosh.com',
    APP_BASE_URL: 'https://lms.staging.zealosh.com',
    NEXT_PUBLIC_APP_URL: 'https://lms.staging.zealosh.com',
    DATABASE_STORAGE: 'supabase',
    JWT_SECRET: 'super_secure_staging_jwt_secret_at_least_32_chars_long',
    OAUTH_CLIENT_SECRET: 'secure_oauth_staging_secret_key_2026',
    NEXT_PUBLIC_SUPABASE_URL: 'https://yeegsljnjwxdhgzfdnyg.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_testing_purposes',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_role_key_for_testing',
    MOODLE_DATABASE_HOST: 'aws-0-ap-south-1.pooler.supabase.com',
    MOODLE_DATABASE_PORT: '5432', // Session Mode
    MOODLE_DATABASE_NAME: 'postgres',
    MOODLE_DATABASE_USER: 'postgres.wcqdjqzsdfwafzyqiibg',
    MOODLE_DATABASE_PASSWORD: 'real_secure_moodle_database_password_99',
    REDIS_HOST: 'zealosh-redis',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: 'real_secure_redis_password_2026',
    BBB_BASE_URL: 'https://media.staging.zealosh.com/bigbluebutton/api',
    BBB_SECURITY_SALT: 'real_bbb_staging_salt_secret_12345',
    BBB_WEBHOOK_CALLBACK_URL: 'https://lms.staging.zealosh.com/api/webhooks/bbb/recording',
    BBB_WEBHOOK_SECRET: 'real_bbb_staging_salt_secret_12345',
  };

  it('1. should validate a complete, authentic staging configuration cleanly with 0 errors', () => {
    const result = validateEnvironment(validStagingConfig, 'staging');

    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);

    for (const report of result.reports) {
      expect(report.status).toBe('VALID');
      expect(report.message).toContain('Passed');
    }
  });

  it('2. should reject missing required variables', () => {
    const incompleteConfig = { ...validStagingConfig };
    delete (incompleteConfig as any).JWT_SECRET;
    delete (incompleteConfig as any).BBB_SECURITY_SALT;

    const result = validateEnvironment(incompleteConfig, 'staging');

    expect(result.valid).toBe(false);
    expect(result.errorCount).toBeGreaterThanOrEqual(2);

    const jwtReport = result.reports.find((r) => r.name === 'JWT_SECRET');
    expect(jwtReport?.status).toBe('MISSING');

    const bbbReport = result.reports.find((r) => r.name === 'BBB_SECURITY_SALT');
    expect(bbbReport?.status).toBe('MISSING');
  });

  it('3. should reject CHANGE_ME_* placeholder values in staging/production', () => {
    const placeholderConfig = {
      ...validStagingConfig,
      JWT_SECRET: 'CHANGE_ME_STAGING_SECURE_JWT_SECRET_2026',
      MOODLE_DATABASE_PASSWORD: 'CHANGE_ME_SECURE_MOODLE_STAGING_PASSWORD',
    };

    const result = validateEnvironment(placeholderConfig, 'staging');

    expect(result.valid).toBe(false);
    expect(result.errorCount).toBeGreaterThanOrEqual(2);

    const jwtReport = result.reports.find((r) => r.name === 'JWT_SECRET');
    expect(jwtReport?.status).toBe('PLACEHOLDER');
    expect(jwtReport?.message).toContain('Default placeholder detected');

    const dbReport = result.reports.find((r) => r.name === 'MOODLE_DATABASE_PASSWORD');
    expect(dbReport?.status).toBe('PLACEHOLDER');
  });

  it('4. should strictly reject Transaction Pooler port 6543 for Moodle and mandate Session Pooler port 5432', () => {
    const transactionPoolerConfig = {
      ...validStagingConfig,
      MOODLE_DATABASE_PORT: '6543', // INCORRECT: Transaction Mode breaks advisory locks
    };

    const result = validateEnvironment(transactionPoolerConfig, 'staging');

    expect(result.valid).toBe(false);
    const portReport = result.reports.find((r) => r.name === 'MOODLE_DATABASE_PORT');
    expect(portReport?.status).toBe('INVALID_FORMAT');
    expect(portReport?.message).toContain('Port 5432 (Session Pooler) is required');
    expect(portReport?.message).toContain('Port 6543 (Transaction Pooler) terminates session advisory locks');
  });

  it('5. should reject non-HTTPS URLs in staging environment', () => {
    const insecureHttpConfig = {
      ...validStagingConfig,
      APP_BASE_URL: 'http://lms.staging.zealosh.com', // Insecure HTTP
    };

    const result = validateEnvironment(insecureHttpConfig, 'staging');

    expect(result.valid).toBe(false);
    const urlReport = result.reports.find((r) => r.name === 'APP_BASE_URL');
    expect(urlReport?.status).toBe('INVALID_FORMAT');
    expect(urlReport?.message).toContain('https://');
  });

  it('6. should reject legacy classroom.staging hostname in BBB_BASE_URL', () => {
    const legacyHostnameConfig = {
      ...validStagingConfig,
      BBB_BASE_URL: 'https://classroom.staging.zealosh.com/bigbluebutton/api',
    };

    const result = validateEnvironment(legacyHostnameConfig, 'staging');

    expect(result.valid).toBe(false);
    const bbbReport = result.reports.find((r) => r.name === 'BBB_BASE_URL');
    expect(bbbReport?.status).toBe('INVALID_FORMAT');
    expect(bbbReport?.message).toContain('media.staging.zealosh.com');
  });

  it('7. SECURITY INVARIANT: should NEVER include raw secret values in validation reports', () => {
    const secretConfig = {
      ...validStagingConfig,
      JWT_SECRET: 'THIS_IS_A_VERY_SECRET_VALUE_DO_NOT_LEAK',
      BBB_SECURITY_SALT: 'ANOTHER_SUPER_SECRET_SALT_VALUE_DO_NOT_LEAK',
    };

    const result = validateEnvironment(secretConfig, 'staging');

    const serializedReport = JSON.stringify(result);

    // Assert that the raw secret values are nowhere in the output report
    expect(serializedReport).not.toContain('THIS_IS_A_VERY_SECRET_VALUE_DO_NOT_LEAK');
    expect(serializedReport).not.toContain('ANOTHER_SUPER_SECRET_SALT_VALUE_DO_NOT_LEAK');
  });

  it('8. should parse dotenv files correctly handling quotes and comments', () => {
    const envContent = `
# Comment line
NODE_ENV=production
PORT=3000
APP_BASE_URL="https://lms.staging.zealosh.com"
MOODLE_DATABASE_PASSWORD='my_single_quoted_pass'
    `;

    const parsed = parseEnvFile(envContent);

    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.PORT).toBe('3000');
    expect(parsed.APP_BASE_URL).toBe('https://lms.staging.zealosh.com');
    expect(parsed.MOODLE_DATABASE_PASSWORD).toBe('my_single_quoted_pass');
  });
});

