export function normalizeExternalUrl(value: string | null | undefined) {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidExternalUrl(value: string | null | undefined) {
  const normalized = normalizeExternalUrl(value);

  if (!normalized) return true;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getExternalUrlDomain(value: string | null | undefined) {
  const normalized = normalizeExternalUrl(value);

  if (!normalized) return null;

  try {
    return new URL(normalized).hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}
