-- Enforce the simple event approval flag across access decisions and RSVP writes.
-- Feed filtering for cancelled events is handled in the mobile feed derivation.

create or replace function public.get_event_access_decision(
  p_event_id uuid,
  p_viewer_email text default null,
  p_viewer_phone_e164 text default null,
  p_guest_token text default null
)
returns table (
  can_see boolean,
  can_rsvp boolean,
  can_see_guest_list boolean,
  is_host boolean,
  is_direct_invitee boolean,
  is_network_qualified boolean,
  has_existing_rsvp boolean,
  requires_host_approval boolean,
  visibility integer,
  forwarding_mode text,
  reason text
)
language plpgsql
security definer
as $$
declare
  v_event public.events%rowtype;
  v_invite public.event_invites%rowtype;
  v_rsvp public.rsvps%rowtype;
  v_viewer_email_lc text;
  v_viewer_phone text;
  v_guest_token text;
  v_host_email_lc text;
  v_viewer_user_id uuid;
  v_host_user_id uuid;
  v_can_see boolean := false;
  v_can_rsvp boolean := false;
  v_can_see_guest_list boolean := false;
  v_is_host boolean := false;
  v_is_direct_invitee boolean := false;
  v_is_network_qualified boolean := false;
  v_has_existing_rsvp boolean := false;
  v_requires_host_approval boolean := false;
  v_reason text := 'not_found';
  v_visibility integer;
  v_forwarding_mode text;
  v_in_host_social_circles boolean := false;
  v_shared_rsvp_history boolean := false;
  v_in_viewer_imported_contacts boolean := false;
  v_in_host_imported_contacts boolean := false;
  v_has_relationship boolean := false;
begin
  v_viewer_email_lc := nullif(lower(trim(p_viewer_email)), '');
  v_viewer_phone := nullif(trim(p_viewer_phone_e164), '');
  v_guest_token := nullif(trim(p_guest_token), '');

  select * into v_event
  from public.events
  where id = p_event_id
  limit 1;

  if v_event.id is null then
    return query
    select false,false,false,false,false,false,false,false,null::int,null::text,'not_found';
    return;
  end if;

  v_visibility := coalesce(v_event.visibility, 2);
  v_forwarding_mode := v_event.forwarding_mode;
  v_host_email_lc := lower(trim(v_event.host_email));

  select ei.* into v_invite
  from public.event_invites ei
  join public.events invited_event on invited_event.id = ei.event_id
  where ei.revoked_at is null
    and (
      ei.event_id = p_event_id
      or (v_event.series_id is not null and invited_event.series_id = v_event.series_id)
    )
    and (
      (v_viewer_email_lc is not null and ei.invitee_email_lc = v_viewer_email_lc)
      or (v_viewer_phone is not null and ei.invitee_phone_e164 = v_viewer_phone)
    )
  order by
    case when ei.event_id = p_event_id then 0 else 1 end,
    ei.created_at desc
  limit 1;

  select r.* into v_rsvp
  from public.rsvps r
  join public.events rsvp_event on rsvp_event.id = r.event_id
  where (
      r.event_id = p_event_id
      or (v_event.series_id is not null and rsvp_event.series_id = v_event.series_id)
    )
    and (
      (v_viewer_email_lc is not null and r.email_lc = v_viewer_email_lc)
      or (v_viewer_phone is not null and r.phone_e164 = v_viewer_phone)
      or (v_guest_token is not null and r.guest_token = v_guest_token)
    )
  order by
    case when r.event_id = p_event_id then 0 else 1 end,
    r.updated_at desc,
    r.responded_at desc
  limit 1;

  v_is_host := v_viewer_email_lc is not null and v_host_email_lc = v_viewer_email_lc;
  v_is_direct_invitee := v_invite.id is not null;
  v_has_existing_rsvp := v_rsvp.id is not null;

  select p.id into v_viewer_user_id
  from public.profiles p
  where p.email_lc = v_viewer_email_lc
  limit 1;

  select p.id into v_host_user_id
  from public.profiles p
  where p.email_lc = v_host_email_lc
  limit 1;

  if v_viewer_email_lc is not null and v_host_email_lc is not null then
    select exists (
      select 1
      from public.social_circle_members scm
      join public.social_circles sc on sc.id = scm.circle_id
      where sc.user_id = v_host_user_id
        and (
          scm.member_email_lc = v_viewer_email_lc
          or (scm.member_user_id is not null and scm.member_user_id = v_viewer_user_id)
        )
    ) into v_in_host_social_circles;

    select exists (
      select 1
      from public.rsvps mine
      join public.rsvps other on other.event_id = mine.event_id
      where mine.email_lc = v_viewer_email_lc
        and other.email_lc = v_host_email_lc
    ) into v_shared_rsvp_history;

    select exists (
      select 1
      from public.device_contacts dc
      where dc.user_id = v_viewer_user_id
        and (
          dc.email_lc = v_host_email_lc
          or (dc.matched_user_id is not null and dc.matched_user_id = v_host_user_id)
        )
    ) into v_in_viewer_imported_contacts;

    select exists (
      select 1
      from public.device_contacts dc
      where dc.user_id = v_host_user_id
        and (
          dc.email_lc = v_viewer_email_lc
          or (dc.matched_user_id is not null and dc.matched_user_id = v_viewer_user_id)
        )
    ) into v_in_host_imported_contacts;

    select exists (
      select 1
      from public.relationships r
      where (
        r.owner_user_id = v_host_user_id
        and r.related_person_id in (
          select p.id from public.people p where p.email_lc = v_viewer_email_lc
        )
      )
      or (
        r.owner_user_id = v_viewer_user_id
        and r.related_person_id in (
          select p.id from public.people p where p.email_lc = v_host_email_lc
        )
      )
    ) into v_has_relationship;
  end if;

  v_is_network_qualified := (
    v_in_host_social_circles
    or v_shared_rsvp_history
    or v_in_viewer_imported_contacts
    or v_in_host_imported_contacts
    or v_has_relationship
  );

  v_can_see := case
    when v_is_host then true
    when v_has_existing_rsvp then true
    when v_visibility = 1 then v_is_direct_invitee
    when v_visibility = 2 then (v_is_direct_invitee or v_is_network_qualified)
    when v_visibility = 3 then true
    else false
  end;

  if v_is_host or v_has_existing_rsvp then
    v_requires_host_approval := false;
  elsif coalesce(v_invite.requires_host_approval, false) then
    v_requires_host_approval := true;
  elsif v_is_direct_invitee then
    v_requires_host_approval := false;
  elsif coalesce(v_event.requires_approval, false) then
    v_requires_host_approval := true;
  elsif v_forwarding_mode = 'host_approval' then
    v_requires_host_approval := true;
  elsif v_forwarding_mode = 'no_forwarding' and not v_is_direct_invitee then
    v_requires_host_approval := false;
  elsif v_visibility = 1 and not v_is_direct_invitee then
    v_requires_host_approval := true;
  else
    v_requires_host_approval := false;
  end if;

  if not v_can_see then
    v_can_rsvp := false;
  elsif v_is_host then
    v_can_rsvp := true;
  elsif v_requires_host_approval then
    v_can_rsvp := true;
  elsif v_visibility = 1 then
    v_can_rsvp := v_is_direct_invitee;
  elsif v_visibility = 2 then
    v_can_rsvp := (v_is_direct_invitee or v_is_network_qualified);
  elsif v_visibility = 3 then
    v_can_rsvp := (coalesce(v_forwarding_mode, '') <> 'no_forwarding');
  else
    v_can_rsvp := false;
  end if;

  v_can_see_guest_list := (
    v_is_host
    or (
      v_event.guest_list_visibility = 'guests_can_see'
      and (v_has_existing_rsvp or v_is_direct_invitee)
    )
  );

  if v_is_host then
    v_reason := 'host';
  elsif v_has_existing_rsvp then
    v_reason := 'existing_rsvp';
  elsif v_requires_host_approval then
    v_reason := 'approval_required';
  elsif v_is_direct_invitee then
    v_reason := 'direct_invitee';
  elsif v_visibility = 2 and v_is_network_qualified then
    v_reason := 'network_qualified';
  elsif v_visibility = 3 then
    if coalesce(v_forwarding_mode, '') = 'no_forwarding' and not v_can_rsvp then
      v_reason := 'forwarding_blocked';
    else
      v_reason := 'public_event';
    end if;
  elsif v_visibility = 2 then
    v_reason := 'not_network_qualified';
  else
    v_reason := 'hidden_visibility_1';
  end if;

  return query
  select
    v_can_see,
    v_can_rsvp,
    v_can_see_guest_list,
    v_is_host,
    v_is_direct_invitee,
    v_is_network_qualified,
    v_has_existing_rsvp,
    v_requires_host_approval,
    v_event.visibility,
    v_event.forwarding_mode,
    v_reason;
end;
$$;

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
  v_decision record;
  v_existing_request_id uuid;
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

  select ei.invitee_name into v_invitee_name
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

  select * into v_decision
  from public.get_event_access_decision(
    p_event_id := v_event_id,
    p_viewer_email := v_email_lc,
    p_guest_token := v_guest_token
  );

  if not coalesce(v_decision.can_see, false) then
    return json_build_object('error', 'viewer_cannot_see_event');
  end if;

  if coalesce(v_decision.requires_host_approval, false) then
    select id into v_existing_request_id
    from public.rsvp_join_requests
    where event_id = v_event_id
      and requester_email = v_email_lc
      and status = 'pending'
    order by created_at desc
    limit 1;

    if v_existing_request_id is null then
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
        v_event_id,
        v_best_name,
        v_email_lc,
        v_guest_token,
        coalesce(nullif(trim(lower(p_status)), ''), 'interested'),
        nullif(trim(p_message), ''),
        'rsvp',
        'pending',
        v_person_id
      );
    else
      update public.rsvp_join_requests
      set
        requester_name = v_best_name,
        guest_token = v_guest_token,
        requested_status = coalesce(nullif(trim(lower(p_status)), ''), 'interested'),
        message = nullif(trim(p_message), ''),
        person_id = coalesce(person_id, v_person_id)
      where id = v_existing_request_id;
    end if;

    return json_build_object(
      'success', false,
      'pending_approval', true,
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
  v_decision record;
  v_existing_request_id uuid;
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
  v_person_id := public.resolve_or_create_person(v_email_lc, null, p_guest_name);

  select ei.invitee_name into v_invitee_name
  from public.event_invites ei
  where ei.event_id = v_event_id
    and (
      ei.person_id = v_person_id
      or (v_email_lc is not null and ei.invitee_email_lc = v_email_lc)
    )
  order by ei.created_at desc
  limit 1;

  if v_invitee_name is null then
    select full_name into v_profile_name
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

  select * into v_decision
  from public.get_event_access_decision(
    p_event_id := v_event_id,
    p_viewer_email := v_email_lc,
    p_guest_token := v_guest_token
  );

  if not coalesce(v_decision.can_see, false) then
    return json_build_object('error', 'viewer_cannot_see_event');
  end if;

  if coalesce(v_decision.requires_host_approval, false) then
    select id into v_existing_request_id
    from public.rsvp_join_requests
    where event_id = v_event_id
      and requester_email = v_email_lc
      and status = 'pending'
    order by created_at desc
    limit 1;

    if v_existing_request_id is null then
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
        v_event_id,
        v_final_name,
        v_email_lc,
        v_guest_token,
        coalesce(nullif(trim(lower(p_status)), ''), 'interested'),
        nullif(trim(p_note), ''),
        'vibe',
        'pending',
        v_person_id
      );
    else
      update public.rsvp_join_requests
      set
        requester_name = v_final_name,
        guest_token = v_guest_token,
        requested_status = coalesce(nullif(trim(lower(p_status)), ''), 'interested'),
        message = nullif(trim(p_note), ''),
        person_id = coalesce(person_id, v_person_id)
      where id = v_existing_request_id;
    end if;

    return json_build_object(
      'success', false,
      'pending_approval', true,
      'join_request_created', true,
      'reason', 'approval_required',
      'deadline_passed', false
    );
  end if;

  if not coalesce(v_decision.can_rsvp, false) then
    return json_build_object('error', coalesce(v_decision.reason, 'viewer_cannot_rsvp'));
  end if;

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

notify pgrst, 'reload schema';
