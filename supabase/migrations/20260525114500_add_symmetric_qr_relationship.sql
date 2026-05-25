-- QR adds are an in-person mutual gesture: the scanner and QR owner should
-- both become direct relationships.

create or replace function public.add_direct_relationship_from_qr(
  p_target_profile_id uuid
)
returns table (
  scanner_relationship_id uuid,
  target_relationship_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scanner_user_id uuid := auth.uid();
  v_scanner_profile public.profiles%rowtype;
  v_target_profile public.profiles%rowtype;
  v_scanner_person_id uuid;
  v_target_person_id uuid;
  v_scanner_relationship_id uuid;
  v_target_relationship_id uuid;
begin
  if v_scanner_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_target_profile_id is null then
    raise exception 'target_profile_required';
  end if;

  if p_target_profile_id = v_scanner_user_id then
    raise exception 'cannot_add_self';
  end if;

  select *
  into v_scanner_profile
  from public.profiles
  where id = v_scanner_user_id
  limit 1;

  if v_scanner_profile.id is null or nullif(trim(v_scanner_profile.email_lc), '') is null then
    raise exception 'scanner_profile_not_found';
  end if;

  select *
  into v_target_profile
  from public.profiles
  where id = p_target_profile_id
  limit 1;

  if v_target_profile.id is null or nullif(trim(v_target_profile.email_lc), '') is null then
    raise exception 'target_profile_not_found';
  end if;

  v_scanner_person_id := public.resolve_or_create_person(
    lower(trim(v_scanner_profile.email_lc)),
    null::text,
    v_scanner_profile.id
  );

  v_target_person_id := public.resolve_or_create_person(
    lower(trim(v_target_profile.email_lc)),
    null::text,
    v_target_profile.id
  );

  insert into public.relationships (
    owner_user_id,
    related_person_id,
    relationship_type,
    source,
    updated_at
  )
  values (
    v_scanner_user_id,
    v_target_person_id,
    'direct',
    'qr',
    now()
  )
  on conflict (owner_user_id, related_person_id)
  do update set
    relationship_type = 'direct',
    source = 'qr',
    updated_at = now()
  returning id into v_scanner_relationship_id;

  insert into public.relationships (
    owner_user_id,
    related_person_id,
    relationship_type,
    source,
    updated_at
  )
  values (
    p_target_profile_id,
    v_scanner_person_id,
    'direct',
    'qr',
    now()
  )
  on conflict (owner_user_id, related_person_id)
  do update set
    relationship_type = 'direct',
    source = 'qr',
    updated_at = now()
  returning id into v_target_relationship_id;

  return query
  select v_scanner_relationship_id, v_target_relationship_id;
end;
$$;

grant execute on function public.add_direct_relationship_from_qr(uuid) to authenticated;

insert into public.relationships (
  owner_user_id,
  related_person_id,
  relationship_type,
  source,
  created_at,
  updated_at
)
select
  related_profile.id as owner_user_id,
  owner_person.id as related_person_id,
  'direct' as relationship_type,
  'qr' as source,
  relationship.created_at,
  now() as updated_at
from public.relationships relationship
join public.people related_person
  on related_person.id = relationship.related_person_id
join public.profiles related_profile
  on related_profile.id = related_person.matched_user_id
join public.profiles owner_profile
  on owner_profile.id = relationship.owner_user_id
join public.people owner_person
  on owner_person.matched_user_id = owner_profile.id
where relationship.source = 'qr'
  and relationship.relationship_type = 'direct'
  and related_person.matched_user_id is not null
on conflict (owner_user_id, related_person_id)
do update set
  relationship_type = 'direct',
  source = 'qr',
  updated_at = now();

notify pgrst, 'reload schema';
