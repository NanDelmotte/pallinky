/**
 * Path: apps/web/lib/supabase/server.ts
 * Description: Simple server-side Supabase client for public web pages and route handlers.
 * No cookie/session handling.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function createClient() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}