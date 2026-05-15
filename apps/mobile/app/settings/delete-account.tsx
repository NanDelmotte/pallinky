/**
 * Path: app/settings/delete-account.tsx
 * Description: Destructive confirmation screen for account deletion.
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { StyledText } from '@pallinky/ui';
import { supabase } from '@pallinky/core';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://pallinky.com';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
    const token = session?.access_token;

      if (!token) {
        Alert.alert('Error', 'Not authenticated');
        setLoading(false);
        return;
      }
console.log('APP_URL', process.env.EXPO_PUBLIC_APP_URL);
console.log('MOBILE_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
      const res = await fetch(`${APP_URL}/api/account/delete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const rawText = await res.text();

      let json: any = null;
     try {
  json = rawText ? JSON.parse(rawText) : null;
} catch (err: any) {
  console.log('DELETE_ACCOUNT_PARSE_ERROR', err);
  console.log('DELETE_ACCOUNT_RAW_RESPONSE', rawText);

  throw new Error(`Non-JSON response: ${rawText || 'empty response'}`);
}
      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.details || json?.error || 'Delete failed'
        );
      }

      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });

// If the server already deleted the auth user, the session can be stale.
// We still want to continue to the signed-out screen.
if (signOutError) {
  console.log('Local sign-out warning:', signOutError.message);
}

router.replace('/auth/verify');
    } catch (err: any) {
      console.log('DELETE_ACCOUNT_ERROR', err);
  console.log('DELETE_ACCOUNT_ERROR_MESSAGE', err?.message);
      Alert.alert('Error', err?.message || 'Something went wrong');
      setLoading(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This will permanently delete your profile, hosted events, RSVPs, votes, and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDelete,
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
        <Ionicons name="arrow-back" size={28} color="#43691b" />
      </TouchableOpacity>

      <StyledText style={styles.title}>Delete Account</StyledText>

      <StyledText style={styles.body}>
        This will permanently delete:
      </StyledText>

      <View style={styles.list}>
        <StyledText style={styles.item}>• Your profile</StyledText>
        <StyledText style={styles.item}>• Your hosted events</StyledText>
        <StyledText style={styles.item}>• Your RSVPs and votes</StyledText>
        <StyledText style={styles.item}>• Your messages</StyledText>
      </View>

      <StyledText style={styles.warning}>
        This action cannot be undone.
      </StyledText>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={confirmDelete}
        disabled={loading}
      >
        <StyledText style={styles.deleteText}>
          {loading ? 'Deleting...' : 'Delete Account'}
        </StyledText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
    padding: 30,
    paddingTop: 60,
  },
  backArrow: {
    marginBottom: 10,
    width: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1f2a1b',
    marginBottom: 20,
  },
  body: {
    fontSize: 16,
    color: '#1f2a1b',
    marginBottom: 10,
  },
  list: {
    marginBottom: 20,
  },
  item: {
    fontSize: 15,
    color: '#66715f',
    marginBottom: 6,
  },
  warning: {
    fontSize: 14,
    color: '#e63946',
    marginBottom: 30,
  },
  deleteBtn: {
    backgroundColor: '#e63946',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});