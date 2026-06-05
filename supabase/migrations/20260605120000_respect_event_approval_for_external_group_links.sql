begin;

-- Group share links should follow the host's approval choice from the create flow.
-- Previously every multi-use external link required approval unless the event was
-- fully public, which made the "No, anyone with the link can RSVP" choice lie.

create or replace function public.create_external_event_invite(
  p_slug text,
  p_invitee_name text default null,
  p_link_mode text default 'single'
)
returns table (
  event_id uuid,
  invite_id text,
  guest_token text,
  invite_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_inviter_email_lc text;
  v_event public.events%rowtype;
  v_invite_id text;
  v_guest_token text;
  v_invitee_name text;
  v_link_mode text;
  v_requires_host_approval boolean;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(
    nullif(lower(trim(p.email_lc)), ''),
    nullif(lower(trim(auth.jwt() ->> 'email')), '')
  )
  into v_inviter_email_lc
  from public.profiles p
  where p.id = v_user_id
  limit 1;

  v_inviter_email_lc := coalesce(
    v_inviter_email_lc,
    nullif(lower(trim(auth.jwt() ->> 'email')), '')
  );

  if v_inviter_email_lc is null then
    raise exception 'profile_email_required';
  end if;

  select *
  into v_event
  from public.events
  where slug = nullif(trim(p_slug), '')
  limit 1;

  if v_event.id is null then
    raise exception 'event_not_found';
  end if;

  if lower(trim(v_event.host_email)) <> v_inviter_email_lc then
    raise exception 'only_host_can_create_external_invite';
  end if;

  v_guest_token := md5(random()::text || clock_timestamp()::text || v_event.id::text || v_inviter_email_lc);
  v_invitee_name := coalesce(nullif(trim(p_invitee_name), ''), 'Guest');
  v_link_mode := case
    when lower(trim(coalesce(p_link_mode, 'single'))) in ('multi', 'group') then 'multi'
    else 'single'
  end;
  v_requires_host_approval := (
    coalesce(v_event.requires_approval, false)
    or coalesce(v_event.forwarding_mode, '') = 'host_approval'
  );

  insert into public.event_invites (
    event_id,
    invitee_name,
    invited_by_email_lc,
    invited_by_invite_id,
    source_type,
    source_ref,
    status,
    can_forward,
    requires_host_approval,
    claimed_at,
    revoked_at,
    guest_token,
    invite_link_mode,
    max_uses
  )
  values (
    v_event.id,
    v_invitee_name,
    v_inviter_email_lc,
    null,
    case when v_link_mode = 'multi' then 'group_share' else 'external_share' end,
    case when v_link_mode = 'multi' then 'share_sheet_group' else 'share_sheet_single' end,
    'pending',
    v_link_mode = 'multi',
    v_requires_host_approval,
    null,
    null,
    v_guest_token,
    v_link_mode,
    case when v_link_mode = 'single' then 1 else null end
  )
  returning id::text, event_invites.guest_token
  into v_invite_id, v_guest_token;

  return query
  select
    v_event.id,
    v_invite_id,
    v_guest_token,
    ('https://pallinky.com/event/' || v_event.slug || '?token=' || v_guest_token)::text;
end;
$$;

grant execute on function public.create_external_event_invite(text, text, text) to authenticated;

update public.event_invites ei
set requires_host_approval = (
  coalesce(e.requires_approval, false)
  or coalesce(e.forwarding_mode, '') = 'host_approval'
)
from public.events e
where ei.event_id = e.id
  and ei.source_type = 'group_share'
  and ei.revoked_at is null
  and ei.status = 'pending';

notify pgrst, 'reload schema';

commit;
