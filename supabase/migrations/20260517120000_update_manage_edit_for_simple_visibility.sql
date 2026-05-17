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
  p_requires_approval boolean default null
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
    location = p_location,
    description = p_description,
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
  boolean
) to anon, authenticated, service_role;
