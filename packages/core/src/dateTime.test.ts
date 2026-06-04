import { describe, expect, it } from 'vitest';

import { formatInEventTimeZone, getEventDayOfMonth, getEventTimeZone } from './dateTime';

describe('dateTime', () => {
  it('returns empty results for invalid dates', () => {
    expect(formatInEventTimeZone('not-a-date', { year: 'numeric' }, 'UTC')).toBe('');
    expect(getEventDayOfMonth('not-a-date', 'UTC')).toBeNull();
  });

  it('extracts the day in an explicit event time zone', () => {
    const instant = '2026-01-01T01:00:00.000Z';

    expect(getEventDayOfMonth(instant, 'UTC')).toBe(1);
    expect(getEventDayOfMonth(instant, 'America/Los_Angeles')).toBe(31);
  });

  it('ignores an invalid event time zone without throwing', () => {
    expect(getEventTimeZone({ event_time_zone: 'Invalid/Zone' })).toBeUndefined();
    expect(() =>
      formatInEventTimeZone('2026-01-01T01:00:00.000Z', { year: 'numeric' }, 'Invalid/Zone')
    ).not.toThrow();
  });
});
