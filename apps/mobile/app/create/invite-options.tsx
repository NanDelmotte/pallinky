/**
 * Path: apps/mobile/app/create/invite-options.tsx
 * Description: Compatibility route for the archived invite setup step.
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

export default function InviteOptionsRouteShim() {
  useEffect(() => {
    router.replace('/create/event-details');
  }, []);

  return (
    <View style={styles.wrapper}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
