/**
 * Path: packages/core/src/supabase.ts
 * Description: Universal Supabase client with AsyncStorage persistence for Expo.
 * Updated: fail closed when the selected app variant and Supabase project disagree.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL_BY_VARIANT = {
  development: 'https://picgzvmhevhznzowkdhv.supabase.co',
  production: 'https://nfoshumnlfsjtfxkyqrq.supabase.co',
} as const;

type AppVariant = keyof typeof SUPABASE_URL_BY_VARIANT;

const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT?.toLowerCase();
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function isKnownAppVariant(value: string | undefined): value is AppVariant {
  return value === 'development' || value === 'production';
}

if (!isKnownAppVariant(appVariant)) {
  throw new Error(
    `Missing or invalid EXPO_PUBLIC_APP_VARIANT. Expected "development" or "production", got ${appVariant ?? 'unset'}.`
  );
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Missing Supabase configuration for ${appVariant}. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.`
  );
}

const expectedSupabaseUrl = SUPABASE_URL_BY_VARIANT[appVariant];

if (supabaseUrl !== expectedSupabaseUrl) {
  throw new Error(
    `${appVariant} Supabase URL mismatch. Expected ${expectedSupabaseUrl}, got ${supabaseUrl}.`
  );
}

export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
