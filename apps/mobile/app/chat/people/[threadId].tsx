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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase, useSession } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';

type MemberRow = {
  user_email_lc: string;
};

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

export default function AddPeopleToChatPage() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const emailLower = normalizeEmail(session?.user?.email);
  const userId = session?.user?.id || '';

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  const loadCandidates = useCallback(async () => {
    if (!emailLower || !userId || !threadId) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [{ data: members, error: membersError }, { data: relationshipRows, error }] =
        await Promise.all([
          supabase.rpc('get_chat_thread_members', {
            p_thread_id: threadId,
            p_user_email: emailLower,
          }),
          supabase
            .from('relationships')
            .select(`
              related_person_id,
              people:related_person_id (
                id,
                email_lc
              )
            `)
            .eq('owner_user_id', userId)
            .eq('relationship_type', 'direct'),
        ]);

      if (membersError) throw membersError;
      if (error) throw error;

      const existingEmails = new Set(
        ((members || []) as MemberRow[]).map((member) => normalizeEmail(member.user_email_lc))
      );

      const directEmails = Array.from(
        new Set(
          ((relationshipRows || []) as any[])
            .map((row) => normalizeEmail(row.people?.email_lc))
            .filter((email) => email && email !== emailLower && !existingEmails.has(email))
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
      console.error('Failed to load add-people candidates', err);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [emailLower, threadId, userId]);

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

  const handleAddPeople = useCallback(async () => {
    if (!threadId || !emailLower || selectedEmails.length === 0 || adding) return;

    setAdding(true);

    try {
      const { data, error } = await supabase.rpc('add_people_to_chat_thread', {
        p_thread_id: threadId,
        p_added_by_email: emailLower,
        p_participant_emails: selectedEmails,
      });

      if (error) throw error;

      const addedCount = Number((data as any)?.[0]?.added_count || 0);
      if (addedCount === 0) {
        Alert.alert('No one new was added', 'Everyone you selected is already in this chat.');
        return;
      }

      router.back();
    } catch (err: any) {
      console.error('Failed to add people to chat', err);
      Alert.alert('Could not add people', err?.message || 'Please try again.');
    } finally {
      setAdding(false);
    }
  }, [adding, emailLower, router, selectedEmails, threadId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <StyledText style={styles.title}>Add people</StyledText>
          <StyledText style={styles.subtitle}>
            {selectedEmails.length > 0 ? `${selectedEmails.length} selected` : 'Anyone in the chat can add people'}
          </StyledText>
        </View>

        <TouchableOpacity
          style={[styles.addButton, selectedEmails.length === 0 && styles.addButtonDisabled]}
          onPress={handleAddPeople}
          disabled={selectedEmails.length === 0 || adding}
        >
          {adding ? <ActivityIndicator color="#fff" /> : <StyledText style={styles.addButtonText}>Add</StyledText>}
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.purple} />
          </View>
        ) : filteredCandidates.length === 0 ? (
          <View style={styles.emptyWrap}>
            <StyledText style={styles.emptyTitle}>No one new to add</StyledText>
            <StyledText style={styles.emptyBody}>
              People from your direct circle who are not already in this chat will show up here.
            </StyledText>
          </View>
        ) : (
          filteredCandidates.map((candidate) => {
            const selected = selectedEmails.includes(candidate.email);
            return (
              <TouchableOpacity
                key={candidate.email}
                style={[styles.row, selected && styles.rowSelected]}
                activeOpacity={0.82}
                onPress={() => toggleSelected(candidate.email)}
              >
                {candidate.avatarUrl ? (
                  <Image source={{ uri: candidate.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarFallback, selected && styles.avatarFallbackSelected]}>
                    <StyledText style={styles.avatarText}>{initialsFor(candidate.name)}</StyledText>
                  </View>
                )}

                <View style={styles.rowText}>
                  <StyledText style={styles.rowTitle}>{candidate.name}</StyledText>
                  <StyledText style={styles.rowSubtitle}>{candidate.email}</StyledText>
                </View>

                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 14,
    color: COLORS.muted,
  },
  addButton: {
    minWidth: 58,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purple,
    paddingHorizontal: 14,
  },
  addButtonDisabled: {
    backgroundColor: '#AADFC0',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  searchWrap: {
    marginHorizontal: 18,
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
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: 10,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  rowSelected: {
    borderColor: COLORS.purple,
    backgroundColor: COLORS.purpleSoft,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.purpleSoft,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
  },
  avatarFallbackSelected: {
    backgroundColor: '#D5F1DF',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.muted,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  checkboxSelected: {
    borderColor: COLORS.purple,
    backgroundColor: COLORS.purple,
  },
  centered: {
    paddingTop: 36,
    alignItems: 'center',
  },
  emptyWrap: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
