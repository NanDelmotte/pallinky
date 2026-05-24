import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@pallinky/core';

export const AUTH_RETURN_KEY = 'pallinky_auth_return_to';
export const AUTH_PENDING_NAME_KEY = 'pallinky_auth_pending_name';

export function getAppVariant() {
  return (
    process.env.EXPO_PUBLIC_APP_VARIANT ??
    Constants.expoConfig?.extra?.appVariant ??
    Constants.expoConfig?.extra?.expoChannelName ??
    ''
  )
    .toString()
    .toLowerCase();
}

export function isDevelopmentVariant() {
  const variant = getAppVariant();
  return variant === 'development' || variant === 'dev';
}

export function getAuthCallbackUrl() {
  return 'pallinky://auth-callback';
}



export function isAuthCallbackUrl(url: string | null | undefined) {
  if (!url) return false;

  const normalized = String(url).trim().toLowerCase();

  return (
    normalized.startsWith('pallinky://auth-callback') ||
    normalized.startsWith('pallinky://auth-callback') ||
    normalized.startsWith(Linking.createURL('auth-callback').toLowerCase()) ||
    normalized.includes('access_token=') ||
    normalized.includes('refresh_token=') ||
    normalized.includes('code=')
  );
}

function readAuthParam(url: string, key: string) {
  try {
    const parsed = new URL(url);
    const fromSearch = parsed.searchParams.get(key);
    if (fromSearch) return fromSearch;
  } catch {
    // Fall back to manual parsing below. Some native callback URLs can contain
    // fragments that URL parsers normalize differently across platforms.
  }

  const hash = url.split('#')[1] ?? '';
  const hashParams = new URLSearchParams(hash);
  const fromHash = hashParams.get(key);
  if (fromHash) return fromHash;

  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const queryParams = new URLSearchParams(query);
  return queryParams.get(key);
}

export async function completeSupabaseAuthFromUrl(url: string): Promise<Session | null> {
  const errorCode = readAuthParam(url, 'error');
  const errorDescription = readAuthParam(url, 'error_description');

  if (errorCode || errorDescription) {
    throw new Error(errorDescription || errorCode || 'OAuth sign-in failed.');
  }

  const accessToken = readAuthParam(url, 'access_token');
  const refreshToken = readAuthParam(url, 'refresh_token');

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;
    return data.session;
  }

  const code = readAuthParam(url, 'code');

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) throw error;
    return data.session;
  }

  return null;
}
