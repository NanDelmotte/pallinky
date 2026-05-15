/**
 * Path: apps/mobile/app/(tabs)/create.tsx
 * Description: Opens the create launchpad when the Launch tab is focused.
 */

import { useFocusEffect, router } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

export default function InviteRedirect() {
  useFocusEffect(
    useCallback(() => {
      router.push('/create');
    }, [])
  );

  return <View style={{ flex: 1 }} />;
}