-- 1. Backfill existing bad names
update events e
set host_name = p.full_name
from profiles p
where lower(e.host_email) = lower(p.email_lc)
  and p.full_name is not null
  and trim(p.full_name) <> ''
  and e.host_name is distinct from p.full_name;

-- 2. Create function to force host name from profile
create or replace function public.set_event_host_name_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.full_name
  into new.host_name
  from public.profiles p
  where lower(p.email_lc) = lower(new.host_email)
    and p.full_name is not null
    and trim(p.full_name) <> ''
  limit 1;

  return new;
end;
$$;

-- 3. Add trigger on events
drop trigger if exists trg_set_event_host_name_from_profile on public.events;

create trigger trg_set_event_host_name_from_profile
before insert or update of host_email, host_name
on public.events
for each row
execute function public.set_event_host_name_from_profile();

-- 4. Sync events when profile updates
create or replace function public.sync_profile_name_to_hosted_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set host_name = new.full_name
  where lower(host_email) = lower(new.email_lc)
    and new.full_name is not null
    and trim(new.full_name) <> '';

  return new;
end;
$$;

-- 5. Add trigger on profiles
drop trigger if exists trg_sync_profile_name_to_hosted_events on public.profiles;

create trigger trg_sync_profile_name_to_hosted_events
after update of full_name
on public.profiles
for each row
execute function public.sync_profile_name_to_hosted_events();