/**
 * Path: apps/mobile/components/IdentityModal.tsx
 * Description: Inline identity modal used by locked host actions on the success screen.
 * Reuses the working Supabase Google/Apple OAuth flow and Email OTP verification
 * without navigating to route-based auth screens. Stores the current return path so
 * Android callback recovery can return the user to the correct screen.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@pallinky/core';
import { StyledInput, StyledText } from '@pallinky/ui';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
  returnTo?: string;
};

const AUTH_RETURN_KEY = 'pallinky_auth_return_to';

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
};

export default function IdentityModal({
  visible,
  onClose,
  initialEmail = '',
  returnTo = '/(tabs)',
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const cleanEmail = useMemo(() => email.toLowerCase().trim(), [email]);

  const storeReturnPath = async () => {
    await SecureStore.setItemAsync(AUTH_RETURN_KEY, returnTo);
  };

  const clearReturnPath = async () => {
    await SecureStore.deleteItemAsync(AUTH_RETURN_KEY);
  };

  const handleRequestCode = async () => {
  if (!cleanEmail) {
  Alert.alert('Email Required', 'Please enter your email.');
  return;
}

// ✅ PLAY STORE BYPASS
if (cleanEmail === 'test@pallinky.com') {
  await clearReturnPath();
  onClose();
  return;
}

setLoading(true);
try {
  await storeReturnPath();

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      emailRedirectTo: 'pallinky://auth-callback',
      shouldCreateUser: true,
    },
  });

  if (error) throw error;

  Alert.alert('Sent', 'Check your email for the 6-digit code.');
} catch (error: any) {
  Alert.alert('Error', error.message ?? 'Could not send the code.');
} finally {
  setLoading(false);
}
  };

  const handleEmailVerify = async () => {
    if (!cleanEmail || !token.trim()) {
      Alert.alert('Missing Info', 'Enter your email and the 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const otpToken = token.trim();

      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: otpToken,
        type: 'signup',
      });

      if (error) {
        const { error: retryError } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: otpToken,
          type: 'magiclink',
        });

        if (retryError) throw retryError;
      }

      await clearReturnPath();
      onClose();
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message ?? 'Could not verify the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'apple' | 'google') => {
    setLoading(true);

    const redirectUrl = Linking.createURL('auth-callback');

    try {
      await storeReturnPath();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          const hash = result.url.split('#')[1] ?? '';
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
            await clearReturnPath();
            onClose();
            return;
          }
        }
      }

      Alert.alert('Login Incomplete', 'The sign-in flow did not return a session.');
    } catch (error: any) {
      Alert.alert('Login Error', error.message ?? 'Could not complete sign-in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={28} color={COLORS.primary} />
            </TouchableOpacity>

            <View style={styles.iconWrap}>
              <Ionicons name="shield-checkmark-outline" size={28} color={COLORS.secondary} />
            </View>

            <StyledText style={styles.title}>Claim your plan</StyledText>
            <StyledText style={styles.subtitle}>
              Verify your identity to unlock sharing and host controls.
            </StyledText>

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => handleOAuthLogin('google')}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={28} color="#4285F4" />
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.socialBtn, styles.appleBtn]}
                  onPress={() => handleOAuthLogin('apple')}
                  disabled={loading}
                >
                  <Ionicons name="logo-apple" size={28} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <StyledInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <TouchableOpacity
              style={styles.requestBtn}
              onPress={handleRequestCode}
              disabled={loading}
            >
              <StyledText style={styles.requestBtnText}>1. Send Me a Code</StyledText>
            </TouchableOpacity>

            <StyledInput
              placeholder="6-digit code"
              value={token}
              onChangeText={setToken}
              keyboardType="number-pad"
              style={styles.input}
            />

            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={handleEmailVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <StyledText style={styles.verifyBtnText}>2. Verify & Continue</StyledText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 28,
  },
  socialBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  appleBtn: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  input: {
    marginBottom: 12,
  },
  requestBtn: {
    backgroundColor: COLORS.secondaryBg,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#d9cdea',
  },
  requestBtnText: {
    color: COLORS.secondary,
    fontWeight: '800',
    fontSize: 16,
  },
  verifyBtn: {
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  verifyBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});