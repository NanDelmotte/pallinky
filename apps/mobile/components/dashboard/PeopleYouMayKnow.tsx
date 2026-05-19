/**
 * Path: apps/mobile/components/dashboard/PeopleYouMayKnow.tsx
  * Description: Second-degree connection suggestions driven by feed signals.
 * Circles are used only for organizing added people.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { StyledText } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@pallinky/core';
import { useRouter } from 'expo-router';
import ReconnectFeedCard from '../../../../packages/ui/src/ReconnectFeedCard';

type CircleMember = {
  id: string;
  member_email_lc?: string | null;
  member_name?: string | null;
  person_id?: string | null;
};

type Circle = {
  id: string;
  circle_name?: string | null;
  members?: CircleMember[] | null;
};

type SuggestionPerson = {
  person_id?: string | null;
  email_lc?: string | null;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  subtitle?: string | null;
  rawSignal?: any;
  rawPayload?: any;
};

type ProfileRow = {
  email_lc: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

interface PeopleProps {
  data: {
    events: any[];
    rsvps: any[];
    userEmail: string;
    socialCircles: Circle[];
  };
  theme: any;
  onRefresh?: () => void;
  signals?: any[];
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().trim() : '';
}

function buildReconnectSubtitle(
  payload: any,
  profileMap?: Map<string, ProfileRow>
): string {
  if (payload?.reason === 'friend_of_friend') {
    const bridges = Array.isArray(payload?.bridges) ? payload.bridges : [];

    const firstBridgeEmail = normalizeEmail(bridges[0]?.bridgePersonEmail);
    const firstBridgeProfile = firstBridgeEmail ? profileMap?.get(firstBridgeEmail) : null;
    const firstBridgeName =
      firstBridgeProfile?.full_name ||
      bridges[0]?.bridgeName ||
      'someone';

    if (bridges.length > 1) {
      return `You both know ${firstBridgeName} + ${bridges.length - 1} others`;
    }

    if (bridges.length === 1) {
      return `You both know ${firstBridgeName}`;
    }

    return 'Connected through your network';
  }


  return payload?.subtitle || payload?.signal_reason || 'Connected through your network';
}

function buildReconnectPersonFromSignal(signal: any): SuggestionPerson {
  const payload = signal?.payload || {};
  const email =
    normalizeEmail(signal?.personEmail) ||
    normalizeEmail(payload?.email_lc) ||
    normalizeEmail(payload?.email);

  const fallbackName = 'Someone';

  return {
    person_id: signal?.personId || payload?.person_id || null,
    email_lc: email || null,
    email: email || null,
    name: payload?.name || payload?.full_name || payload?.first_name || fallbackName,
    full_name: payload?.full_name || payload?.name || payload?.first_name || fallbackName,
    avatar_url: payload?.avatar_url || payload?.photo_url || null,
    subtitle: buildReconnectSubtitle(payload),
    rawSignal: signal,
    rawPayload: payload,
  };
}

export default function PeopleYouMayKnow({
  data,
  theme,
  onRefresh,
  signals = [],
}: PeopleProps) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const { rsvps = [], userEmail = '', socialCircles = [] } = data;
  const emailLower = normalizeEmail(userEmail);

  const [removedEmails, setRemovedEmails] = useState<string[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<SuggestionPerson | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileMap, setProfileMap] = useState<Map<string, ProfileRow>>(new Map());

  const existingDirectEmails = useMemo(() => {
    const set = new Set<string>();

    for (const circle of socialCircles) {
      const members = Array.isArray(circle?.members) ? circle.members : [];
      for (const member of members) {
        const email = normalizeEmail(member?.member_email_lc);
        if (email) set.add(email);
      }
    }

    if (emailLower) set.add(emailLower);
    return set;
  }, [socialCircles, emailLower]);

  const uniqueSuggestions = useMemo(() => {
    if (signals.length > 0) {
      return Array.from(
        new Map(
          signals
            .filter((s) => s.type === 'suggested_connection')
            .map((s) => buildReconnectPersonFromSignal(s))
            .filter((person) => {
              const personEmail = normalizeEmail(person.email_lc || person.email);
              return (
                !!personEmail &&
                personEmail !== emailLower &&
                !existingDirectEmails.has(personEmail) &&
                !removedEmails.includes(personEmail)
              );
            })
            .map((item) => [normalizeEmail(item.email_lc || item.email), item] as const)
        ).values()
      );
    }

    return Array.from(
      new Map(
        rsvps
          .filter((r) => {
            const rEmail = normalizeEmail(r.email_lc || r.email);
            return (
              !!rEmail &&
              rEmail !== emailLower &&
              !existingDirectEmails.has(rEmail) &&
              !removedEmails.includes(rEmail)
            );
          })
          .map((item) => [normalizeEmail(item.email_lc || item.email), item] as const)
      ).values()
    ) as SuggestionPerson[];
  }, [signals, rsvps, emailLower, existingDirectEmails, removedEmails]);

  useEffect(() => {
    const emails = Array.from(
      new Set(
        uniqueSuggestions
          .flatMap((p) => {
            const personEmail = normalizeEmail(p.email_lc || p.email);
            const bridgeEmails = Array.isArray(p.rawPayload?.bridges)
              ? p.rawPayload.bridges.map((b: any) => normalizeEmail(b?.bridgePersonEmail))
              : [];

            return [personEmail, ...bridgeEmails];
          })
          .filter(Boolean)
      )
    );

    if (emails.length === 0) {
      setProfileMap(new Map());
      return;
    }

    supabase
      .from('profiles')
      .select('email_lc, full_name, avatar_url')
      .in('email_lc', emails)
      .then(({ data }) => {
        const map = new Map<string, ProfileRow>();

        for (const row of (data || []) as ProfileRow[]) {
          map.set(normalizeEmail(row.email_lc), row);
        }

        setProfileMap(map);
      });
  }, [uniqueSuggestions]);

  const filteredCircles = useMemo(() => {
    return socialCircles.filter((c) =>
      String(c.circle_name || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );
  }, [socialCircles, searchQuery]);

  const horizontalCardWidth = Math.min(Math.max(screenWidth - 92, 300), 420);

  const handleRemoveLocally = (email: string) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    setRemovedEmails((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedPerson(null);
    setNewCircleName('');
    setSearchQuery('');
  };

  const addToExistingCircle = async (circle: Circle) => {
    if (!selectedPerson) return;

    const targetEmail = normalizeEmail(selectedPerson.email_lc || selectedPerson.email);
    if (!targetEmail) return;

    setLoading(true);
    try {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email_lc', targetEmail)
        .maybeSingle();

      if (profileError) throw profileError;

      const { data: resolvedPersonId, error: personError } = await supabase.rpc(
        'resolve_or_create_person',
        {
          p_email_lc: targetEmail,
          p_phone_e164: null,
          p_matched_user_id: profileRow?.id || null,
        }
      );

      if (personError) throw personError;

      const { error } = await supabase.from('social_circle_members').insert({
        circle_id: circle.id,
        member_name:
          selectedPerson.full_name ||
          selectedPerson.name ||
          null,
        member_email_lc: targetEmail,
        member_phone_e164: null,
        member_user_id: profileRow?.id || null,
        person_id: resolvedPersonId || null,
      });

      if (error) throw error;

      handleRemoveLocally(targetEmail);
      closeModal();
      onRefresh?.();
    } catch (error: any) {
      const message =
        error?.code === '23505'
          ? 'That person is already in this circle.'
          : 'Could not update circle.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const createAndAdd = async () => {
    if (!newCircleName.trim() || !selectedPerson || !emailLower) return;

    const targetEmail = normalizeEmail(selectedPerson.email_lc || selectedPerson.email);
    if (!targetEmail) return;

    setLoading(true);
    try {
      const { data: meProfile, error: meProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
        .maybeSingle();

      if (meProfileError) throw meProfileError;
      if (!meProfile?.id) throw new Error('Profile not found.');

      const { data: newCircle, error: circleError } = await supabase
        .from('social_circles')
        .insert({
          circle_name: newCircleName.trim(),
          user_id: meProfile.id,
        })
        .select('id')
        .single();

      if (circleError) throw circleError;
      if (!newCircle?.id) throw new Error('Could not create circle.');

      const { data: targetProfile, error: targetProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email_lc', targetEmail)
        .maybeSingle();

      if (targetProfileError) throw targetProfileError;

      const { data: resolvedPersonId, error: personError } = await supabase.rpc(
        'resolve_or_create_person',
        {
          p_email_lc: targetEmail,
          p_phone_e164: null,
          p_matched_user_id: targetProfile?.id || null,
        }
      );

      if (personError) throw personError;

      const { error: memberError } = await supabase.from('social_circle_members').insert({
        circle_id: newCircle.id,
        member_name:
          selectedPerson.full_name ||
          selectedPerson.name ||
          null,
        member_email_lc: targetEmail,
        member_phone_e164: null,
        member_user_id: targetProfile?.id || null,
        person_id: resolvedPersonId || null,
      });

      if (memberError) throw memberError;

      handleRemoveLocally(targetEmail);
      closeModal();
      onRefresh?.();
    } catch {
      Alert.alert('Error', 'Could not create circle.');
    } finally {
      setLoading(false);
    }
  };

  if (uniqueSuggestions.length === 0) {
    return (
      <View style={styles.container}>
        <Pressable
          onPress={() => router.push('/circles' as any)}
          style={({ pressed }) => [
            styles.emptyCard,
            {
              borderColor: theme.border || '#e5e7eb',
              backgroundColor: theme.cardBg || '#ffffff',
            },
            pressed && { opacity: 0.92 },
          ]}
        >
          <View style={styles.emptyIconWrap}>
            <Ionicons name="people-outline" size={20} color="#1f2a1b" />
          </View>

          <View style={{ flex: 1 }}>
            <StyledText style={styles.emptyTitle}>No second-degree suggestions yet</StyledText>
<StyledText style={styles.emptySubtitle}>
  When you attend events, your network grows, and people will appear here.
</StyledText>
          </View>

          <Ionicons name="chevron-forward" size={18} color="#64748b" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollPadding}
      >
        {uniqueSuggestions.map((person, i) => {
          const email = normalizeEmail(person.email_lc || person.email);
          const profile = profileMap.get(email);

          const enrichedPerson = {
            ...person,
            name:
              profile?.full_name ||
              person.name ||
              person.full_name ||
              'Someone',
            full_name:
              profile?.full_name ||
              person.full_name ||
              person.name ||
              'Someone',
            avatar_url: profile?.avatar_url || person.avatar_url || null,
          };

          const subtitle =
            buildReconnectSubtitle(person.rawPayload, profileMap) ||
            "You haven’t seen each other in a while";

          return (
            <View
              key={`${email || 'suggestion'}-${i}`}
              style={[styles.cardWrapper, { width: horizontalCardWidth }]}
            >
              <ReconnectFeedCard
                person={enrichedPerson}
                subtitle={subtitle}
                onPress={() => {
                  setSelectedPerson(enrichedPerson);
                  setModalVisible(true);
                }}
                onDismiss={() => handleRemoveLocally(email)}
              />
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <StyledText style={styles.modalTitle}>Add to Pallinky</StyledText>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={28} color="#1f2a1b" />
              </TouchableOpacity>
            </View>

            <StyledText style={styles.subTitle}>
              Tag {selectedPerson?.name || selectedPerson?.full_name || 'this person'} to one of your circles.
            </StyledText>

            {socialCircles.length > 0 && (
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={16} color="#999" style={{ marginLeft: 10 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search circles..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            )}

            <ScrollView style={styles.circlesList}>
              {filteredCircles.map((circle) => (
                <TouchableOpacity
                  key={circle.id}
                  style={styles.circleOption}
                  onPress={() => addToExistingCircle(circle)}
                >
                  <StyledText style={styles.circleOptionText}>{circle.circle_name}</StyledText>
                  <Ionicons name="chevron-forward" size={18} color="#43691b" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.newCircleSection}>
              <TextInput
                style={styles.input}
                placeholder="Or create a new circle..."
                value={newCircleName}
                onChangeText={setNewCircleName}
              />
              <TouchableOpacity
                style={[styles.createBtn, (!newCircleName.trim() || loading) && styles.disabledBtn]}
                onPress={createAndAdd}
                disabled={!newCircleName.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <StyledText style={styles.createBtnText}>Create & Add</StyledText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8, marginBottom: 10 },
  scrollPadding: { paddingHorizontal: 16, paddingRight: 24 },
  cardWrapper: { marginRight: 12 },

  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 3,
    lineHeight: 17,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1f2a1b',
  },
  subTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    padding: 10,
    fontSize: 14,
  },
  circlesList: { maxHeight: 200 },
  circleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  circleOptionText: {
    fontSize: 16,
    color: '#1f2a1b',
    fontWeight: '600',
  },
  newCircleSection: { marginTop: 20 },
  input: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 10,
  },
  createBtn: {
    backgroundColor: '#43691b',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
});
