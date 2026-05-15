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
import * as SecureStore from 'expo-secure-store';

const AUTH_RETURN_KEY = 'pallinky_auth_return_to';

export default function AuthCallback() {
  useEffect(() => {
    let active = true;

    const recover = async () => {
      try {
        const storedReturnTo = await SecureStore.getItemAsync(AUTH_RETURN_KEY);
        const destination = storedReturnTo?.trim() || '/(tabs)';

        await SecureStore.deleteItemAsync(AUTH_RETURN_KEY);

        if (!active) return;

        setTimeout(() => {
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