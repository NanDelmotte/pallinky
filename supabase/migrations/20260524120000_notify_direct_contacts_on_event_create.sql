create or replace function public.enqueue_direct_contact_event_created_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_user_id uuid;
  v_host_email_lc text;
begin
  v_host_email_lc := nullif(lower(trim(new.host_email)), '');

  if v_host_email_lc is null then
    return new;
  end if;

  if coalesce(new.visibility, 2) < 2 or coalesce(new.visible_in_feed, true) is not true then
    return new;
  end if;

  select p.id
  into v_host_user_id
  from public.profiles p
  where p.email_lc = v_host_email_lc
  limit 1;

  if v_host_user_id is null then
    return new;
  end if;

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    status,
    payload
  )
  select
    new.id,
    contact_emails.recipient_email,
    'friend_event_created',
    'friend_event_created',
    'pending',
    jsonb_build_object(
      'event_id', new.id,
      'event_title', new.title,
      'event_slug', new.slug,
      'slug', new.slug,
      'host_name', new.host_name,
      'host_email', v_host_email_lc,
      'event_type', new.event_type
    )
  from (
    select distinct nullif(lower(trim(coalesce(person.email_lc, matched_profile.email_lc))), '') as recipient_email
    from public.relationships relationship
    join public.people person
      on person.id = relationship.related_person_id
    left join public.profiles matched_profile
      on matched_profile.id = person.matched_user_id
    where relationship.owner_user_id = v_host_user_id
      and relationship.relationship_type = 'direct'
  ) contact_emails
  where contact_emails.recipient_email is not null
    and contact_emails.recipient_email <> v_host_email_lc;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_direct_contact_event_created_notification on public.events;

create trigger trg_enqueue_direct_contact_event_created_notification
after insert on public.events
for each row
execute function public.enqueue_direct_contact_event_created_notification();

notify pgrst, 'reload schema';
