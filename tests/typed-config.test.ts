// ==============================================================================
// Zealosh LMS — Centralized Typed Configuration Unit Test Suite
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { validateAndLoadConfig, getAppConfig } from '@/lib/config';

describe('Zealosh LMS — Centralized Typed Environment Configuration', () => {
  const validStagingEnv = {
    NODE_ENV: 'production',
    ZEALOSH_ENVIRONMENT: 'staging',
    PORT: '3000',
    ZEALOSH_DOMAIN: 'app.staging.zealosh.com',
    APP_BASE_URL: 'https://app.staging.zealosh.com',
    NEXT_PUBLIC_APP_URL: 'https://app.staging.zealosh.com',
    DATABASE_STORAGE: 'supabase',
    JWT_SECRET: 'super_secure_staging_jwt_secret_with_more_than_32_characters',
    NEXT_PUBLIC_SUPABASE_URL: 'https://yeegsljnjwxdhgzfdnyg.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_key',
  };

  it('1. should validate complete staging environment and return typed config', () => {
    const result = validateAndLoadConfig(validStagingEnv);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.config).toBeDefined();
    expect(result.config?.env).toBe('staging');
    expect(result.config?.port).toBe(3000);
    expect(result.config?.databaseStorage).toBe('supabase');
    expect(result.config?.supabase.isConfigured).toBe(true);
  });

  it('2. should reject staging/production when APP_BASE_URL is not HTTPS', () => {
    const invalidEnv = {
      ...validStagingEnv,
      APP_BASE_URL: 'http://insecure.zealosh.com',
    };

    const result = validateAndLoadConfig(invalidEnv);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('APP_BASE_URL'))).toBe(true);
  });

  it('3. should reject short JWT_SECRET (< 32 chars) in staging/production', () => {
    const invalidEnv = {
      ...validStagingEnv,
      JWT_SECRET: 'short_key',
    };

    const result = validateAndLoadConfig(invalidEnv);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });

  it('4. should reject CHANGE_ME placeholder in staging/production', () => {
    const placeholderEnv = {
      ...validStagingEnv,
      JWT_SECRET: 'CHANGE_ME_IN_PRODUCTION_SECRET_KEY_12345',
    };

    const result = validateAndLoadConfig(placeholderEnv);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('CHANGE_ME'))).toBe(true);
  });

  it('5. should reject in-memory storage mode in staging/production', () => {
    const inMemoryEnv = {
      ...validStagingEnv,
      DATABASE_STORAGE: 'inmemory',
    };

    const result = validateAndLoadConfig(inMemoryEnv);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('DATABASE_STORAGE'))).toBe(true);
  });

  it('6. should reject Moodle port 6543 (Transaction Pooler)', () => {
    const poolerEnv = {
      ...validStagingEnv,
      MOODLE_DATABASE_HOST: 'aws-0-ap-south-1.pooler.supabase.com',
      MOODLE_DATABASE_PORT: '6543',
      MOODLE_DATABASE_USER: 'postgres.test',
    };

    const result = validateAndLoadConfig(poolerEnv);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('MOODLE_DATABASE_PORT'))).toBe(true);
  });

  it('7. should classify secret fields and never expose raw secret values in redacted report', () => {
    const result = validateAndLoadConfig(validStagingEnv);

    const secretReports = result.redactedReport.filter((r) => r.isSecret);
    expect(secretReports.length).toBeGreaterThan(0);

    for (const report of secretReports) {
      expect(report.message).not.toContain(validStagingEnv.JWT_SECRET);
      expect(report.message).not.toContain(validStagingEnv.SUPABASE_SERVICE_ROLE_KEY);
    }
  });

  it('8. should gracefully handle development mode with fallbacks', () => {
    const devEnv = {
      NODE_ENV: 'development',
      ZEALOSH_ENVIRONMENT: 'development',
    };

    const result = validateAndLoadConfig(devEnv);

    expect(result.valid).toBe(true);
    expect(result.config?.env).toBe('development');
    expect(result.config?.port).toBe(3000);
  });

  it('9. should parse and validate full integration settings (SMTP, Payments, AI, Worker)', () => {
    const fullEnv = {
      ...validStagingEnv,
      SMTP_HOST: 'smtp.sendgrid.net',
      SMTP_PORT: '587',
      SMTP_USER: 'apikey',
      SMTP_PASSWORD: 'super_secret_smtp_password_key',
      RAZORPAY_KEY_ID: 'rzp_test_12345',
      RAZORPAY_KEY_SECRET: 'rzp_secret_67890',
      WHATSAPP_API_KEY: 'wa_key_abcde',
      WHATSAPP_PHONE_NUMBER_ID: '100609345263',
      GEMINI_API_KEY: 'AIzaSyDummyGeminiKey12345',
      ZEALOSH_WORKER_SUPERVISOR: 'systemd',
      WORKER_INTERVAL_MS: '45000',
    };

    const result = validateAndLoadConfig(fullEnv);

    expect(result.valid).toBe(true);
    expect(result.config?.email.isConfigured).toBe(true);
    expect(result.config?.email.smtpHost).toBe('smtp.sendgrid.net');
    expect(result.config?.payments.razorpayConfigured).toBe(true);
    expect(result.config?.whatsapp.isConfigured).toBe(true);
    expect(result.config?.ai.geminiConfigured).toBe(true);
    expect(result.config?.worker.supervisor).toBe('systemd');
    expect(result.config?.worker.intervalMs).toBe(45000);

    // Verify secrets are classified as isSecret in redacted report
    const secretNames = result.redactedReport.filter((r) => r.isSecret).map((r) => r.name);
    expect(secretNames).toContain('SMTP_PASSWORD');
    expect(secretNames).toContain('RAZORPAY_KEY_SECRET');
    expect(secretNames).toContain('WHATSAPP_API_KEY');
    expect(secretNames).toContain('GEMINI_API_KEY');
  });
});

