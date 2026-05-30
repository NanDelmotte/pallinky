import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase, useSession } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';

type Candidate = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

const COLORS = {
  background: '#F8FAF6',
  surface: '#EFF4EA',
  text: '#1F2A1B',
  muted: '#66715F',
  border: '#D6DED0',
  purple: '#6A4C93',
  purpleSoft: '#EFE9F7',
  purpleText: '#5B3F84',
};

function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function fallbackName(email: string) {
  return email.split('@')[0] || email;
}

function initialsFor(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'CH';
}

export default function NewChatPage() {
  const router = useRouter();
  const { session } = useSession();
  const emailLower = normalizeEmail(session?.user?.email);
  const userId = session?.user?.id || '';

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  const loadCandidates = useCallback(async () => {
    if (!emailLower || !userId) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: relationshipRows, error } = await supabase
        .from('relationships')
        .select(`
          related_person_id,
          people:related_person_id (
            id,
            email_lc
          )
        `)
        .eq('owner_user_id', userId)
        .eq('relationship_type', 'direct');

      if (error) throw error;

      const directEmails = Array.from(
        new Set(
          ((relationshipRows || []) as any[])
            .map((row) => normalizeEmail(row.people?.email_lc))
            .filter((email) => email && email !== emailLower)
        )
      );

      if (directEmails.length === 0) {
        setCandidates([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('email_lc, full_name, avatar_url')
        .in('email_lc', directEmails);

      const profileMap = new Map(
        ((profiles || []) as any[]).map((profile) => [
          normalizeEmail(profile.email_lc),
          {
            name: String(profile.full_name || '').trim(),
            avatarUrl: profile.avatar_url || null,
          },
        ])
      );

      const nextCandidates = directEmails
        .map((email) => {
          const profile = profileMap.get(email);
          return {
            email,
            name: profile?.name || fallbackName(email),
            avatarUrl: profile?.avatarUrl || null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setCandidates(nextCandidates);
    } catch (err) {
      console.error('Failed to load chat candidates', err);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [emailLower, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadCandidates();
    }, [loadCandidates])
  );

  const filteredCandidates = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return candidates;

    return candidates.filter((candidate) => {
      const haystack = `${candidate.name} ${candidate.email}`.toLowerCase();
      return haystack.includes(cleanQuery);
    });
  }, [candidates, query]);

  const toggleSelected = useCallback((email: string) => {
    setSelectedEmails((current) =>
      current.includes(email) ? current.filter((value) => value !== email) : [...current, email]
    );
  }, []);

  const handleCreate = useCallback(async () => {
    if (!emailLower || selectedEmails.length === 0 || creating) return;

    setCreating(true);

    try {
      if (selectedEmails.length === 1) {
        const { data, error } = await supabase.rpc('get_or_create_direct_chat_thread', {
          p_user_email: emailLower,
          p_other_email: selectedEmails[0],
        });

        let nextThreadId = data ? String(data) : '';

        if (error || !nextThreadId) {
          const fallback = await supabase.rpc('create_chat_thread', {
            p_creator_email: emailLower,
            p_title: null,
            p_participant_emails: selectedEmails,
            p_kind: 'direct',
          });

          if (fallback.error || !fallback.data) {
            throw fallback.error || error || new Error('Could not create direct chat');
          }

          nextThreadId = String(fallback.data);
        }

        router.replace({ pathname: '/chat/[threadId]', params: { threadId: nextThreadId } } as any);
        return;
      }

      const fallbackTitle =
        groupTitle.trim() ||
        selectedEmails
          .map((email) => candidates.find((candidate) => candidate.email === email)?.name || fallbackName(email))
          .slice(0, 3)
          .join(', ');

      const { data, error } = await supabase.rpc('create_chat_thread', {
        p_creator_email: emailLower,
        p_title: fallbackTitle,
        p_participant_emails: selectedEmails,
        p_kind: 'group',
      });

      if (error) throw error;

      router.replace({ pathname: '/chat/[threadId]', params: { threadId: String(data) } } as any);
    } catch (err) {
      console.error('Failed to create chat', err);
      Alert.alert('Could not create chat', 'Please try again.');
    } finally {
      setCreating(false);
    }
  }, [candidates, creating, emailLower, groupTitle, router, selectedEmails]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <StyledText style={styles.title}>New chat</StyledText>
          <StyledText style={styles.subtitle}>
            {selectedEmails.length > 0 ? `${selectedEmails.length} selected` : 'Choose people'}
          </StyledText>
        </View>

        <TouchableOpacity
          style={[styles.startButton, selectedEmails.length === 0 && styles.startButtonDisabled]}
          onPress={handleCreate}
          disabled={selectedEmails.length === 0 || creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <StyledText style={styles.startButtonText}>Start</StyledText>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={COLORS.muted}
          style={styles.searchInput}
        />
      </View>

      {selectedEmails.length > 1 ? (
        <View style={styles.groupTitleWrap}>
          <TextInput
            value={groupTitle}
            onChangeText={setGroupTitle}
            placeholder="Group name"
            placeholderTextColor={COLORS.muted}
            style={styles.groupTitleInput}
          />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.purple} />
          </View>
        ) : filteredCandidates.length === 0 ? (
          <View style={styles.centered}>
            <StyledText style={styles.emptyText}>No people available yet</StyledText>
          </View>
        ) : (
          filteredCandidates.map((candidate) => {
            const selected = selectedEmails.includes(candidate.email);

            return (
              <TouchableOpacity
                key={candidate.email}
                style={styles.row}
                activeOpacity={0.8}
                onPress={() => toggleSelected(candidate.email)}
              >
                {candidate.avatarUrl ? (
                  <Image source={{ uri: candidate.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <StyledText style={styles.avatarFallbackText}>
                      {initialsFor(candidate.name)}
                    </StyledText>
                  </View>
                )}

                <View style={styles.rowText}>
                  <StyledText style={styles.rowTitle}>{candidate.name}</StyledText>
                  <StyledText style={styles.rowSubtitle}>{candidate.email}</StyledText>
                </View>

                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  startButton: {
    minWidth: 72,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purple,
  },
  startButtonDisabled: {
    opacity: 0.45,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  searchWrap: {
    marginHorizontal: 16,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    paddingVertical: 10,
  },
  groupTitleWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
  },
  groupTitleInput: {
    minHeight: 44,
    fontSize: 16,
    color: COLORS.text,
  },
  content: {
    paddingTop: 12,
    paddingBottom: 36,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purpleSoft,
  },
  avatarFallbackText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.purpleText,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    color: COLORS.text,
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
    color: COLORS.muted,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#C9C9C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
});
