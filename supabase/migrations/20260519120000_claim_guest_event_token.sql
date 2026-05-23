-- Claim an existing guest RSVP/join-request token for the currently signed-in app user.
-- This reuses the durable guest_token bridge without changing public invite links.

create or replace function public.claim_guest_event_token(
  p_slug text,
  p_guest_token text
)
returns table (
  event_id uuid,
  event_slug text,
  claim_status text,
  claim_source text,
  rsvp_status text,
  request_status text,
  person_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_slug text := nullif(trim(p_slug), '');
  v_guest_token text := nullif(trim(p_guest_token), '');
  v_event public.events%rowtype;
  v_rsvp public.rsvps%rowtype;
  v_request public.rsvp_join_requests%rowtype;
  v_person public.people%rowtype;
  v_person_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if v_slug is null or v_guest_token is null then
    return query
    select null::uuid, v_slug, 'invalid_token', null::text, null::text, null::text, null::uuid;
    return;
  end if;

  select *
  into v_event
  from public.events
  where slug = v_slug
  limit 1;

  if v_event.id is null then
    return query
    select null::uuid, v_slug, 'event_not_found', null::text, null::text, null::text, null::uuid;
    return;
  end if;

  select *
  into v_rsvp
  from public.rsvps
  where event_id = v_event.id
    and guest_token = v_guest_token
  limit 1;

  if v_rsvp.id is not null then
    v_person_id := v_rsvp.person_id;

    if v_person_id is null then
      v_person_id := public.resolve_or_create_person(
        v_rsvp.email_lc,
        v_rsvp.phone_e164,
        v_user_id
      );
    end if;

    select *
    into v_person
    from public.people
    where id = v_person_id
    limit 1;

    if v_person.id is not null
      and v_person.matched_user_id is not null
      and v_person.matched_user_id <> v_user_id then
      return query
      select
        v_event.id,
        v_event.slug,
        'already_claimed',
        'rsvp',
        v_rsvp.status,
        null::text,
        v_person_id;
      return;
    end if;

    update public.people
    set matched_user_id = coalesce(matched_user_id, v_user_id)
    where id = v_person_id;

    update public.rsvps
    set person_id = v_person_id
    where id = v_rsvp.id;

    return query
    select
      v_event.id,
      v_event.slug,
      'claimed',
      'rsvp',
      v_rsvp.status,
      null::text,
      v_person_id;
    return;
  end if;

  select *
  into v_request
  from public.rsvp_join_requests
  where event_id = v_event.id
    and guest_token = v_guest_token
  order by created_at desc
  limit 1;

  if v_request.id is null then
    return query
    select
      v_event.id,
      v_event.slug,
      'token_not_found',
      null::text,
      null::text,
      null::text,
      null::uuid;
    return;
  end if;

  v_person_id := v_request.person_id;

  if v_person_id is null then
    v_person_id := public.resolve_or_create_person(
      v_request.requester_email_lc,
      v_request.requester_phone_e164,
      v_user_id
    );
  end if;

  select *
  into v_person
  from public.people
  where id = v_person_id
  limit 1;

  if v_person.id is not null
    and v_person.matched_user_id is not null
    and v_person.matched_user_id <> v_user_id then
    return query
    select
      v_event.id,
      v_event.slug,
      'already_claimed',
      'join_request',
      v_request.requested_status,
      v_request.status,
      v_person_id;
    return;
  end if;

  update public.people
  set matched_user_id = coalesce(matched_user_id, v_user_id)
  where id = v_person_id;

  update public.rsvp_join_requests
  set person_id = v_person_id
  where id = v_request.id;

  return query
  select
    v_event.id,
    v_event.slug,
    'claimed',
    'join_request',
    v_request.requested_status,
    v_request.status,
    v_person_id;
end;
$$;

grant execute on function public.claim_guest_event_token(text, text) to authenticated;
grant execute on function public.claim_guest_event_token(text, text) to service_role;
