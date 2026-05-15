/**
 * Path: apps/web/app/add/page.tsx
 * Description: Public profile add landing page for QR/share links.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Add on Pallinky',
  description: 'Open Pallinky to add this person to your contacts.',
};

type Props = {
  searchParams: Promise<{ profileId?: string | string[] }>;
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
  const { profileId: rawProfileId } = await searchParams;
  const profileId = firstParam(rawProfileId)?.trim() || '';
  const profile = profileId ? await loadPublicProfile(profileId) : null;

  const displayName = profile?.full_name?.trim() || 'Someone';
  const avatarUrl = profile?.avatar_url || avatarFallback(displayName);
  const appUrl = profileId
    ? `pallinky://add?profileId=${encodeURIComponent(profileId)}`
    : 'pallinky://';

  return (
    <main
      style={{
        minHeight: '100vh',
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
          alt={`${displayName} profile`}
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
          Pallinky contact request
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
          Add {displayName} on Pallinky
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
          Open Pallinky to add this person to your contacts and start making
          plans together.
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
            Open in Pallinky
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
            Download on the App Store
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
            Get it on Android
          </a>
        </div>

        <p style={{ margin: '22px 0 0', color: '#66715f', fontSize: '0.92rem' }}>
          If you just installed Pallinky, come back to this page and tap Open in Pallinky.
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
            Learn more about Pallinky
          </Link>
        </div>
      </div>
    </main>
  );
}
