begin;

create or replace function public.submit_vibe_rsvp(
  p_slug text,
  p_user_email text,
  p_guest_name text default null::text,
  p_selected_dates text[] default '{}'::text[],
  p_note text default null::text,
  p_status text default 'interested'::text,
  p_guest_token text default null::text
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

  v_guest_token := coalesce(
    nullif(trim(p_guest_token), ''),
    md5(random()::text || clock_timestamp()::text || coalesce(v_email_lc, ''))
  );
  v_person_id := public.resolve_or_create_person(v_email_lc, null, p_guest_name);

  select ei.invitee_name into v_invitee_name
  from public.event_invites ei
  where ei.event_id = v_event_id
    and (
      ei.guest_token = v_guest_token
      or ei.person_id = v_person_id
      or (v_email_lc is not null and ei.invitee_email_lc = v_email_lc)
    )
  order by
    case when ei.guest_token = v_guest_token then 0 else 1 end,
    ei.created_at desc
  limit 1;

  if v_invitee_name is null then
    select full_name into v_profile_name
    from public.profiles
    where email_lc = v_email_lc
    limit 1;
  end if;

  -- A group-share link is named "Guest"; the responder's entered name is authoritative.
  v_final_name := coalesce(
    nullif(trim(p_guest_name), ''),
    nullif(trim(v_invitee_name), ''),
    nullif(trim(v_profile_name), ''),
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
      'guest_token', v_guest_token,
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
    guest_token = excluded.guest_token,
    updated_at = now();

  update public.event_invites
  set
    claimed_at = coalesce(claimed_at, now()),
    status = 'accepted'
  where event_id = v_event_id
    and guest_token = v_guest_token
    and revoked_at is null;

  return json_build_object(
    'success', true,
    'guest_token', v_guest_token,
    'deadline_passed', false
  );
end;
$$;

grant execute on function public.submit_vibe_rsvp(text, text, text, text[], text, text, text) to anon;
grant execute on function public.submit_vibe_rsvp(text, text, text, text[], text, text, text) to authenticated;
grant execute on function public.submit_vibe_rsvp(text, text, text, text[], text, text, text) to service_role;

notify pgrst, 'reload schema';

commit;
