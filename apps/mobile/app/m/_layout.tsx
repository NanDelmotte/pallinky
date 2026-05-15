/**
 * Path: apps/mobile/app/m/_layout.tsx
 */

import React from 'react';
import { Stack } from 'expo-router';

export default function ManageLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[token]/index" />
      <Stack.Screen name="[token]/vibe-details" />
      <Stack.Screen name="[token]/studio/index" />
    </Stack>
  );
}