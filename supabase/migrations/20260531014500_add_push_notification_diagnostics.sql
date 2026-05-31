-- Lightweight diagnostics for pending/sent push rows and token matching.

create or replace function public.get_recent_push_notification_diagnostics(
  p_recipient_email text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  created_at timestamptz,
  event_id uuid,
  recipient_email text,
  type text,
  status text,
  attempts integer,
  processed_at timestamptz,
  last_sent_at timestamptz,
  last_error text,
  has_push_token boolean,
  latest_token_at timestamptz,
  payload jsonb
)
language sql
security definer
set search_path = public
as $function$
with latest_tokens as (
  select distinct on (lower(trim(email_lc)))
    lower(trim(email_lc)) as email_lc,
    created_at
  from public.push_tokens
  where nullif(trim(email_lc), '') is not null
  order by lower(trim(email_lc)), created_at desc
)
select
  outbox.id,
  outbox.created_at,
  outbox.event_id,
  outbox.recipient_email,
  outbox.type,
  outbox.status,
  outbox.attempts,
  outbox.processed_at,
  outbox.last_sent_at,
  outbox.last_error,
  latest_tokens.email_lc is not null as has_push_token,
  latest_tokens.created_at as latest_token_at,
  outbox.payload
from public.notifications_outbox outbox
left join latest_tokens
  on latest_tokens.email_lc = lower(trim(outbox.recipient_email))
where p_recipient_email is null
  or lower(trim(outbox.recipient_email)) = lower(trim(p_recipient_email))
order by outbox.created_at desc
limit greatest(1, least(coalesce(p_limit, 20), 100));
$function$;

grant execute on function public.get_recent_push_notification_diagnostics(text, integer)
  to authenticated;

notify pgrst, 'reload schema';
