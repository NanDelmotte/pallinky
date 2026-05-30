begin;

alter table public.chat_threads
  add column if not exists avatar_url text;

drop function if exists public.get_my_chat_threads(text);

create or replace function public.get_my_chat_threads(
  p_user_email text
)
returns table(
  thread_id uuid,
  kind text,
  title text,
  participant_preview text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count bigint,
  participant_count bigint,
  latest_event_id uuid,
  latest_event_title text,
  latest_event_slug text,
  avatar_url text,
  counterpart_email_lc text
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
      t.avatar_url as custom_avatar_url,
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
      e.title as event_title,
      e.slug as event_slug,
      e.cover_image_url
    from public.chat_thread_events cte
    join public.events e on e.id = cte.event_id
    order by cte.thread_id, cte.created_at desc, cte.id desc
  ),
  counterparts as (
    select
      p.thread_id,
      p.user_email_lc,
      coalesce(nullif(trim(pr.full_name), ''), p.user_email_lc) as display_name,
      pr.avatar_url
    from public.chat_thread_participants p
    left join public.profiles pr
      on pr.email_lc = p.user_email_lc
    where p.archived_at is null
      and p.user_email_lc <> v_user_email_lc
  ),
  previews as (
    select
      p.thread_id,
      string_agg(
        coalesce(nullif(trim(pr.full_name), ''), p.user_email_lc),
        ', '
        order by p.joined_at asc, p.user_email_lc asc
      ) as participant_preview
    from public.chat_thread_participants p
    left join public.profiles pr
      on pr.email_lc = p.user_email_lc
    where p.archived_at is null
      and p.user_email_lc <> v_user_email_lc
    group by p.thread_id
  )
  select
    t.id as thread_id,
    t.kind,
    coalesce(
      nullif(trim(t.title), ''),
      case
        when t.kind = 'direct' then counterpart.display_name
        else le.event_title
      end,
      'Chat'
    ) as title,
    case
      when t.kind = 'direct' then counterpart.display_name
      else coalesce(preview.participant_preview, 'Chat')
    end as participant_preview,
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
    le.event_title as latest_event_title,
    le.event_slug as latest_event_slug,
    coalesce(
      t.custom_avatar_url,
      case
        when t.kind = 'direct' then counterpart.avatar_url
        else le.cover_image_url
      end
    ) as avatar_url,
    counterpart.user_email_lc as counterpart_email_lc
  from my_threads t
  left join latest_events le
    on le.thread_id = t.id
  left join lateral (
    select c.user_email_lc, c.display_name, c.avatar_url
    from counterparts c
    where c.thread_id = t.id
    order by c.display_name asc, c.user_email_lc asc
    limit 1
  ) counterpart on true
  left join previews preview
    on preview.thread_id = t.id
  order by coalesce(t.last_message_at, t.created_at) desc, t.id desc;
end;
$$;

create or replace function public.get_chat_thread_details(
  p_thread_id uuid,
  p_user_email text
)
returns table(
  thread_id uuid,
  kind text,
  title text,
  participant_preview text,
  participant_count bigint,
  latest_event_id uuid,
  latest_event_title text,
  latest_event_slug text,
  avatar_url text
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
  with thread_row as (
    select
      t.id,
      t.kind,
      t.title,
      t.avatar_url as custom_avatar_url
    from public.chat_threads t
    where t.id = p_thread_id
      and t.archived_at is null
    limit 1
  ),
  latest_event as (
    select
      cte.event_id,
      e.title as event_title,
      e.slug as event_slug,
      e.cover_image_url
    from public.chat_thread_events cte
    join public.events e on e.id = cte.event_id
    where cte.thread_id = p_thread_id
    order by cte.created_at desc, cte.id desc
    limit 1
  ),
  participant_rows as (
    select
      p.user_email_lc,
      coalesce(nullif(trim(pr.full_name), ''), p.user_email_lc) as display_name,
      pr.avatar_url,
      p.joined_at
    from public.chat_thread_participants p
    left join public.profiles pr
      on pr.email_lc = p.user_email_lc
    where p.thread_id = p_thread_id
      and p.archived_at is null
  ),
  counterpart as (
    select *
    from participant_rows
    where user_email_lc <> v_user_email_lc
    order by display_name asc, user_email_lc asc
    limit 1
  ),
  preview as (
    select string_agg(display_name, ', ' order by joined_at asc, user_email_lc asc) as participant_preview
    from participant_rows
    where user_email_lc <> v_user_email_lc
  )
  select
    tr.id as thread_id,
    tr.kind,
    coalesce(
      nullif(trim(tr.title), ''),
      case
        when tr.kind = 'direct' then (select c.display_name from counterpart c)
        else (select le.event_title from latest_event le)
      end,
      'Chat'
    ) as title,
    case
      when tr.kind = 'direct' then coalesce((select c.display_name from counterpart c), 'Direct chat')
      else coalesce((select p.participant_preview from preview p), 'Chat')
    end as participant_preview,
    (
      select count(*)
      from participant_rows
    )::bigint as participant_count,
    (select le.event_id from latest_event le) as latest_event_id,
    (select le.event_title from latest_event le) as latest_event_title,
    (select le.event_slug from latest_event le) as latest_event_slug,
    coalesce(
      tr.custom_avatar_url,
      case
        when tr.kind = 'direct' then (select c.avatar_url from counterpart c)
        else (select le.cover_image_url from latest_event le)
      end,
      null
    ) as avatar_url
  from thread_row tr;
end;
$$;

create or replace function public.update_chat_thread_avatar(
  p_thread_id uuid,
  p_user_email text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_email_lc text;
  v_clean_avatar_url text;
begin
  v_user_email_lc := nullif(lower(trim(p_user_email)), '');
  v_clean_avatar_url := nullif(trim(coalesce(p_avatar_url, '')), '');

  if p_thread_id is null then
    raise exception 'thread_id_required';
  end if;

  if v_user_email_lc is null then
    raise exception 'user_email_required';
  end if;

  if not public.is_chat_thread_participant(p_thread_id, v_user_email_lc) then
    raise exception 'not_chat_thread_participant';
  end if;

  update public.chat_threads
  set
    avatar_url = v_clean_avatar_url,
    updated_at = now()
  where id = p_thread_id
    and archived_at is null;
end;
$$;

commit;
