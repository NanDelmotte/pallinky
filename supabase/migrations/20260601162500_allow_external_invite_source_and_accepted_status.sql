begin;

alter table public.event_invites
drop constraint if exists event_invites_source_type_check;

alter table public.event_invites
add constraint event_invites_source_type_check
check (
  source_type = any (
    array[
      'host_friend'::text,
      'host_circle'::text,
      'host_manual'::text,
      'forward'::text,
      'external_share'::text,
      'group_share'::text
    ]
  )
);

alter table public.event_invites
drop constraint if exists event_invites_status_check;

alter table public.event_invites
add constraint event_invites_status_check
check (
  status = any (
    array[
      'pending'::text,
      'active'::text,
      'accepted'::text,
      'revoked'::text
    ]
  )
);

notify pgrst, 'reload schema';

commit;
