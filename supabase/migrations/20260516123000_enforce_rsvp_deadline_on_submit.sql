-- Enforce RSVP deadlines at the point every response source writes a response.
-- This intentionally does not change invite/feed visibility or access-decision behavior.

create or replace function public.submit_rsvp(
  p_slug text,
  p_name text,
  p_status text,
  p_guest_token text default null::text,
  p_email text default null::text,
  p_message text default null::text
) returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event_id uuid;
  v_email_lc text;
  v_guest_token text;
  v_person_id uuid;
  v_invitee_name text;
  v_best_name text;
  v_event_title text;
  v_host_name text;
  v_rsvp_deadline date;
begin
  select id, title, host_name, rsvp_deadline
  into v_event_id, v_event_title, v_host_name, v_rsvp_deadline
  from public.events
  where slug = p_slug
  limit 1;

  if v_event_id is null then
    return json_build_object('error', 'Event not found');
  end if;

  if v_rsvp_deadline is not null and current_date > v_rsvp_deadline then
    return json_build_object(
      'success', false,
      'error', 'rsvp_deadline_passed',
      'deadline_passed', true,
      'rsvp_deadline', v_rsvp_deadline
    );
  end if;

  v_email_lc := nullif(lower(trim(p_email)), '');

  v_guest_token := coalesce(
    nullif(trim(p_guest_token), ''),
    md5(random()::text || clock_timestamp()::text || coalesce(v_email_lc, '') || coalesce(p_name, ''))
  );

  if v_email_lc is not null then
    select id into v_person_id
    from public.people
    where email_lc = v_email_lc
    limit 1;

    if v_person_id is null then
      insert into public.people (email_lc)
      values (v_email_lc)
      returning id into v_person_id;
    end if;
  end if;

  select ei.invitee_name
  into v_invitee_name
  from public.event_invites ei
  where ei.event_id = v_event_id
    and (
      (v_person_id is not null and ei.person_id = v_person_id)
      or (v_email_lc is not null and ei.invitee_email_lc = v_email_lc)
    )
  order by ei.created_at desc
  limit 1;

  v_best_name := coalesce(
    nullif(trim(v_invitee_name), ''),
    nullif(trim(p_name), ''),
    split_part(v_email_lc, '@', 1),
    'Someone'
  );

  insert into public.rsvps (
    event_id,
    name,
    status,
    guest_token,
    email,
    message,
    person_id
  )
  values (
    v_event_id,
    v_best_name,
    p_status,
    v_guest_token,
    p_email,
    p_message,
    v_person_id
  )
  on conflict on constraint rsvps_event_id_email_lc_key
  do update set
    name = excluded.name,
    status = excluded.status,
    message = excluded.message,
    guest_token = excluded.guest_token,
    email = excluded.email,
    person_id = excluded.person_id,
    updated_at = now();

  if v_email_lc is not null then
    insert into public.notifications_outbox (
      event_id,
      recipient_email,
      template,
      type,
      payload
    )
    values (
      v_event_id,
      v_email_lc,
      'guest_rsvp_confirmation',
      'guest_rsvp_confirmation',
      jsonb_build_object(
        'event_title', v_event_title,
        'host_name', v_host_name,
        'slug', p_slug,
        'response', p_status,
        'guest_name', v_best_name
      )
    );
  end if;

  return json_build_object('success', true, 'deadline_passed', false);
end;
$$;

create or replace function public.submit_rsvp_enriched(
  p_event_id uuid,
  p_name text,
  p_email text,
  p_status text,
  p_phone_e164 text default null::text,
  p_message text default null::text
) returns json
language plpgsql
as $$
declare
  v_email_lc text;
  v_localpart text;
  v_guest_name text;
  v_existing_name text;
  v_invite_name text;
  v_person_id uuid;
  v_guest_token text;
  v_decision record;
  v_result json;
  v_event_title text;
  v_host_name text;
  v_slug text;
  v_rsvp_deadline date;
begin
  v_email_lc := nullif(lower(trim(p_email)), '');
  v_localpart := split_part(coalesce(v_email_lc, ''), '@', 1);
  v_guest_token := md5(random()::text || clock_timestamp()::text || coalesce(v_email_lc, ''));

  if v_email_lc is null then
    return json_build_object('error', 'Email required');
  end if;

  select e.title, e.host_name, e.slug, e.rsvp_deadline
  into v_event_title, v_host_name, v_slug, v_rsvp_deadline
  from public.events e
  where e.id = p_event_id
  limit 1;

  if v_slug is null then
    return json_build_object('error', 'Event not found');
  end if;

  if v_rsvp_deadline is not null and current_date > v_rsvp_deadline then
    return json_build_object(
      'success', false,
      'error', 'rsvp_deadline_passed',
      'deadline_passed', true,
      'rsvp_deadline', v_rsvp_deadline
    );
  end if;

  v_person_id := public.resolve_or_create_person(
    v_email_lc,
    p_phone_e164,
    nullif(trim(p_name), '')
  );

  select r.name
  into v_existing_name
  from public.rsvps r
  where r.event_id = p_event_id
    and r.email_lc = v_email_lc
  order by r.updated_at desc nulls last
  limit 1;

  select ei.invitee_name
  into v_invite_name
  from public.event_invites ei
  where ei.event_id = p_event_id
    and (
      ei.invitee_email_lc = v_email_lc
      or (v_person_id is not null and ei.person_id = v_person_id)
    )
    and nullif(trim(ei.invitee_name), '') is not null
  order by ei.id desc
  limit 1;

  v_guest_name := coalesce(
    nullif(trim(p_name), ''),
    case
      when nullif(trim(v_existing_name), '') is not null
       and lower(trim(v_existing_name)) <> v_localpart
      then trim(v_existing_name)
      else null
    end,
    nullif(trim(v_invite_name), ''),
    nullif(trim(v_existing_name), ''),
    v_localpart,
    'Someone'
  );

  select *
  into v_decision
  from public.get_event_access_decision(
    p_event_id := p_event_id,
    p_viewer_email := v_email_lc,
    p_guest_token := v_guest_token
  );

  if not coalesce(v_decision.can_see, false) then
    return json_build_object('error', 'viewer_cannot_see_event');
  end if;

  if coalesce(v_decision.requires_host_approval, false) then
    insert into public.rsvp_join_requests (
      event_id,
      requester_name,
      requester_email,
      guest_token,
      requested_status,
      message,
      source,
      status,
      person_id
    )
    values (
      p_event_id,
      v_guest_name,
      v_email_lc,
      v_guest_token,
      coalesce(nullif(trim(lower(p_status)), ''), 'interested'),
      nullif(trim(p_message), ''),
      'rsvp',
      'pending',
      v_person_id
    );

    return json_build_object(
      'success', false,
      'join_request_created', true,
      'reason', 'approval_required',
      'deadline_passed', false
    );
  end if;

  if not coalesce(v_decision.can_rsvp, false) then
    return json_build_object('error', coalesce(v_decision.reason, 'viewer_cannot_rsvp'));
  end if;

  insert into public.rsvps (
    event_id,
    name,
    email,
    status,
    guest_token,
    person_id
  )
  values (
    p_event_id,
    v_guest_name,
    v_email_lc,
    coalesce(nullif(trim(lower(p_status)), ''), 'interested'),
    v_guest_token,
    v_person_id
  )
  on conflict on constraint rsvps_event_id_email_lc_key
  do update set
    name = excluded.name,
    status = excluded.status,
    email = excluded.email,
    person_id = coalesce(public.rsvps.person_id, excluded.person_id),
    guest_token = excluded.guest_token,
    updated_at = now()
  returning json_build_object(
    'success', true,
    'email_lc', rsvps.email_lc,
    'status', rsvps.status,
    'guest_token', rsvps.guest_token,
    'deadline_passed', false
  )
  into v_result;

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    payload
  )
  values (
    p_event_id,
    v_email_lc,
    'guest_rsvp_confirmation',
    'guest_rsvp_confirmation',
    jsonb_build_object(
      'event_title', v_event_title,
      'host_name', v_host_name,
      'slug', v_slug,
      'response', coalesce(nullif(trim(lower(p_status)), ''), 'interested'),
      'guest_name', v_guest_name,
      'token', v_guest_token
    )
  );

  return v_result;
end;
$$;

create or replace function public.submit_vibe_rsvp(
  p_slug text,
  p_user_email text,
  p_guest_name text default null::text,
  p_selected_dates text[] default '{}'::text[],
  p_note text default null::text,
  p_status text default 'interested'::text
) returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event_id uuid;
  v_email_lc text;
  v_guest_token text;
  v_person_id uuid;
  v_invitee_name text;
  v_profile_name text;
  v_final_name text;
  v_rsvp_deadline date;
begin
  v_email_lc := nullif(lower(trim(p_user_email)), '');

  select id, rsvp_deadline into v_event_id, v_rsvp_deadline
  from public.events
  where slug = p_slug
  limit 1;

  if v_event_id is null then
    return json_build_object('error', 'Event not found');
  end if;

  if v_rsvp_deadline is not null and current_date > v_rsvp_deadline then
    return json_build_object(
      'success', false,
      'error', 'rsvp_deadline_passed',
      'deadline_passed', true,
      'rsvp_deadline', v_rsvp_deadline
    );
  end if;

  v_guest_token := md5(random()::text || clock_timestamp()::text || coalesce(v_email_lc, ''));

  v_person_id := public.resolve_or_create_person(
    v_email_lc,
    null,
    p_guest_name
  );

  select ei.invitee_name
  into v_invitee_name
  from public.event_invites ei
  where ei.event_id = v_event_id
    and (
      ei.person_id = v_person_id
      or (v_email_lc is not null and ei.invitee_email_lc = v_email_lc)
    )
  order by ei.created_at desc
  limit 1;

  if v_invitee_name is null then
    select full_name
    into v_profile_name
    from public.profiles
    where email_lc = v_email_lc
    limit 1;
  end if;

  v_final_name := coalesce(
    nullif(trim(v_invitee_name), ''),
    nullif(trim(v_profile_name), ''),
    nullif(trim(p_guest_name), ''),
    split_part(v_email_lc, '@', 1),
    'Someone'
  );

  insert into public.vibe_responses (
    event_id,
    guest_name,
    selected_dates,
    note,
    user_email
  )
  values (
    v_event_id,
    v_final_name,
    coalesce(p_selected_dates, '{}'::text[]),
    nullif(trim(p_note), ''),
    v_email_lc
  )
  on conflict (event_id, user_email)
  do update set
    guest_name = excluded.guest_name,
    selected_dates = excluded.selected_dates,
    note = excluded.note;

  insert into public.rsvps (
    event_id,
    name,
    email,
    status,
    guest_token,
    person_id,
    responded_at,
    updated_at
  )
  values (
    v_event_id,
    v_final_name,
    v_email_lc,
    'voted',
    v_guest_token,
    v_person_id,
    now(),
    now()
  )
  on conflict on constraint rsvps_event_id_email_lc_key
  do update set
    name = excluded.name,
    status = 'voted',
    person_id = excluded.person_id,
    updated_at = now();

  return json_build_object(
    'success', true,
    'guest_token', v_guest_token,
    'deadline_passed', false
  );
end;
$$;
