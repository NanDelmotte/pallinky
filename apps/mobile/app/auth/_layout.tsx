/**
 * Path: apps/mobile/app/auth/_layout.tsx
 * Version: v18.34 (Internal Card Fix)
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack 
  screenOptions={{ 
    headerShown: false,
    animation: 'slide_from_right',
    presentation: 'card'
  }}
>
  <Stack.Screen 
    name="index" 
    options={{ 
      title: 'Identify Yourself',
      gestureEnabled: false 
    }} 
  />
  <Stack.Screen 
    name="verify" 
    options={{ 
      title: 'Enter Code'
    }} 
  />
</Stack>
  );
}