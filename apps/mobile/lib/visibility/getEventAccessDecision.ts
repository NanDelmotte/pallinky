

//mobile/lib/visibility/getEventAccessDecision.ts


import { supabase } from '@pallinky/core';

export type EventAccessReason =
  | 'host'
  | 'direct_invitee'
  | 'existing_rsvp'
  | 'public_event'
  | 'approval_required'
  | 'forwarding_blocked'
  | 'network_not_implemented'
  | 'hidden_visibility_1'
  | 'hidden_visibility_2'
  | 'not_found';

export type EventAccessDecision = {
  can_see: boolean;
  can_rsvp: boolean;
  can_see_guest_list: boolean;
  is_host: boolean;
  is_direct_invitee: boolean;
  is_network_qualified: boolean;
  has_existing_rsvp: boolean;
  requires_host_approval: boolean;
  visibility: number | null;
  forwarding_mode: string | null;
  reason: EventAccessReason;
};

const FALLBACK: EventAccessDecision = {
  can_see: false,
  can_rsvp: false,
  can_see_guest_list: false,
  is_host: false,
  is_direct_invitee: false,
  is_network_qualified: false,
  has_existing_rsvp: false,
  requires_host_approval: false,
  visibility: null,
  forwarding_mode: null,
  reason: 'not_found',
};

export async function getEventAccessDecision(params: {
  eventId: string;
  viewerEmail?: string | null;
  viewerPhoneE164?: string | null;
  guestToken?: string | null;
}): Promise<EventAccessDecision> {
  const { eventId, viewerEmail = null, viewerPhoneE164 = null, guestToken = null } = params;

  if (!eventId) return FALLBACK;

  const { data, error } = await supabase.rpc('get_event_access_decision', {
    p_event_id: eventId,
    p_viewer_email: viewerEmail,
    p_viewer_phone_e164: viewerPhoneE164,
    p_guest_token: guestToken,
  });

  if (error || !data) {
    if (error) console.error('get_event_access_decision failed', { eventId, error });
    return FALLBACK;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return FALLBACK;

  return {
    can_see: row.can_see === true,
    can_rsvp: row.can_rsvp === true,
    can_see_guest_list: row.can_see_guest_list === true,
    is_host: row.is_host === true,
    is_direct_invitee: row.is_direct_invitee === true,
    is_network_qualified: row.is_network_qualified === true,
    has_existing_rsvp: row.has_existing_rsvp === true,
    requires_host_approval: row.requires_host_approval === true,
    visibility: typeof row.visibility === 'number' ? row.visibility : null,
    forwarding_mode: row.forwarding_mode ?? null,
    reason: (row.reason ?? 'not_found') as EventAccessReason,
  };
}