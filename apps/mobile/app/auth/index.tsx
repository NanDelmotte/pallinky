/**
 * Path: apps/mobile/app/auth/index.tsx
 * Description: Entry point for the Auth group. 
 * Redirects to the unified Verify/Identify screen.
 */
import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function AuthIndex() {
  const params = useLocalSearchParams();

  // Redirects the user immediately to the unified identification screen
  // while preserving any 'next' or 'email' parameters passed from the create flow.
  return (
    <Redirect 
      href={{
        pathname: "/auth/verify",
        params: params
      }} 
    />
  );
}