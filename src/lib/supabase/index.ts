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
