begin;

create or replace function public.rename_chat_thread(
  p_thread_id uuid,
  p_user_email text,
  p_title text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_email_lc text;
  v_clean_title text;
begin
  v_user_email_lc := nullif(lower(trim(p_user_email)), '');
  v_clean_title := nullif(trim(p_title), '');

  if p_thread_id is null then
    raise exception 'thread_id_required';
  end if;

  if v_user_email_lc is null then
    raise exception 'user_email_required';
  end if;

  if v_clean_title is null then
    raise exception 'title_required';
  end if;

  if not public.is_chat_thread_participant(p_thread_id, v_user_email_lc) then
    raise exception 'not_chat_thread_participant';
  end if;

  update public.chat_threads
  set
    title = v_clean_title,
    updated_at = now()
  where id = p_thread_id
    and archived_at is null;
end;
$$;

commit;
