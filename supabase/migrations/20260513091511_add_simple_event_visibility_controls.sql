-- supabase/migrations/YYYYMMDDHHMMSS_add_simple_event_visibility_controls.sql

alter table public.events
add column if not exists visible_in_feed boolean not null default false,
add column if not exists requires_approval boolean not null default false;

create index if not exists idx_events_visible_in_feed
on public.events using btree (visible_in_feed);

comment on column public.events.visible_in_feed is
'If true, event may appear in Friends Plans / social feed. If false, event is link-only.';

comment on column public.events.requires_approval is
'If true, RSVPs become pending approval instead of accepted directly.';