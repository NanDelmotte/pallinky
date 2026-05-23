/**
 * Path: packages/core/src/supabase.ts
 * Description: Universal Supabase client with AsyncStorage persistence for Expo.
 * Updated: avoid startup crashes when public Supabase env is absent from a release bundle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PRODUCTION_SUPABASE_URL = 'https://nfoshumnlfsjtfxkyqrq.supabase.co';

const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT ?? 'production';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (
  appVariant === 'production' &&
  supabaseUrl &&
  supabaseUrl !== PRODUCTION_SUPABASE_URL
) {
  throw new Error(
    `Production Supabase URL mismatch. Expected ${PRODUCTION_SUPABASE_URL}, got ${supabaseUrl}.`
  );
}

const missingConfigError = {
  name: 'SupabaseConfigurationError',
  message:
    'Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY for the mobile release build.',
};

const missingConfigResult = Promise.resolve({ data: null, error: missingConfigError });

function createDisabledQuery() {
  return new Proxy(missingConfigResult, {
    get(target, prop) {
      if (prop in target) {
        const value = target[prop as keyof typeof target];
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return () => createDisabledQuery();
    },
  });
}

function createDisabledSupabaseClient(): SupabaseClient {
  return {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: missingConfigError }),
      getUser: () => Promise.resolve({ data: { user: null }, error: missingConfigError }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => undefined,
          },
        },
      }),
      signInWithOtp: () => missingConfigResult,
      verifyOtp: () => missingConfigResult,
      signInWithOAuth: () => missingConfigResult,
      setSession: () => missingConfigResult,
      exchangeCodeForSession: () => missingConfigResult,
      signOut: () => missingConfigResult,
    },
    from: () => createDisabledQuery(),
    rpc: () => missingConfigResult,
    storage: {
      from: () => createDisabledQuery(),
    },
  } as unknown as SupabaseClient;
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createDisabledSupabaseClient();
