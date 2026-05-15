alter table public.events
add column if not exists event_url text;

alter table public.events
drop constraint if exists events_event_url_reasonable_length;

alter table public.events
add constraint events_event_url_reasonable_length
check (event_url is null or length(event_url) <= 2048);

create or replace function public.create_event_draft(
  p_title text,
  p_host_name text,
  p_host_email text,
  p_keyword text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_location text default null,
  p_description text default null,
  p_cover_image_url text default null,
  p_gif_key text default 'zen',
  p_expires_in_days integer default 14,
  p_event_type text default 'formal',
  p_proposed_dates text[] default '{}',
  p_visibility integer default 2,
  p_invite_list_visibility text default 'host_only',
  p_guest_list_visibility text default 'guests_can_see',
  p_send_rsvp_reminders boolean default false,
  p_remind_after_days integer default 3,
  p_rsvp_deadline date default null,
  p_send_final_reminder_at_deadline boolean default false,
  p_forwarding_mode text default null,
  p_event_url text default null
)
returns table(id uuid, slug text, manage_handle text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_manage text;
  v_suffix text;
  v_slug text;
  v_event_id uuid;
begin
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
    location,
    description,
    event_url,
    cover_image_url,
    gif_key,
    status,
    expires_at,
    event_type,
    proposed_dates,
    visibility,
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
    p_host_name,
    lower(trim(p_host_email)),
    p_starts_at,
    p_ends_at,
    p_location,
    p_description,
    nullif(trim(p_event_url), ''),
    p_cover_image_url,
    p_gif_key,
    'active',
    now() + (p_expires_in_days || ' days')::interval,
    p_event_type,
    p_proposed_dates,
    p_visibility,
    p_invite_list_visibility,
    p_guest_list_visibility,
    p_send_rsvp_reminders,
    p_remind_after_days,
    p_rsvp_deadline,
    p_send_final_reminder_at_deadline,
    p_forwarding_mode
  )
  returning public.events.id into v_event_id;

  insert into public.rsvps (event_id, name, email, status, guest_token)
  values (v_event_id, p_host_name, lower(trim(p_host_email)), 'yes', 'HOST-' || v_manage);

  return query
  select v_event_id as id, v_slug as slug, v_manage as manage_handle;
end;
$$;