-- Fix chat message notification trigger to use the actual chat_thread_events timestamp.

create or replace function public.enqueue_chat_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.chat_threads%rowtype;
  v_sender_email_lc text;
  v_sender_name text;
  v_preview text;
  v_linked_event_id uuid;
  v_linked_event_title text;
begin
  v_sender_email_lc := nullif(lower(trim(new.sender_email_lc)), '');

  if v_sender_email_lc is null then
    return new;
  end if;

  if new.message_type not in ('text', 'image') then
    return new;
  end if;

  select *
  into v_thread
  from public.chat_threads
  where id = new.thread_id
  limit 1;

  if v_thread.id is null then
    return new;
  end if;

  select nullif(trim(p.full_name), '')
  into v_sender_name
  from public.profiles p
  where p.email_lc = v_sender_email_lc
  limit 1;

  select e.id, e.title
  into v_linked_event_id, v_linked_event_title
  from public.chat_thread_events cte
  join public.events e
    on e.id = cte.event_id
  where cte.thread_id = new.thread_id
  order by cte.created_at desc, cte.id desc
  limit 1;

  v_preview := coalesce(
    nullif(trim(new.body), ''),
    case when nullif(trim(new.image_url), '') is not null then 'Photo' end,
    'New message'
  );

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    status,
    payload
  )
  select
    v_linked_event_id,
    participant.user_email_lc,
    'chat_message_batch',
    'chat_message_batch',
    'pending',
    jsonb_build_object(
      'thread_id', new.thread_id,
      'message_id', new.id,
      'sender_email', v_sender_email_lc,
      'sender_name', coalesce(v_sender_name, split_part(v_sender_email_lc, '@', 1), 'Someone'),
      'body', v_preview,
      'preview', v_preview,
      'thread_title', coalesce(nullif(trim(v_thread.title), ''), v_linked_event_title, 'Chat'),
      'chat_kind', v_thread.kind,
      'event_id', v_linked_event_id,
      'event_title', v_linked_event_title
    )
  from public.chat_thread_participants participant
  where participant.thread_id = new.thread_id
    and participant.archived_at is null
    and participant.user_email_lc <> v_sender_email_lc;

  return new;
end;
$$;

notify pgrst, 'reload schema';
