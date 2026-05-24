/**
 * Path: apps/mobile/app/auth-callback.tsx
 * Description: Minimal OAuth recovery route for mobile deep-link returns.
 * Used mainly on Android when the OS surfaces the callback route after OAuth.
 * Reads the last stored return path and sends the user back there instead of
 * participating in the legacy route-based auth flow.
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import {
  AUTH_PENDING_NAME_KEY,
  AUTH_RETURN_KEY,
  completeSupabaseAuthFromUrl,
} from '../lib/authRedirect';

export default function AuthCallback() {
  useEffect(() => {
    let active = true;

    const recover = async () => {
      try {
        const callbackUrl = await Linking.getInitialURL();

        if (callbackUrl) {
          await completeSupabaseAuthFromUrl(callbackUrl);
        }

        const storedReturnTo = await SecureStore.getItemAsync(AUTH_RETURN_KEY);
        const destination = storedReturnTo?.trim() || '/(tabs)';
        const pendingName = await SecureStore.getItemAsync(AUTH_PENDING_NAME_KEY);

        if (!pendingName) {
          await SecureStore.deleteItemAsync(AUTH_RETURN_KEY);
        }

        if (!active) return;

        setTimeout(() => {
          if (pendingName) {
            router.replace({
              pathname: '/auth/verify',
              params: {
                resumeAuth: Date.now().toString(),
                returnTo: encodeURIComponent(destination),
              },
            } as any);
            return;
          }

          router.replace(destination as any);
        }, 300);
      } catch {
        if (!active) return;

        setTimeout(() => {
          router.replace('/(tabs)' as any);
        }, 300);
      }
    };

    void recover();

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0077b6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
