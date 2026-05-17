/**
 * Path: apps/web/app/event/[slug]/page.tsx
 * Description: Web event details page with token-aware returning guest recognition, change RSVP, and ICS download for formal events.
 */

import { formatInEventTimeZone } from '@pallinky/core/src/dateTime';
import { createClient } from '../../../lib/supabase/server';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import RSVPButton from './RSVPButton';

const SYSTEM = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
};

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  submerged: { bg: '#F6F7F9', accent: '#6A4C93', text: '#1f2a1b', isDark: false },
  zen: { bg: '#F6F7F9', accent: '#43691b', text: '#1f2a1b', isDark: false },
  girly: { bg: '#f4bbd3', accent: '#fe5d9f', text: '#2b1f24', isDark: false },
  fiesta: { bg: '#1729ae', accent: '#fe20e8', text: '#ffffff', isDark: true },
  classy: { bg: '#03172f', accent: '#efd466', text: '#fff7b6', isDark: true },
  spicy: { bg: '#656c12', accent: '#ecc216', text: '#ffffff', isDark: true },
};

const FONT_MAP: Record<string, string> = {
  Sans: 'Arial, ui-sans-serif, system-ui, sans-serif',
  Serif: '"Times New Roman", ui-serif, Georgia, serif',
  Cursive: '"Snell Roundhand", "Apple Chancery", cursive',
  Gothic: '"Copperplate", Impact, sans-serif',
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

function formatEventDate(event: any) {
  if (!event?.starts_at) return '';

  return formatInEventTimeZone(
    event.starts_at,
    { weekday: 'long', month: 'short', day: 'numeric' },
    event
  );
}

function formatEventDateTime(isoString?: string | null) {
  if (!isoString) return '';
  return formatInEventTimeZone(isoString, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getResponseLabel(status?: string | null, isDatePoll?: boolean) {
  if (isDatePoll) return 'Voted';

  const clean = String(status || '').toLowerCase();
  if (clean === 'yes') return 'Going';
  if (clean === 'maybe') return 'Maybe';
  if (clean === 'no') return 'Not going';
  if (clean === 'interested') return 'Interested';
  return 'Response saved';
}

function formatICSDate(isoString: string) {
  const date = new Date(isoString);
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escapeICS(value?: string | null) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function buildICS(event: any) {
  if (!event?.starts_at) return '';

  const startsAt = formatICSDate(event.starts_at);
  const endsAt = formatICSDate(
    event.ends_at || new Date(new Date(event.starts_at).getTime() + 2 * 60 * 60 * 1000).toISOString()
  );
  const stamp = formatICSDate(new Date().toISOString());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pallinky//Event//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@pallinky.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${startsAt}`,
    `DTEND:${endsAt}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description || `Event details: https://pallinky.com/event/${event.slug}`)}`,
    `LOCATION:${escapeICS(event.location || '')}`,
    `URL:https://pallinky.com/event/${event.slug}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export default async function EventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { token = '' } = await searchParams;

  const supabase = await createClient();
  const cookieStore = await cookies();

  const { data: event } = await supabase.from('events').select('*').eq('slug', slug).single();

  if (!event) notFound();

  const isPoll = Array.isArray(event.proposed_dates) && event.proposed_dates.length > 0;
const isFormal = !isPoll && (event.event_type === 'formal' || !!event.starts_at);
  const themeKey =
    event?.gif_key && PALETTES[event.gif_key]
      ? event.gif_key
      : isFormal
        ? 'zen'
        : 'submerged';

  const theme = PALETTES[themeKey];
  const pageFont = FONT_MAP[event?.font_family] || FONT_MAP.Sans;

  const hasLocationInDesc = event?.description?.includes('Location: ');
  const displayDescription = hasLocationInDesc
    ? event.description.split('Location: ')[0].trim()
    : event?.description;
  const locationText = hasLocationInDesc
    ? event.description.split('Location: ')[1].trim()
    : event?.location;

 let rememberedEmail =
  cookieStore.get('pallinky_guest_email')?.value?.toLowerCase().trim() || '';

const guestToken =
  token || cookieStore.get('pallinky_guest_token')?.value || null;

if (guestToken) {
  const { data: tokenRow } = await supabase
    .from('rsvps')
    .select('email_lc')
    .eq('event_id', event.id)
    .eq('guest_token', guestToken)
    .maybeSingle();

  if (tokenRow?.email_lc) {
    rememberedEmail = tokenRow.email_lc.toLowerCase().trim();
  }
}

  let existingGuest: {
    name: string;
    email: string;
    status: string | null;
    note: string;
    selectedDates: string[];
    respondedAt?: string | null;
  } | null = null;

  if (rememberedEmail) {
    const { data: existingRsvp } = await supabase
      .from('rsvps')
      .select('name, email, email_lc, status, message, responded_at')
      .eq('event_id', event.id)
      .eq('email_lc', rememberedEmail)
      .maybeSingle();

    const { data: existingVote } = !isFormal
      ? await supabase
          .from('vibe_responses')
          .select('guest_name, user_email, selected_dates, note')
          .eq('event_id', event.id)
          .eq('user_email', rememberedEmail)
          .maybeSingle()
      : { data: null as any };

    if (existingRsvp || existingVote) {
      existingGuest = {
        name:
          existingRsvp?.name ||
          existingVote?.guest_name ||
          rememberedEmail.split('@')[0] ||
          '',
        email: existingRsvp?.email || existingVote?.user_email || rememberedEmail,
        status: existingRsvp?.status || (existingVote ? 'interested' : null),
        note: existingVote?.note || existingRsvp?.message || '',
        selectedDates: existingVote?.selected_dates || [],
        respondedAt: existingRsvp?.responded_at || null,
      };
    }
  }

  const icsHref = isFormal && event.starts_at
    ? `data:text/calendar;charset=utf-8,${encodeURIComponent(buildICS(event))}`
    : null;

  return (
    <main
      style={{
        fontFamily: pageFont,
        minHeight: '100vh',
        backgroundColor: theme.bg,
        color: theme.text,
      }}
    >
      <div
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          padding: '20px 20px 56px',
        }}
      >
        {event.cover_image_url ? (
          <div
            style={{
              width: '100%',
              paddingTop: '5px',
              marginBottom: '0',
            }}
          >
            <img
              src={event.cover_image_url}
              alt={event.title || 'Event cover'}
              style={{
                width: '100%',
                height: '220px',
                objectFit: 'cover',
                borderRadius: '24px',
                display: 'block',
              }}
            />
          </div>
        ) : null}

        <div
          style={{
            padding: '25px',
            paddingTop: '15px',
          }}
        >
          {isFormal ? (
            <>
              <h1
                style={{
                  fontSize: '34px',
                  fontWeight: 900,
                  letterSpacing: '-1px',
                  margin: '0 0 4px',
                  lineHeight: 1.05,
                }}
              >
                {event.title}
              </h1>

              <p
                style={{
                  fontSize: '18px',
                  margin: '0 0 25px',
                  color: theme.text,
                  opacity: 0.7,
                }}
              >
                Hosted by {event.host_name}
              </p>

              <div style={{ marginBottom: '30px' }}>
                {event.starts_at ? (
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      marginBottom: locationText ? '8px' : '0',
                    }}
                  >
                    {formatEventDate(event)}
                  </div>
                ) : null}

                {locationText ? (
                  <div style={{ marginBottom: '5px' }}>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(locationText)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: theme.accent,
                        fontSize: '18px',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      📍 {locationText}
                    </a>
                    <div
                      style={{
                        fontSize: '11px',
                        opacity: 0.8,
                        marginLeft: '24px',
                        fontWeight: 700,
                        color: theme.accent,
                        marginTop: '2px',
                      }}
                    >
                      Open in Maps
                    </div>
                  </div>
                ) : null}
              </div>

              {displayDescription ? (
                <div style={{ marginBottom: '24px', padding: '5px' }}>
                  <p
                    style={{
                      fontSize: '17px',
                      lineHeight: 1.53,
                      margin: 0,
                      color: theme.text,
                      opacity: 0.9,
                    }}
                  >
                    {displayDescription}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    color: theme.accent,
                    fontSize: '20px',
                    lineHeight: 1,
                  }}
                >
                  ≋
                </span>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: theme.accent,
                  }}
                >
                  {event.host_name}&apos;s Idea
                </div>
              </div>

              <h1
                style={{
                  fontSize: '34px',
                  fontWeight: 900,
                  margin: '0 0 12px',
                  lineHeight: 1.05,
                }}
              >
                {event.title}
              </h1>

              {event.description ? (
                <p
                  style={{
                    fontSize: '18px',
                    lineHeight: '26px',
                    fontWeight: 500,
                    margin: '0 0 24px',
                    color: theme.text,
                    opacity: 0.8,
                  }}
                >
                  {event.description}
                </p>
              ) : null}
            </>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '28px',
            }}
          >
            {icsHref ? (
              <a
                href={icsHref}
                download={`${event.slug || 'event'}.ics`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px 18px',
                  borderRadius: '16px',
                  border: `1.5px solid ${theme.accent}`,
                  backgroundColor: SYSTEM.surface,
                  color: theme.accent,
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: 800,
                }}
              >
                Download calendar file
              </a>
            ) : null}

            {/* removed redundant jump-to-form button */}
          </div>

          {existingGuest ? (
            <div
              style={{
                marginBottom: '28px',
                padding: '18px',
                borderRadius: '18px',
                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                border: `1px solid ${theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.borderSoft}`,
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: theme.text,
                  opacity: 0.6,
                  marginBottom: '8px',
                }}
              >
                Your response
              </div>

              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  marginBottom: '6px',
                }}
              >
                {getResponseLabel(existingGuest.status, isPoll)}
              </div>

              <div
                style={{
                  fontSize: '15px',
                  color: theme.text,
                  opacity: 0.75,
                  marginBottom: existingGuest.respondedAt ? '8px' : '0',
                }}
              >
                {existingGuest.email}
              </div>

              {existingGuest.respondedAt ? (
                <div
                  style={{
                    fontSize: '14px',
                    color: theme.text,
                    opacity: 0.6,
                  }}
                >
                  Last updated {formatEventDateTime(existingGuest.respondedAt)}
                </div>
              ) : null}
            </div>
          ) : null}

          <div id="rsvp-form">
            <RSVPButton event={event} existingGuest={existingGuest} />
          </div>
        </div>
      </div>
    </main>
  );
}