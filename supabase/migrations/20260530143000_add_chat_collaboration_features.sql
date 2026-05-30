begin;

create or replace function public.attach_event_to_chat_thread(
  p_thread_id uuid,
  p_event_id uuid,
  p_attached_by_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attached_by_email_lc text;
  v_event_title text;
  v_event_slug text;
  v_host_email_lc text;
begin
  v_attached_by_email_lc := nullif(lower(trim(p_attached_by_email)), '');

  if p_thread_id is null or p_event_id is null then
    raise exception 'thread_id_and_event_id_required';
  end if;

  if v_attached_by_email_lc is null then
    raise exception 'attached_by_email_required';
  end if;

  if not public.is_chat_thread_participant(p_thread_id, v_attached_by_email_lc) then
    raise exception 'not_chat_thread_participant';
  end if;

  select e.title, e.slug, lower(trim(e.host_email))
  into v_event_title, v_event_slug, v_host_email_lc
  from public.events e
  where e.id = p_event_id
  limit 1;

  if v_event_title is null then
    raise exception 'event_not_found';
  end if;

  insert into public.chat_thread_events (
    thread_id,
    event_id,
    attached_by_email_lc
  )
  values (
    p_thread_id,
    p_event_id,
    v_attached_by_email_lc
  )
  on conflict (thread_id, event_id) do nothing;

  insert into public.chat_messages (
    thread_id,
    sender_email_lc,
    message_type,
    body,
    metadata
  )
  values (
    p_thread_id,
    v_attached_by_email_lc,
    'event_attachment',
    v_event_title,
    jsonb_build_object(
      'event_id', p_event_id,
      'event_slug', v_event_slug,
      'attached_by_email_lc', v_attached_by_email_lc
    )
  );

  update public.chat_threads
  set
    last_message_at = now(),
    last_message_preview = left(coalesce(v_event_title, 'Event added'), 140)
  where id = p_thread_id;

  insert into public.event_invites (
    event_id,
    invitee_email_lc,
    invitee_phone_e164,
    invitee_name,
    invited_by_email_lc,
    invited_by_invite_id,
    source_type,
    source_ref,
    status,
    can_forward,
    requires_host_approval,
    claimed_at,
    revoked_at,
    device_contact_id,
    person_id
  )
  select
    p_event_id,
    participant.user_email_lc,
    null::text as invitee_phone_e164,
    coalesce(
      nullif(trim(profile.full_name), ''),
      split_part(participant.user_email_lc, '@', 1),
      'Guest'
    ) as invitee_name,
    v_attached_by_email_lc,
    null::uuid as invited_by_invite_id,
    'host_friend',
    null::text as source_ref,
    'pending',
    false,
    false,
    null::timestamptz as claimed_at,
    null::timestamptz as revoked_at,
    null::uuid as device_contact_id,
    person.id as person_id
  from public.chat_thread_participants participant
  left join public.profiles profile
    on profile.email_lc = participant.user_email_lc
  left join public.people person
    on person.email_lc = participant.user_email_lc
  where participant.thread_id = p_thread_id
    and participant.archived_at is null
    and participant.user_email_lc <> coalesce(v_host_email_lc, '')
    and not exists (
      select 1
      from public.rsvps r
      where r.event_id = p_event_id
        and lower(trim(r.email_lc)) = participant.user_email_lc
    )
    and not exists (
      select 1
      from public.event_invites ei
      where ei.event_id = p_event_id
        and lower(trim(ei.invitee_email_lc)) = participant.user_email_lc
    );
end;
$$;

create or replace function public.get_chat_thread_events(
  p_thread_id uuid,
  p_user_email text
)
returns table(
  event_id uuid,
  event_slug text,
  event_title text,
  starts_at timestamptz,
  cover_image_url text,
  host_name text,
  attached_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_email_lc text;
begin
  v_user_email_lc := nullif(lower(trim(p_user_email)), '');

  if v_user_email_lc is null then
    raise exception 'user_email_required';
  end if;

  if not public.is_chat_thread_participant(p_thread_id, v_user_email_lc) then
    raise exception 'not_chat_thread_participant';
  end if;

  return query
  select
    e.id as event_id,
    e.slug as event_slug,
    e.title as event_title,
    e.starts_at,
    e.cover_image_url,
    e.host_name,
    cte.created_at as attached_at
  from public.chat_thread_events cte
  join public.events e
    on e.id = cte.event_id
  where cte.thread_id = p_thread_id
  order by
    case
      when e.starts_at is null then 1
      when e.starts_at >= now() then 0
      else 1
    end asc,
    case
      when e.starts_at >= now() then e.starts_at
      else null
    end asc nulls last,
    case
      when e.starts_at < now() then e.starts_at
      else null
    end desc nulls last,
    cte.created_at desc,
    cte.id desc;
end;
$$;

create or replace function public.get_chat_thread_members(
  p_thread_id uuid,
  p_user_email text
)
returns table(
  user_email_lc text,
  display_name text,
  avatar_url text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_email_lc text;
begin
  v_user_email_lc := nullif(lower(trim(p_user_email)), '');

  if v_user_email_lc is null then
    raise exception 'user_email_required';
  end if;

  if not public.is_chat_thread_participant(p_thread_id, v_user_email_lc) then
    raise exception 'not_chat_thread_participant';
  end if;

  return query
  select
    participant.user_email_lc,
    coalesce(nullif(trim(profile.full_name), ''), participant.user_email_lc) as display_name,
    profile.avatar_url,
    participant.joined_at
  from public.chat_thread_participants participant
  left join public.profiles profile
    on profile.email_lc = participant.user_email_lc
  where participant.thread_id = p_thread_id
    and participant.archived_at is null
  order by participant.joined_at asc, participant.user_email_lc asc;
end;
$$;

create or replace function public.add_people_to_chat_thread(
  p_thread_id uuid,
  p_added_by_email text,
  p_participant_emails text[]
)
returns table(
  added_count integer,
  added_names text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added_by_email_lc text;
  v_added_emails text[];
  v_added_names text;
begin
  v_added_by_email_lc := nullif(lower(trim(p_added_by_email)), '');

  if p_thread_id is null then
    raise exception 'thread_id_required';
  end if;

  if v_added_by_email_lc is null then
    raise exception 'added_by_email_required';
  end if;

  if not public.is_chat_thread_participant(p_thread_id, v_added_by_email_lc) then
    raise exception 'not_chat_thread_participant';
  end if;

  with normalized as (
    select distinct nullif(lower(trim(email_value)), '') as user_email_lc
    from unnest(coalesce(p_participant_emails, '{}'::text[])) as email_value
  ),
  upserted as (
    insert into public.chat_thread_participants (
      thread_id,
      user_email_lc,
      role,
      joined_at,
      archived_at,
      last_read_at
    )
    select
      p_thread_id,
      normalized.user_email_lc,
      'member',
      now(),
      null,
      null
    from normalized
    where normalized.user_email_lc is not null
      and normalized.user_email_lc <> v_added_by_email_lc
    on conflict (thread_id, user_email_lc)
    do update set
      archived_at = null,
      updated_at = now()
    where public.chat_thread_participants.archived_at is not null
    returning user_email_lc
  )
  select
    coalesce(array_agg(upserted.user_email_lc order by upserted.user_email_lc), '{}'::text[]),
    coalesce(
      string_agg(
        coalesce(nullif(trim(profile.full_name), ''), split_part(upserted.user_email_lc, '@', 1)),
        ', '
        order by coalesce(nullif(trim(profile.full_name), ''), upserted.user_email_lc)
      ),
      ''
    )
  into v_added_emails, v_added_names
  from upserted
  left join public.profiles profile
    on profile.email_lc = upserted.user_email_lc;

  if coalesce(array_length(v_added_emails, 1), 0) = 0 then
    return query select 0::integer, ''::text;
    return;
  end if;

  update public.chat_threads
  set kind = 'group'
  where id = p_thread_id
    and kind = 'direct'
    and (
      select count(*)
      from public.chat_thread_participants participant
      where participant.thread_id = p_thread_id
        and participant.archived_at is null
    ) > 2;

  insert into public.chat_messages (
    thread_id,
    sender_email_lc,
    message_type,
    body,
    metadata
  )
  values (
    p_thread_id,
    v_added_by_email_lc,
    'system',
    case
      when coalesce(array_length(v_added_emails, 1), 0) = 1 then
        coalesce(nullif(trim(v_added_names), ''), 'Someone') || ' joined the chat'
      else
        coalesce(nullif(trim(v_added_names), ''), 'New people') || ' joined the chat'
    end,
    jsonb_build_object(
      'added_by_email_lc', v_added_by_email_lc,
      'added_emails', to_jsonb(v_added_emails)
    )
  );

  update public.chat_threads
  set
    last_message_at = now(),
    last_message_preview = left(
      case
        when coalesce(array_length(v_added_emails, 1), 0) = 1 then
          coalesce(nullif(trim(v_added_names), ''), 'Someone') || ' joined the chat'
        else
          coalesce(nullif(trim(v_added_names), ''), 'New people') || ' joined the chat'
      end,
      140
    )
  where id = p_thread_id;

  insert into public.event_invites (
    event_id,
    invitee_email_lc,
    invitee_phone_e164,
    invitee_name,
    invited_by_email_lc,
    invited_by_invite_id,
    source_type,
    source_ref,
    status,
    can_forward,
    requires_host_approval,
    claimed_at,
    revoked_at,
    device_contact_id,
    person_id
  )
  select
    linked_event.event_id,
    added_email.user_email_lc,
    null::text as invitee_phone_e164,
    coalesce(
      nullif(trim(profile.full_name), ''),
      split_part(added_email.user_email_lc, '@', 1),
      'Guest'
    ) as invitee_name,
    v_added_by_email_lc,
    null::uuid as invited_by_invite_id,
    'host_friend',
    null::text as source_ref,
    'pending',
    false,
    false,
    null::timestamptz as claimed_at,
    null::timestamptz as revoked_at,
    null::uuid as device_contact_id,
    person.id as person_id
  from (
    select unnest(v_added_emails) as user_email_lc
  ) added_email
  join public.chat_thread_events linked_event
    on linked_event.thread_id = p_thread_id
  join public.events event_row
    on event_row.id = linked_event.event_id
  left join public.profiles profile
    on profile.email_lc = added_email.user_email_lc
  left join public.people person
    on person.email_lc = added_email.user_email_lc
  where added_email.user_email_lc <> lower(trim(coalesce(event_row.host_email, '')))
    and not exists (
      select 1
      from public.rsvps r
      where r.event_id = linked_event.event_id
        and lower(trim(r.email_lc)) = added_email.user_email_lc
    )
    and not exists (
      select 1
      from public.event_invites invite_row
      where invite_row.event_id = linked_event.event_id
        and lower(trim(invite_row.invitee_email_lc)) = added_email.user_email_lc
    );

  return query
  select coalesce(array_length(v_added_emails, 1), 0)::integer, coalesce(v_added_names, '');
end;
$$;

commit;
