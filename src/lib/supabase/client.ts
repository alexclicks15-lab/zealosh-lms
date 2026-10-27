import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (typeof window !== 'undefined') {
    if (clientInstance) return clientInstance;
    clientInstance = createBrowserClient(supabaseUrl, supabaseKey);
    return clientInstance;
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
