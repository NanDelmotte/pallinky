import { describe, expect, it } from 'vitest';

import { formatRsvpReceivedBody } from './rsvpCopy';

describe('RSVP push copy', () => {
  it('describes a poll response as a vote', () => {
    expect(
      formatRsvpReceivedBody({
        guestName: 'Ada',
        eventTitle: 'Cocktails',
        response: 'voted',
      })
    ).toBe('Ada voted in Cocktails');
  });

  it('keeps confirmed attendance wording for yes responses', () => {
    expect(
      formatRsvpReceivedBody({
        guestName: 'Ada',
        eventTitle: 'Cocktails',
        response: 'yes',
      })
    ).toBe('Ada is coming to Cocktails');
  });
});
