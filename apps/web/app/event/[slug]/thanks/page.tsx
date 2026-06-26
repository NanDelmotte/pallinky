/**
 * Path: apps/web/app/event/[slug]/thanks/page.tsx
 * Description: Localized web thanks page for guest RSVP / poll confirmations, aligned with the email confirmation tone and event-type-aware copy system.
 *
 * Implementation notes:
 * - Replaces generic confirmation copy with i18n translation keys
 * - Uses event-type-aware confirmation logic:
 *   - Formal / Series -> RSVP language
 *   - Poll -> Vote language
 * - Renders content in human-first order:
 *   - event context
 *   - headline
 *   - support
 * - Updates CTA labels to feel less transactional
 * - Uses planning-chat language for Reach-out plans
 */

import Link from 'next/link';
import { createClient } from '../../../../lib/supabase/server';
import { t } from '../../../../../../packages/i18n';
import type { AppLanguage, TranslationKey } from '../../../../../../packages/i18n/types';

const SYSTEM = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
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

const IOS_BETA_URL = 'https://apps.apple.com/app/pallinky/id6760797135';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    status?: string;
    theme?: string;
    token?: string;
    lang?: string;
    locale?: string;
    language?: string;
    is_update?: string;
  }>;
};

type ConfirmationCopyKeys = {
  subjectKey: TranslationKey;
  headlineKey: TranslationKey;
  eventContextKey: TranslationKey;
  supportKey: TranslationKey;
};

function normalizeLanguage(value?: string): AppLanguage {
  const clean = String(value || '').toLowerCase();

  if (clean.startsWith('nl')) return 'nl';
  if (clean.startsWith('fr')) return 'fr';
  return 'en';
}

function getConfirmationCopyKeys({
  response,
  isDatePoll,
  isUpdate,
  isPlanningChat,
}: {
  response?: string;
  isDatePoll?: boolean;
  isUpdate?: boolean;
  isPlanningChat?: boolean;
}): ConfirmationCopyKeys {
  const clean = String(response || '').toLowerCase();

  if (isPlanningChat) {
    return {
      subjectKey: 'planning_chat_joined_subject',
      headlineKey: 'planning_chat_joined_headline',
      eventContextKey: 'planning_chat_joined_event_context',
      supportKey: 'planning_chat_joined_support',
    };
  }

  if (isDatePoll) {
    return isUpdate
      ? {
          subjectKey: 'poll_updated_subject',
          headlineKey: 'poll_updated_headline',
          eventContextKey: 'poll_updated_event_context',
          supportKey: 'poll_updated_support',
        }
      : {
          subjectKey: 'poll_submitted_subject',
          headlineKey: 'poll_submitted_headline',
          eventContextKey: 'poll_submitted_event_context',
          supportKey: 'poll_submitted_support',
        };
  }

  if (clean === 'yes') {
    return {
      subjectKey: 'formal_yes_subject',
      headlineKey: 'formal_yes_headline',
      eventContextKey: 'formal_yes_event_context',
      supportKey: 'formal_yes_support',
    };
  }

  if (clean === 'maybe') {
    return {
      subjectKey: 'formal_maybe_subject',
      headlineKey: 'formal_maybe_headline',
      eventContextKey: 'formal_maybe_event_context',
      supportKey: 'formal_maybe_support',
    };
  }

  if (clean === 'no') {
    return {
      subjectKey: 'formal_no_subject',
      headlineKey: 'formal_no_headline',
      eventContextKey: 'formal_no_event_context',
      supportKey: 'formal_no_support',
    };
  }

  return {
    subjectKey: 'formal_yes_subject',
    headlineKey: 'formal_yes_headline',
    eventContextKey: 'formal_yes_event_context',
    supportKey: 'formal_yes_support',
  };
}

function DownloadCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        width: '100%',
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          padding: '20px',
          borderRadius: '24px',
          width: '100%',
          border: `1px solid ${SYSTEM.border}`,
          backgroundColor: SYSTEM.surface,
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: SYSTEM.secondaryBg,
            color: SYSTEM.secondary,
            fontSize: '22px',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: SYSTEM.text,
              marginBottom: '2px',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: SYSTEM.textMuted,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
    </a>
  );
}

export default async function ThanksPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const {
    status,
    theme: themeKey,
    token,
    lang: langParam,
    locale,
    language,
    is_update,
  } = resolvedSearchParams;

  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('*').eq('slug', slug).single();

  if (!event) {
    return <div>Not found</div>;
  }

  const resolvedThemeKey =
    (themeKey && PALETTES[themeKey] && themeKey) ||
    (event?.gif_key && PALETTES[event.gif_key] && event.gif_key) ||
    'zen';

  const theme = PALETTES[resolvedThemeKey];
  const pageFont = FONT_MAP[event?.font_family] || FONT_MAP.Sans;

  const fallbackGif =
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeTV1bmo3bXRrcGc1cmZtM3lzY2prdnV3aDcxazduOWUxY29uZDNteCZlcD12MV9naWZzX3RyZW5kaW5nJmN0PWc/89x4osEodHEoo/giphy.gif';
  const finalGif = event.thanks_gif_url || fallbackGif;

  const proposedDates = Array.isArray(event.proposed_dates) ? event.proposed_dates : [];
  const isDatePoll = proposedDates.length > 0;
  const isPlanningChat = event.event_type === 'reach_out';
  const isUpdate = is_update === 'true';
  const response = status || 'interested';
  const lang = normalizeLanguage(langParam || locale || language);

  const copyKeys = getConfirmationCopyKeys({
    response,
    isDatePoll,
    isUpdate,
    isPlanningChat,
  });

  const eventTitle = event.title || 'your event';
  const hostName = event.host_name || 'Someone';
  const isPendingRequest = String(response || '').toLowerCase() === 'pending';

  const eventContext = t(lang, copyKeys.eventContextKey, {
    event: eventTitle,
    host: hostName,
  });

  const headline = isPendingRequest && isPlanningChat
    ? t(lang, 'planning_chat_request_pending_headline', { event: eventTitle, host: hostName })
    : isPendingRequest
    ? t(lang, 'rsvp_request_pending_headline', { event: eventTitle, host: hostName })
    : t(lang, copyKeys.headlineKey, {
        event: eventTitle,
        host: hostName,
      });

  const support = isPendingRequest && isPlanningChat
    ? t(lang, 'planning_chat_request_pending_support', { event: eventTitle, host: hostName })
    : isPendingRequest
    ? t(lang, 'rsvp_request_pending_support', { event: eventTitle, host: hostName })
    : t(lang, copyKeys.supportKey, {
        event: eventTitle,
        host: hostName,
      });

  const canOpenChat = true;

  return (
    <main
      style={{
        fontFamily: pageFont,
        minHeight: '100vh',
        backgroundColor: theme.bg,
        color: theme.text,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          margin: '0 auto',
          padding: '40px 40px 60px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '220px',
            height: '220px',
            borderRadius: '110px',
            border: `6px solid ${theme.accent}`,
            overflow: 'hidden',
            marginBottom: '30px',
            backgroundColor: 'rgba(0,0,0,0.05)',
          }}
        >
          <img
            src={finalGif}
            alt="Success"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <div
          style={{
            fontSize: '18px',
            fontWeight: 700,
            textAlign: 'center',
            margin: '0 0 10px',
            lineHeight: 1.3,
            color: theme.text,
          }}
        >
          {eventContext}
        </div>

        <h1
          style={{
            fontSize: '32px',
            fontWeight: 900,
            textAlign: 'center',
            margin: '0 0 12px',
            letterSpacing: '-0.5px',
            lineHeight: 1.1,
          }}
        >
          {headline}
        </h1>

        <p
          style={{
            fontSize: '18px',
            textAlign: 'center',
            margin: '0 0 30px',
            fontWeight: 500,
            color: theme.text,
            opacity: 0.7,
          }}
        >
          {support}
        </p>

        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '30px',
          }}
        >
          {event.starts_at ? (
            <a
              href={`https://pallinky.com/event/${slug}/ics`}
              style={{
                width: '100%',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  padding: '20px',
                  borderRadius: '24px',
                  width: '100%',
                  border: `1px solid ${SYSTEM.border}`,
                  backgroundColor: SYSTEM.surface,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: SYSTEM.secondaryBg,
                    color: SYSTEM.secondary,
                    fontSize: '22px',
                    flexShrink: 0,
                  }}
                >
                  📅
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: SYSTEM.text,
                      marginBottom: '2px',
                    }}
                  >
                    Add to calendar
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: SYSTEM.textMuted,
                    }}
                  >
                    Save this event to your calendar.
                  </div>
                </div>
              </div>
            </a>
          ) : null}

          <DownloadCard
            href={IOS_BETA_URL}
            icon="🍎"
            title="Get Pallinky for iPhone"
            subtitle={t(lang, 'post_rsvp_install_hint')}
          />

          {canOpenChat ? (
            <Link
              href={`https://pallinky.com/event/${slug}${isPlanningChat ? '/chat' : ''}${token ? `?token=${token}` : ''}`}
              style={{
                width: '100%',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  padding: '20px',
                  borderRadius: '24px',
                  width: '100%',
                  border: `1px solid ${SYSTEM.border}`,
                  backgroundColor: SYSTEM.surface,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: SYSTEM.secondaryBg,
                    color: SYSTEM.secondary,
                    fontSize: '22px',
                    flexShrink: 0,
                  }}
                >
                  💬
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: SYSTEM.text,
                      marginBottom: '2px',
                    }}
                  >
                    {isPlanningChat ? 'Open planning chat' : 'Open the event'}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: SYSTEM.textMuted,
                    }}
                  >
                    {isPlanningChat
                      ? 'Join the group chat and help figure out the plan.'
                      : 'Go back to the invitation, details, and guest list.'}
                  </div>
                </div>
              </div>
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
