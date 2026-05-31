-- Close push notification producer gaps for approval requests and public event discovery.

create or replace function public.enqueue_direct_contact_event_created_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_user_id uuid;
  v_host_email_lc text;
begin
  v_host_email_lc := nullif(lower(trim(new.host_email)), '');

  if v_host_email_lc is null then
    return new;
  end if;

  if coalesce(new.visibility, 2) < 2 or coalesce(new.visible_in_feed, true) is not true then
    return new;
  end if;

  select p.id
  into v_host_user_id
  from public.profiles p
  where p.email_lc = v_host_email_lc
  limit 1;

  if v_host_user_id is null then
    return new;
  end if;

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    status,
    payload
  )
  select
    new.id,
    contact_emails.recipient_email,
    'friend_event_created',
    'friend_event_created',
    'pending',
    jsonb_build_object(
      'event_id', new.id,
      'event_title', new.title,
      'event_slug', new.slug,
      'slug', new.slug,
      'host_name', new.host_name,
      'host_email', v_host_email_lc,
      'event_type', new.event_type
    )
  from (
    select distinct nullif(lower(trim(coalesce(person.email_lc, matched_profile.email_lc))), '') as recipient_email
    from public.relationships relationship
    join public.people person
      on person.id = relationship.related_person_id
    left join public.profiles matched_profile
      on matched_profile.id = person.matched_user_id
    where relationship.owner_user_id = v_host_user_id
      and relationship.relationship_type = 'direct'
  ) contact_emails
  where contact_emails.recipient_email is not null
    and contact_emails.recipient_email <> v_host_email_lc
    and not exists (
      select 1
      from public.notifications_outbox existing
      where existing.event_id = new.id
        and existing.type = 'friend_event_created'
        and lower(trim(existing.recipient_email)) = contact_emails.recipient_email
    );

  return new;
end;
$$;

drop trigger if exists trg_enqueue_direct_contact_event_created_notification on public.events;

create trigger trg_enqueue_direct_contact_event_created_notification
after insert or update of visibility, visible_in_feed, host_email, host_name, title, slug, event_type, status
on public.events
for each row
execute function public.enqueue_direct_contact_event_created_notification();

create or replace function public.enqueue_join_request_created_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_host_email_lc text;
  v_requester_email_lc text;
begin
  if lower(trim(coalesce(new.status, ''))) <> 'pending' then
    return new;
  end if;

  select *
  into v_event
  from public.events
  where id = new.event_id
  limit 1;

  v_host_email_lc := nullif(lower(trim(v_event.host_email)), '');
  v_requester_email_lc := nullif(lower(trim(coalesce(new.requester_email_lc, new.requester_email))), '');

  if v_event.id is null or v_host_email_lc is null then
    return new;
  end if;

  if v_requester_email_lc is not null and v_requester_email_lc = v_host_email_lc then
    return new;
  end if;

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    status,
    payload
  )
  select
    new.event_id,
    v_host_email_lc,
    'join_request_created',
    'join_request_created',
    'pending',
    jsonb_build_object(
      'event_id', new.event_id,
      'event_title', v_event.title,
      'event_slug', v_event.slug,
      'slug', v_event.slug,
      'host_name', v_event.host_name,
      'host_email', v_host_email_lc,
      'guest_name', coalesce(nullif(trim(new.requester_name), ''), 'Someone'),
      'guest_email', v_requester_email_lc,
      'requested_status', new.requested_status,
      'request_id', new.id
    )
  where not exists (
    select 1
    from public.notifications_outbox existing
    where existing.event_id = new.event_id
      and existing.type = 'join_request_created'
      and lower(trim(existing.recipient_email)) = v_host_email_lc
      and existing.payload->>'request_id' = new.id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_enqueue_join_request_created_notification on public.rsvp_join_requests;

create trigger trg_enqueue_join_request_created_notification
after insert or update
on public.rsvp_join_requests
for each row
execute function public.enqueue_join_request_created_notification();

create or replace function public.enqueue_join_request_resolved_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_recipient_email_lc text;
  v_type text;
begin
  if lower(trim(coalesce(new.status, ''))) = lower(trim(coalesce(old.status, ''))) then
    return new;
  end if;

  if lower(trim(coalesce(new.status, ''))) = 'approved' then
    v_type := 'join_request_approved';
  elsif lower(trim(coalesce(new.status, ''))) = 'denied' then
    v_type := 'join_request_denied';
  else
    return new;
  end if;

  v_recipient_email_lc := nullif(lower(trim(coalesce(new.requester_email_lc, new.requester_email))), '');

  if v_recipient_email_lc is null then
    return new;
  end if;

  select *
  into v_event
  from public.events
  where id = new.event_id
  limit 1;

  if v_event.id is null then
    return new;
  end if;

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    status,
    payload
  )
  select
    new.event_id,
    v_recipient_email_lc,
    v_type,
    v_type,
    'pending',
    jsonb_build_object(
      'event_id', new.event_id,
      'event_title', v_event.title,
      'event_slug', v_event.slug,
      'slug', v_event.slug,
      'host_name', v_event.host_name,
      'host_email', lower(trim(v_event.host_email)),
      'guest_name', coalesce(nullif(trim(new.requester_name), ''), 'Someone'),
      'guest_email', v_recipient_email_lc,
      'requested_status', new.requested_status,
      'request_id', new.id,
      'token', new.guest_token
    )
  where not exists (
    select 1
    from public.notifications_outbox existing
    where existing.event_id = new.event_id
      and existing.type = v_type
      and lower(trim(existing.recipient_email)) = v_recipient_email_lc
      and existing.payload->>'request_id' = new.id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_enqueue_join_request_resolved_notification on public.rsvp_join_requests;

create trigger trg_enqueue_join_request_resolved_notification
after update of status
on public.rsvp_join_requests
for each row
execute function public.enqueue_join_request_resolved_notification();

notify pgrst, 'reload schema';
