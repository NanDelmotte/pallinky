import * as Notifications from 'expo-notifications';
import { supabase } from '@pallinky/core';

const MESSAGE_NOTIFICATION_TYPES = new Set(['chat_message_batch', 'event_dm_message']);

function normalizeCount(value: unknown) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export async function syncAppIconBadge() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const emailLower = user?.email?.toLowerCase().trim() || '';

    if (!emailLower) {
      await Notifications.setBadgeCountAsync(0);
      return 0;
    }

    const [{ data: inboxData, error: inboxError }, { data: chatData, error: chatError }] =
      await Promise.all([
        supabase.rpc('get_my_notifications_inbox'),
        supabase.rpc('get_my_chat_threads', {
          p_user_email: emailLower,
        }),
      ]);

    if (inboxError) throw inboxError;
    if (chatError) throw chatError;

    const nonChatInboxCount = ((inboxData || []) as any[])
      .filter((row) => row.user_email_lc === emailLower)
      .filter((row) => !MESSAGE_NOTIFICATION_TYPES.has(row.notification_type))
      .reduce(
        (sum, row) => sum + (row.is_read ? 0 : normalizeCount(row.unread_count)),
        0
      );

    const chatUnreadCount = ((chatData || []) as any[]).reduce(
      (sum, row) => sum + normalizeCount(row.unread_count),
      0
    );

    const total = nonChatInboxCount + chatUnreadCount;
    await Notifications.setBadgeCountAsync(total);

    return total;
  } catch (err) {
    console.log('App icon badge sync error:', err);
    return null;
  }
}
