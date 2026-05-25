-- Keep the relationships table as the canonical source of direct connections.
-- Adding someone to a circle is an explicit people-management action, so it
-- should also create/update the owner's direct relationship to that person.

create or replace function public.sync_circle_member_relationship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
begin
  if new.person_id is null then
    return new;
  end if;

  select sc.user_id
  into v_owner_user_id
  from public.social_circles sc
  where sc.id = new.circle_id
  limit 1;

  if v_owner_user_id is null then
    return new;
  end if;

  insert into public.relationships (
    owner_user_id,
    related_person_id,
    relationship_type,
    source,
    created_at,
    updated_at
  )
  values (
    v_owner_user_id,
    new.person_id,
    'direct',
    'imported_circle',
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (owner_user_id, related_person_id)
  do update set
    relationship_type = 'direct',
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_circle_member_relationship on public.social_circle_members;

create trigger trg_sync_circle_member_relationship
after insert or update of person_id, circle_id
on public.social_circle_members
for each row
execute function public.sync_circle_member_relationship();

insert into public.relationships (
  owner_user_id,
  related_person_id,
  relationship_type,
  source,
  created_at,
  updated_at
)
select distinct
  sc.user_id,
  scm.person_id,
  'direct',
  'imported_circle',
  coalesce(scm.created_at, now()),
  now()
from public.social_circle_members scm
join public.social_circles sc
  on sc.id = scm.circle_id
where scm.person_id is not null
on conflict (owner_user_id, related_person_id)
do update set
  relationship_type = 'direct',
  updated_at = now();

notify pgrst, 'reload schema';
