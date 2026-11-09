import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from './client';
import { createServerSupabaseClient } from './server';

export { createClient, createServerSupabaseClient };

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

/**
 * Creates a fresh, request-scoped client using the public anonymous key.
 * Used for individual user authentication (signIn, signUp, resetPassword).
 * Strictly isolated per request: never caches session state or leaks identity between concurrent callers.
 */
export function createUserAuthClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let adminClientInstance: SupabaseClient | null = null;
let currentKey: string | null = null;

export function resetSupabaseAdminClient(): void {
  adminClientInstance = null;
  currentKey = null;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: getSupabaseAdminClient can only be invoked in server-side environments');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !key) {
    return null;
  }

  if (!adminClientInstance || currentKey !== key) {
    currentKey = key;
    adminClientInstance = createSupabaseClient(supabaseUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClientInstance;
}
