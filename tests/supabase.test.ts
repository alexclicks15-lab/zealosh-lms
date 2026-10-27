import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isSupabaseConfigured, getSupabaseAdminClient } from '../src/lib/supabase';
import { createClient } from '../src/lib/supabase/client';

describe('Supabase Client & Configuration Integration Tests', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://yeegsljnjwxdhgzfdnyg.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IMAOSBMuGgGlXOrVUcNGHQ_NUKVEWQ4';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  });

  it('should detect when Supabase is configured via environment variables', () => {
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('should initialize browser Supabase client with auth and query capabilities', () => {
    const client = createClient();
    expect(client).not.toBeNull();
    expect(typeof client?.from).toBe('function');
    expect(typeof client?.auth?.getSession).toBe('function');
  });

  it('should initialize administrative/server Supabase client instance', () => {
    const admin = getSupabaseAdminClient();
    expect(admin).not.toBeNull();
    expect(typeof admin?.from).toBe('function');
  });

  it('should return null when credentials are intentionally cleared', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(isSupabaseConfigured()).toBe(false);
  });
});
