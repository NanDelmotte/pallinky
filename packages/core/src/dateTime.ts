const DEFAULT_EVENT_TIME_ZONE = 'UTC';

function isValidTimeZone(timeZone?: string | null) {
  if (!timeZone) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getLocalTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_EVENT_TIME_ZONE;
}

export function getEventTimeZone(event?: { event_time_zone?: string | null } | null) {
  return isValidTimeZone(event?.event_time_zone) ? event!.event_time_zone! : undefined;
}

export function formatInEventTimeZone(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  event?: { event_time_zone?: string | null } | string | null
) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const eventTimeZone =
    typeof event === 'string' ? event : getEventTimeZone(event ?? null);

  return date.toLocaleString(undefined, {
    ...options,
    ...(eventTimeZone ? { timeZone: eventTimeZone } : {}),
  });
}

export function getEventDayOfMonth(
  value: string | Date | null | undefined,
  event?: { event_time_zone?: string | null } | string | null
) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const eventTimeZone =
    typeof event === 'string' ? event : getEventTimeZone(event ?? null);

  const parts = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    ...(eventTimeZone ? { timeZone: eventTimeZone } : {}),
  }).formatToParts(date);

  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return Number.isFinite(day) ? day : null;
}
