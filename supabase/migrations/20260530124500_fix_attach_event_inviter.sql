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
    invited_by_email_lc,
    status
  )
  select
    p_event_id,
    p.user_email_lc,
    v_attached_by_email_lc,
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

commit;
