create or replace function public.set_event_host_name_fallback()
returns trigger
language plpgsql
as $$
begin
  new.host_name := coalesce(
    nullif(trim(new.host_name), ''),
    nullif(split_part(lower(trim(new.host_email)), '@', 1), ''),
    'Host'
  );

  return new;
end;
$$;

drop trigger if exists trg_set_event_host_name_fallback on public.events;

create trigger trg_set_event_host_name_fallback
before insert or update of host_name, host_email
on public.events
for each row
execute function public.set_event_host_name_fallback();