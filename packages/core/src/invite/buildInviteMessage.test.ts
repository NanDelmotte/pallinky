import { describe, expect, it } from 'vitest';

import { buildInviteMessage } from './buildInviteMessage';

describe('buildInviteMessage', () => {
  it('names the host when one is provided', () => {
    expect(
      buildInviteMessage({
        hostName: '  Alice  ',
        title: 'Dinner',
        link: 'https://pallinky.com/event/dinner',
      })
    ).toBe(
      'Alice invited you to Dinner 🎉\n\nOpen the invite:\nhttps://pallinky.com/event/dinner'
    );
  });

  it('uses the default title and call to action', () => {
    expect(buildInviteMessage({ link: 'custom://invite?token=abc' })).toBe(
      "You're invited to this event 🎉\n\nOpen the invite:\ncustom://invite?token=abc"
    );
  });

  it('uses a custom call to action and preserves the link', () => {
    const link = 'https://pallinky.com/event/a?token=x%2By';

    expect(buildInviteMessage({ title: 'A plan', ctaLabel: 'Join us', link })).toContain(
      `Join us:\n${link}`
    );
  });
});
