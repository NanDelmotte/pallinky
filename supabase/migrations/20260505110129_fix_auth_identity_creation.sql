-- supabase/migrations/20260505_fix_auth_identity_creation.sql

begin;

-- 1. Ensure new auth users always get both profile + person identity.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email_lc,
    full_name,
    created_at,
    updated_at
  )
  values (
    new.id,
    lower(new.email),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    now(),
    now()
  )
  on conflict (id) do update
  set
    email_lc = excluded.email_lc,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();

  perform public.resolve_or_create_person(
    lower(new.email),
    null::text,
    new.id
  );

  return new;
end;
$$;


-- 2. Recreate missing auth.users trigger.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();


-- 3. Backfill missing profiles for existing auth users.
insert into public.profiles (
  id,
  email_lc,
  full_name,
  created_at,
  updated_at
)
select
  u.id,
  lower(u.email),
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name'
  ),
  now(),
  now()
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
)
on conflict (id) do update
set
  email_lc = excluded.email_lc,
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  updated_at = now();


-- 4. Backfill people records and matched_user_id for existing auth users.
select public.resolve_or_create_person(
  lower(u.email),
  null::text,
  u.id
)
from auth.users u
where u.email is not null;


commit;