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
          (v_event_type <> 'formal' and lower(trim(coalesce(r.status, ''))) in ('interested', 'yes', 'maybe', 'going', 'voted'))
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

do $$
declare
  v_link record;
begin
  for v_link in
    select cte.thread_id, cte.event_id
    from public.chat_thread_events cte
  loop
    perform public.sync_event_participants_to_chat_thread(v_link.thread_id, v_link.event_id);
  end loop;
end;
$$;

commit;
