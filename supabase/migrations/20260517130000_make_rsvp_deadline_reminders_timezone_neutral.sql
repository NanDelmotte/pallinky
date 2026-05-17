-- Make final RSVP deadline reminders independent of the database/session timezone.
-- The worker runs every minute and this reminder says "today", so use the
-- last calendar day to start anywhere on Earth (UTC-12). That prevents hosts
-- and guests west of Amsterdam (including US time zones) from receiving a
-- "today" reminder while their local calendar still says yesterday.
create or replace function public.enqueue_final_rsvp_deadline_reminders()
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  v_count integer := 0;
  v_universal_today date := ((now() at time zone 'UTC') - interval '12 hours')::date;
begin
  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    payload
  )
  select distinct
    e.id,
    ei.invitee_email_lc,
    'rsvp_deadline_reminder',
    'rsvp_deadline_reminder',
    jsonb_build_object(
      'event_id', e.id,
      'event_title', e.title,
      'host_name', e.host_name,
      'slug', e.slug,
      'rsvp_deadline', e.rsvp_deadline,
      'deadline_basis_timezone', 'UTC-12'
    )
  from public.events e
  join public.event_invites ei
    on ei.event_id = e.id
   and ei.revoked_at is null
   and ei.invitee_email_lc is not null
  left join public.rsvps r
    on r.event_id = e.id
   and r.email_lc = ei.invitee_email_lc
  where e.status = 'active'
    and e.send_final_reminder_at_deadline = true
    and e.rsvp_deadline = v_universal_today
    and r.id is null
    and lower(trim(ei.invitee_email_lc)) <> lower(trim(e.host_email))
    and not exists (
      select 1
      from public.notifications_outbox n
      where n.event_id = e.id
        and n.recipient_email = ei.invitee_email_lc
        and n.type = 'rsvp_deadline_reminder'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
