begin;

-- Resolve RSVP approval requests from the host event details screen.
-- The previous live resolver can fail with viewer_cannot_see_event when approving
-- a token-based group-link request because the host is resolving someone else's
-- guest token. Approval should be authorized by host ownership, then materialize
-- the pending request into an RSVP.

create or replace function public.resolve_join_request(
  p_request_id uuid,
  p_decision text,
  p_decided_by_email text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.rsvp_join_requests%rowtype;
  v_event public.events%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_decider_email_lc text := nullif(lower(trim(p_decided_by_email)), '');
  v_auth_email_lc text;
  v_profile_email_lc text;
  v_rsvp_status text;
begin
  if p_request_id is null then
    raise exception 'request_required';
  end if;

  if v_decision not in ('approved', 'denied') then
    raise exception 'invalid_decision';
  end if;

  v_auth_email_lc := nullif(lower(trim(auth.jwt() ->> 'email')), '');

  if auth.uid() is not null then
    select nullif(lower(trim(p.email_lc)), '')
    into v_profile_email_lc
    from public.profiles p
    where p.id = auth.uid()
    limit 1;
  end if;

  v_decider_email_lc := coalesce(v_decider_email_lc, v_profile_email_lc, v_auth_email_lc);

  if v_decider_email_lc is null then
    raise exception 'decider_email_required';
  end if;

  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if v_profile_email_lc is not null and v_profile_email_lc <> v_decider_email_lc then
    raise exception 'decider_email_mismatch';
  end if;

  if v_auth_email_lc is not null and v_auth_email_lc <> v_decider_email_lc then
    raise exception 'decider_email_mismatch';
  end if;

  select *
  into v_request
  from public.rsvp_join_requests
  where id = p_request_id
  limit 1;

  if v_request.id is null then
    raise exception 'join_request_not_found';
  end if;

  select *
  into v_event
  from public.events
  where id = v_request.event_id
  limit 1;

  if v_event.id is null then
    raise exception 'event_not_found';
  end if;

  if lower(trim(v_event.host_email)) <> v_decider_email_lc then
    raise exception 'only_host_can_resolve_join_request';
  end if;

  update public.rsvp_join_requests
  set
    status = v_decision,
    decided_at = now(),
    decided_by_email_lc = v_decider_email_lc,
    updated_at = now()
  where id = v_request.id;

  if v_decision = 'approved' then
    v_rsvp_status := coalesce(nullif(trim(lower(v_request.requested_status)), ''), 'yes');

    insert into public.rsvps (
      event_id,
      name,
      email,
      status,
      message,
      guest_token,
      person_id,
      phone_e164,
      responded_at,
      updated_at
    )
    values (
      v_request.event_id,
      coalesce(nullif(trim(v_request.requester_name), ''), split_part(v_request.requester_email_lc, '@', 1), 'Guest'),
      v_request.requester_email,
      v_rsvp_status,
      nullif(trim(v_request.message), ''),
      v_request.guest_token,
      v_request.person_id,
      v_request.requester_phone_e164,
      now(),
      now()
    )
    on conflict on constraint rsvps_event_id_email_lc_key
    do update set
      name = excluded.name,
      email = excluded.email,
      status = excluded.status,
      message = excluded.message,
      guest_token = excluded.guest_token,
      person_id = coalesce(public.rsvps.person_id, excluded.person_id),
      phone_e164 = coalesce(public.rsvps.phone_e164, excluded.phone_e164),
      responded_at = coalesce(public.rsvps.responded_at, excluded.responded_at),
      updated_at = now();

    update public.event_invites
    set
      status = 'accepted',
      claimed_at = coalesce(claimed_at, now())
    where event_id = v_request.event_id
      and guest_token = v_request.guest_token
      and revoked_at is null;
  else
    update public.event_invites
    set status = 'declined'
    where event_id = v_request.event_id
      and guest_token = v_request.guest_token
      and revoked_at is null
      and status = 'pending';
  end if;

  return json_build_object(
    'success', true,
    'request_id', v_request.id,
    'decision', v_decision,
    'event_id', v_request.event_id
  );
end;
$$;

grant execute on function public.resolve_join_request(uuid, text, text) to authenticated;
grant execute on function public.resolve_join_request(uuid, text, text) to service_role;

notify pgrst, 'reload schema';

commit;
