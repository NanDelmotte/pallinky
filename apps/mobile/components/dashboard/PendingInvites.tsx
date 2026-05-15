/**
 * Path: apps/mobile/components/dashboard/PendingInvites.tsx
 * Description: Pending invite cards driven by feed signals when available.
 * Falls back to raw data only if signals are not passed.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import PlanCard from '../../../../packages/ui/src/PlanCard';

interface PendingInvitesProps {
  data: {
    events: any[];
    rsvps: any[];
    invites: any[];
    chatSummaries?: Record<string, any>;
    userEmail: string;
  };
  theme: {
    label: string;
    text: string;
  };
  onRefresh?: () => void;
  signals?: any[];
}

export default function PendingInvites({
  data,
  theme,
  onRefresh,
  signals = [],
}: PendingInvitesProps) {
  const { events = [], rsvps = [], invites = [], chatSummaries = {}, userEmail = '' } = data;
  const router = useRouter();

  const emailLower = userEmail.toLowerCase().trim();

  const pendingList =
    signals.length > 0
      ? signals.filter((s) => s.type === 'incoming_invite').map((s) => {
          const event = events.find((ev) => ev.id === s.eventId);
          return event || null;
        }).filter(Boolean)
      : events.filter((ev) => {
          const invite = invites.find((i) => i.event_id === ev.id);
          if (!invite) return false;

          const userRsvp = rsvps.find(
            (r) =>
              r.event_id === ev.id &&
              ((r.email_lc || r.email || '').toLowerCase().trim() === emailLower)
          );

          if (!userRsvp) return true;

          const status = (userRsvp.status || '').toLowerCase().trim();

          if (['yes', 'going', 'interested'].includes(status)) return false;

          return status === 'maybe' || status === '' || status === 'pending';
        });

  if (pendingList.length === 0) return null;

  return (
    <View style={styles.section}>
      {pendingList.map((ev: any) => {
        const userRsvp = rsvps.find(
          (r) =>
            r.event_id === ev.id &&
            ((r.email_lc || r.email || '').toLowerCase().trim() === emailLower)
        );

        const currentStatus = (userRsvp?.status || '').toLowerCase().trim();
        const chat = chatSummaries[ev.id] || null;

        return (
          <PlanCard
            key={`pending-${ev.id}`}
            id={ev.id}
            currentUserEmail={emailLower}
            hostEmail={ev.host_email}
            title={ev.title}
            startsAt={ev.starts_at}
            location={ev.location}
            coverImageUrl={ev.cover_image_url}
            gifKey={ev.gif_key}
            fontFamily={ev.font_family}
            hostName={ev.host_name || 'A Friend'}
            actionLabel={currentStatus === 'maybe' ? 'Update' : 'RSVP'}
            unreadMessages={chat?.unread_count || 0}
            lastMessagePreview={chat?.last_message_body || null}
            onPress={() => router.push(`/event/${ev.slug}/details` as any)}
            onRefresh={onRefresh}
            showPeek={true}
            badge={currentStatus === 'maybe' ? 'MAYBE' : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 4 },
});