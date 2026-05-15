/**
 * Path: packages/core/src/supabase.ts
 * Description: Universal Supabase client with AsyncStorage persistence for Expo.
 * Updated: switched auth session storage off SecureStore to avoid 2048-byte limit warnings.
 */
import { createClient } from '@supabase/supabase-js';
let AsyncStorage: any = null;

try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  // non-react-native environment (web / server)
  AsyncStorage = null;
}

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: AsyncStorage || undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});