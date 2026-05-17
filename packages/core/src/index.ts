/**
 * Path: packages/core/src/index.ts
 * Description: Shared core exports for Pallinky mobile/web packages.
 * Note: Current auth/session implementation is mobile-oriented because it uses Expo SecureStore.
 */

export * from './supabase';
export * from './session';

export * from './auth/useHostGate';

export * from './events/createVibeDraft';
export * from './events/getEventHostBySlug';

export * from './invite/buildInviteMessage';
export * from './dateTime';
