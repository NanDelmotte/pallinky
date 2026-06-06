export const PENDING_CHAT_EVENT_THREAD_KEY = 'pallinky:pending_chat_event_thread';

const MAX_PENDING_CHAT_EVENT_AGE_MS = 2 * 60 * 60 * 1000;

type PendingChatEventContext = {
  threadId: string;
  createdAt: number;
};

export function serializePendingChatEventContext(
  threadId: string,
  createdAt = Date.now()
): string {
  return JSON.stringify({ threadId: threadId.trim(), createdAt });
}

export function parsePendingChatEventContext(
  raw: string | null,
  now = Date.now()
): PendingChatEventContext | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const threadId = typeof parsed?.threadId === 'string' ? parsed.threadId.trim() : '';
    const createdAt = typeof parsed?.createdAt === 'number' ? parsed.createdAt : 0;

    if (!threadId || !createdAt || now - createdAt > MAX_PENDING_CHAT_EVENT_AGE_MS) {
      return null;
    }

    return { threadId, createdAt };
  } catch {
    return null;
  }
}
