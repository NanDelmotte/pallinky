/**
 * Path: apps/mobile/app/event/[slug]/reach-out.tsx
 * Description: Shared reach-out surface.
 * - Guests suggest time/place or decline.
 * - Hosts review suggestions, propose back, finalize, or message guests.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, useSession } from '@pallinky/core';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import DateOptionPicker from '../../../components/DateOptionPicker';
import LocationSearch from '../../../components/LocationSearch';

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  danger: '#C62828',
  dangerBg: '#fdecec',
};

type ReachOutResponseType = 'suggest_time' | 'suggest_place' | 'declined';

type ReachOutResponse = {
  id: string;
  event_id: string;
  responder_email_lc: string;
  response_type: ReachOutResponseType;
  response_text: string | null;
  suggested_dates: string[] | null;
  suggested_location: string | null;
  created_at: string;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function getFirstName(value: string | null | undefined) {
  return (value || '').trim().split(' ')[0] || 'Guest';
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '';

  return new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function buildSuggestionText(dates: Date[], location: string) {
  const cleanLocation = location.trim();

  const dateLines = dates.map((date) =>
    date.toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  );

  return [
    dateLines.length ? `Times:\n${dateLines.join('\n')}` : null,
    cleanLocation ? `Place:\n${cleanLocation}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export default function ReachOutPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useSession();

  const viewerEmail = normalizeEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [savingSuggestion, setSavingSuggestion] = useState(false);
  const [savingDecline, setSavingDecline] = useState(false);
  const [savingHostProposal, setSavingHostProposal] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [openingDmForEmail, setOpeningDmForEmail] = useState<string | null>(null);

  const [event, setEvent] = useState<any>(null);
  const [responses, setResponses] = useState<ReachOutResponse[]>([]);
  const [profileNamesByEmail, setProfileNamesByEmail] = useState<Record<string, string>>({});
  const [profileAvatarsByEmail, setProfileAvatarsByEmail] = useState<Record<string, string>>({});
  const [hostAvatarUrl, setHostAvatarUrl] = useState<string | null>(null);

  const [suggestedDates, setSuggestedDates] = useState<Date[]>([]);
  const [suggestedLocation, setSuggestedLocation] = useState('');

  const [hostDates, setHostDates] = useState<Date[]>([]);
  const [hostLocation, setHostLocation] = useState('');

  const isHost = useMemo(() => {
    return !!event && viewerEmail !== '' && normalizeEmail(event.host_email) === viewerEmail;
  }, [event, viewerEmail]);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

      if (eventError) throw eventError;

      setEvent(eventData);

      if (eventData?.location) {
        setHostLocation(eventData.location);
      }

      const { data: responseData, error: responseError } = await supabase
        .from('reach_out_responses')
        .select(
  'id, event_id, responder_email_lc, response_type, response_text, suggested_dates, suggested_location, created_at'
)
        .eq('event_id', eventData.id)
        .order('created_at', { ascending: false });

      if (responseError) throw responseError;

      setResponses((responseData || []) as ReachOutResponse[]);

      const emails = Array.from(
        new Set(
          [
            normalizeEmail(eventData.host_email),
            ...(responseData || []).map((row: any) => normalizeEmail(row.responder_email_lc)),
          ].filter(Boolean)
        )
      );

      if (emails.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('email_lc, full_name, avatar_url')
          .in('email_lc', emails);

        if (profileError) {
          console.log('Reach-out profile load error:', profileError);
        }

        const nameMap: Record<string, string> = {};
        const avatarMap: Record<string, string> = {};

        (profiles || []).forEach((profile: any) => {
          const email = normalizeEmail(profile.email_lc);
          if (!email) return;
          if (profile.full_name) nameMap[email] = profile.full_name;
          if (profile.avatar_url) avatarMap[email] = profile.avatar_url;
        });

        setProfileNamesByEmail(nameMap);
        setProfileAvatarsByEmail(avatarMap);
        setHostAvatarUrl(avatarMap[normalizeEmail(eventData.host_email)] || null);
      }
    } catch (err) {
      console.log('Reach-out load error:', err);
      Alert.alert('Unable to load plan');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const insertResponse = async ({
  responseType,
  responseText,
  suggestedDatesValue,
  suggestedLocationValue,
}: {
  responseType: ReachOutResponseType;
  responseText?: string | null;
  suggestedDatesValue?: string[] | null;
  suggestedLocationValue?: string | null;
}) => {
  if (!event?.id || !viewerEmail) {
    Alert.alert('Sign in required', 'Please sign in to respond.');
    return;
  }
  const { error } = await supabase.from('reach_out_responses').insert({
    event_id: event.id,
    responder_email_lc: viewerEmail,
    response_type: responseType,
    response_text: responseText || null,
    suggested_dates: suggestedDatesValue || null,
    suggested_location: suggestedLocationValue || null,
  });

  if (error) throw error;

  if (!isHost && responseType !== 'declined') {
    const { error: notificationError } = await supabase.from('notifications_outbox').insert({
      event_id: event.id,
      recipient_email: event.host_email,
      template: 'reach_out_suggestion',
type: 'reach_out_suggestion',
      status: 'pending',
      payload: {
        event_title: event.title,
        host_name: event.host_name,
        guest_name: profileNamesByEmail[viewerEmail] || viewerEmail || 'Someone',
guest_email: viewerEmail,
message: `${profileNamesByEmail[viewerEmail] || viewerEmail || 'Someone'} suggested:\n\n${responseText || ''}`,
        slug: event.slug,
      },
    });

    if (notificationError) throw notificationError;
  }
};

  const notifyGuests = async ({
    type,
    template,
    payload,
  }: {
    type: string;
    template: string;
    payload: any;
  }) => {
    if (!event?.id) return;

    const { data: invites, error } = await supabase
      .from('event_invites')
      .select('invitee_email_lc')
      .eq('event_id', event.id);

    if (error) throw error;

    const recipients = Array.from(
      new Set(
        (invites || [])
          .map((invite: any) => normalizeEmail(invite.invitee_email_lc))
          .filter((email: string) => !!email && email !== viewerEmail)
      )
    );

    if (!recipients.length) return;

    const rows = recipients.map((recipientEmail) => ({
      event_id: event.id,
      recipient_email: recipientEmail,
      template,
      type,
      status: 'pending',
      payload,
    }));

    const { error: insertError } = await supabase.from('notifications_outbox').insert(rows);
    if (insertError) throw insertError;
  };

  const saveGuestSuggestion = async () => {
    const responseText = buildSuggestionText(suggestedDates, suggestedLocation);

    if (!responseText) {
      Alert.alert('Add a time or place first');
      return;
    }

    try {
      setSavingSuggestion(true);

      await insertResponse({
  responseType: suggestedDates.length ? 'suggest_time' : 'suggest_place',
  responseText,
  suggestedDatesValue: suggestedDates.map((date) => date.toISOString()),
  suggestedLocationValue: suggestedLocation.trim() || null,
});

      setSuggestedDates([]);
      setSuggestedLocation('');
      await loadData();

      Alert.alert('Sent', 'Your suggestion was shared.');
    } catch (err: any) {
      console.log('Reach-out suggestion save error:', err);
      Alert.alert('Could not send suggestion', err?.message || 'Please try again.');
    } finally {
      setSavingSuggestion(false);
    }
  };

  const saveDecline = async () => {
    try {
      setSavingDecline(true);

      await insertResponse({
        responseType: 'declined',
        responseText: 'Not this time',
      });

      await loadData();
      Alert.alert('Noted', 'The host will see that you are not available this time.');
    } catch (err: any) {
      console.log('Reach-out decline save error:', err);
      Alert.alert('Could not send response', err?.message || 'Please try again.');
    } finally {
      setSavingDecline(false);
    }
  };

  const sendHostProposal = async () => {
    const responseText = buildSuggestionText(hostDates, hostLocation);

    if (!responseText) {
      Alert.alert('Add a time or place first');
      return;
    }

    try {
      setSavingHostProposal(true);

      await insertResponse({
  responseType: hostDates.length ? 'suggest_time' : 'suggest_place',
  responseText,
  suggestedDatesValue: hostDates.map((date) => date.toISOString()),
  suggestedLocationValue: hostLocation.trim() || null,
});

      await notifyGuests({
        type: 'reach_out_suggestion',
template: 'reach_out_suggestion',
        payload: {
          event_title: event.title,
          host_name: event.host_name,
          message: `New suggestion for ${event.title}\n\n${responseText}`,
          slug: event.slug,
        },
      });

      setHostDates([]);
      setHostLocation('');
      await loadData();

      Alert.alert('Sent', 'Your suggestion was sent to guests.');
    } catch (err: any) {
      console.log('Reach-out host proposal error:', err);
      Alert.alert('Could not send proposal', err?.message || 'Please try again.');
    } finally {
      setSavingHostProposal(false);
    }
  };

  const finalizePlan = async () => {
    if (!event?.id) return;

    const startsAt = hostDates[0] || null;
    const location = hostLocation.trim();

    if (!startsAt) {
      Alert.alert('Choose a date first');
      return;
    }

    try {
      setFinalizing(true);

      const { error } = await supabase
        .from('events')
        .update({
          event_type: 'formal',
          starts_at: startsAt.toISOString(),
          location: location || null,
        })
        .eq('id', event.id);

      if (error) throw error;

      await notifyGuests({
        type: 'event_updated',
        template: 'event_updated',
        payload: {
          event_title: event.title,
          host_name: event.host_name,
          starts_at: startsAt.toISOString(),
          location: location || null,
          slug: event.slug,
          final_date_chosen: true,
        },
      });

      Alert.alert('Plan finalized', 'Guests have been notified.');
      router.replace(`/event/${slug}/details` as any);
    } catch (err: any) {
      console.log('Reach-out finalize error:', err);
      Alert.alert('Could not finalize plan', err?.message || 'Please try again.');
    } finally {
      setFinalizing(false);
    }
  };

  const handleOpenDm = async (targetEmail: string | null | undefined) => {
    if (!event?.id || !viewerEmail) return;

    const target = normalizeEmail(targetEmail);
    if (!target || target === viewerEmail) return;

    try {
      setOpeningDmForEmail(target);

      const { data, error } = await supabase.rpc('get_or_create_event_dm_thread', {
        p_event_id: event.id,
        p_user_email: viewerEmail,
        p_other_email: target,
      });

      if (error) throw error;

      router.push({
        pathname: '/event/[slug]/dm/[thread_id]',
        params: {
          slug,
          thread_id: String(data),
        },
      } as any);
    } catch (err: any) {
      console.log('Reach-out DM error:', err);
      Alert.alert('Unable to open message', err?.message || 'Please try again.');
    } finally {
      setOpeningDmForEmail(null);
    }
  };

  if (loading || !event) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const hostFirst = getFirstName(event.host_name);
  const hostEmail = normalizeEmail(event.host_email);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        <Text style={styles.kicker}>
          {isHost ? 'Reach-out management' : `${hostFirst} wants to make a plan`}
        </Text>
        <Text style={styles.title}>{event.title}</Text>

        <TouchableOpacity
          style={styles.organizerRow}
          onPress={() => handleOpenDm(hostEmail)}
          disabled={isHost || openingDmForEmail === hostEmail}
          activeOpacity={0.82}
        >
          <View style={styles.organizerAvatarWrap}>
            {hostAvatarUrl ? (
              <Image source={{ uri: hostAvatarUrl }} style={styles.organizerAvatarImage} />
            ) : (
              <View style={styles.organizerAvatarFallback}>
                <Text style={styles.organizerAvatarFallbackText}>
                  {hostFirst.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            {!isHost ? (
              <View style={styles.organizerMessageBadge}>
                <MaterialCommunityIcons name="message-text-outline" size={10} color="#fff" />
              </View>
            ) : null}
          </View>

          <Text style={styles.organizerText}>
            <Text style={styles.organizerMuted}>Organized by </Text>
            <Text style={styles.organizerName}>{event.host_name}</Text>
          </Text>
        </TouchableOpacity>

        {!!event.description && <Text style={styles.description}>{event.description}</Text>}

        {isHost ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitleSmall}>Suggestions</Text>

              {responses.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No suggestions yet.</Text>
                </View>
              ) : (
                responses.map((response) => {
                  const responderEmail = normalizeEmail(response.responder_email_lc);
                  const responderName =
                    profileNamesByEmail[responderEmail] ||
                    responderEmail ||
                    'Guest';

                  return (
                    <View key={response.id} style={styles.suggestionCard}>
                      <View style={styles.suggestionHeader}>
                        <View style={styles.suggestionTextWrap}>
                          <Text style={styles.suggestionName}>{getFirstName(responderName)}</Text>
                          <Text style={styles.suggestionMeta}>
                            {response.response_type === 'declined'
                              ? 'Not this time'
                              : 'Suggested a plan'}{' '}
                            • {formatDateTime(response.created_at)}
                          </Text>
                        </View>

                        {responderEmail !== viewerEmail ? (
                          <TouchableOpacity
                            style={styles.messageButton}
                            onPress={() => handleOpenDm(responderEmail)}
                            disabled={openingDmForEmail === responderEmail}
                          >
                            <MaterialCommunityIcons
                              name="message-text-outline"
                              size={16}
                              color={COLORS.text}
                            />
                          </TouchableOpacity>
                        ) : null}
                      </View>

                     {response.response_type !== 'declined' ? (
  <View style={styles.suggestionContent}>
    {(response.suggested_dates || []).length > 0 ? (
  (response.suggested_dates || []).map((date) => (
    <View key={date} style={styles.suggestionChip}>
      <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
      <Text style={styles.suggestionChipText}>{formatDateTime(date)}</Text>
    </View>
  ))
) : response.response_text?.includes('Times:') ? (
  <View style={styles.suggestionChip}>
    <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
    <Text style={styles.suggestionChipText}>
      {response.response_text
        .split('Place:')[0]
        .replace('Times:', '')
        .trim()}
    </Text>
  </View>
) : null}

    {!!response.suggested_location && (
      <View style={styles.suggestionChip}>
        <Ionicons name="location-outline" size={14} color={COLORS.primary} />
        <Text style={styles.suggestionChipText}>
          {response.suggested_location}
        </Text>
      </View>
    )}
  </View>
) : (
  <Text style={styles.responseText}>Not available</Text>
)}

{response.response_type !== 'declined' ? (
  <TouchableOpacity
    style={styles.useSuggestionButton}
    onPress={() => {
      setHostDates((response.suggested_dates || []).map((value) => new Date(value)));
      setHostLocation(response.suggested_location || '');
    }}
  >
    <Text style={styles.useSuggestionButtonText}>Use suggestion</Text>
  </TouchableOpacity>
) : null}
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              
              <DateOptionPicker
                value={hostDates}
                onChange={setHostDates}
                accentColor={COLORS.primary}
              />
            </View>

            <View style={[styles.card, styles.locationCard]}>
                           <LocationSearch value={hostLocation} onChange={setHostLocation} />

              {!!hostLocation && (
                <Text style={styles.selectedLocation}>Selected: {hostLocation}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, savingHostProposal && styles.disabledButton]}
              onPress={sendHostProposal}
              disabled={savingHostProposal}
            >
              <Text style={styles.primaryButtonText}>
                {savingHostProposal ? 'Sending…' : 'Send proposal'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, finalizing && styles.disabledButton]}
              onPress={finalizePlan}
              disabled={finalizing}
            >
              <Text style={styles.secondaryButtonText}>
                {finalizing ? 'Finalizing…' : 'Finalize plan'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
          
            <View style={styles.card}>
              <DateOptionPicker
                value={suggestedDates}
                onChange={setSuggestedDates}
                accentColor={COLORS.primary}
              />
            </View>
{responses
  .filter((response) => normalizeEmail(response.responder_email_lc) === viewerEmail)
  .map((response) => {
    const fallbackPlace =
      response.response_text?.includes('Place:')
        ? (response.response_text.split('Place:')[1] || '').trim()
        : '';

    const placeToShow = response.suggested_location || fallbackPlace;

    return (
      <View key={response.id} style={styles.yourSuggestionCard}>
        <Text style={styles.yourSuggestionTitle}>
          {response.response_type === 'declined' ? 'You said not this time' : 'Your suggestion'}
        </Text>

        {response.response_type !== 'declined' ? (
          <View style={styles.suggestionContent}>
            {(response.suggested_dates || []).map((date) => (
              <View key={date} style={styles.suggestionChip}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                <Text style={styles.suggestionChipText}>{formatDateTime(date)}</Text>
              </View>
            ))}

            {!!placeToShow && (
              <View style={styles.suggestionChip}>
                <Ionicons name="location-outline" size={14} color={COLORS.primary} />
                <Text style={styles.suggestionChipText}>{placeToShow}</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    );
  })}
            <View style={[styles.card, styles.locationCard]}>
              
              <LocationSearch value={suggestedLocation} onChange={setSuggestedLocation} />

              {!!suggestedLocation && (
                <Text style={styles.selectedLocation}>Selected: {suggestedLocation}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, savingSuggestion && styles.disabledButton]}
              onPress={saveGuestSuggestion}
              disabled={savingSuggestion}
            >
              <Text style={styles.primaryButtonText}>
                {savingSuggestion ? 'Sending…' : 'Send suggestion'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ghostButton, savingDecline && styles.disabledButton]}
              onPress={saveDecline}
              disabled={savingDecline}
            >
              <Text style={styles.ghostButtonText}>Not this time</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 24,
    paddingBottom: 80,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  kicker: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 8,
  },
useSuggestionButton: {
  marginTop: 12,
  minHeight: 42,
  borderRadius: 12,
  backgroundColor: COLORS.primary,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 14,
},

useSuggestionButtonText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '900',
},
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 10,
  },

  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  organizerAvatarWrap: {
    width: 42,
    height: 42,
    marginRight: 12,
    position: 'relative',
  },
suggestionContent: {
  marginTop: 10,
  gap: 8,
},

suggestionChip: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  backgroundColor: '#F2F4F1',
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 8,
},

suggestionChipText: {
  fontSize: 14,
  fontWeight: '800',
  color: COLORS.text,
},
  organizerAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },

  organizerAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f1efe8',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  organizerAvatarFallbackText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },

  organizerMessageBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },

  organizerText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    color: COLORS.text,
  },

  organizerMuted: {
    opacity: 0.65,
    fontWeight: '500',
  },

  organizerName: {
    fontWeight: '800',
  },

  description: {
    fontSize: 16,
    lineHeight: 23,
    color: COLORS.textMuted,
    marginBottom: 22,
  },

  section: {
    marginBottom: 24,
  },

  sectionTitleSmall: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 12,
  },

  card: {
  backgroundColor: COLORS.surface,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: COLORS.borderSoft,
  padding: 18, // ⬅️ increase from 16
  marginBottom: 16,
},

  locationCard: {
    zIndex: 3000,
  },

  sectionTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 20,
  },

  selectedLocation: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
    fontWeight: '700',
  },

  suggestionCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  suggestionTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  suggestionName: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },

  suggestionMeta: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '700',
  },

  responseText: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.text,
    backgroundColor: '#F8F9F7',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 12,
    padding: 12,
  },

  emptyCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 18,
    padding: 18,
  },

  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },

  messageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },

  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },

  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },

  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '900',
  },

  ghostButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ghostButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '800',
  },

  disabledButton: {
    opacity: 0.65,
  },
  yourSuggestionCard: {
  backgroundColor: '#F2F4F1',
  borderWidth: 1,
  borderColor: COLORS.borderSoft,
  borderRadius: 18,
  padding: 16,
  marginBottom: 16,
},

yourSuggestionTitle: {
  fontSize: 16,
  fontWeight: '900',
  color: COLORS.text,
  marginBottom: 10,
},


});