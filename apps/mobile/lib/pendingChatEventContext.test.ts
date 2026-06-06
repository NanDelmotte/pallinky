import { describe, expect, it } from 'vitest';

import {
  parsePendingChatEventContext,
  serializePendingChatEventContext,
} from './pendingChatEventContext';

describe('pending chat event context', () => {
  it('round-trips a fresh chat thread', () => {
    const raw = serializePendingChatEventContext(' thread-123 ', 1_000);

    expect(parsePendingChatEventContext(raw, 2_000)).toEqual({
      threadId: 'thread-123',
      createdAt: 1_000,
    });
  });

  it('rejects legacy or expired context', () => {
    expect(parsePendingChatEventContext(JSON.stringify({ threadId: 'legacy' }), 1_000)).toBeNull();
    expect(
      parsePendingChatEventContext(
        serializePendingChatEventContext('expired', 1_000),
        1_000 + 2 * 60 * 60 * 1_000 + 1
      )
    ).toBeNull();
  });

  it('rejects malformed context', () => {
    expect(parsePendingChatEventContext('{broken')).toBeNull();
    expect(parsePendingChatEventContext(null)).toBeNull();
  });
});
