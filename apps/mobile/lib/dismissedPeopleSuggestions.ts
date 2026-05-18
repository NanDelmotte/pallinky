import * as SecureStore from 'expo-secure-store';

const DISMISSED_PEOPLE_SUGGESTIONS_PREFIX = 'dismissed_people_suggestions';
const LEGACY_DISMISSED_PEOPLE_SUGGESTIONS_KEY = 'dismissed_people_suggestions';

function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function encodeKeySegment(value: string) {
  return Array.from(value)
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
}

function storageKeyForUser(userEmail: string) {
  const normalized = normalizeEmail(userEmail);
  return normalized
    ? `${DISMISSED_PEOPLE_SUGGESTIONS_PREFIX}.${encodeKeySegment(normalized)}`
    : LEGACY_DISMISSED_PEOPLE_SUGGESTIONS_KEY;
}

function normalizeSuggestionId(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function parseStoredIds(value: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeSuggestionId(String(item || '')))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function getDismissedPeopleSuggestionIds(userEmail: string) {
  const stored = await SecureStore.getItemAsync(storageKeyForUser(userEmail));
  return Array.from(new Set(parseStoredIds(stored)));
}

export async function dismissPeopleSuggestion(userEmail: string, suggestionId: string) {
  const normalizedId = normalizeSuggestionId(suggestionId);
  if (!normalizedId) return [];

  const existing = await getDismissedPeopleSuggestionIds(userEmail);
  const next = existing.includes(normalizedId) ? existing : [...existing, normalizedId];

  await SecureStore.setItemAsync(storageKeyForUser(userEmail), JSON.stringify(next));
  return next;
}

export async function clearDismissedPeopleSuggestions(userEmail: string) {
  await SecureStore.deleteItemAsync(storageKeyForUser(userEmail));
  await SecureStore.deleteItemAsync(LEGACY_DISMISSED_PEOPLE_SUGGESTIONS_KEY);
}
