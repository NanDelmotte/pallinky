create or replace function public.create_event_draft(
  p_description text,
  p_ends_at timestamptz,
  p_event_type text,
  p_expires_in_days integer,
  p_host_email text,
  p_host_name text,
  p_keyword text,
  p_location text,
  p_remind_after_days integer,
  p_requires_approval boolean,
  p_rsvp_deadline date,
  p_send_final_reminder_at_deadline boolean,
  p_send_rsvp_reminders boolean,
  p_starts_at timestamptz,
  p_title text,
  p_visible_in_feed boolean
)
returns table (
  id uuid,
  slug text,
  manage_handle text
)
language sql
security definer
set search_path = public
as $$
  select *
  from public.create_event_draft(
    p_title := p_title,
    p_host_name := p_host_name,
    p_host_email := p_host_email,
    p_keyword := p_keyword,
    p_starts_at := p_starts_at,
    p_ends_at := p_ends_at,
    p_location := p_location,
    p_description := p_description,
    p_event_url := null,
    p_cover_image_url := null,
    p_gif_key := 'waves',
    p_event_type := p_event_type,
    p_proposed_dates := '{}',
    p_visibility := 2,
    p_visible_in_feed := p_visible_in_feed,
    p_requires_approval := p_requires_approval,
    p_expires_in_days := p_expires_in_days,
    p_invite_list_visibility := 'host_only',
    p_guest_list_visibility := 'guests_can_see',
    p_send_rsvp_reminders := p_send_rsvp_reminders,
    p_remind_after_days := p_remind_after_days,
    p_rsvp_deadline := p_rsvp_deadline,
    p_send_final_reminder_at_deadline := p_send_final_reminder_at_deadline,
    p_forwarding_mode := null
  );
$$;

notify pgrst, 'reload schema';