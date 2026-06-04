import { describe, expect, it } from 'vitest';

import { deriveFeedSignals } from './deriveFeed';

const viewerEmail = 'viewer@example.com';

function futureDate(hours = 48) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function makeEvent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Event ${id}`,
    host_email: viewerEmail,
    starts_at: futureDate(),
    visible_in_feed: true,
    status: 'active',
    ...overrides,
  };
}

function derive(overrides: Record<string, unknown> = {}) {
  return deriveFeedSignals({
    deviceContactCount: 0,
    data: {
      events: [],
      rsvps: [],
      vibeResponses: [],
      secondDegreeEvents: [],
      secondDegreeRsvps: [],
      invites: [],
      socialCircles: [],
      relationships: [],
      contacts: [],
      chatSummaries: {},
      accessByEventId: {},
      userEmail: viewerEmail,
      userPersonId: '',
      ...overrides,
    },
  });
}

describe('deriveFeedSignals', () => {
  it('excludes events without a positive access decision', () => {
    const result = derive({ events: [makeEvent('hidden')] });

    expect(result.items.some((item) => item.eventId === 'hidden')).toBe(false);
  });

  it('excludes cancelled events', () => {
    const event = makeEvent('cancelled', { status: 'cancelled' });
    const result = derive({
      events: [event],
      accessByEventId: { cancelled: { can_see: true } },
    });

    expect(result.items.some((item) => item.eventId === 'cancelled')).toBe(false);
  });

  it('keeps the upcoming plan instead of the incoming invite for the same event', () => {
    const event = makeEvent('shared');
    const result = derive({
      events: [event],
      invites: [{ event_id: 'shared', status: 'pending' }],
      accessByEventId: { shared: { can_see: true } },
    });

    expect(result.items.filter((item) => item.eventId === 'shared')).toHaveLength(1);
    expect(result.items.find((item) => item.eventId === 'shared')?.type).toBe('upcoming_plan');
  });

  it('orders higher-priority items first', () => {
    const event = makeEvent('soon', { starts_at: futureDate(2) });
    const result = derive({
      events: [event],
      accessByEventId: { soon: { can_see: true } },
    });

    expect(result.items[0]?.type).toBe('event_starting_soon');
  });

  it('moves from cold start to mature network as relationships grow', () => {
    expect(derive().feedState).toBe('cold_start');

    const relationships = Array.from({ length: 5 }, (_, index) => ({
      related_person_id: `person-${index}`,
    }));

    expect(derive({ relationships }).feedState).toBe('mature_network');
  });
});
