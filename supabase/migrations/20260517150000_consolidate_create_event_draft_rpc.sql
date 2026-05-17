-- Keep create_event_draft as a single canonical PostgREST RPC endpoint.
--
-- Historical migrations left obsolete overloads in place:
--   * the pre-simple-visibility 22-argument implementation, where p_event_url
--     was appended after p_forwarding_mode; and
--   * mobile wrapper overloads that accepted only the mobile create-flow subset.
--
-- Because every parameter on these overloads has a default, PostgREST can match
-- the same JSON RPC payload to multiple functions and reject the call as
-- ambiguous. The canonical 25-argument function from
-- 20260517140000_store_event_time_zone.sql accepts all existing named mobile
-- arguments, preserves RSVP/deadline behavior, and stores event_time_zone.

-- Obsolete pre-simple-visibility/event-url overload. Named-argument clients can
-- still use the canonical function below because it includes these parameter
-- names plus defaults for the newer visibility/time-zone controls.
drop function if exists public.create_event_draft(
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
  integer,
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
  text
);

-- Defensive cleanup for an incorrectly targeted historical drop signature. This
-- signature is not the canonical function and may exist in environments that
-- received an out-of-band hotfix.
drop function if exists public.create_event_draft(
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
  integer,
  text,
  text,
  boolean,
  integer,
  date,
  boolean,
  text
);

-- Mobile wrapper before event_time_zone support.
drop function if exists public.create_event_draft(
  text,
  timestamptz,
  text,
  integer,
  text,
  text,
  text,
  text,
  integer,
  boolean,
  date,
  boolean,
  boolean,
  timestamptz,
  text,
  boolean
);

-- Mobile wrapper after event_time_zone support. This is the overload that makes
-- the current formal create-flow payload ambiguous with the canonical function.
drop function if exists public.create_event_draft(
  text,
  timestamptz,
  text,
  integer,
  text,
  text,
  text,
  text,
  integer,
  boolean,
  date,
  boolean,
  boolean,
  timestamptz,
  text,
  boolean,
  text
);

-- Re-grant the one intended RPC signature. This is harmless if grants already
-- exist and documents the canonical shape PostgREST should expose.
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
  text
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
