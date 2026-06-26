begin;

-- Align access decisions with the simplified visibility product language:
-- visibility = 1 means invite-only, while visibility = 2 means people can see
-- the event and respond from a shared web link. Approval remains controlled by
-- requires_approval / forwarding_mode.

create or replace function public.get_event_access_decision(
  p_event_id uuid,
  p_viewer_email text default null,
  p_viewer_phone_e164 text default null,
  p_guest_token text default null
)
returns table (
  can_see boolean,
  can_rsvp boolean,
  can_see_guest_list boolean,
  is_host boolean,
  is_direct_invitee boolean,
  is_network_qualified boolean,
  has_existing_rsvp boolean,
  requires_host_approval boolean,
  visibility integer,
  forwarding_mode text,
  reason text
)
language plpgsql
security definer
as $$
declare
  v_event public.events%rowtype;
  v_invite public.event_invites%rowtype;
  v_rsvp public.rsvps%rowtype;
  v_viewer_email_lc text;
  v_viewer_phone text;
  v_guest_token text;
  v_host_email_lc text;
  v_viewer_user_id uuid;
  v_host_user_id uuid;
  v_can_see boolean := false;
  v_can_rsvp boolean := false;
  v_can_see_guest_list boolean := false;
  v_is_host boolean := false;
  v_is_direct_invitee boolean := false;
  v_is_network_qualified boolean := false;
  v_has_existing_rsvp boolean := false;
  v_requires_host_approval boolean := false;
  v_reason text := 'not_found';
  v_visibility integer;
  v_forwarding_mode text;
  v_in_host_social_circles boolean := false;
  v_shared_rsvp_history boolean := false;
  v_in_viewer_imported_contacts boolean := false;
  v_in_host_imported_contacts boolean := false;
  v_has_relationship boolean := false;
  v_token_consumed_by_other boolean := false;
begin
  v_viewer_email_lc := nullif(lower(trim(p_viewer_email)), '');
  v_viewer_phone := nullif(trim(p_viewer_phone_e164), '');
  v_guest_token := nullif(trim(p_guest_token), '');

  select * into v_event
  from public.events
  where id = p_event_id
  limit 1;

  if v_event.id is null then
    return query
    select false,false,false,false,false,false,false,false,null::int,null::text,'not_found';
    return;
  end if;

  v_visibility := coalesce(v_event.visibility, 2);
  v_forwarding_mode := v_event.forwarding_mode;
  v_host_email_lc := lower(trim(v_event.host_email));

  select ei.* into v_invite
  from public.event_invites ei
  join public.events invited_event on invited_event.id = ei.event_id
  where ei.revoked_at is null
    and (
      ei.event_id = p_event_id
      or (v_event.series_id is not null and invited_event.series_id = v_event.series_id)
    )
    and (
      (v_guest_token is not null and ei.guest_token = v_guest_token)
      or (v_viewer_email_lc is not null and ei.invitee_email_lc = v_viewer_email_lc)
      or (v_viewer_phone is not null and ei.invitee_phone_e164 = v_viewer_phone)
    )
  order by
    case when ei.event_id = p_event_id then 0 else 1 end,
    case when v_guest_token is not null and ei.guest_token = v_guest_token then 0 else 1 end,
    ei.created_at desc
  limit 1;

  if v_invite.id is not null
    and coalesce(v_invite.invite_link_mode, 'single') = 'single'
    and v_guest_token is not null then
    select exists (
      select 1
      from public.rsvps used
      where used.event_id = p_event_id
        and used.guest_token = v_guest_token
        and (
          v_viewer_email_lc is null
          or used.email_lc is null
          or lower(trim(used.email_lc)) <> v_viewer_email_lc
        )
    ) into v_token_consumed_by_other;

    if v_token_consumed_by_other then
      v_invite := null;
    end if;
  end if;

  select r.* into v_rsvp
  from public.rsvps r
  join public.events rsvp_event on rsvp_event.id = r.event_id
  where (
      r.event_id = p_event_id
      or (v_event.series_id is not null and rsvp_event.series_id = v_event.series_id)
    )
    and (
      (v_viewer_email_lc is not null and r.email_lc = v_viewer_email_lc)
      or (v_viewer_phone is not null and r.phone_e164 = v_viewer_phone)
      or (v_guest_token is not null and r.guest_token = v_guest_token)
    )
  order by
    case when r.event_id = p_event_id then 0 else 1 end,
    r.updated_at desc,
    r.responded_at desc
  limit 1;

  v_is_host := v_viewer_email_lc is not null and v_host_email_lc = v_viewer_email_lc;
  v_is_direct_invitee := v_invite.id is not null;
  v_has_existing_rsvp := v_rsvp.id is not null;

  select p.id into v_viewer_user_id
  from public.profiles p
  where p.email_lc = v_viewer_email_lc
  limit 1;

  select p.id into v_host_user_id
  from public.profiles p
  where p.email_lc = v_host_email_lc
  limit 1;

  if v_viewer_email_lc is not null and v_host_email_lc is not null then
    select exists (
      select 1
      from public.social_circle_members scm
      join public.social_circles sc on sc.id = scm.circle_id
      where sc.user_id = v_host_user_id
        and (
          scm.member_email_lc = v_viewer_email_lc
          or (scm.member_user_id is not null and scm.member_user_id = v_viewer_user_id)
        )
    ) into v_in_host_social_circles;

    select exists (
      select 1
      from public.rsvps mine
      join public.rsvps other on other.event_id = mine.event_id
      where mine.email_lc = v_viewer_email_lc
        and other.email_lc = v_host_email_lc
    ) into v_shared_rsvp_history;

    select exists (
      select 1
      from public.device_contacts dc
      where dc.user_id = v_viewer_user_id
        and (
          dc.email_lc = v_host_email_lc
          or (dc.matched_user_id is not null and dc.matched_user_id = v_host_user_id)
        )
    ) into v_in_viewer_imported_contacts;

    select exists (
      select 1
      from public.device_contacts dc
      where dc.user_id = v_host_user_id
        and (
          dc.email_lc = v_viewer_email_lc
          or (dc.matched_user_id is not null and dc.matched_user_id = v_viewer_user_id)
        )
    ) into v_in_host_imported_contacts;

    select exists (
      select 1
      from public.relationships r
      where (
        r.owner_user_id = v_host_user_id
        and r.related_person_id in (
          select p.id from public.people p where p.email_lc = v_viewer_email_lc
        )
      )
      or (
        r.owner_user_id = v_viewer_user_id
        and r.related_person_id in (
          select p.id from public.people p where p.email_lc = v_host_email_lc
        )
      )
    ) into v_has_relationship;
  end if;

  v_is_network_qualified := (
    v_in_host_social_circles
    or v_shared_rsvp_history
    or v_in_viewer_imported_contacts
    or v_in_host_imported_contacts
    or v_has_relationship
  );

  v_can_see := case
    when v_is_host then true
    when v_has_existing_rsvp then true
    when v_visibility = 1 then v_is_direct_invitee
    when v_visibility in (2, 3) then true
    else false
  end;

  if v_is_host or v_has_existing_rsvp then
    v_requires_host_approval := false;
  elsif coalesce(v_invite.requires_host_approval, false) then
    v_requires_host_approval := true;
  elsif v_is_direct_invitee then
    v_requires_host_approval := false;
  elsif coalesce(v_event.requires_approval, false) then
    v_requires_host_approval := true;
  elsif v_forwarding_mode = 'host_approval' then
    v_requires_host_approval := true;
  elsif v_forwarding_mode = 'no_forwarding' and not v_is_direct_invitee then
    v_requires_host_approval := false;
  elsif v_visibility = 1 and not v_is_direct_invitee then
    v_requires_host_approval := true;
  else
    v_requires_host_approval := false;
  end if;

  if not v_can_see then
    v_can_rsvp := false;
  elsif v_is_host then
    v_can_rsvp := true;
  elsif v_requires_host_approval then
    v_can_rsvp := true;
  elsif v_visibility = 1 then
    v_can_rsvp := v_is_direct_invitee;
  elsif v_visibility = 2 then
    v_can_rsvp := (coalesce(v_forwarding_mode, '') <> 'no_forwarding');
  elsif v_visibility = 3 then
    v_can_rsvp := (coalesce(v_forwarding_mode, '') <> 'no_forwarding');
  else
    v_can_rsvp := false;
  end if;

  v_can_see_guest_list := (
    v_is_host
    or (
      v_event.guest_list_visibility = 'guests_can_see'
      and (v_has_existing_rsvp or v_is_direct_invitee)
    )
  );

  if v_is_host then
    v_reason := 'host';
  elsif v_has_existing_rsvp then
    v_reason := 'existing_rsvp';
  elsif v_requires_host_approval then
    v_reason := 'approval_required';
  elsif v_is_direct_invitee then
    v_reason := 'direct_invitee';
  elsif v_visibility = 2 then
    if coalesce(v_forwarding_mode, '') = 'no_forwarding' and not v_can_rsvp then
      v_reason := 'forwarding_blocked';
    else
      v_reason := 'visible_event';
    end if;
  elsif v_visibility = 3 then
    if coalesce(v_forwarding_mode, '') = 'no_forwarding' and not v_can_rsvp then
      v_reason := 'forwarding_blocked';
    else
      v_reason := 'public_event';
    end if;
  elsif v_token_consumed_by_other then
    v_reason := 'invite_already_used';
  else
    v_reason := 'hidden_visibility_1';
  end if;

  return query
  select
    v_can_see,
    v_can_rsvp,
    v_can_see_guest_list,
    v_is_host,
    v_is_direct_invitee,
    v_is_network_qualified,
    v_has_existing_rsvp,
    v_requires_host_approval,
    v_event.visibility,
    v_event.forwarding_mode,
    v_reason;
end;
$$;

notify pgrst, 'reload schema';

commit;
