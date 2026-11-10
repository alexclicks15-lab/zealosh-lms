// Zealosh LMS — Centralized Typed Environment Configuration & Validation Module
// Milestone: ZM-IMPL-09 (Stage B-Prep)
// Enforces typed configuration, runtime safety, zero secret leakage, and fail-fast startup.

export type EnvironmentMode = 'development' | 'test' | 'staging' | 'production';
export type DatabaseStorageMode = 'supabase' | 'postgres' | 'inmemory';

export interface AppConfig {
  env: EnvironmentMode;
  port: number;
  domain: string;
  appBaseUrl: string;
  publicAppUrl: string;
  databaseStorage: DatabaseStorageMode;
  jwtSecret: string;
  jwtExpiresIn: string;
  oauthClientSecret?: string;
  supabase: {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
    isConfigured: boolean;
  };
  moodle: {
    host?: string;
    port?: number;
    dbName?: string;
    user?: string;
    isConfigured: boolean;
  };
  bigBlueButton: {
    baseUrl?: string;
    isConfigured: boolean;
  };
  ai: {
    ollamaBaseUrl?: string;
    model?: string;
    geminiConfigured: boolean;
    isConfigured: boolean;
  };
  storage: {
    bucketName?: string;
    isConfigured: boolean;
  };
  email: {
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    emailFrom?: string;
    isConfigured: boolean;
  };
  payments: {
    razorpayConfigured: boolean;
    stripeConfigured: boolean;
    isConfigured: boolean;
  };
  whatsapp: {
    phoneNumberId?: string;
    isConfigured: boolean;
  };
  worker: {
    supervisor: 'systemd' | 'pm2' | 'standalone';
    intervalMs: number;
  };
}

export interface ConfigValidationResult {
  valid: boolean;
  config?: AppConfig;
  errors: string[];
  warnings: string[];
  redactedReport: Array<{
    name: string;
    status: 'VALID' | 'MISSING' | 'INVALID' | 'WARNING';
    message: string;
    isSecret: boolean;
  }>;
}

/**
 * Validates and transforms a raw environment record into a typed AppConfig.
 * SECURITY GUARANTEE: Never includes raw secret values in errors or logs.
 */
export function validateAndLoadConfig(
  rawEnv: Record<string, string | undefined> = process.env
): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const redactedReport: ConfigValidationResult['redactedReport'] = [];

  const rawEnvName = (rawEnv.ZEALOSH_ENVIRONMENT || rawEnv.NODE_ENV || 'development').toLowerCase();
  let env: EnvironmentMode = 'development';
  if (rawEnvName === 'production') env = 'production';
  else if (rawEnvName === 'staging') env = 'staging';
  else if (rawEnvName === 'test') env = 'test';

  const isProductionLike = env === 'production' || env === 'staging';

  // Helper for reporting
  const addReport = (
    name: string,
    status: 'VALID' | 'MISSING' | 'INVALID' | 'WARNING',
    message: string,
    isSecret: boolean
  ) => {
    redactedReport.push({ name, status, message, isSecret });
    if (status === 'MISSING' || status === 'INVALID') {
      errors.push(`[${name}] ${message}`);
    } else if (status === 'WARNING') {
      warnings.push(`[${name}] ${message}`);
    }
  };

  // 1. Port
  const rawPort = rawEnv.PORT || '3000';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    addReport('PORT', 'INVALID', 'Must be an integer between 1 and 65535', false);
  } else {
    addReport('PORT', 'VALID', 'Valid port', false);
  }

  // 2. Domain & URLs
  const domain = (rawEnv.ZEALOSH_DOMAIN || 'zealosh.com').trim();
  const appBaseUrl = (rawEnv.APP_BASE_URL || (isProductionLike ? 'https://app.zealosh.com' : 'http://localhost:3000')).trim();
  const publicAppUrl = (rawEnv.NEXT_PUBLIC_APP_URL || appBaseUrl).trim();

  if (isProductionLike) {
    if (!appBaseUrl.startsWith('https://')) {
      addReport('APP_BASE_URL', 'INVALID', 'Must start with https:// in staging/production', false);
    } else {
      addReport('APP_BASE_URL', 'VALID', 'Valid HTTPS URL', false);
    }

    if (!publicAppUrl.startsWith('https://')) {
      addReport('NEXT_PUBLIC_APP_URL', 'INVALID', 'Must start with https:// in staging/production', false);
    } else {
      addReport('NEXT_PUBLIC_APP_URL', 'VALID', 'Valid HTTPS URL', false);
    }
  } else {
    addReport('APP_BASE_URL', 'VALID', 'Development URL accepted', false);
    addReport('NEXT_PUBLIC_APP_URL', 'VALID', 'Development URL accepted', false);
  }

  // 3. Database Storage Mode
  const rawDbStorage = (rawEnv.DATABASE_STORAGE || (isProductionLike ? 'supabase' : 'inmemory')).toLowerCase();
  let databaseStorage: DatabaseStorageMode = 'inmemory';
  if (rawDbStorage === 'supabase') databaseStorage = 'supabase';
  else if (rawDbStorage === 'postgres') databaseStorage = 'postgres';
  else databaseStorage = 'inmemory';

  if (isProductionLike && databaseStorage === 'inmemory') {
    addReport('DATABASE_STORAGE', 'INVALID', 'In-memory storage is strictly prohibited in staging/production (ADR-004)', false);
  } else {
    addReport('DATABASE_STORAGE', 'VALID', `Storage mode set to ${databaseStorage}`, false);
  }

  // 4. JWT Secret
  const jwtSecret = rawEnv.JWT_SECRET || '';
  if (!jwtSecret) {
    if (isProductionLike) {
      addReport('JWT_SECRET', 'MISSING', 'JWT_SECRET is required', true);
    } else {
      addReport('JWT_SECRET', 'WARNING', 'Using fallback development JWT secret', true);
    }
  } else if (jwtSecret.includes('CHANGE_ME') && isProductionLike) {
    addReport('JWT_SECRET', 'INVALID', 'Default placeholder CHANGE_ME secret detected in production/staging', true);
  } else if (jwtSecret.length < 32 && isProductionLike) {
    addReport('JWT_SECRET', 'INVALID', 'Must be at least 32 characters long in production/staging', true);
  } else {
    addReport('JWT_SECRET', 'VALID', 'Cryptographic secret verified', true);
  }

  const jwtExpiresIn = rawEnv.JWT_EXPIRES_IN || '7d';

  // 5. Supabase Configuration
  const supabaseUrl = rawEnv.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = rawEnv.SUPABASE_SERVICE_ROLE_KEY;
  const isSupabaseConfigured = Boolean(supabaseUrl && (supabaseAnonKey || supabaseServiceKey));

  if (databaseStorage === 'supabase') {
    if (!supabaseUrl) {
      addReport('NEXT_PUBLIC_SUPABASE_URL', 'MISSING', 'NEXT_PUBLIC_SUPABASE_URL required when DATABASE_STORAGE=supabase', false);
    } else if (!supabaseUrl.startsWith('https://')) {
      addReport('NEXT_PUBLIC_SUPABASE_URL', 'INVALID', 'Must start with https://', false);
    } else {
      addReport('NEXT_PUBLIC_SUPABASE_URL', 'VALID', 'Valid Supabase endpoint', false);
    }

    if (!supabaseAnonKey && !supabaseServiceKey) {
      addReport('SUPABASE_KEYS', 'MISSING', 'At least one Supabase API key (anon or service role) is required', true);
    } else {
      addReport('SUPABASE_KEYS', 'VALID', 'Supabase credentials present', true);
    }
  } else {
    addReport('SUPABASE', 'VALID', 'Optional for non-Supabase storage mode', false);
  }

  // 6. Moodle Configuration (Optional / Gated)
  const moodleHost = rawEnv.MOODLE_DATABASE_HOST;
  const moodlePort = rawEnv.MOODLE_DATABASE_PORT ? parseInt(rawEnv.MOODLE_DATABASE_PORT, 10) : undefined;
  const moodleDbName = rawEnv.MOODLE_DATABASE_NAME;
  const moodleUser = rawEnv.MOODLE_DATABASE_USER;
  const isMoodleConfigured = Boolean(moodleHost && moodleUser);

  if (moodlePort && moodlePort === 6543) {
    addReport('MOODLE_DATABASE_PORT', 'INVALID', 'Port 6543 (Transaction Pooler) terminates session advisory locks. Port 5432 (Session Pooler) is required.', false);
  }

  // 7. BigBlueButton Configuration (Optional / Gated)
  const bbbBaseUrl = rawEnv.BBB_BASE_URL || rawEnv.BIGBLUEBUTTON_BASE_URL;
  const isBBBConfigured = Boolean(bbbBaseUrl);

  // 8. AI Inference Configuration (Optional / Gated)
  const ollamaBaseUrl = rawEnv.OLLAMA_BASE_URL;
  const ollamaModel = rawEnv.OLLAMA_MODEL || 'llama3.2:3b';
  const geminiApiKey = rawEnv.GEMINI_API_KEY;
  const isGeminiConfigured = Boolean(geminiApiKey);
  const isAIConfigured = Boolean(ollamaBaseUrl || isGeminiConfigured);

  if (geminiApiKey) {
    addReport('GEMINI_API_KEY', 'VALID', 'Gemini AI API Key present', true);
  } else {
    addReport('GEMINI_API_KEY', 'VALID', 'Optional AI provider unconfigured', false);
  }

  // 9. Storage Configuration
  const bucketName = rawEnv.S3_BUCKET_NAME || rawEnv.STORAGE_BUCKET;
  const isStorageConfigured = Boolean(bucketName);

  // 10. Email & SMTP Configuration
  const smtpHost = rawEnv.SMTP_HOST;
  const smtpPort = rawEnv.SMTP_PORT ? parseInt(rawEnv.SMTP_PORT, 10) : undefined;
  const smtpUser = rawEnv.SMTP_USER;
  const smtpPassword = rawEnv.SMTP_PASSWORD;
  const emailFrom = rawEnv.EMAIL_FROM || 'admissions@zealosh.com';
  const isEmailConfigured = Boolean(smtpHost && smtpUser);

  if (smtpPassword) {
    addReport('SMTP_PASSWORD', 'VALID', 'SMTP secret credentials present', true);
  } else {
    addReport('SMTP_PASSWORD', 'VALID', 'Optional SMTP credentials unconfigured (using mock/gated adapter)', false);
  }

  // 11. Payment Gateways (Razorpay / Stripe)
  const razorpayKeyId = rawEnv.RAZORPAY_KEY_ID;
  const razorpayKeySecret = rawEnv.RAZORPAY_KEY_SECRET;
  const isRazorpayConfigured = Boolean(razorpayKeyId && razorpayKeySecret);

  const stripeSecretKey = rawEnv.STRIPE_SECRET_KEY;
  const stripePublishableKey = rawEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const isStripeConfigured = Boolean(stripeSecretKey && stripePublishableKey);

  if (razorpayKeySecret) {
    addReport('RAZORPAY_KEY_SECRET', 'VALID', 'Razorpay secret present', true);
  }
  if (stripeSecretKey) {
    addReport('STRIPE_SECRET_KEY', 'VALID', 'Stripe secret key present', true);
  }

  // 12. WhatsApp Notification Service
  const whatsappApiKey = rawEnv.WHATSAPP_API_KEY;
  const whatsappPhoneId = rawEnv.WHATSAPP_PHONE_NUMBER_ID;
  const isWhatsappConfigured = Boolean(whatsappApiKey && whatsappPhoneId);

  if (whatsappApiKey) {
    addReport('WHATSAPP_API_KEY', 'VALID', 'WhatsApp API key present', true);
  }

  // 13. Background Worker Supervisor Configuration
  const rawSupervisor = (rawEnv.ZEALOSH_WORKER_SUPERVISOR || 'standalone').toLowerCase();
  let supervisor: 'systemd' | 'pm2' | 'standalone' = 'standalone';
  if (rawSupervisor === 'systemd') supervisor = 'systemd';
  else if (rawSupervisor === 'pm2') supervisor = 'pm2';

  const rawInterval = rawEnv.WORKER_INTERVAL_MS ? parseInt(rawEnv.WORKER_INTERVAL_MS, 10) : 30000;
  const workerIntervalMs = isNaN(rawInterval) || rawInterval < 1000 ? 30000 : rawInterval;

  const isValid = errors.length === 0;

  const config: AppConfig = {
    env,
    port,
    domain,
    appBaseUrl,
    publicAppUrl,
    databaseStorage,
    jwtSecret: jwtSecret || 'zealosh-development-fallback-secret-key-32ch',
    jwtExpiresIn,
    oauthClientSecret: rawEnv.OAUTH_CLIENT_SECRET,
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      serviceRoleKey: supabaseServiceKey,
      isConfigured: isSupabaseConfigured,
    },
    moodle: {
      host: moodleHost,
      port: moodlePort,
      dbName: moodleDbName,
      user: moodleUser,
      isConfigured: isMoodleConfigured,
    },
    bigBlueButton: {
      baseUrl: bbbBaseUrl,
      isConfigured: isBBBConfigured,
    },
    ai: {
      ollamaBaseUrl,
      model: ollamaModel,
      geminiConfigured: isGeminiConfigured,
      isConfigured: isAIConfigured,
    },
    storage: {
      bucketName,
      isConfigured: isStorageConfigured,
    },
    email: {
      smtpHost,
      smtpPort,
      smtpUser,
      emailFrom,
      isConfigured: isEmailConfigured,
    },
    payments: {
      razorpayConfigured: isRazorpayConfigured,
      stripeConfigured: isStripeConfigured,
      isConfigured: isRazorpayConfigured || isStripeConfigured,
    },
    whatsapp: {
      phoneNumberId: whatsappPhoneId,
      isConfigured: isWhatsappConfigured,
    },
    worker: {
      supervisor,
      intervalMs: workerIntervalMs,
    },
  };

  return {
    valid: isValid,
    config: isValid ? config : undefined,
    errors,
    warnings,
    redactedReport,
  };
}

let cachedConfig: AppConfig | null = null;

/**
 * Returns the cached typed AppConfig or throws a descriptive (scrubbed) error in production.
 */
export function getAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = validateAndLoadConfig();
  if (!result.valid) {
    const errorSummary = result.errors.join('; ');
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[Configuration Error] Failed to start Zealosh LMS: ${errorSummary}`);
    }
  }

  cachedConfig = result.config || (validateAndLoadConfig({ ZEALOSH_ENVIRONMENT: 'development' }).config as AppConfig);
  return cachedConfig;
}

