// Path: app/event/[slug]/components/DetailsGuestsSection.tsx

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Theme = {
  bg: string;
  accent: string;
  text: string;
  isDark: boolean;
};

const SYSTEM = {
  surface: '#FFFFFF',
  text: '#1f2a1b',
  borderSoft: '#e7ede2',
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function normalizeStatus(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function getFirstName(value: string | null | undefined, fallback = 'Guest') {
  return (value || '').trim().split(' ')[0] || fallback;
}

function getInviteName(inv: any) {
  return (
    inv.invitee_name ||
    (inv.invitee_email_lc ? inv.invitee_email_lc.split('@')[0] : null) ||
    inv.invitee_phone_e164 ||
    'Guest'
  );
}

function getSectionKey(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === 'voted') return 'voted';
  if (normalized === 'yes' || normalized === 'going') return 'going';
  if (normalized === 'maybe' || normalized === 'interested') return 'maybe';
  if (normalized === 'no' || normalized === 'not_going' || normalized === 'declined') {
    return 'not_going';
  }

  return 'invited';
}

function buildGuestLookupByName(allRsvps: any[]) {
  const map = new Map<string, any>();

  allRsvps.forEach((rsvp: any) => {
    const key = normalizeEmail(rsvp?.name);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, rsvp);
    }
  });

  return map;
}

function Section({
  title,
  rows,
  theme,
  isHost,
  canDmTarget,
  handleOpenOrCreateDm,
  openingDmForEmail,
  guestFallback,
}: {
  title: string;
  rows: any[];
  theme: Theme;
  isHost: boolean;
  canDmTarget: (email: string | null | undefined) => boolean;
  handleOpenOrCreateDm: (email: string | null | undefined) => void;
  openingDmForEmail: string | null;
  guestFallback: string;
}) {
  if (!rows.length) return null;

  return (
    <View style={styles.sectionBlock}>
      <Text style={[styles.subsectionTitle, { color: theme.text }]}>
        {title} ({rows.length})
      </Text>

      <View style={styles.list}>
        {rows.map((row: any, i: number) => {
          const firstName = getFirstName(row.label, guestFallback);
          const canMessageThisGuest = isHost && !!row.emailLc && canDmTarget(row.emailLc);

          return (
            <TouchableOpacity
  key={row.id || `${row.emailLc || row.label}-${i}`}
  activeOpacity={0.8}
  onPress={() => {
    if (isHost && row.emailLc && canDmTarget(row.emailLc)) {
      handleOpenOrCreateDm(row.emailLc);
    }
  }}
  style={[
    styles.rowCard,
    {
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
      borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
    },
  ]}
>
              <View style={styles.rowLeft}>
                <View style={styles.avatarWrap}>
                  {row.avatarUrl ? (
                    <Image source={{ uri: row.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>
                        {firstName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {firstName}
                </Text>
              </View>

              {canMessageThisGuest ? (
                <TouchableOpacity
                  style={[
                    styles.messageButton,
                    {
                      borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.borderSoft,
                      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : SYSTEM.surface,
                    },
                  ]}
                  onPress={() => handleOpenOrCreateDm(row.emailLc)}
                  disabled={openingDmForEmail === row.emailLc}
                >
                  <MaterialCommunityIcons
        name="message-text-outline"
        size={16}
        color={theme.text}
      />
    </TouchableOpacity>
  ) : null}
</TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function DetailsGuestsSection({
  theme,
  guests,
  allRsvps,
  invites,
  isHost,
  canDmTarget,
  handleOpenOrCreateDm,
  openingDmForEmail,
  profileNamesByEmail,
  profileAvatarsByEmail,
  t,
}: {
  theme: Theme;
  guests: any[];
  allRsvps: any[];
  invites: any[];
  isHost: boolean;
  canDmTarget: (email: string | null | undefined) => boolean;
  handleOpenOrCreateDm: (email: string | null | undefined) => void;
  openingDmForEmail: string | null;
  profileNamesByEmail: Record<string, string>;
  profileAvatarsByEmail: Record<string, string>;
  t: any;
}) {
  const { votedRows, goingRows, interestedRows, notGoingRows, invitedRows, totalVisible } =
    useMemo(() => {
      const rsvpByName = buildGuestLookupByName(allRsvps);
      const guestEmailSet = new Set<string>();
      const guestNameSet = new Set<string>();

      const guestRows = (guests || []).map((guest: any) => {
        const matchingRsvp =
          rsvpByName.get(normalizeEmail(guest.name)) ||
          allRsvps.find(
            (r: any) =>
              normalizeEmail(r.name) === normalizeEmail(guest.name) ||
              String(r.name) === String(guest.name)
          );

        const emailLc = normalizeEmail(matchingRsvp?.email_lc || matchingRsvp?.email || guest.email);
        const label = profileNamesByEmail[emailLc] || guest.name || guest.email || t('event_guest_fallback');
        const avatarUrl = guest.avatar_url || profileAvatarsByEmail[emailLc] || null;

        if (emailLc) guestEmailSet.add(emailLc);
        guestNameSet.add(normalizeEmail(label));
        guestNameSet.add(normalizeEmail(guest.name));

        return {
          id: guest.id,
          label,
          emailLc,
          avatarUrl,
          section: getSectionKey(guest.status),
        };
      });

      const inviteRows = (invites || [])
        .map((inv: any) => {
          const emailLc = normalizeEmail(inv.invitee_email_lc);
          const fallbackName = getInviteName(inv);
          const label = profileNamesByEmail[emailLc] || fallbackName;
          const avatarUrl = profileAvatarsByEmail[emailLc] || null;

          const duplicateByEmail = !!emailLc && guestEmailSet.has(emailLc);
          const duplicateByName = guestNameSet.has(normalizeEmail(label));

          if (duplicateByEmail || duplicateByName) {
            return null;
          }

          return {
            id: inv.id,
            label,
            emailLc,
            avatarUrl,
            section: 'invited',
          };
        })
        .filter(Boolean) as any[];

      const allRows = [...guestRows, ...inviteRows];

      return {
        votedRows: allRows.filter((row) => row.section === 'voted'),
        goingRows: allRows.filter((row) => row.section === 'going'),
        interestedRows: allRows.filter((row) => row.section === 'interested'),
        notGoingRows: allRows.filter((row) => row.section === 'not_going'),
        invitedRows: allRows.filter((row) => row.section === 'invited'),
        totalVisible: allRows.length,
      };
    }, [guests, allRsvps, invites, profileNamesByEmail, profileAvatarsByEmail, t]);

  if (totalVisible === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('event_people')} ({totalVisible})</Text>

      <Section
        title={t('event_voted')}
        rows={votedRows}
        theme={theme}
        isHost={isHost}
        canDmTarget={canDmTarget}
        handleOpenOrCreateDm={handleOpenOrCreateDm}
        openingDmForEmail={openingDmForEmail}
        guestFallback={t('event_guest_fallback')}
      />

      <Section
        title={t('event_status_going')}
        rows={goingRows}
        theme={theme}
        isHost={isHost}
        canDmTarget={canDmTarget}
        handleOpenOrCreateDm={handleOpenOrCreateDm}
        openingDmForEmail={openingDmForEmail}
        guestFallback={t('event_guest_fallback')}
      />

      <Section
        title={t('event_interested')}
        rows={interestedRows}
        theme={theme}
        isHost={isHost}
        canDmTarget={canDmTarget}
        handleOpenOrCreateDm={handleOpenOrCreateDm}
        openingDmForEmail={openingDmForEmail}
        guestFallback={t('event_guest_fallback')}
      />

      <Section
        title={t('event_status_not_going')}
        rows={notGoingRows}
        theme={theme}
        isHost={isHost}
        canDmTarget={canDmTarget}
        handleOpenOrCreateDm={handleOpenOrCreateDm}
        openingDmForEmail={openingDmForEmail}
        guestFallback={t('event_guest_fallback')}
      />

      <Section
        title={t('event_status_invited')}
        rows={invitedRows}
        theme={theme}
        isHost={isHost}
        canDmTarget={canDmTarget}
        handleOpenOrCreateDm={handleOpenOrCreateDm}
        openingDmForEmail={openingDmForEmail}
        guestFallback={t('event_guest_fallback')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },

  sectionBlock: {
    marginBottom: 18,
  },

  subsectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },

  list: {
    gap: 10,
  },

  rowCard: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },

  avatarWrap: {
    width: 42,
    height: 42,
    marginRight: 12,
  },

  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: SYSTEM.surface,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f1efe8',
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarFallbackText: {
    fontSize: 16,
    fontWeight: '900',
    color: SYSTEM.text,
  },

  name: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },

  messageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});