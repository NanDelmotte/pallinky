//packages/core/src/events/createEventdraft.ts

import { getLocalTimeZone } from '../dateTime';
import { supabase } from '../supabase';

export type createEventdraftInput = {
  title: string;
  description?: string;
  hostName: string;
  hostEmail: string;
  keyword: string;
  gifKey?: string;
  eventType?: string;
  eventTimeZone?: string | null;
  proposedDates?: string[];
  location?: string | null;
  externalUrl?: string | null;
  visibility?: 1 | 2 | 3;
  eventUrl?: string | null;
  inviteListVisibility?: 'host_only' | 'guests_can_see';
  guestListVisibility?: 'host_only' | 'guests_can_see';
  sendRsvpReminders?: boolean;
  remindAfterDays?: 1 | 2 | 3 | 5 | 7;
  rsvpDeadline?: string | null;
  sendFinalReminderAtDeadline?: boolean;
  forwardingMode?: 'free' | 'host_approval' | null;
};

export type createEventdraftResult = {
  id: string;
  slug: string;
  manage_handle: string;
};

export async function createEventdraft(
  input: createEventdraftInput
): Promise<createEventdraftResult> {
  const fullDescription = input.location
    ? `${input.description ?? ''}\n\nLocation: ${input.location}`.trim()
    : (input.description ?? '').trim();

  const { data, error } = await supabase.rpc('create_event_draft', {
    p_title: input.title.trim(),
    p_host_email: input.hostEmail.toLowerCase().trim(),
p_host_name:
  input.hostName?.trim() ||
  input.hostEmail.toLowerCase().trim().split('@')[0] ||
  'Host',
    p_description: fullDescription,
    p_keyword: input.keyword,
    p_gif_key: input.gifKey ?? 'waves',
    p_event_type: input.eventType ?? 'poll',
    p_event_time_zone: input.eventTimeZone ?? getLocalTimeZone(),
    p_proposed_dates: input.proposedDates ?? [],
    p_visibility: input.visibility ?? 2,
    p_invite_list_visibility: input.inviteListVisibility ?? 'host_only',
    p_guest_list_visibility: input.guestListVisibility ?? 'guests_can_see',
    p_send_rsvp_reminders: input.sendRsvpReminders ?? false,
    p_remind_after_days: input.remindAfterDays ?? 3,
    p_rsvp_deadline: input.rsvpDeadline ?? null,
    p_send_final_reminder_at_deadline: input.sendFinalReminderAtDeadline ?? false,
    p_forwarding_mode: input.forwardingMode ?? null,
    p_event_url: input.eventUrl ?? null,
    p_external_url: input.externalUrl ?? null,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row?.slug || !row?.manage_handle) {
    throw new Error('create_event_draft returned an unexpected payload.');
  }

  return {
    id: row.id,
    slug: row.slug,
    manage_handle: row.manage_handle,
  };
}