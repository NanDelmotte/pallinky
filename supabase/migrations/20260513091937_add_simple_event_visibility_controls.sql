-- supabase/migrations/YYYYMMDDHHMMSS_add_simple_event_visibility_controls.sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_simple_event_visibility_controls.sql

alter table public.events
add column if not exists visible_in_feed boolean not null default true,
add column if not exists requires_approval boolean not null default false;

update public.events
set visible_in_feed = true
where visible_in_feed = false;

create index if not exists idx_events_visible_in_feed
on public.events using btree (visible_in_feed);
