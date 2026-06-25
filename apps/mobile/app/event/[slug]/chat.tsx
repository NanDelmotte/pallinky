/**
 * Path: app/event/[slug]/chat.tsx
 * Description: Resolves an event-linked chat thread, then hands off to the generic chat screen.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { supabase, useSession } from '@pallinky/core';

const COLORS = {
  background: '#EFEAE2',
  text: '#111111',
  muted: '#656565',
  green: '#1F9D55',
};

export default function EventChatResolverPage() {
  const { slug, token } = useLocalSearchParams<{ slug: string; token?: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [message, setMessage] = useState('Opening chat...');

  useEffect(() => {
    let cancelled = false;

    async function resolveThread() {
      const viewerEmail = session?.user?.email?.toLowerCase().trim() || '';
      if (!slug || !viewerEmail) {
        setMessage('Sign in required');
        return;
      }

      try {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('id, slug, event_type, host_email')
          .eq('slug', slug)
          .single();

        if (eventError) throw eventError;
        if (!eventData?.id) throw new Error('Event not found');

        const viewerEmailLc = viewerEmail.toLowerCase().trim();
        const isHost = viewerEmailLc === String(eventData.host_email || '').toLowerCase().trim();

        if (eventData.event_type === 'reach_out' && !isHost) {
          const { data: response, error: rsvpError } = await supabase.rpc('submit_vibe_rsvp', {
            p_slug: slug,
            p_user_email: viewerEmailLc,
            p_guest_name:
              session?.user?.user_metadata?.full_name ||
              viewerEmailLc.split('@')[0] ||
              'Guest',
            p_selected_dates: [],
            p_note: null,
            p_status: 'interested',
            p_guest_token: typeof token === 'string' ? token : null,
          });

          if (rsvpError) throw rsvpError;

          if (response?.join_request_created === true) {
            setMessage('Request sent. The host will approve access before you join the chat.');
            return;
          }

          if (response?.error) {
            throw new Error(response.error);
          }
        }

        const threadResponse = await supabase.rpc('get_or_create_event_primary_chat_thread', {
          p_event_id: eventData.id,
          p_user_email: viewerEmail,
        });

        if (threadResponse.error) throw threadResponse.error;
        const threadId = threadResponse.data;

        if (!threadId) throw new Error('Could not open chat');
        if (cancelled) return;

        router.replace({
          pathname: '/chat/[threadId]',
          params: { threadId: String(threadId), eventSlug: String(slug) },
        } as any);
      } catch (err: any) {
        if (cancelled) return;
        setMessage(err?.message || 'Could not open chat');
      }
    }

    void resolveThread();

    return () => {
      cancelled = true;
    };
  }, [router, session?.user?.email, session?.user?.user_metadata?.full_name, slug, token]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.centered}>
        {message === 'Opening chat...' ? <ActivityIndicator color={COLORS.green} /> : null}
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  message: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.muted,
  },
});
