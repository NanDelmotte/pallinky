-- Ensure table exists (no-op if already there)
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

drop policy if exists "Public read app config" on public.app_config;

create policy "Public read app config"
on public.app_config
for select
using (true);

-- Replace existing config with simple version-based model
insert into public.app_config (key, value)
values (
  'mobile_force_update',
  jsonb_build_object(
    'minimum_ios_version', '1.0.8',
    'app_store_url', 'https://apps.apple.com/app/pallinky/id6760797135',
    'message', 'Please update Pallinky to continue.'
  )
)
on conflict (key)
do update set
  value = excluded.value,
  updated_at = now();