-- Ensure the legacy Pallinky event URL column and the new host-provided External link column exist.
alter table public.events
  add column if not exists event_url text;

alter table public.events
  add column if not exists external_url text;

alter table public.events
  drop constraint if exists events_event_url_reasonable_length;

alter table public.events
  add constraint events_event_url_reasonable_length
  check (event_url is null or length(event_url) <= 2048)
  not valid;

alter table public.events
  drop constraint if exists events_external_url_reasonable_length;

alter table public.events
  add constraint events_external_url_reasonable_length
  check (
    external_url is null
    or btrim(external_url) = ''
    or (
      length(external_url) <= 2048
      and (
        lower(btrim(external_url)) like 'http://%'
        or lower(btrim(external_url)) like 'https://%'
      )
    )
  )
  not valid;

-- Remove every older create_event_draft overload so PostgREST exposes exactly one RPC signature.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_event_draft'
    order by p.pronargs asc
  loop
    execute format('drop function if exists %s', v_function);
  end loop;
end;
$$;

create function public.create_event_draft(
  p_title text,
  p_host_name text,
  p_host_email text,
  p_keyword text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_location text default null,
  p_description text default null,
  p_event_url text default null,
  p_cover_image_url text default null,
  p_gif_key text default 'waves',
  p_event_type text default 'vibe',
  p_proposed_dates text[] default '{}',
  p_visibility integer default 2,
  p_visible_in_feed boolean default true,
  p_requires_approval boolean default false,
  p_expires_in_days integer default 14,
  p_invite_list_visibility text default 'host_only',
  p_guest_list_visibility text default 'guests_can_see',
  p_send_rsvp_reminders boolean default false,
  p_remind_after_days integer default 3,
  p_rsvp_deadline date default null,
  p_send_final_reminder_at_deadline boolean default false,
  p_forwarding_mode text default null,
  p_event_time_zone text default null,
  p_external_url text default null
)
returns table (
  id uuid,
  slug text,
  manage_handle text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manage text;
  v_suffix text;
  v_slug text;
  v_event_id uuid;
  v_host_name text;
begin
  v_host_name := coalesce(
    nullif(trim(p_host_name), ''),
    nullif(split_part(lower(trim(p_host_email)), '@', 1), ''),
    'Host'
  );

  v_manage := md5(random()::text || clock_timestamp()::text);
  v_suffix := substring(md5(random()::text), 1, 4);
  v_slug := lower(p_keyword) || '-' || v_suffix;

  insert into public.events (
    title,
    slug,
    keyword,
    slug_suffix,
    manage_handle,
    manage_token_hash,
    host_name,
    host_email,
    starts_at,
    ends_at,
    event_time_zone,
    location,
    description,
    event_url,
    external_url,
    cover_image_url,
    gif_key,
    status,
    expires_at,
    event_type,
    proposed_dates,
    visibility,
    visible_in_feed,
    requires_approval,
    invite_list_visibility,
    guest_list_visibility,
    send_rsvp_reminders,
    remind_after_days,
    rsvp_deadline,
    send_final_reminder_at_deadline,
    forwarding_mode
  )
  values (
    p_title,
    v_slug,
    p_keyword,
    v_suffix,
    v_manage,
    encode(extensions.digest(v_manage, 'sha256'), 'hex'),
    v_host_name,
    lower(trim(p_host_email)),
    p_starts_at,
    p_ends_at,
    nullif(trim(p_event_time_zone), ''),
    p_location,
    p_description,
    nullif(trim(p_event_url), ''),
    nullif(trim(p_external_url), ''),
    p_cover_image_url,
    p_gif_key,
    'active',
    now() + (p_expires_in_days || ' days')::interval,
    p_event_type,
    p_proposed_dates,
    p_visibility,
    p_visible_in_feed,
    p_requires_approval,
    p_invite_list_visibility,
    p_guest_list_visibility,
    p_send_rsvp_reminders,
    p_remind_after_days,
    p_rsvp_deadline,
    p_send_final_reminder_at_deadline,
    p_forwarding_mode
  )
  returning public.events.id into v_event_id;

  insert into public.rsvps (
    event_id,
    name,
    email,
    status,
    guest_token
  )
  values (
    v_event_id,
    v_host_name,
    lower(trim(p_host_email)),
    'yes',
    'HOST-' || v_manage
  );

  return query
  select
    v_event_id as id,
    v_slug as slug,
    v_manage as manage_handle;
end;
$$;

create or replace function public.update_event_by_manage_token(
  p_manage_token text,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text,
  p_description text,
  p_cover_image_url text,
  p_expires_at timestamptz,
  p_gif_key text,
  p_event_type text,
  p_proposed_dates text[],
  p_visibility integer,
  p_invite_list_visibility text,
  p_guest_list_visibility text,
  p_send_rsvp_reminders boolean,
  p_remind_after_days integer,
  p_rsvp_deadline date,
  p_send_final_reminder_at_deadline boolean,
  p_forwarding_mode text,
  p_visible_in_feed boolean default null,
  p_requires_approval boolean default null,
  p_event_time_zone text default null,
  p_external_url text default '__pallinky_keep_external_url__'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set
    title = p_title,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    event_time_zone = coalesce(nullif(trim(p_event_time_zone), ''), event_time_zone),
    location = p_location,
    description = p_description,
    external_url = case
      when p_external_url = '__pallinky_keep_external_url__' then external_url
      else nullif(trim(p_external_url), '')
    end,
    cover_image_url = coalesce(p_cover_image_url, cover_image_url),
    expires_at = coalesce(p_expires_at, expires_at),
    gif_key = coalesce(p_gif_key, gif_key),
    event_type = coalesce(p_event_type, event_type),
    proposed_dates = coalesce(p_proposed_dates, proposed_dates),
    visibility = coalesce(p_visibility, visibility),
    visible_in_feed = coalesce(p_visible_in_feed, visible_in_feed),
    requires_approval = coalesce(p_requires_approval, requires_approval),
    invite_list_visibility = coalesce(p_invite_list_visibility, invite_list_visibility),
    guest_list_visibility = coalesce(p_guest_list_visibility, guest_list_visibility),
    send_rsvp_reminders = coalesce(p_send_rsvp_reminders, send_rsvp_reminders),
    remind_after_days = coalesce(p_remind_after_days, remind_after_days),
    rsvp_deadline = p_rsvp_deadline,
    send_final_reminder_at_deadline = coalesce(
      p_send_final_reminder_at_deadline,
      send_final_reminder_at_deadline
    ),
    forwarding_mode = p_forwarding_mode,
    updated_at = now()
  where manage_handle = p_manage_token
     or manage_token_hash = encode(extensions.digest(p_manage_token, 'sha256'), 'hex');
end;
$$;

notify pgrst, 'reload schema';

grant all on function public.create_event_draft(
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  integer,
  boolean,
  boolean,
  integer,
  text,
  text,
  boolean,
  integer,
  date,
  boolean,
  text,
  text,
  text
) to anon, authenticated, service_role;

grant all on function public.update_event_by_manage_token(
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text[],
  integer,
  text,
  text,
  boolean,
  integer,
  date,
  boolean,
  text,
  boolean,
  boolean,
  text,
  text
) to anon, authenticated, service_role;
