alter table public.notifications_outbox
  drop constraint if exists notifications_outbox_type_check;

alter table public.notifications_outbox
  add constraint notifications_outbox_type_check
  check (
    type = any (array[
      'invite_created',
      'host_message',
      'event_cancelled',
      'chat_message_batch',
      'event_updated',
      'rsvp_received',
      'join_request_created',
      'join_request_approved',
      'join_request_denied',
      'rsvp_deadline_reminder',
      'event_dm_message',
      'guest_rsvp_confirmation',
      'reach_out_suggestion',
      'friend_event_created'
    ]::text[])
  );
