/**
 * Path: apps/mobile/app/create/_layout.tsx
 */

import { Stack } from 'expo-router';
import { FormalDraftProvider } from '../../lib/formalDraft';

export const unstable_settings = {
  initialRouteName: 'formal',
};

export default function CreateLayout() {
  return (
    <FormalDraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Create',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="vibe"
          options={{
            title: 'Throw a Line',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="formal"
          options={{
            title: 'Seal a Deal',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="event-type"
          options={{
            title: 'When',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="formal-date"
          options={{
            title: 'Specific time',
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'rgba(31, 42, 27, 0.28)' },
          }}
        />
        <Stack.Screen
          name="formal-series"
          options={{
            title: 'Series',
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'rgba(31, 42, 27, 0.28)' },
          }}
        />
        <Stack.Screen
          name="formal-options"
          options={{
            title: 'Options',
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'rgba(31, 42, 27, 0.28)' },
          }}
        />
        <Stack.Screen
          name="invite-options"
          options={{
            title: 'Invite options',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="event-details"
          options={{
            title: 'Finish it off',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="event-success"
          options={{
            gestureEnabled: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="success"
          options={{
            gestureEnabled: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="success-vibe"
          options={{
            gestureEnabled: false,
            presentation: 'card',
          }}
        />
      </Stack>
    </FormalDraftProvider>
  );
}
