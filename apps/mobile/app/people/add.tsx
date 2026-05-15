import { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  Alert,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';

type ProfileRow = {
  id: string;
  email_lc: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

function avatarFallback(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || 'Friend',
  )}&background=43691b&color=fff`;
}

export default function AddPersonScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    void loadProfile();
  }, [profileId]);

  async function loadProfile() {
    if (!profileId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email_lc, full_name, avatar_url')
        .eq('id', profileId)
        .single();

      if (error) throw error;
      setProfile(data as ProfileRow);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load profile.');
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!profile?.email_lc) {
      Alert.alert('Error', 'This profile has no contact email.');
      return;
    }

    setAdding(true);

    try {
      const { data: personId, error: personError } = await supabase.rpc(
        'resolve_or_create_person',
        {
          p_email_lc: profile.email_lc,
          p_phone_e164: null,
          p_matched_user_id: profile.id,
        },
      );

      if (personError) throw personError;

      // For now this creates/resolves the person record.
      // Circle placement can be added separately.
      Alert.alert('Added', `${profile.full_name || 'Contact'} added to your Pallinky contacts.`);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not add contact.');
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#43691b" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <StyledText style={styles.errorText}>Profile not found.</StyledText>
      </View>
    );
  }

  const displayName = profile.full_name || 'this person';
  const avatarUrl = profile.avatar_url || avatarFallback(displayName);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />

        <StyledText style={styles.title}>Add {displayName}?</StyledText>

        <StyledText style={styles.subtitle}>
          This will add {displayName} to your Pallinky contacts.
        </StyledText>

        <TouchableOpacity style={styles.primaryButton} onPress={handleAdd} disabled={adding}>
          {adding ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <StyledText style={styles.primaryButtonText}>Add Contact</StyledText>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace('/(tabs)')}
          disabled={adding}
        >
          <StyledText style={styles.secondaryButtonText}>Cancel</StyledText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
    justifyContent: 'center',
    padding: 24,
  },
  centered: {
    flex: 1,
    backgroundColor: '#F6F7F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9dfd3',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#eee',
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1f2a1b',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
  },
  primaryButton: {
    marginTop: 24,
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#43691b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    marginTop: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#43691b',
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: '#1f2a1b',
    fontSize: 16,
    fontWeight: '700',
  },
});