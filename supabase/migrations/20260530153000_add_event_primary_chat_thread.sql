begin;

create or replace function public.sync_event_participants_to_chat_thread(
  p_thread_id uuid,
  p_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type text;
begin
  if p_thread_id is null or p_event_id is null then
    return;
  end if;

  select coalesce(e.event_type, 'formal')
  into v_event_type
  from public.events e
  where e.id = p_event_id
  limit 1;

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
    eligible.email_lc,
    eligible.role,
    now(),
    null,
    case when eligible.role = 'owner' then now() else null end
  from (
    select
      normalized.email_lc,
      case
        when bool_or(normalized.role = 'owner') then 'owner'::text
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
    ) normalized
    where normalized.email_lc is not null
    group by normalized.email_lc
  ) eligible
  on conflict (thread_id, user_email_lc)
  do update set
    archived_at = null,
    updated_at = now();
end;
$$;

create or replace function public.get_or_create_event_primary_chat_thread(
  p_event_id uuid,
  p_user_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
  v_host_email_lc text;
begin
  if p_event_id is null then
    raise exception 'event_id_required';
  end if;

  select cte.thread_id
  into v_thread_id
  from public.chat_thread_events cte
  where cte.event_id = p_event_id
  order by cte.created_at asc, cte.id asc
  limit 1;

  if v_thread_id is null then
    select lower(trim(e.host_email))
    into v_host_email_lc
    from public.events e
    where e.id = p_event_id
    limit 1;

    if v_host_email_lc is null then
      raise exception 'event_not_found';
    end if;

    v_thread_id := public.create_chat_thread(
      p_creator_email := v_host_email_lc,
      p_title := null,
      p_participant_emails := '{}'::text[],
      p_kind := 'group'
    );

    perform public.attach_event_to_chat_thread(
      p_thread_id := v_thread_id,
      p_event_id := p_event_id,
      p_attached_by_email := v_host_email_lc
    );
  end if;

  perform public.sync_event_participants_to_chat_thread(v_thread_id, p_event_id);

  return v_thread_id;
end;
$$;

create or replace function public.sync_primary_chat_thread_from_rsvp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_thread_id uuid;
begin
  v_event_id := coalesce(new.event_id, old.event_id);

  if v_event_id is null then
    return coalesce(new, old);
  end if;

  select cte.thread_id
  into v_thread_id
  from public.chat_thread_events cte
  where cte.event_id = v_event_id
  order by cte.created_at asc, cte.id asc
  limit 1;

  if v_thread_id is not null then
    perform public.sync_event_participants_to_chat_thread(v_thread_id, v_event_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_primary_chat_thread_from_rsvp on public.rsvps;
create trigger trg_sync_primary_chat_thread_from_rsvp
after insert or update or delete on public.rsvps
for each row
execute function public.sync_primary_chat_thread_from_rsvp();

commit;
