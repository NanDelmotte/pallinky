-- Force-refresh the push worker function against the current outbox schema.
-- Older dev databases may still have a version that references notifications_outbox.user_id.

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
  select o.*
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
  limit greatest(coalesce(p_limit, 50), 1)
  for update skip locked
),
tokens as (
  select distinct on (lower(trim(pt.email_lc)))
    lower(trim(pt.email_lc)) as email_lc,
    pt.device_token
  from public.push_tokens pt
  where nullif(trim(pt.email_lc), '') is not null
    and nullif(trim(pt.device_token), '') is not null
  order by lower(trim(pt.email_lc)), pt.updated_at desc nulls last, pt.created_at desc nulls last
)
select
  locked.id,
  locked.event_id,
  locked.recipient_email,
  locked.type,
  locked.payload,
  tokens.device_token
from locked
join tokens
  on tokens.email_lc = lower(trim(locked.recipient_email));
$function$;

notify pgrst, 'reload schema';
