begin;

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text,
  created_by_email_lc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text,
  archived_at timestamptz,
  constraint chat_threads_kind_check
    check (kind in ('direct', 'group'))
);

create table if not exists public.chat_thread_participants (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_email_lc text not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_thread_participants_pkey
    primary key (thread_id, user_email_lc),
  constraint chat_thread_participants_role_check
    check (role in ('owner', 'member'))
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_email_lc text not null,
  message_type text not null default 'text',
  body text,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint chat_messages_type_check
    check (message_type in ('text', 'image', 'system', 'event_attachment')),
  constraint chat_messages_has_content_check
    check (
      nullif(trim(coalesce(body, '')), '') is not null
      or nullif(trim(coalesce(image_url, '')), '') is not null
      or message_type in ('system', 'event_attachment')
    )
);

create table if not exists public.chat_thread_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  attached_by_email_lc text not null,
  created_at timestamptz not null default now(),
  unique (thread_id, event_id)
);

create index if not exists chat_threads_updated_at_idx
  on public.chat_threads(updated_at desc);

create index if not exists chat_threads_last_message_at_idx
  on public.chat_threads(last_message_at desc nulls last);

create index if not exists chat_thread_participants_user_email_idx
  on public.chat_thread_participants(user_email_lc);

create index if not exists chat_messages_thread_created_at_idx
  on public.chat_messages(thread_id, created_at asc);

create index if not exists chat_thread_events_event_id_idx
  on public.chat_thread_events(event_id);

create or replace function public.touch_chat_threads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_threads_updated_at on public.chat_threads;
create trigger trg_touch_chat_threads_updated_at
before update on public.chat_threads
for each row
execute function public.touch_chat_threads_updated_at();

create or replace function public.touch_chat_thread_participants_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_thread_participants_updated_at on public.chat_thread_participants;
create trigger trg_touch_chat_thread_participants_updated_at
before update on public.chat_thread_participants
for each row
execute function public.touch_chat_thread_participants_updated_at();

create or replace function public.is_chat_thread_participant(
  p_thread_id uuid,
  p_user_email text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_thread_participants p
    where p.thread_id = p_thread_id
      and p.user_email_lc = lower(trim(p_user_email))
      and p.archived_at is null
  );
$$;

create or replace function public.create_chat_thread(
  p_creator_email text,
  p_title text default null,
  p_participant_emails text[] default '{}'::text[],
  p_kind text default 'group'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_email_lc text;
  v_thread_id uuid;
  v_participant_email text;
begin
  v_creator_email_lc := nullif(lower(trim(p_creator_email)), '');

  if v_creator_email_lc is null then
    raise exception 'creator_email_required';
  end if;

  if p_kind not in ('direct', 'group') then
    raise exception 'invalid_chat_kind';
  end if;

  insert into public.chat_threads (
    kind,
    title,
    created_by_email_lc
  )
  values (
    p_kind,
    nullif(trim(p_title), ''),
    v_creator_email_lc
  )
  returning id into v_thread_id;

  insert into public.chat_thread_participants (
    thread_id,
    user_email_lc,
    role,
    joined_at,
    last_read_at
  )
  values (
    v_thread_id,
    v_creator_email_lc,
    'owner',
    now(),
    now()
  );

  foreach v_participant_email in array p_participant_emails
  loop
    v_participant_email := nullif(lower(trim(v_participant_email)), '');

    if v_participant_email is null or v_participant_email = v_creator_email_lc then
      continue;
    end if;

    insert into public.chat_thread_participants (
      thread_id,
      user_email_lc,
      role,
      joined_at
    )
    values (
      v_thread_id,
      v_participant_email,
      'member',
      now()
    )
    on conflict (thread_id, user_email_lc) do nothing;
  end loop;

  return v_thread_id;
end;
$$;

create or replace function public.get_or_create_direct_chat_thread(
  p_user_email text,
  p_other_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_email_lc text;
  v_other_email_lc text;
  v_thread_id uuid;
begin
  v_user_email_lc := nullif(lower(trim(p_user_email)), '');
  v_other_email_lc := nullif(lower(trim(p_other_email)), '');

  if v_user_email_lc is null or v_other_email_lc is null then
    raise exception 'participant_email_required';
  end if;

  if v_user_email_lc = v_other_email_lc then
    raise exception 'cannot_chat_with_self';
  end if;

  if exists (
    select 1
    from public.blocked_users b
    where
      (lower(trim(b.blocker_email)) = v_user_email_lc and lower(trim(b.blocked_email)) = v_other_email_lc)
      or
      (lower(trim(b.blocker_email)) = v_other_email_lc and lower(trim(b.blocked_email)) = v_user_email_lc)
  ) then
    raise exception 'blocked_user_interaction';
  end if;

  select t.id
  into v_thread_id
  from public.chat_threads t
  join public.chat_thread_participants me
    on me.thread_id = t.id
   and me.user_email_lc = v_user_email_lc
   and me.archived_at is null
  join public.chat_thread_participants other_participant
    on other_participant.thread_id = t.id
   and other_participant.user_email_lc = v_other_email_lc
   and other_participant.archived_at is null
  where t.kind = 'direct'
    and (
      select count(*)
      from public.chat_thread_participants p
      where p.thread_id = t.id
        and p.archived_at is null
    ) = 2
  limit 1;

  if v_thread_id is null then
    v_thread_id := public.create_chat_thread(
      p_creator_email := v_user_email_lc,
      p_title := null,
      p_participant_emails := array[v_other_email_lc],
      p_kind := 'direct'
    );
  end if;

  return v_thread_id;
end;
$$;

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

  select e.title, lower(trim(e.host_email))
  into v_event_title, v_host_email_lc
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
    status
  )
  select
    p_event_id,
    p.user_email_lc,
    'pending'
  from public.chat_thread_participants p
  where p.thread_id = p_thread_id
    and p.archived_at is null
    and p.user_email_lc <> coalesce(v_host_email_lc, '')
    and not exists (
      select 1
      from public.rsvps r
      where r.event_id = p_event_id
        and lower(trim(r.email_lc)) = p.user_email_lc
    )
    and not exists (
      select 1
      from public.event_invites ei
      where ei.event_id = p_event_id
        and lower(trim(ei.invitee_email_lc)) = p.user_email_lc
    );
end;
$$;

create or replace function public.sync_legacy_event_chat_participants(
  p_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
  v_event_type text;
begin
  select t.id, coalesce(e.event_type, 'formal')
  into v_thread_id, v_event_type
  from public.event_chat_threads t
  join public.events e on e.id = t.event_id
  where t.event_id = p_event_id
  limit 1;

  if v_thread_id is null then
    return;
  end if;

  insert into public.chat_thread_participants (
    thread_id,
    user_email_lc,
    role,
    joined_at,
    archived_at
  )
  select
    v_thread_id,
    email_lc,
    role,
    now(),
    null
  from (
    select
      eligible_raw.email_lc,
      case
        when bool_or(eligible_raw.role = 'owner') then 'owner'::text
        else 'member'::text
      end as role
    from (
      select lower(trim(e.host_email)) as email_lc, 'owner'::text as role
      from public.events e
      where e.id = p_event_id

      union all

      select lower(trim(r.email_lc)) as email_lc, 'member'::text as role
      from public.rsvps r
      where r.event_id = p_event_id
        and r.email_lc is not null
        and (
          (v_event_type = 'formal' and lower(trim(coalesce(r.status, ''))) in ('yes', 'maybe', 'going'))
          or
          (v_event_type <> 'formal' and lower(trim(coalesce(r.status, ''))) in ('interested', 'yes', 'maybe', 'going'))
        )
    ) eligible_raw
    where eligible_raw.email_lc is not null
    group by eligible_raw.email_lc
  ) eligible
  where eligible.email_lc is not null
  on conflict (thread_id, user_email_lc)
  do update set
    role = excluded.role,
    archived_at = null,
    updated_at = now();

  update public.chat_thread_participants p
  set
    archived_at = coalesce(p.archived_at, now()),
    updated_at = now()
  where p.thread_id = v_thread_id
    and p.user_email_lc not in (
      select lower(trim(e.host_email))
      from public.events e
      where e.id = p_event_id

      union

      select lower(trim(r.email_lc))
      from public.rsvps r
      where r.event_id = p_event_id
        and r.email_lc is not null
        and (
          (v_event_type = 'formal' and lower(trim(coalesce(r.status, ''))) in ('yes', 'maybe', 'going'))
          or
          (v_event_type <> 'formal' and lower(trim(coalesce(r.status, ''))) in ('interested', 'yes', 'maybe', 'going'))
        )
    );
end;
$$;

create or replace function public.get_my_chat_threads(
  p_user_email text
)
returns table(
  thread_id uuid,
  kind text,
  title text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count bigint,
  participant_count bigint,
  latest_event_id uuid,
  latest_event_title text
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

  return query
  with my_threads as (
    select
      t.id,
      t.kind,
      t.title,
      t.created_at,
      t.last_message_preview,
      t.last_message_at,
      p.last_read_at
    from public.chat_threads t
    join public.chat_thread_participants p
      on p.thread_id = t.id
    where p.user_email_lc = v_user_email_lc
      and p.archived_at is null
      and t.archived_at is null
  ),
  latest_events as (
    select distinct on (cte.thread_id)
      cte.thread_id,
      cte.event_id,
      e.title as event_title
    from public.chat_thread_events cte
    join public.events e on e.id = cte.event_id
    order by cte.thread_id, cte.created_at desc, cte.id desc
  )
  select
    t.id as thread_id,
    t.kind,
    coalesce(
      nullif(trim(t.title), ''),
      case
        when t.kind = 'direct' then (
          select coalesce(nullif(trim(pr.full_name), ''), other_participant.user_email_lc)
          from public.chat_thread_participants other_participant
          left join public.profiles pr
            on pr.email_lc = other_participant.user_email_lc
          where other_participant.thread_id = t.id
            and other_participant.user_email_lc <> v_user_email_lc
            and other_participant.archived_at is null
          order by other_participant.joined_at asc
          limit 1
        )
        else le.event_title
      end,
      'Chat'
    ) as title,
    t.last_message_preview,
    t.last_message_at,
    coalesce((
      select count(*)
      from public.chat_messages m
      where m.thread_id = t.id
        and m.created_at > coalesce(t.last_read_at, '-infinity'::timestamptz)
        and m.sender_email_lc <> v_user_email_lc
    ), 0)::bigint as unread_count,
    (
      select count(*)
      from public.chat_thread_participants p2
      where p2.thread_id = t.id
        and p2.archived_at is null
    )::bigint as participant_count,
    le.event_id as latest_event_id,
    le.event_title as latest_event_title
  from my_threads t
  left join latest_events le
    on le.thread_id = t.id
  order by coalesce(t.last_message_at, t.created_at) desc, t.id desc;
end;
$$;

create or replace function public.get_chat_thread_messages(
  p_thread_id uuid,
  p_user_email text
)
returns table(
  id uuid,
  thread_id uuid,
  sender_email_lc text,
  message_type text,
  body text,
  image_url text,
  metadata jsonb,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_chat_thread_participant(p_thread_id, p_user_email) then
    raise exception 'not_chat_thread_participant';
  end if;

  return query
  select
    m.id,
    m.thread_id,
    m.sender_email_lc,
    m.message_type,
    m.body,
    m.image_url,
    m.metadata,
    m.created_at,
    m.edited_at
  from public.chat_messages m
  where m.thread_id = p_thread_id
    and not exists (
      select 1
      from public.blocked_users b
      where
        (
          lower(trim(b.blocker_email)) = lower(trim(p_user_email))
          and lower(trim(b.blocked_email)) = m.sender_email_lc
        )
        or
        (
          lower(trim(b.blocked_email)) = lower(trim(p_user_email))
          and lower(trim(b.blocker_email)) = m.sender_email_lc
        )
    )
  order by m.created_at asc, m.id asc;
end;
$$;

create or replace function public.mark_chat_thread_read(
  p_thread_id uuid,
  p_user_email text
)
returns void
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

  update public.chat_thread_participants
  set
    last_read_at = now(),
    archived_at = null,
    updated_at = now()
  where thread_id = p_thread_id
    and user_email_lc = v_user_email_lc;
end;
$$;

create or replace function public.send_chat_message(
  p_thread_id uuid,
  p_sender_email text,
  p_body text default null,
  p_image_url text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(
  message_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_email_lc text;
  v_clean_body text;
  v_clean_image_url text;
  v_message_id uuid;
  v_created_at timestamptz;
  v_preview text;
begin
  v_sender_email_lc := nullif(lower(trim(p_sender_email)), '');
  v_clean_body := nullif(trim(coalesce(p_body, '')), '');
  v_clean_image_url := nullif(trim(coalesce(p_image_url, '')), '');

  if p_thread_id is null then
    raise exception 'thread_id_required';
  end if;

  if v_sender_email_lc is null then
    raise exception 'sender_email_required';
  end if;

  if not public.is_chat_thread_participant(p_thread_id, v_sender_email_lc) then
    raise exception 'not_chat_thread_participant';
  end if;

  if v_clean_body is null and v_clean_image_url is null then
    raise exception 'empty_message';
  end if;

  if exists (
    select 1
    from public.chat_thread_participants p
    join public.blocked_users b
      on (
        lower(trim(b.blocker_email)) = v_sender_email_lc
        and lower(trim(b.blocked_email)) = p.user_email_lc
      )
      or (
        lower(trim(b.blocker_email)) = p.user_email_lc
        and lower(trim(b.blocked_email)) = v_sender_email_lc
      )
    where p.thread_id = p_thread_id
      and p.user_email_lc <> v_sender_email_lc
      and p.archived_at is null
  ) then
    raise exception 'blocked_user_interaction';
  end if;

  insert into public.chat_messages (
    thread_id,
    sender_email_lc,
    message_type,
    body,
    image_url,
    metadata
  )
  values (
    p_thread_id,
    v_sender_email_lc,
    case when v_clean_image_url is not null then 'image' else 'text' end,
    v_clean_body,
    v_clean_image_url,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id, public.chat_messages.created_at
  into v_message_id, v_created_at;

  v_preview := coalesce(v_clean_body, 'Photo');

  update public.chat_threads
  set
    last_message_at = v_created_at,
    last_message_preview = left(v_preview, 140),
    updated_at = greatest(coalesce(updated_at, v_created_at), v_created_at)
  where id = p_thread_id;

  update public.chat_thread_participants
  set
    last_read_at = v_created_at,
    archived_at = null,
    updated_at = now()
  where thread_id = p_thread_id
    and user_email_lc = v_sender_email_lc;

  return query
  select v_message_id, v_created_at;
end;
$$;

create or replace function public.sync_event_chat_thread_to_chat_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_host_email_lc text;
begin
  select e.title, lower(trim(e.host_email))
  into v_title, v_host_email_lc
  from public.events e
  where e.id = new.event_id
  limit 1;

  insert into public.chat_threads (
    id,
    kind,
    title,
    created_by_email_lc,
    created_at,
    updated_at
  )
  values (
    new.id,
    'group',
    v_title,
    coalesce(v_host_email_lc, 'system@legacy.local'),
    new.created_at,
    new.created_at
  )
  on conflict (id) do update set
    title = excluded.title,
    updated_at = public.chat_threads.updated_at;

  insert into public.chat_thread_events (
    thread_id,
    event_id,
    attached_by_email_lc,
    created_at
  )
  values (
    new.id,
    new.event_id,
    coalesce(v_host_email_lc, 'system@legacy.local'),
    new.created_at
  )
  on conflict (thread_id, event_id) do nothing;

  perform public.sync_legacy_event_chat_participants(new.event_id);

  return new;
end;
$$;

create or replace function public.sync_event_dm_thread_to_chat_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_threads (
    id,
    kind,
    title,
    created_by_email_lc,
    created_at,
    updated_at,
    last_message_at,
    last_message_preview
  )
  values (
    new.id,
    'direct',
    null,
    new.user_a_email_lc,
    new.created_at,
    new.updated_at,
    new.last_message_at,
    new.last_message_preview
  )
  on conflict (id) do update set
    updated_at = excluded.updated_at,
    last_message_at = excluded.last_message_at,
    last_message_preview = excluded.last_message_preview;

  insert into public.chat_thread_participants (
    thread_id,
    user_email_lc,
    role,
    joined_at
  )
  values
    (new.id, new.user_a_email_lc, 'member', new.created_at),
    (new.id, new.user_b_email_lc, 'member', new.created_at)
  on conflict (thread_id, user_email_lc) do nothing;

  insert into public.chat_thread_events (
    thread_id,
    event_id,
    attached_by_email_lc,
    created_at
  )
  values (
    new.id,
    new.event_id,
    new.user_a_email_lc,
    new.created_at
  )
  on conflict (thread_id, event_id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_event_chat_message_to_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_messages (
    id,
    thread_id,
    sender_email_lc,
    message_type,
    body,
    image_url,
    created_at,
    edited_at,
    metadata
  )
  values (
    new.id,
    new.thread_id,
    new.sender_email_lc,
    case when new.image_url is not null then 'image' else 'text' end,
    new.body,
    new.image_url,
    new.created_at,
    new.edited_at,
    jsonb_build_object('legacy_source', 'event_chat', 'event_id', new.event_id)
  )
  on conflict (id) do update set
    body = excluded.body,
    image_url = excluded.image_url,
    edited_at = excluded.edited_at,
    metadata = excluded.metadata;

  update public.chat_threads
  set
    last_message_at = new.created_at,
    last_message_preview = left(coalesce(new.body, 'Photo'), 140),
    updated_at = greatest(coalesce(public.chat_threads.updated_at, new.created_at), new.created_at)
  where id = new.thread_id;

  return new;
end;
$$;

create or replace function public.sync_event_dm_message_to_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_messages (
    id,
    thread_id,
    sender_email_lc,
    message_type,
    body,
    created_at,
    edited_at,
    metadata
  )
  values (
    new.id,
    new.thread_id,
    new.sender_email_lc,
    'text',
    new.body,
    new.created_at,
    new.edited_at,
    jsonb_build_object(
      'legacy_source', 'event_dm',
      'event_id', new.event_id,
      'recipient_email_lc', new.recipient_email_lc
    )
  )
  on conflict (id) do update set
    body = excluded.body,
    edited_at = excluded.edited_at,
    metadata = excluded.metadata;

  update public.chat_threads
  set
    last_message_at = new.created_at,
    last_message_preview = left(coalesce(new.body, ''), 140),
    updated_at = greatest(coalesce(public.chat_threads.updated_at, new.created_at), new.created_at)
  where id = new.thread_id;

  return new;
end;
$$;

create or replace function public.sync_event_chat_read_to_chat_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_thread_participants (
    thread_id,
    user_email_lc,
    role,
    joined_at,
    last_read_at
  )
  values (
    new.thread_id,
    new.user_email_lc,
    'member',
    now(),
    new.last_read_at
  )
  on conflict (thread_id, user_email_lc) do update set
    last_read_at = excluded.last_read_at,
    archived_at = null,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_event_dm_read_to_chat_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_thread_participants (
    thread_id,
    user_email_lc,
    role,
    joined_at,
    last_read_at
  )
  values (
    new.thread_id,
    new.user_email_lc,
    'member',
    now(),
    new.last_read_at
  )
  on conflict (thread_id, user_email_lc) do update set
    last_read_at = excluded.last_read_at,
    archived_at = null,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_legacy_event_chat_participants_from_rsvp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_legacy_event_chat_participants(coalesce(new.event_id, old.event_id));
  return coalesce(new, old);
end;
$$;

insert into public.chat_threads (
  id,
  kind,
  title,
  created_by_email_lc,
  created_at,
  updated_at
)
select
  t.id,
  'group',
  e.title,
  lower(trim(e.host_email)),
  t.created_at,
  t.created_at
from public.event_chat_threads t
join public.events e on e.id = t.event_id
on conflict (id) do nothing;

insert into public.chat_threads (
  id,
  kind,
  title,
  created_by_email_lc,
  created_at,
  updated_at,
  last_message_at,
  last_message_preview
)
select
  t.id,
  'direct',
  null,
  t.user_a_email_lc,
  t.created_at,
  t.updated_at,
  t.last_message_at,
  t.last_message_preview
from public.event_dm_threads t
on conflict (id) do nothing;

insert into public.chat_thread_events (
  thread_id,
  event_id,
  attached_by_email_lc,
  created_at
)
select
  t.id,
  t.event_id,
  lower(trim(e.host_email)),
  t.created_at
from public.event_chat_threads t
join public.events e on e.id = t.event_id
on conflict (thread_id, event_id) do nothing;

insert into public.chat_thread_events (
  thread_id,
  event_id,
  attached_by_email_lc,
  created_at
)
select
  t.id,
  t.event_id,
  t.user_a_email_lc,
  t.created_at
from public.event_dm_threads t
on conflict (thread_id, event_id) do nothing;

insert into public.chat_thread_participants (
  thread_id,
  user_email_lc,
  role,
  joined_at
)
select
  t.id,
  t.user_a_email_lc,
  'member',
  t.created_at
from public.event_dm_threads t
on conflict (thread_id, user_email_lc) do nothing;

insert into public.chat_thread_participants (
  thread_id,
  user_email_lc,
  role,
  joined_at
)
select
  t.id,
  t.user_b_email_lc,
  'member',
  t.created_at
from public.event_dm_threads t
on conflict (thread_id, user_email_lc) do nothing;

insert into public.chat_messages (
  id,
  thread_id,
  sender_email_lc,
  message_type,
  body,
  image_url,
  metadata,
  created_at,
  edited_at
)
select
  m.id,
  m.thread_id,
  m.sender_email_lc,
  case when m.image_url is not null then 'image' else 'text' end,
  m.body,
  m.image_url,
  jsonb_build_object('legacy_source', 'event_chat', 'event_id', m.event_id),
  m.created_at,
  m.edited_at
from public.event_chat_messages m
on conflict (id) do nothing;

insert into public.chat_messages (
  id,
  thread_id,
  sender_email_lc,
  message_type,
  body,
  metadata,
  created_at,
  edited_at
)
select
  m.id,
  m.thread_id,
  m.sender_email_lc,
  'text',
  m.body,
  jsonb_build_object(
    'legacy_source', 'event_dm',
    'event_id', m.event_id,
    'recipient_email_lc', m.recipient_email_lc
  ),
  m.created_at,
  m.edited_at
from public.event_dm_messages m
on conflict (id) do nothing;

insert into public.chat_thread_participants (
  thread_id,
  user_email_lc,
  role,
  joined_at,
  last_read_at
)
select
  r.thread_id,
  r.user_email_lc,
  'member',
  now(),
  r.last_read_at
from public.event_chat_reads r
on conflict (thread_id, user_email_lc) do update set
  last_read_at = excluded.last_read_at,
  updated_at = now();

insert into public.chat_thread_participants (
  thread_id,
  user_email_lc,
  role,
  joined_at,
  last_read_at
)
select
  r.thread_id,
  r.user_email_lc,
  'member',
  now(),
  r.last_read_at
from public.event_dm_reads r
on conflict (thread_id, user_email_lc) do update set
  last_read_at = excluded.last_read_at,
  updated_at = now();

select public.sync_legacy_event_chat_participants(t.event_id)
from public.event_chat_threads t;

update public.chat_threads ct
set
  last_message_at = latest.last_message_at,
  last_message_preview = latest.last_message_preview
from (
  select
    m.thread_id,
    max(m.created_at) as last_message_at,
    (
      array_agg(
        coalesce(nullif(trim(m.body), ''), 'Photo')
        order by m.created_at desc, m.id desc
      )
    )[1] as last_message_preview
  from public.chat_messages m
  group by m.thread_id
) latest
where ct.id = latest.thread_id;

drop trigger if exists trg_sync_event_chat_thread_to_chat_thread on public.event_chat_threads;
create trigger trg_sync_event_chat_thread_to_chat_thread
after insert on public.event_chat_threads
for each row
execute function public.sync_event_chat_thread_to_chat_thread();

drop trigger if exists trg_sync_event_dm_thread_to_chat_thread on public.event_dm_threads;
create trigger trg_sync_event_dm_thread_to_chat_thread
after insert or update on public.event_dm_threads
for each row
execute function public.sync_event_dm_thread_to_chat_thread();

drop trigger if exists trg_sync_event_chat_message_to_chat_message on public.event_chat_messages;
create trigger trg_sync_event_chat_message_to_chat_message
after insert or update on public.event_chat_messages
for each row
execute function public.sync_event_chat_message_to_chat_message();

drop trigger if exists trg_sync_event_dm_message_to_chat_message on public.event_dm_messages;
create trigger trg_sync_event_dm_message_to_chat_message
after insert or update on public.event_dm_messages
for each row
execute function public.sync_event_dm_message_to_chat_message();

drop trigger if exists trg_sync_event_chat_read_to_chat_participant on public.event_chat_reads;
create trigger trg_sync_event_chat_read_to_chat_participant
after insert or update on public.event_chat_reads
for each row
execute function public.sync_event_chat_read_to_chat_participant();

drop trigger if exists trg_sync_event_dm_read_to_chat_participant on public.event_dm_reads;
create trigger trg_sync_event_dm_read_to_chat_participant
after insert or update on public.event_dm_reads
for each row
execute function public.sync_event_dm_read_to_chat_participant();

drop trigger if exists trg_sync_legacy_event_chat_participants_from_rsvp on public.rsvps;
create trigger trg_sync_legacy_event_chat_participants_from_rsvp
after insert or update or delete on public.rsvps
for each row
execute function public.sync_legacy_event_chat_participants_from_rsvp();

commit;
