/**
 * Path: apps/web/app/event/[slug]/RSVPButton.tsx
 * Description: Web RSVP form with returning guest support and change-RSVP, updated to pass confirmation context (status, language, update state, token) into the localized thanks page flow.
 *
 * Implementation notes:
 * - Preserves existing form UX for:
 *   - Formal
 *   - Poll
 *   - Reach-out fallback
 * - Adds language capture using browser locale
 * - Passes confirmation context to the thanks page via query params:
 *   - status
 *   - lang
 *   - is_update
 *   - token (when available)
 * - Keeps backend response handling unchanged
 * - Does not localize the form itself yet
 */

'use client';

import React, { useMemo, useState } from 'react';

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

function formatVoteDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type ExistingGuest = {
  name: string;
  email: string;
  status: string | null;
  note: string;
  selectedDates: string[];
  respondedAt?: string | null;
} | null;

export default function RSVPButton({
  event,
  existingGuest,
  guestToken,
}: {
  event: any;
  existingGuest: ExistingGuest;
  guestToken?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(existingGuest?.email || '');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState(existingGuest?.name || '');
  const [selectedDates, setSelectedDates] = useState<string[]>(existingGuest?.selectedDates || []);
  const [note, setNote] = useState(existingGuest?.note || '');
  const [error, setError] = useState('');

  const proposedDates = Array.isArray(event.proposed_dates) ? event.proposed_dates : [];
  const isDatePoll = proposedDates.length > 0;
  const isFormal = !isDatePoll && (event.event_type === 'formal' || !!event.starts_at);

  const themeKey =
    event?.gif_key && PALETTES[event.gif_key]
      ? event.gif_key
      : isFormal
        ? 'zen'
        : 'submerged';

  const theme = PALETTES[themeKey];

  const customFont = useMemo(
    () => ({
      fontFamily: FONT_MAP[event?.font_family] || FONT_MAP.Sans,
    }),
    [event?.font_family]
  );

  const inputBg = theme.isDark ? 'rgba(255,255,255,0.05)' : SYSTEM.surface;
  const inputBorder = theme.isDark ? `${theme.accent}33` : SYSTEM.border;
  const secondaryBg = theme.isDark ? 'transparent' : SYSTEM.surface;
  const secondaryText = theme.accent;
  const placeholderColor = theme.isDark ? 'rgba(255,247,182,0.55)' : 'rgba(31,42,27,0.45)';

  const baseFieldStyle: React.CSSProperties = {
    width: '100%',
    border: `1px solid ${inputBorder}`,
    fontSize: '16px',
    outline: 'none',
    backgroundColor: inputBg,
    color: theme.text,
    WebkitTextFillColor: theme.text,
    boxSizing: 'border-box',
  };

  const formShellStyle: React.CSSProperties = {
    ...customFont,
    display: 'flex',
    flexDirection: 'column',
    gap: '25px',
    paddingBottom: 'calc(110px + env(safe-area-inset-bottom))',
  };

  const stickyButtonStyle: React.CSSProperties = {
    position: 'sticky',
    bottom: 'max(12px, env(safe-area-inset-bottom))',
    zIndex: 20,
    boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
  };

  const buildThanksUrl = ({
    slug,
    finalStatus,
    token,
    isUpdate,
  }: {
    slug: string;
    finalStatus: string;
    token?: string | null;
    isUpdate: boolean;
  }) => {
    const params = new URLSearchParams();

    params.set('status', finalStatus);
    params.set('lang', navigator.language || 'en');
    params.set('is_update', String(isUpdate));

    if (themeKey) {
      params.set('theme', themeKey);
    }

    if (token) {
      params.set('token', token);
    }

    return `/event/${slug}/thanks?${params.toString()}`;
  };

  const handleSubmit = async (statusOverride?: string) => {
    setError('');

    const cleanName = name.trim();
    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setError('Please enter your name.');
      return;
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (isDatePoll && selectedDates.length === 0) {
      setError('Pick at least one date.');
      return;
    }

    const finalStatus = statusOverride || 'interested';
    const wasExistingGuest = !!existingGuest;

    setLoading(true);

    try {
      const response = await fetch(`/api/event/${event.slug}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone || null,
          guestToken: guestToken || null,
          status: finalStatus,
          selectedDates,
          note,
          lang: navigator.language || 'en',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(
          result?.deadline_passed
            ? 'The RSVP deadline has passed, so responses are now closed.'
            : result?.error || 'Failed to save your response. Please try again.'
        );
        return;
      }

      if (result?.deadline_passed) {
        setError('The RSVP deadline has passed, so responses are now closed.');
        return;
      }

      const resultGuestToken = result?.guest_token || null;
      const confirmationStatus = result?.join_request_created ? 'pending' : finalStatus;

      if (resultGuestToken) {
        document.cookie = `pallinky_guest_token=${resultGuestToken}; path=/; max-age=31536000`;
        document.cookie = `pallinky_guest_email=${cleanEmail}; path=/; max-age=31536000`;
      }

      const fallbackThanksUrl = buildThanksUrl({
        slug: event.slug,
        finalStatus: confirmationStatus,
        token: resultGuestToken,
        isUpdate: wasExistingGuest,
      });

      if (result?.redirectTo) {
        try {
          const redirectUrl = new URL(result.redirectTo, window.location.origin);
          redirectUrl.searchParams.set('status', confirmationStatus);
          redirectUrl.searchParams.set('lang', navigator.language || 'en');
          redirectUrl.searchParams.set('is_update', String(wasExistingGuest));

          if (themeKey) {
            redirectUrl.searchParams.set('theme', themeKey);
          }

          if (resultGuestToken) {
            redirectUrl.searchParams.set('token', resultGuestToken);
          }

          window.location.href = redirectUrl.toString();
          return;
        } catch {
          window.location.href = fallbackThanksUrl;
          return;
        }
      }

      window.location.href = fallbackThanksUrl;
    } catch {
      setError('Failed to save your response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isFormal) {
    return (
      <div style={formShellStyle}>
        <style>{`
          .pallinky-rsvp-field::placeholder,
          .pallinky-rsvp-textarea::placeholder {
            color: ${placeholderColor};
            opacity: 1;
          }
        `}</style>

        <div
          style={{
            fontSize: '18px',
            fontWeight: 800,
            marginBottom: '15px',
            paddingBottom: '8px',
            borderBottom: `1px solid ${theme.isDark ? `${theme.accent}40` : SYSTEM.border}`,
            color: theme.text,
          }}
        >
          {existingGuest ? 'Change your RSVP' : 'RSVP Details'}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <input
            className="pallinky-rsvp-field"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              ...baseFieldStyle,
              padding: '15px',
              borderRadius: '12px',
            }}
          />
          <input
            className="pallinky-rsvp-field"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              ...baseFieldStyle,
              padding: '15px',
              borderRadius: '12px',
            }}
          />
          <input
            className="pallinky-rsvp-field"
            placeholder="Phone number (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              ...baseFieldStyle,
              padding: '15px',
              borderRadius: '12px',
            }}
          />
          <textarea
            className="pallinky-rsvp-textarea"
            placeholder="Note for the host..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              ...baseFieldStyle,
              height: '80px',
              padding: '15px',
              borderRadius: '12px',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {error ? (
          <p style={{ color: '#c1121f', fontSize: '14px', fontWeight: 600, margin: '0 0 16px' }}>
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '50px' }}>
          <button
            type="button"
            onClick={() => handleSubmit('yes')}
            disabled={loading}
            style={{
              ...stickyButtonStyle,
              height: '60px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: theme.accent,
              color: theme.bg,
              fontSize: '19px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Saving...' : existingGuest ? 'Update to Going' : "I’m Going"}
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleSubmit('maybe')}
              disabled={loading}
              style={{
                flex: 1,
                height: '55px',
                borderRadius: '16px',
                border: `1.5px solid ${theme.accent}`,
                backgroundColor: secondaryBg,
                color: secondaryText,
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {existingGuest ? 'Update to Maybe' : 'Maybe'}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit('no')}
              disabled={loading}
              style={{
                flex: 1,
                height: '55px',
                borderRadius: '16px',
                border: `1.5px solid ${theme.accent}`,
                backgroundColor: secondaryBg,
                color: secondaryText,
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {existingGuest ? 'Update to No' : 'No'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isDatePoll) {
    return (
      <div style={formShellStyle}>
        <style>{`
          .pallinky-rsvp-field::placeholder,
          .pallinky-rsvp-textarea::placeholder {
            color: ${placeholderColor};
            opacity: 1;
          }
        `}</style>

        <div style={{ marginBottom: '0' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '12px',
              letterSpacing: '1px',
              color: theme.text,
              opacity: 0.6,
            }}
          >
            Vote for dates:
          </div>

          {proposedDates.map((date: string, index: number) => {
            const isSelected = selectedDates.includes(date);

            return (
              <button
                key={`${date}-${index}`}
                type="button"
                onClick={() =>
                  setSelectedDates((prev) =>
                    prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
                  )
                }
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px',
                  borderRadius: '20px',
                  marginBottom: '10px',
                  border: `1.5px solid ${
                    isSelected ? theme.accent : theme.isDark ? `${theme.accent}33` : SYSTEM.border
                  }`,
                  backgroundColor: isSelected
                    ? theme.accent
                    : theme.isDark
                      ? 'rgba(255,255,255,0.04)'
                      : SYSTEM.surface,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? theme.bg : theme.accent,
                      fontSize: '18px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {isSelected ? '✓' : '○'}
                  </div>

                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: isSelected ? theme.bg : theme.text,
                      textAlign: 'left',
                    }}
                  >
                    {formatVoteDate(date)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: '0' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '12px',
              letterSpacing: '1px',
              color: theme.text,
              opacity: 0.6,
            }}
          >
            Optional note for the host
          </div>

          <textarea
            className="pallinky-rsvp-textarea"
            placeholder="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              ...baseFieldStyle,
              borderRadius: '20px',
              padding: '18px',
              height: '100px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            marginBottom: '-8px',
            letterSpacing: '1px',
            color: theme.text,
            opacity: 0.6,
          }}
        >
          Your details
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '0',
          }}
        >
          <input
            className="pallinky-rsvp-field"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              ...baseFieldStyle,
              padding: '16px',
              borderRadius: '14px',
            }}
          />
          <input
            className="pallinky-rsvp-field"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              ...baseFieldStyle,
              padding: '16px',
              borderRadius: '14px',
            }}
          />
          <input
            className="pallinky-rsvp-field"
            placeholder="Phone number (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              ...baseFieldStyle,
              padding: '16px',
              borderRadius: '14px',
            }}
          />
        </div>

        {error ? (
          <p style={{ color: '#c1121f', fontSize: '14px', fontWeight: 600, margin: 0 }}>{error}</p>
        ) : null}

        <button
          type="button"
          onClick={() => handleSubmit('interested')}
          disabled={loading}
          style={{
            ...stickyButtonStyle,
            padding: '22px',
            borderRadius: '18px',
            border: 'none',
            backgroundColor: theme.accent,
            color: theme.bg,
            fontSize: '19px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Saving...' : existingGuest ? 'Update vote' : 'Submit vote'}
        </button>
      </div>
    );
  }

  return (
    <div style={formShellStyle}>
      <style>{`
        .pallinky-rsvp-field::placeholder,
        .pallinky-rsvp-textarea::placeholder {
          color: ${placeholderColor};
          opacity: 1;
        }
      `}</style>

      <div style={{ marginBottom: '0' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            marginBottom: '12px',
            letterSpacing: '1px',
            color: theme.text,
            opacity: 0.6,
          }}
        >
          Optional note for the host
        </div>

        <textarea
          className="pallinky-rsvp-textarea"
          placeholder="Add a note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            ...baseFieldStyle,
            borderRadius: '20px',
            padding: '18px',
            height: '100px',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>

      <div
        style={{
          fontSize: '11px',
          fontWeight: 800,
          textTransform: 'uppercase',
          marginBottom: '-8px',
          letterSpacing: '1px',
          color: theme.text,
          opacity: 0.6,
        }}
      >
        Your details
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <input
          className="pallinky-rsvp-field"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            ...baseFieldStyle,
            padding: '16px',
            borderRadius: '14px',
          }}
        />
        <input
          className="pallinky-rsvp-field"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            ...baseFieldStyle,
            padding: '16px',
            borderRadius: '14px',
          }}
        />
        <input
          className="pallinky-rsvp-field"
          placeholder="Phone number (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{
            ...baseFieldStyle,
            padding: '16px',
            borderRadius: '14px',
          }}
        />
      </div>

      {error ? (
        <p style={{ color: '#c1121f', fontSize: '14px', fontWeight: 600, margin: 0 }}>{error}</p>
      ) : null}

      <button
        type="button"
        onClick={() => handleSubmit('interested')}
        disabled={loading}
        style={{
          ...stickyButtonStyle,
          padding: '22px',
          borderRadius: '18px',
          border: 'none',
          backgroundColor: theme.accent,
          color: theme.bg,
          fontSize: '19px',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        {loading ? 'Saving...' : existingGuest ? 'Update response' : 'Submit'}
      </button>
    </div>
  );
}
