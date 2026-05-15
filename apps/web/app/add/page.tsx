/**
 * Path: apps/web/app/add/page.tsx
 * Description: Public profile add landing page for QR/share links.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import Link from 'next/link';
import { t, type AppLanguage } from '@pallinky/i18n';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: t('en', 'add_landing_metadata_title'),
  description: t('en', 'add_landing_metadata_description'),
};

type Props = {
  searchParams: Promise<{
    profileId?: string | string[];
    name?: string | string[];
    avatarUrl?: string | string[];
    lang?: string | string[];
  }>;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

const APP_STORE_URL = 'https://apps.apple.com/app/pallinky/id6760797135';
const ANDROID_URL = 'https://pallinky.com/pallinky.apk';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function avatarFallback(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || 'Pallinky friend',
  )}&background=43691b&color=fff`;
}

function isSupportedLanguage(value: string): value is AppLanguage {
  return value === 'en' || value === 'nl' || value === 'fr';
}

function resolveLanguage(langParam: string | undefined, acceptLanguage: string) {
  if (langParam && isSupportedLanguage(langParam)) {
    return langParam;
  }

  const preferred = acceptLanguage
    .split(',')
    .map((part) => part.trim().slice(0, 2).toLowerCase())
    .find(isSupportedLanguage);

  return preferred || 'en';
}

async function loadPublicProfile(profileId: string): Promise<ProfileRow | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', profileId)
      .maybeSingle();

    if (error) {
      console.log('Add profile landing load error:', error.message);
      return null;
    }

    return (data as ProfileRow | null) || null;
  } catch (err) {
    console.log('Add profile landing load exception:', err);
    return null;
  }
}

export default async function AddProfilePage({ searchParams }: Props) {
  const {
    profileId: rawProfileId,
    name: rawName,
    avatarUrl: rawAvatarUrl,
    lang: rawLang,
  } = await searchParams;
  const requestHeaders = await headers();
  const lang = resolveLanguage(
    firstParam(rawLang)?.trim().toLowerCase(),
    requestHeaders.get('accept-language') || '',
  );
  const profileId = firstParam(rawProfileId)?.trim() || '';
  const sharedName = firstParam(rawName)?.trim() || '';
  const sharedAvatarUrl = firstParam(rawAvatarUrl)?.trim() || '';
  const profile = profileId ? await loadPublicProfile(profileId) : null;

  const displayName =
    profile?.full_name?.trim() || sharedName || t(lang, 'add_landing_fallback_name');
  const avatarUrl = profile?.avatar_url?.trim() || sharedAvatarUrl || avatarFallback(displayName);
  const appUrl = profileId
    ? `pallinky://add?profileId=${encodeURIComponent(profileId)}`
    : 'pallinky://';

  return (
    <main
      style={{
        minHeight: '100vh',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif',
        background: 'linear-gradient(180deg, #f8fbf3 0%, #eef5e5 50%, #e7f0db 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          background: '#ffffff',
          borderRadius: '28px',
          padding: '40px 28px',
          boxShadow: '0 20px 60px rgba(67, 105, 27, 0.12)',
          border: '1px solid rgba(67, 105, 27, 0.12)',
          textAlign: 'center',
        }}
      >
        <img
          src={avatarUrl}
          alt={t(lang, 'add_landing_avatar_alt', { name: displayName })}
          style={{
            width: '112px',
            height: '112px',
            borderRadius: '56px',
            objectFit: 'cover',
            border: '4px solid #eff5e7',
            boxShadow: '0 10px 30px rgba(67, 105, 27, 0.16)',
          }}
        />

        <p
          style={{
            margin: '22px 0 0',
            color: '#43691b',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontSize: '0.78rem',
          }}
        >
          {t(lang, 'add_landing_badge')}
        </p>

        <h1
          style={{
            margin: '10px 0 0',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            lineHeight: 1.05,
            fontWeight: 800,
            color: '#1f2a12',
            letterSpacing: '-0.03em',
          }}
        >
          {t(lang, 'add_landing_title', { name: displayName })}
        </h1>

        <p
          style={{
            margin: '16px auto 0',
            maxWidth: '500px',
            fontSize: '1.08rem',
            lineHeight: 1.6,
            color: '#4f5d43',
          }}
        >
          {t(lang, 'add_landing_body')}
        </p>

        <div
          style={{
            display: 'grid',
            gap: '14px',
            marginTop: '32px',
          }}
        >
          <a
            href={appUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '56px',
              padding: '0 20px',
              borderRadius: '16px',
              background: '#43691b',
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '1rem',
              boxShadow: '0 10px 24px rgba(67, 105, 27, 0.18)',
            }}
          >
            {t(lang, 'add_landing_open_app')}
          </a>

          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '56px',
              padding: '0 20px',
              borderRadius: '16px',
              background: '#eff5e7',
              color: '#2c3a1d',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              border: '1px solid rgba(67, 105, 27, 0.16)',
            }}
          >
            {t(lang, 'add_landing_download_ios')}
          </a>

          <a
            href={ANDROID_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '56px',
              padding: '0 20px',
              borderRadius: '16px',
              background: '#ffffff',
              color: '#2c3a1d',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              border: '1px solid rgba(67, 105, 27, 0.16)',
            }}
          >
            {t(lang, 'add_landing_download_android')}
          </a>
        </div>

        <p style={{ margin: '22px 0 0', color: '#66715f', fontSize: '0.92rem' }}>
          {t(lang, 'add_landing_installed_hint')}
        </p>

        <div style={{ marginTop: '24px' }}>
          <Link
            href="/"
            style={{
              color: '#43691b',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            {t(lang, 'add_landing_learn_more')}
          </Link>
        </div>
      </div>
    </main>
  );
}
