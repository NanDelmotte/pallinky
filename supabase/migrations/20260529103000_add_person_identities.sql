begin;

create table if not exists public.person_identities (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  identity_type text not null,
  identity_value text not null,
  verified_at timestamptz,
  source text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint person_identities_type_check
    check (identity_type in ('email', 'phone', 'auth_user_id')),

  constraint person_identities_value_not_blank
    check (nullif(trim(identity_value), '') is not null),

  constraint person_identities_source_check
    check (source in ('auth', 'profile', 'person', 'rsvp', 'invite', 'contact', 'circle', 'manual', 'system'))
);

create unique index if not exists person_identities_type_value_key
  on public.person_identities (identity_type, identity_value);

create index if not exists person_identities_person_id_idx
  on public.person_identities (person_id);

alter table public.person_identities enable row level security;

drop policy if exists "Users can read identities attached to visible people" on public.person_identities;
create policy "Users can read identities attached to visible people"
on public.person_identities
for select
to authenticated
using (
  exists (
    select 1
    from public.people p
    where p.id = person_id
      and (
        p.matched_user_id = auth.uid()
        or exists (
          select 1
          from public.relationships r
          where r.owner_user_id = auth.uid()
            and r.related_person_id = p.id
        )
      )
  )
);

insert into public.person_identities (person_id, identity_type, identity_value, verified_at, source)
select id, 'email', lower(trim(email_lc)), null, 'person'
from public.people
where nullif(trim(email_lc), '') is not null
on conflict (identity_type, identity_value) do nothing;

insert into public.person_identities (person_id, identity_type, identity_value, verified_at, source)
select id, 'phone', trim(phone_e164), null, 'person'
from public.people
where nullif(trim(phone_e164), '') is not null
on conflict (identity_type, identity_value) do nothing;

insert into public.person_identities (person_id, identity_type, identity_value, verified_at, source)
select id, 'auth_user_id', matched_user_id::text, now(), 'auth'
from public.people
where matched_user_id is not null
on conflict (identity_type, identity_value) do nothing;

insert into public.person_identities (person_id, identity_type, identity_value, verified_at, source)
select pe.id, 'email', lower(trim(pr.email_lc)), now(), 'profile'
from public.profiles pr
join public.people pe
  on pe.matched_user_id = pr.id
where nullif(trim(pr.email_lc), '') is not null
on conflict (identity_type, identity_value) do nothing;

create or replace function public.person_identity_ref_count(p_person_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select
    (
      select count(*) from public.relationships r
      where r.related_person_id = p_person_id
    )
    + (
      select count(*) from public.rsvps r
      where r.person_id = p_person_id
    )
    + (
      select count(*) from public.event_invites ei
      where ei.person_id = p_person_id
    )
    + (
      select count(*) from public.social_circle_members scm
      where scm.person_id = p_person_id
    )
    + (
      select count(*) from public.device_contacts dc
      where dc.person_id = p_person_id
    );
$$;

create or replace function public.merge_people(
  p_canonical_person_id uuid,
  p_duplicate_person_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical public.people%rowtype;
  v_duplicate public.people%rowtype;
  v_duplicate_email text;
  v_duplicate_phone text;
begin
  if p_canonical_person_id is null or p_duplicate_person_id is null then
    raise exception 'person_id_required';
  end if;

  if p_canonical_person_id = p_duplicate_person_id then
    return p_canonical_person_id;
  end if;

  select * into v_canonical
  from public.people
  where id = p_canonical_person_id
  for update;

  select * into v_duplicate
  from public.people
  where id = p_duplicate_person_id
  for update;

  if v_canonical.id is null or v_duplicate.id is null then
    raise exception 'person_not_found';
  end if;

  v_duplicate_email := v_duplicate.email_lc;
  v_duplicate_phone := v_duplicate.phone_e164;

  insert into public.person_identities (person_id, identity_type, identity_value, verified_at, source)
  select p_canonical_person_id, identity_type, identity_value, verified_at, source
  from public.person_identities
  where person_id = p_duplicate_person_id
  on conflict (identity_type, identity_value) do update
    set person_id = excluded.person_id,
        verified_at = coalesce(public.person_identities.verified_at, excluded.verified_at),
        updated_at = now();

  if v_duplicate.email_lc is not null then
    insert into public.person_identities (person_id, identity_type, identity_value, source)
    values (p_canonical_person_id, 'email', lower(trim(v_duplicate.email_lc)), 'person')
    on conflict (identity_type, identity_value) do update
      set person_id = excluded.person_id,
          updated_at = now();
  end if;

  if v_duplicate.phone_e164 is not null then
    insert into public.person_identities (person_id, identity_type, identity_value, source)
    values (p_canonical_person_id, 'phone', trim(v_duplicate.phone_e164), 'person')
    on conflict (identity_type, identity_value) do update
      set person_id = excluded.person_id,
          updated_at = now();
  end if;

  if v_duplicate.matched_user_id is not null then
    insert into public.person_identities (person_id, identity_type, identity_value, verified_at, source)
    values (p_canonical_person_id, 'auth_user_id', v_duplicate.matched_user_id::text, now(), 'auth')
    on conflict (identity_type, identity_value) do update
      set person_id = excluded.person_id,
          verified_at = coalesce(public.person_identities.verified_at, excluded.verified_at),
          updated_at = now();
  end if;

  delete from public.relationships r
  where r.related_person_id = p_duplicate_person_id
    and exists (
      select 1
      from public.relationships existing
      where existing.owner_user_id = r.owner_user_id
        and existing.related_person_id = p_canonical_person_id
    );

  update public.relationships
  set related_person_id = p_canonical_person_id,
      updated_at = now()
  where related_person_id = p_duplicate_person_id;

  update public.rsvps
  set person_id = p_canonical_person_id,
      updated_at = now()
  where person_id = p_duplicate_person_id;

  update public.event_invites
  set person_id = p_canonical_person_id
  where person_id = p_duplicate_person_id;

  update public.social_circle_members
  set person_id = p_canonical_person_id
  where person_id = p_duplicate_person_id;

  update public.device_contacts
  set person_id = p_canonical_person_id,
      matched_user_id = coalesce(matched_user_id, v_canonical.matched_user_id, v_duplicate.matched_user_id),
      updated_at = now()
  where person_id = p_duplicate_person_id;

  update public.people
  set email_lc = null,
      phone_e164 = null,
      matched_user_id = null
  where id = p_duplicate_person_id;

  delete from public.people
  where id = p_duplicate_person_id;

  update public.people
  set
    email_lc = coalesce(public.people.email_lc, v_duplicate_email),
    phone_e164 = coalesce(public.people.phone_e164, v_duplicate_phone),
    matched_user_id = coalesce(public.people.matched_user_id, v_duplicate.matched_user_id)
  where id = p_canonical_person_id;

  return p_canonical_person_id;
end;
$$;

create or replace function public.resolve_or_create_person(
  p_email_lc text,
  p_phone_e164 text,
  p_matched_user_id uuid default null::uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_phone text;
  v_auth_value text;
  v_person_id uuid;
  v_other_person_id uuid;
  v_email_person_id uuid;
  v_phone_person_id uuid;
  v_auth_person_id uuid;
  v_trusted_matched_user_id uuid;
  v_allow_auth_merge boolean;
begin
  v_email := nullif(lower(trim(p_email_lc)), '');
  v_phone := nullif(trim(p_phone_e164), '');
  v_trusted_matched_user_id := null;

  if p_matched_user_id is not null
    and (
      auth.uid() is null
      or auth.uid() = p_matched_user_id
      or exists (
        select 1
        from public.profiles p
        where p.id = p_matched_user_id
          and v_email is not null
          and p.email_lc = v_email
      )
    )
  then
    v_trusted_matched_user_id := p_matched_user_id;
  end if;

  v_auth_value := case
    when v_trusted_matched_user_id is null then null
    else v_trusted_matched_user_id::text
  end;
  v_allow_auth_merge := v_trusted_matched_user_id is not null
    and (
      auth.uid() is null
      or auth.uid() = v_trusted_matched_user_id
    );

  if v_email is null and v_phone is null and v_trusted_matched_user_id is null then
    return null;
  end if;

  if v_email is not null then
    select person_id into v_email_person_id
    from public.person_identities
    where identity_type = 'email'
      and identity_value = v_email
    limit 1;

    if v_email_person_id is null then
      select id into v_email_person_id
      from public.people
      where email_lc = v_email
      limit 1;
    end if;
  end if;

  if v_phone is not null then
    select person_id into v_phone_person_id
    from public.person_identities
    where identity_type = 'phone'
      and identity_value = v_phone
    limit 1;

    if v_phone_person_id is null then
      select id into v_phone_person_id
      from public.people
      where phone_e164 = v_phone
      limit 1;
    end if;
  end if;

  if v_auth_value is not null then
    select person_id into v_auth_person_id
    from public.person_identities
    where identity_type = 'auth_user_id'
      and identity_value = v_auth_value
    limit 1;

    if v_auth_person_id is null then
      select id into v_auth_person_id
      from public.people
      where matched_user_id = v_trusted_matched_user_id
      limit 1;
    end if;
  end if;

  select person_id into v_person_id
  from (
    select v_email_person_id as person_id
    union
    select v_phone_person_id
    union
    select v_auth_person_id
  ) candidates
  where person_id is not null
    and (
      v_allow_auth_merge
      or person_id is distinct from v_auth_person_id
      or (v_email_person_id is null and v_phone_person_id is null)
    )
  order by public.person_identity_ref_count(person_id) desc, person_id
  limit 1;

  if v_person_id is null then
    begin
      insert into public.people (email_lc, phone_e164, matched_user_id)
      values (v_email, v_phone, v_trusted_matched_user_id)
      returning id into v_person_id;
    exception
      when unique_violation then
        select id into v_person_id
        from public.people
        where (v_email is not null and email_lc = v_email)
           or (v_phone is not null and phone_e164 = v_phone)
           or (v_trusted_matched_user_id is not null and matched_user_id = v_trusted_matched_user_id)
        order by public.person_identity_ref_count(id) desc, id
        limit 1;
    end;
  end if;

  for v_other_person_id in
    select distinct person_id
    from (
      select v_email_person_id as person_id
      union all
      select v_phone_person_id
      union all
      select v_auth_person_id
    ) candidates
    where person_id is not null
      and person_id <> v_person_id
      and (
        v_allow_auth_merge
        or (
          person_id is distinct from v_auth_person_id
          and v_person_id is distinct from v_auth_person_id
        )
      )
  loop
    perform public.merge_people(v_person_id, v_other_person_id);
  end loop;

  update public.people
  set
    email_lc = case
      when public.people.email_lc is null and v_email is not null
      then v_email
      else public.people.email_lc
    end,
    phone_e164 = case
      when public.people.phone_e164 is null and v_phone is not null
      then v_phone
      else public.people.phone_e164
    end,
    matched_user_id = coalesce(public.people.matched_user_id, v_trusted_matched_user_id)
  where id = v_person_id;

  if v_email is not null then
    insert into public.person_identities (person_id, identity_type, identity_value, source)
    values (v_person_id, 'email', v_email, 'person')
    on conflict (identity_type, identity_value) do nothing;
  end if;

  if v_phone is not null then
    insert into public.person_identities (person_id, identity_type, identity_value, source)
    values (v_person_id, 'phone', v_phone, 'person')
    on conflict (identity_type, identity_value) do nothing;
  end if;

  if v_trusted_matched_user_id is not null then
    insert into public.person_identities (person_id, identity_type, identity_value, verified_at, source)
    values (v_person_id, 'auth_user_id', v_trusted_matched_user_id::text, now(), 'auth')
    on conflict (identity_type, identity_value) do nothing;
  end if;

  return v_person_id;
end;
$$;

create or replace function public.resolve_or_create_person(
  p_email_lc text,
  p_phone_e164 text,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.resolve_or_create_person(p_email_lc, p_phone_e164, null::uuid);
end;
$$;

create or replace function public.match_device_contacts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.device_contacts dc
  set
    matched_user_id = coalesce(p.id, matched_person.matched_user_id, dc.matched_user_id),
    person_id = coalesce(dc.person_id, pi.person_id)
  from public.person_identities pi
  join public.people matched_person
    on matched_person.id = pi.person_id
  left join public.profiles p
    on p.id = matched_person.matched_user_id
    or (
      pi.identity_type = 'email'
      and p.email_lc = pi.identity_value
    )
  where dc.user_id = v_user_id
    and dc.email_lc is not null
    and pi.identity_type = 'email'
    and pi.identity_value = dc.email_lc
    and (
      dc.person_id is distinct from pi.person_id
      or dc.matched_user_id is distinct from coalesce(p.id, matched_person.matched_user_id, dc.matched_user_id)
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

drop function if exists public.get_my_device_contacts();

create or replace function public.get_my_device_contacts()
returns table (
  id uuid,
  display_name text,
  email_lc text,
  phone_e164 text,
  avatar_uri text,
  device_contact_id text,
  matched_user_id uuid,
  person_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    dc.id,
    dc.display_name,
    dc.email_lc,
    dc.phone_e164,
    dc.avatar_uri,
    dc.device_contact_id,
    dc.matched_user_id,
    dc.person_id
  from public.device_contacts dc
  where dc.user_id = auth.uid();
$$;

create or replace function public.add_device_contacts_to_circle(
  p_circle_id uuid,
  p_contact_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.social_circles sc
    where sc.id = p_circle_id
      and sc.user_id = v_user_id
  ) then
    raise exception 'circle_not_found';
  end if;

  update public.device_contacts dc
  set
    person_id = coalesce(
      dc.person_id,
      public.resolve_or_create_person(dc.email_lc, dc.phone_e164, dc.matched_user_id)
    ),
    updated_at = now()
  where dc.user_id = v_user_id
    and dc.id = any(p_contact_ids)
    and dc.person_id is null
    and (dc.email_lc is not null or dc.phone_e164 is not null);

  insert into public.social_circle_members (
    circle_id,
    member_name,
    member_email_lc,
    member_phone_e164,
    member_user_id,
    device_contact_id,
    person_id
  )
  select
    p_circle_id,
    dc.display_name,
    dc.email_lc,
    dc.phone_e164,
    dc.matched_user_id,
    dc.id,
    dc.person_id
  from public.device_contacts dc
  where dc.user_id = v_user_id
    and dc.id = any(p_contact_ids)
    and dc.person_id is not null
    and not exists (
      select 1
      from public.social_circle_members scm
      where scm.circle_id = p_circle_id
        and (
          scm.device_contact_id = dc.id
          or scm.person_id = dc.person_id
        )
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.merge_people(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_or_create_person(text, text, uuid) to authenticated;
grant execute on function public.resolve_or_create_person(text, text, text) to authenticated, anon;
grant execute on function public.match_device_contacts() to authenticated;
grant execute on function public.get_my_device_contacts() to authenticated;
grant execute on function public.add_device_contacts_to_circle(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';

commit;
