create or replace function public.get_pending_push_notifications(p_limit integer)
returns table (
  id uuid,
  event_id uuid,
  recipient_email text,
  type text,
  payload jsonb,
  device_token text
)
language sql
security definer
set search_path to 'public'
as $function$
with locked as (
  select *
  from public.notifications_outbox o
  where o.status = 'pending'
    and o.type in (
      'invite_created',
      'chat_message_batch',
      'event_updated',
      'rsvp_received',
      'join_request_created',
      'join_request_approved',
      'join_request_denied',
      'event_cancelled',
      'host_message',
      'rsvp_deadline_reminder',
      'event_dm_message',
      'guest_rsvp_confirmation',
      'reach_out_suggestion',
      'friend_event_created'
    )
  order by o.created_at asc
  limit p_limit
  for update skip locked
),
tokens as (
  select distinct on (email_lc)
    email_lc,
    device_token
  from public.push_tokens
  order by email_lc, created_at desc
)
select
  l.id,
  l.event_id,
  l.recipient_email,
  l.type,
  l.payload,
  t.device_token
from locked l
join tokens t
  on t.email_lc = lower(trim(l.recipient_email));
$function$;

notify pgrst, 'reload schema';
