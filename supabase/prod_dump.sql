


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_device_contacts_to_circle"("p_circle_id" "uuid", "p_contact_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.social_circles sc
    where sc.id = p_circle_id
      and sc.user_id = v_user_id
  ) then
    raise exception 'circle_not_found';
  end if;

  insert into public.social_circle_members (
    circle_id,
    member_name,
    member_email_lc,
    member_phone_e164,
    member_user_id,
    device_contact_id,
    person_id
  )
  select
    p_circle_id,
    dc.display_name,
    dc.email_lc,
    dc.phone_e164,
    dc.matched_user_id,
    dc.id,
    coalesce(
      dc.person_id,
      public.resolve_or_create_person(dc.email_lc, dc.phone_e164, dc.matched_user_id)
    )
  from public.device_contacts dc
  where dc.user_id = v_user_id
    and dc.id = any(p_contact_ids)
    and not exists (
      select 1
      from public.social_circle_members scm
      where scm.circle_id = p_circle_id
        and scm.device_contact_id = dc.id
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."add_device_contacts_to_circle"("p_circle_id" "uuid", "p_contact_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_notifications_inbox_from_outbox"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select *
    from public.notifications_outbox
    order by created_at asc, id asc
  loop
    insert into public.notifications_inbox (
      user_email_lc,
      event_id,
      notification_type,
      group_key,
      latest_outbox_id,
      latest_payload,
      latest_message,
      unread_count,
      total_count,
      is_read,
      first_received_at,
      last_received_at,
      created_at,
      updated_at
    )
    values (
      lower(trim(v_row.recipient_email)),
      v_row.event_id,
      v_row.type,
      public.build_notification_group_key(lower(trim(v_row.recipient_email)), v_row.event_id, v_row.type),
      v_row.id,
      coalesce(v_row.payload, '{}'::jsonb),
      coalesce(v_row.payload->>'message', v_row.payload->>'event_title', 'Notification'),
      1,
      1,
      false,
      coalesce(v_row.created_at, now()),
      coalesce(v_row.created_at, now()),
      coalesce(v_row.created_at, now()),
      now()
    )
    on conflict (group_key)
    do update set
      latest_outbox_id = excluded.latest_outbox_id,
      latest_payload = excluded.latest_payload,
      latest_message = excluded.latest_message,
      unread_count = public.notifications_inbox.unread_count + 1,
      total_count = public.notifications_inbox.total_count + 1,
      is_read = false,
      read_at = null,
      last_received_at = excluded.last_received_at,
      updated_at = now();

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."backfill_notifications_inbox_from_outbox"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_user"("p_blocked_email" "text", "p_reason" "text" DEFAULT 'blocked_user'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_blocker_email_lc text;
  v_blocked_email_lc text;
begin
  select p.email_lc
  into v_blocker_email_lc
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_blocker_email_lc is null then
    raise exception 'not_authenticated';
  end if;

  v_blocked_email_lc := nullif(lower(trim(p_blocked_email)), '');

  if v_blocked_email_lc is null then
    raise exception 'blocked_email_required';
  end if;

  if v_blocker_email_lc = v_blocked_email_lc then
    raise exception 'cannot_block_self';
  end if;

  insert into public.blocked_users (
    blocker_email,
    blocked_email
  )
  values (
    v_blocker_email_lc,
    v_blocked_email_lc
  )
  on conflict do nothing;

  insert into public.reports (
    reporter_email,
    target_type,
    target_user_email,
    reason,
    details
  )
  values (
    v_blocker_email_lc,
    'user',
    v_blocked_email_lc,
    coalesce(nullif(trim(p_reason), ''), 'blocked_user'),
    'User blocked from app UI'
  );

  return json_build_object(
    'ok', true,
    'blocked_email', v_blocked_email_lc
  );
end;
$$;


ALTER FUNCTION "public"."block_user"("p_blocked_email" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_notification_group_key"("p_user_email_lc" "text", "p_event_id" "uuid", "p_notification_type" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select lower(trim(coalesce(p_user_email_lc, '')))
         || '|' || coalesce(p_event_id::text, 'no_event')
         || '|' || lower(trim(coalesce(p_notification_type, 'unknown')));
$$;


ALTER FUNCTION "public"."build_notification_group_key"("p_user_email_lc" "text", "p_event_id" "uuid", "p_notification_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_event_by_manage_token"("p_manage_token" "text", "p_message" "text" DEFAULT NULL::"text") RETURNS TABLE("ok" boolean, "slug" "text", "enqueued_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event public.events%rowtype;
begin
  select *
  into v_event
  from public.events
  where manage_handle = p_manage_token
     or manage_token_hash = encode(extensions.digest(p_manage_token, 'sha256'), 'hex')
  limit 1;

  if v_event.id is null then
    raise exception 'invalid_manage_handle';
  end if;

  update public.events
  set status = 'cancelled',
      updated_at = now()
  where id = v_event.id;

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    payload
  )
  select distinct
    v_event.id,
    r.email_lc,
    'event_cancelled',
    'event_cancelled',
    jsonb_build_object(
      'slug', v_event.slug,
      'title', v_event.title,
      'event_title', v_event.title,
      'host_name', v_event.host_name,
      'message', nullif(trim(p_message), '')
    )
  from public.rsvps r
  where r.event_id = v_event.id
    and r.email_lc is not null
    and r.email_lc <> lower(trim(v_event.host_email));

  get diagnostics enqueued_count = row_count;

  ok := true;
  slug := v_event.slug;
  return next;
end;
$$;


ALTER FUNCTION "public"."cancel_event_by_manage_token"("p_manage_token" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chat_notification_allowed"("p_event_id" "uuid", "p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_last timestamptz;
begin

  select max(last_sent_at)
  into v_last
  from notifications_outbox
  where event_id = p_event_id
  and recipient_email = lower(trim(p_email))
  and type = 'chat_message_batch';

  if v_last is null then
    return true;
  end if;

  if now() - v_last > interval '5 minutes' then
    return true;
  end if;

  return false;

end;
$$;


ALTER FUNCTION "public"."chat_notification_allowed"("p_event_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_event_draft"("p_title" "text", "p_host_name" "text", "p_host_email" "text", "p_keyword" "text", "p_starts_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_ends_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_location" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text", "p_cover_image_url" "text" DEFAULT NULL::"text", "p_gif_key" "text" DEFAULT 'zen'::"text", "p_expires_in_days" integer DEFAULT 14, "p_event_type" "text" DEFAULT 'formal'::"text", "p_proposed_dates" "text"[] DEFAULT '{}'::"text"[], "p_visibility" integer DEFAULT 2, "p_invite_list_visibility" "text" DEFAULT 'host_only'::"text", "p_guest_list_visibility" "text" DEFAULT 'guests_can_see'::"text", "p_send_rsvp_reminders" boolean DEFAULT false, "p_remind_after_days" integer DEFAULT 3, "p_rsvp_deadline" "date" DEFAULT NULL::"date", "p_send_final_reminder_at_deadline" boolean DEFAULT false, "p_forwarding_mode" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "slug" "text", "manage_handle" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_event_draft"("p_title" "text", "p_host_name" "text", "p_host_email" "text", "p_keyword" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_description" "text", "p_cover_image_url" "text", "p_gif_key" "text", "p_expires_in_days" integer, "p_event_type" "text", "p_proposed_dates" "text"[], "p_visibility" integer, "p_invite_list_visibility" "text", "p_guest_list_visibility" "text", "p_send_rsvp_reminders" boolean, "p_remind_after_days" integer, "p_rsvp_deadline" "date", "p_send_final_reminder_at_deadline" boolean, "p_forwarding_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_event_invites_from_device_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[], "p_source_type" "text" DEFAULT 'device_contact'::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_host_email text;
  v_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select e.host_email
  into v_host_email
  from public.events e
  join public.profiles p
    on p.email_lc = lower(trim(e.host_email))
  where e.id = p_event_id
    and p.id = v_user_id;

  if v_host_email is null then
    raise exception 'event_not_found_or_not_owned';
  end if;

  insert into public.event_invites (
    event_id,
    invitee_email_lc,
    invitee_phone_e164,
    invitee_name,
    invited_by_email_lc,
    source_type,
    source_ref,
    device_contact_id,
    status,
    person_id
  )
  select
    p_event_id,
    dc.email_lc,
    dc.phone_e164,
    dc.display_name,
    lower(trim(v_host_email)),
    p_source_type,
    dc.id::text,
    dc.id,
    'pending',
    coalesce(
      dc.person_id,
      public.resolve_or_create_person(dc.email_lc, dc.phone_e164, dc.matched_user_id)
    )
  from public.device_contacts dc
  where dc.user_id = v_user_id
    and dc.id = any(p_contact_ids)
    and not exists (
      select 1
      from public.event_invites ei
      where ei.event_id = p_event_id
        and ei.device_contact_id = dc.id
        and ei.revoked_at is null
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."create_event_invites_from_device_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[], "p_source_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_report"("p_target_type" "text", "p_target_id" "uuid" DEFAULT NULL::"uuid", "p_target_user_email" "text" DEFAULT NULL::"text", "p_reason" "text" DEFAULT 'inappropriate_content'::"text", "p_details" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_reporter_email_lc text;
  v_report_id uuid;
begin
  select p.email_lc
  into v_reporter_email_lc
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_reporter_email_lc is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.reports (
    reporter_email,
    target_type,
    target_id,
    target_user_email,
    reason,
    details,
    status
  )
  values (
    v_reporter_email_lc,
    lower(trim(p_target_type)),
    p_target_id,
    nullif(lower(trim(p_target_user_email)), ''),
    lower(trim(p_reason)),
    nullif(trim(p_details), ''),
    'open'
  )
  returning id into v_report_id;

  return v_report_id;
end;
$$;


ALTER FUNCTION "public"."create_report"("p_target_type" "text", "p_target_id" "uuid", "p_target_user_email" "text", "p_reason" "text", "p_details" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_my_account_data"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_email_lc text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select email_lc
  into v_email_lc
  from public.profiles
  where id = v_user_id;

  if v_email_lc is null then
    raise exception 'profile_not_found';
  end if;

  -- direct user-owned rows
  delete from public.hidden_people
  where user_id = v_user_id;

  delete from public.social_circle_members
  where member_user_id = v_user_id;

  delete from public.social_circles
  where user_id = v_user_id;

  delete from public.device_contacts
  where user_id = v_user_id;

  -- direct email-scoped rows
  delete from public.closed_cards
  where user_email_lc = v_email_lc;

  delete from public.notifications_inbox
  where user_email_lc = v_email_lc;

  delete from public.notifications_outbox
  where lower(trim(recipient_email)) = v_email_lc;

  delete from public.event_chat_reads
  where user_email_lc = v_email_lc;

  delete from public.event_dm_reads
  where user_email_lc = v_email_lc;

  delete from public.event_chat_messages
  where sender_email_lc = v_email_lc;

  delete from public.event_dm_messages
  where sender_email_lc = v_email_lc
     or recipient_email_lc = v_email_lc;

  delete from public.rsvp_join_requests
  where lower(trim(requester_email)) = v_email_lc
     or lower(trim(decided_by_email_lc)) = v_email_lc;

  delete from public.rsvps
  where email_lc = v_email_lc;

  delete from public.vibe_responses
  where lower(trim(user_email)) = v_email_lc;

  delete from public.event_invites
  where invitee_email_lc = v_email_lc
     or invited_by_email_lc = v_email_lc;

  delete from public.push_tokens
  where email_lc = v_email_lc;

  delete from public.push_subscriptions
  where lower(trim(email)) = v_email_lc;

  delete from public.social_intent
  where lower(trim(user_email)) = v_email_lc;

  -- hosted events subtree
  delete from public.closed_cards
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.email_subscriptions
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.social_intent
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.rsvp_join_requests
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.notifications_inbox
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.notifications_outbox
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.event_chat_reads
  where thread_id in (
    select id
    from public.event_chat_threads
    where event_id in (
      select id from public.events where lower(trim(host_email)) = v_email_lc
    )
  );

  delete from public.event_chat_messages
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.event_chat_threads
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.event_dm_reads
  where thread_id in (
    select id
    from public.event_dm_threads
    where event_id in (
      select id from public.events where lower(trim(host_email)) = v_email_lc
    )
  );

  delete from public.event_dm_messages
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.event_dm_threads
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.event_invites
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.vibe_responses
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.rsvps
  where event_id in (
    select id from public.events where lower(trim(host_email)) = v_email_lc
  );

  delete from public.events
  where lower(trim(host_email)) = v_email_lc;

  -- clear remaining FK references to the profile row
  update public.people
  set matched_user_id = null
  where matched_user_id = v_user_id;

  update public.device_contacts
  set matched_user_id = null
  where matched_user_id = v_user_id;

  update public.hidden_people
  set matched_user_id = null
  where matched_user_id = v_user_id;

  delete from public.profiles
  where id = v_user_id;
end;
$$;


ALTER FUNCTION "public"."delete_my_account_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dismiss_notification_group"("p_inbox_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_email_lc text;
begin
  select email_lc
  into v_user_email_lc
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_user_email_lc is null then
    raise exception 'not_authenticated';
  end if;

  update public.notifications_inbox
  set
    dismissed_at = now(),
    unread_count = 0,
    is_read = true,
    read_at = coalesce(read_at, now()),
    updated_at = now()
  where id = p_inbox_id
    and user_email_lc = v_user_email_lc;
end;
$$;


ALTER FUNCTION "public"."dismiss_notification_group"("p_inbox_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_rsvp_access"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_decision record;
begin
  select *
  into v_decision
  from public.get_event_access_decision(
    p_event_id := new.event_id,
    p_viewer_email := new.email,
    p_viewer_phone_e164 := new.phone_e164,
    p_guest_token := new.guest_token
  );

  if not coalesce(v_decision.can_see, false) then
    raise exception 'viewer_cannot_see_event';
  end if;

  if not coalesce(v_decision.can_rsvp, false) then
    if coalesce(v_decision.requires_host_approval, false) then
      raise exception 'RSVP requires host approval';
    end if;

    if coalesce(v_decision.reason, '') = 'forwarding_blocked' then
      raise exception 'viewer_cannot_rsvp_forwarding_blocked';
    end if;

    raise exception 'viewer_cannot_rsvp';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_rsvp_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_final_rsvp_deadline_reminders"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count integer := 0;
begin
  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    payload
  )
  select distinct
    e.id,
    ei.invitee_email_lc,
    'rsvp_deadline_reminder',
    'rsvp_deadline_reminder',
    jsonb_build_object(
      'event_id', e.id,
      'event_title', e.title,
      'host_name', e.host_name,
      'slug', e.slug,
      'rsvp_deadline', e.rsvp_deadline
    )
  from public.events e
  join public.event_invites ei
    on ei.event_id = e.id
   and ei.revoked_at is null
   and ei.invitee_email_lc is not null
  left join public.rsvps r
    on r.event_id = e.id
   and r.email_lc = ei.invitee_email_lc
  where e.status = 'active'
    and e.send_final_reminder_at_deadline = true
    and e.rsvp_deadline = current_date
    and r.id is null
    and lower(trim(ei.invitee_email_lc)) <> lower(trim(e.host_email))
    and not exists (
      select 1
      from public.notifications_outbox n
      where n.event_id = e.id
        and n.recipient_email = ei.invitee_email_lc
        and n.type = 'rsvp_deadline_reminder'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."enqueue_final_rsvp_deadline_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_notification_type"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.type is null then
    new.type :=
      case
        when new.template = 'invite_created' then 'invite_created'
        when new.template = 'chat_message_batch' then 'chat_message_batch'
        when new.template = 'rsvp_received' then 'rsvp_received'
        when new.template = 'join_request_created' then 'join_request_created'
        when new.template = 'join_request_approved' then 'join_request_approved'
        when new.template = 'join_request_denied' then 'join_request_denied'
        when new.template = 'event_cancelled' then 'event_cancelled'
        when new.template = 'host_message' then 'host_message'
        when new.template = 'rsvp_deadline_reminder' then 'rsvp_deadline_reminder'
        when new.template = 'event_dm_message' then 'event_dm_message'
        else new.template
      end;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_notification_type"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."event_dm_user_high"("p_email_1" "text", "p_email_2" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select greatest(lower(trim(p_email_1)), lower(trim(p_email_2)));
$$;


ALTER FUNCTION "public"."event_dm_user_high"("p_email_1" "text", "p_email_2" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."event_dm_user_low"("p_email_1" "text", "p_email_2" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select least(lower(trim(p_email_1)), lower(trim(p_email_2)));
$$;


ALTER FUNCTION "public"."event_dm_user_low"("p_email_1" "text", "p_email_2" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_vibe_by_manage_token"("p_manage_token" "text", "p_winning_starts_at" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.events
  set
    event_type = 'formal',
    starts_at = p_winning_starts_at,
    updated_at = now()
  where manage_handle = p_manage_token
     or manage_token_hash = encode(extensions.digest(p_manage_token, 'sha256'), 'hex');
end;
$$;


ALTER FUNCTION "public"."finalize_vibe_by_manage_token"("p_manage_token" "text", "p_winning_starts_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_access_decision"("p_event_id" "uuid", "p_viewer_email" "text" DEFAULT NULL::"text", "p_viewer_phone_e164" "text" DEFAULT NULL::"text", "p_guest_token" "text" DEFAULT NULL::"text") RETURNS TABLE("can_see" boolean, "can_rsvp" boolean, "can_see_guest_list" boolean, "is_host" boolean, "is_direct_invitee" boolean, "is_network_qualified" boolean, "has_existing_rsvp" boolean, "requires_host_approval" boolean, "visibility" integer, "forwarding_mode" "text", "reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
begin
  v_viewer_email_lc := nullif(lower(trim(p_viewer_email)), '');
  v_viewer_phone := nullif(trim(p_viewer_phone_e164), '');
  v_guest_token := nullif(trim(p_guest_token), '');

  select *
  into v_event
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

  select ei.*
  into v_invite
  from public.event_invites ei
  join public.events invited_event
    on invited_event.id = ei.event_id
  where ei.revoked_at is null
    and (
      ei.event_id = p_event_id
      or (
        v_event.series_id is not null
        and invited_event.series_id = v_event.series_id
      )
    )
    and (
      (v_viewer_email_lc is not null and ei.invitee_email_lc = v_viewer_email_lc)
      or
      (v_viewer_phone is not null and ei.invitee_phone_e164 = v_viewer_phone)
    )
  order by
    case when ei.event_id = p_event_id then 0 else 1 end,
    ei.created_at desc
  limit 1;

  select r.*
  into v_rsvp
  from public.rsvps r
  join public.events rsvp_event
    on rsvp_event.id = r.event_id
  where (
      r.event_id = p_event_id
      or (
        v_event.series_id is not null
        and rsvp_event.series_id = v_event.series_id
      )
    )
    and (
      (v_viewer_email_lc is not null and r.email_lc = v_viewer_email_lc)
      or
      (v_viewer_phone is not null and r.phone_e164 = v_viewer_phone)
      or
      (v_guest_token is not null and r.guest_token = v_guest_token)
    )
  order by
    case when r.event_id = p_event_id then 0 else 1 end,
    r.updated_at desc,
    r.responded_at desc
  limit 1;

  v_is_host := (
    v_viewer_email_lc is not null
    and v_host_email_lc = v_viewer_email_lc
  );

  v_is_direct_invitee := v_invite.id is not null;
  v_has_existing_rsvp := v_rsvp.id is not null;

  select p.id
  into v_viewer_user_id
  from public.profiles p
  where p.email_lc = v_viewer_email_lc
  limit 1;

  select p.id
  into v_host_user_id
  from public.profiles p
  where p.email_lc = v_host_email_lc
  limit 1;

  if v_viewer_email_lc is not null and v_host_email_lc is not null then
    select exists (
      select 1
      from public.social_circle_members scm
      join public.social_circles sc
        on sc.id = scm.circle_id
      where sc.user_id = v_host_user_id
        and (
          scm.member_email_lc = v_viewer_email_lc
          or (scm.member_user_id is not null and scm.member_user_id = v_viewer_user_id)
        )
    )
    into v_in_host_social_circles;

    select exists (
      select 1
      from public.rsvps mine
      join public.rsvps other
        on other.event_id = mine.event_id
      where mine.email_lc = v_viewer_email_lc
        and other.email_lc = v_host_email_lc
    )
    into v_shared_rsvp_history;

    select exists (
      select 1
      from public.device_contacts dc
      where dc.user_id = v_viewer_user_id
        and (
          dc.email_lc = v_host_email_lc
          or (dc.matched_user_id is not null and dc.matched_user_id = v_host_user_id)
        )
    )
    into v_in_viewer_imported_contacts;

    select exists (
      select 1
      from public.device_contacts dc
      where dc.user_id = v_host_user_id
        and (
          dc.email_lc = v_viewer_email_lc
          or (dc.matched_user_id is not null and dc.matched_user_id = v_viewer_user_id)
        )
    )
    into v_in_host_imported_contacts;
  end if;

  v_is_network_qualified := (
    v_in_host_social_circles
    or v_shared_rsvp_history
    or v_in_viewer_imported_contacts
    or v_in_host_imported_contacts
  );

  v_can_see := case
    when v_is_host then true
    when v_has_existing_rsvp then true
    when v_visibility = 1 then v_is_direct_invitee
    when v_visibility = 2 then (v_is_direct_invitee or v_is_network_qualified)
    when v_visibility = 3 then true
    else false
  end;

  if v_is_host then
    v_requires_host_approval := false;
  elsif coalesce(v_invite.requires_host_approval, false) then
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
  elsif v_visibility = 1 then
    v_can_rsvp := v_is_direct_invitee;
  elsif v_visibility = 2 then
    v_can_rsvp := (v_is_direct_invitee or v_is_network_qualified);
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
  elsif v_is_direct_invitee then
    if v_requires_host_approval and not v_can_rsvp then
      v_reason := 'approval_required';
    else
      v_reason := 'direct_invitee';
    end if;
  elsif v_visibility = 2 and v_is_network_qualified then
    v_reason := 'network_qualified';
  elsif v_visibility = 3 then
    if coalesce(v_forwarding_mode, '') = 'no_forwarding' and not v_can_rsvp then
      v_reason := 'forwarding_blocked';
    elsif v_requires_host_approval and not v_can_rsvp then
      v_reason := 'approval_required';
    else
      v_reason := 'public_event';
    end if;
  elsif v_visibility = 2 then
    v_reason := 'not_network_qualified';
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


ALTER FUNCTION "public"."get_event_access_decision"("p_event_id" "uuid", "p_viewer_email" "text", "p_viewer_phone_e164" "text", "p_guest_token" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "host_name" "text" NOT NULL,
    "host_email" "text" NOT NULL,
    "keyword" "text" NOT NULL,
    "slug_suffix" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "location" "text",
    "cover_image_url" "text",
    "gif_key" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "manage_handle" "text" NOT NULL,
    "manage_token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "first_shared_at" timestamp with time zone,
    "last_changed_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visibility" integer DEFAULT 2,
    "font_family" "text" DEFAULT 'System'::"text",
    "thanks_gif_url" "text",
    "event_type" "text" DEFAULT 'formal'::"text",
    "proposed_dates" "text"[],
    "invite_list_visibility" "text" DEFAULT 'host_only'::"text" NOT NULL,
    "guest_list_visibility" "text" DEFAULT 'guests_can_see'::"text" NOT NULL,
    "send_rsvp_reminders" boolean DEFAULT false NOT NULL,
    "remind_after_days" integer DEFAULT 3 NOT NULL,
    "rsvp_deadline" "date",
    "send_final_reminder_at_deadline" boolean DEFAULT false NOT NULL,
    "forwarding_mode" "text",
    "series_id" "uuid",
    CONSTRAINT "events_forwarding_mode_check" CHECK ((("forwarding_mode" IS NULL) OR ("forwarding_mode" = ANY (ARRAY['free'::"text", 'host_approval'::"text"])))),
    CONSTRAINT "events_guest_list_visibility_check" CHECK (("guest_list_visibility" = ANY (ARRAY['host_only'::"text", 'guests_can_see'::"text"]))),
    CONSTRAINT "events_invite_list_visibility_check" CHECK (("invite_list_visibility" = ANY (ARRAY['host_only'::"text", 'guests_can_see'::"text"]))),
    CONSTRAINT "events_remind_after_days_check" CHECK (("remind_after_days" = ANY (ARRAY[1, 2, 3, 5, 7]))),
    CONSTRAINT "host_email_lowercase" CHECK (("host_email" = "lower"("host_email")))
);

ALTER TABLE ONLY "public"."events" REPLICA IDENTITY FULL;


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_by_manage_token"("p_manage_token" "text") RETURNS SETOF "public"."events"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select *
  from public.events
  where manage_handle = p_manage_token
     or manage_token_hash = encode(extensions.digest(p_manage_token, 'sha256'), 'hex')
  limit 1;
$$;


ALTER FUNCTION "public"."get_event_by_manage_token"("p_manage_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_chat_messages"("p_event_id" "uuid", "p_user_email" "text") RETURNS TABLE("id" "uuid", "sender_email_lc" "text", "body" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_event_chat_participant(p_event_id, p_user_email) then
    raise exception 'not_event_chat_participant';
  end if;

  return query
  select
    m.id,
    m.sender_email_lc,
    m.body,
    m.created_at
  from public.event_chat_messages m
  join public.event_chat_threads t on t.id = m.thread_id
  where t.event_id = p_event_id
    and not exists (
      select 1
      from public.blocked_users b
      where
        (
          lower(trim(b.blocker_email)) = lower(trim(p_user_email))
          and lower(trim(b.blocked_email)) = m.sender_email_lc
        )
        or
        (
          lower(trim(b.blocked_email)) = lower(trim(p_user_email))
          and lower(trim(b.blocker_email)) = m.sender_email_lc
        )
    )
  order by m.created_at asc;
end;
$$;


ALTER FUNCTION "public"."get_event_chat_messages"("p_event_id" "uuid", "p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_chat_summary"("p_event_id" "uuid", "p_user_email" "text") RETURNS TABLE("thread_id" "uuid", "last_message_body" "text", "last_message_at" timestamp with time zone, "unread_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_email_lc text;
begin
  v_user_email_lc := lower(trim(p_user_email));

  if not public.is_event_chat_participant(p_event_id, v_user_email_lc) then
    raise exception 'not_event_chat_participant';
  end if;

  return query
  with thread_row as (
    select id
    from public.event_chat_threads
    where event_id = p_event_id
  ),
  last_read as (
    select r.last_read_at
    from public.event_chat_reads r
    join thread_row t on t.id = r.thread_id
    where r.user_email_lc = v_user_email_lc
  ),
  last_message as (
    select m.body, m.created_at
    from public.event_chat_messages m
    join thread_row t on t.id = m.thread_id
    order by m.created_at desc
    limit 1
  )
  select
    t.id as thread_id,
    lm.body as last_message_body,
    lm.created_at as last_message_at,
    coalesce((
      select count(*)
      from public.event_chat_messages m
      where m.thread_id = t.id
        and m.created_at > coalesce((select lr.last_read_at from last_read lr), '-infinity'::timestamptz)
        and m.sender_email_lc <> v_user_email_lc
    ), 0)::bigint as unread_count
  from thread_row t
  left join last_message lm on true;
end;
$$;


ALTER FUNCTION "public"."get_event_chat_summary"("p_event_id" "uuid", "p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_dm_messages"("p_thread_id" "uuid", "p_user_email" "text") RETURNS TABLE("id" "uuid", "thread_id" "uuid", "event_id" "uuid", "sender_email_lc" "text", "recipient_email_lc" "text", "body" "text", "created_at" timestamp with time zone, "edited_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_event_dm_participant(p_thread_id, p_user_email) then
    raise exception 'not_event_dm_participant';
  end if;

  return query
  select
    m.id,
    m.thread_id,
    m.event_id,
    m.sender_email_lc,
    m.recipient_email_lc,
    m.body,
    m.created_at,
    m.edited_at
  from public.event_dm_messages m
  where m.thread_id = p_thread_id
    and not exists (
      select 1
      from public.blocked_users b
      where
        (
          lower(trim(b.blocker_email)) = lower(trim(p_user_email))
          and lower(trim(b.blocked_email)) = m.sender_email_lc
        )
        or
        (
          lower(trim(b.blocked_email)) = lower(trim(p_user_email))
          and lower(trim(b.blocker_email)) = m.sender_email_lc
        )
    )
  order by m.created_at asc, m.id asc;
end;
$$;


ALTER FUNCTION "public"."get_event_dm_messages"("p_thread_id" "uuid", "p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_guest_list"("p_slug" "text", "p_viewer_email" "text" DEFAULT NULL::"text") RETURNS TABLE("name" "text", "status" "text", "responded_at" timestamp with time zone, "message" "text", "common_event" "text", "mutual_friend_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_id uuid;
  v_decision record;
  v_viewer_email_lc text;
begin
  v_viewer_email_lc := nullif(lower(trim(p_viewer_email)), '');

  select e.id
  into v_event_id
  from public.events e
  where e.slug = p_slug
  limit 1;

  if v_event_id is null then
    return;
  end if;

  select *
  into v_decision
  from public.get_event_access_decision(
    p_event_id := v_event_id,
    p_viewer_email := v_viewer_email_lc
  );

  if not coalesce(v_decision.can_see_guest_list, false) then
    return;
  end if;

  return query
  with viewer as (
    select v_viewer_email_lc as email_lc
  ),
  guest_rows as (
    select
      r.event_id,
      r.email_lc,
      r.name,
      r.status,
      r.responded_at,
      r.message
    from public.rsvps r
    where r.event_id = v_event_id
      and r.email_lc is not null
  )
  select
    gr.name,
    gr.status,
    gr.responded_at,
    gr.message,
    (
      select e2.title
      from public.rsvps r1
      join public.rsvps r2 on r2.event_id = r1.event_id
      join public.events e2 on e2.id = r1.event_id
      cross join viewer v
      where v.email_lc is not null
        and r1.email_lc = gr.email_lc
        and r2.email_lc = v.email_lc
        and e2.slug <> p_slug
      order by e2.starts_at desc nulls last, e2.created_at desc
      limit 1
    ) as common_event,
    coalesce((
      with viewer_people as (
        select distinct other.email_lc
        from public.rsvps mine
        join public.rsvps other on other.event_id = mine.event_id
        cross join viewer v
        where v.email_lc is not null
          and mine.email_lc = v.email_lc
          and other.email_lc is not null
          and other.email_lc <> v.email_lc
      ),
      guest_people as (
        select distinct other.email_lc
        from public.rsvps mine
        join public.rsvps other on other.event_id = mine.event_id
        where mine.email_lc = gr.email_lc
          and other.email_lc is not null
          and other.email_lc <> gr.email_lc
      )
      select count(*)::int
      from (
        select email_lc from viewer_people
        intersect
        select email_lc from guest_people
      ) shared
    ), 0) as mutual_friend_count
  from guest_rows gr
  order by gr.responded_at desc nulls last, gr.name asc nulls last;
end;
$$;


ALTER FUNCTION "public"."get_guest_list"("p_slug" "text", "p_viewer_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_host_dashboard_by_email"("p_email" "text") RETURNS TABLE("id" "uuid", "title" "text", "slug" "text", "manage_handle" "text", "starts_at" timestamp with time zone, "status" "text", "rsvp_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select
    e.id,
    e.title,
    e.slug,
    e.manage_handle,
    e.starts_at,
    e.status,
    count(distinct r.email_lc) as rsvp_count
  from public.events e
  left join public.rsvps r on r.event_id = e.id
  where lower(trim(e.host_email)) = lower(trim(p_email))
    and e.status <> 'cancelled'
  group by e.id
  order by e.starts_at desc nulls last, e.created_at desc;
end;
$$;


ALTER FUNCTION "public"."get_host_dashboard_by_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_device_contacts"() RETURNS TABLE("id" "uuid", "display_name" "text", "email_lc" "text", "phone_e164" "text", "avatar_uri" "text", "device_contact_id" "text", "matched_user_id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    dc.id,
    dc.display_name,
    dc.email_lc,
    dc.phone_e164,
    dc.avatar_uri,
    dc.device_contact_id,
    dc.matched_user_id
  from public.device_contacts dc
  where dc.user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_device_contacts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_event_dm_inbox"() RETURNS TABLE("id" "text", "event_id" "uuid", "notification_type" "text", "latest_payload" "jsonb", "latest_message" "text", "unread_count" integer, "total_count" integer, "is_read" boolean, "first_received_at" timestamp with time zone, "last_received_at" timestamp with time zone, "read_at" timestamp with time zone, "thread_id" "uuid", "can_dismiss" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with me as (
    select p.email_lc
    from public.profiles p
    where p.id = auth.uid()
    limit 1
  ),
  my_threads as (
    select
      t.id as thread_id,
      t.event_id,
      case
        when t.user_a_email_lc = me.email_lc then t.user_b_email_lc
        else t.user_a_email_lc
      end as counterpart_email_lc,
      t.last_message_at,
      t.last_message_preview
    from public.event_dm_threads t
    cross join me
    where me.email_lc in (t.user_a_email_lc, t.user_b_email_lc)
      and t.last_message_at is not null
  ),
  dm_counts as (
    select
      mt.thread_id,
      count(*)::integer as unread_count
    from my_threads mt
    cross join me
    left join public.event_dm_reads r
      on r.thread_id = mt.thread_id
     and r.user_email_lc = me.email_lc
    join public.event_dm_messages m
      on m.thread_id = mt.thread_id
    where m.recipient_email_lc = me.email_lc
      and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    group by mt.thread_id
  ),
  first_last as (
    select
      m.thread_id,
      min(m.created_at) as first_received_at,
      max(m.created_at) as last_received_at,
      count(*)::integer as total_count
    from public.event_dm_messages m
    group by m.thread_id
  )
  select
    ('event_dm:' || mt.thread_id::text) as id,
    mt.event_id,
    'event_dm_message'::text as notification_type,
    jsonb_build_object(
      'thread_id', mt.thread_id,
      'event_id', mt.event_id,
      'counterpart_email_lc', mt.counterpart_email_lc,
      'counterpart_name', coalesce(nullif(trim(pr.full_name), ''), mt.counterpart_email_lc),
      'preview', mt.last_message_preview
    ) as latest_payload,
    mt.last_message_preview as latest_message,
    coalesce(dc.unread_count, 0) as unread_count,
    fl.total_count,
    (coalesce(dc.unread_count, 0) = 0) as is_read,
    fl.first_received_at,
    fl.last_received_at,
    case
      when coalesce(dc.unread_count, 0) = 0 then fl.last_received_at
      else null
    end as read_at,
    mt.thread_id,
    false as can_dismiss
  from my_threads mt
  join first_last fl
    on fl.thread_id = mt.thread_id
  left join dm_counts dc
    on dc.thread_id = mt.thread_id
  left join public.profiles pr
    on pr.email_lc = mt.counterpart_email_lc
  order by fl.last_received_at desc;
$$;


ALTER FUNCTION "public"."get_my_event_dm_inbox"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_notifications_inbox"() RETURNS TABLE("id" "text", "user_email_lc" "text", "event_id" "uuid", "notification_type" "text", "latest_payload" "jsonb", "latest_message" "text", "unread_count" integer, "total_count" integer, "is_read" boolean, "first_received_at" timestamp with time zone, "last_received_at" timestamp with time zone, "read_at" timestamp with time zone, "thread_id" "uuid", "can_dismiss" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with me as (
    select lower(trim(p.email_lc)) as email_lc
    from public.profiles p
    where p.id = auth.uid()
    limit 1
  ),
  standard_rows as (
    select
      ni.id::text,
      ni.user_email_lc,
      ni.event_id,
      ni.notification_type,
      ni.latest_payload,
      ni.latest_message,
      ni.unread_count,
      ni.total_count,
      ni.is_read,
      ni.first_received_at,
      ni.last_received_at,
      ni.read_at,
      null::uuid as thread_id,
      true as can_dismiss
    from public.notifications_inbox ni
    where ni.dismissed_at is null
      and ni.user_email_lc = (select email_lc from me)
  ),
  dm_rows as (
    select
      d.id,
      (select email_lc from me) as user_email_lc,
      d.event_id,
      d.notification_type,
      d.latest_payload,
      d.latest_message,
      d.unread_count,
      d.total_count,
      d.is_read,
      d.first_received_at,
      d.last_received_at,
      d.read_at,
      d.thread_id,
      d.can_dismiss
    from public.get_my_event_dm_inbox() d
  )
  select *
  from (
    select * from standard_rows
    union all
    select * from dm_rows
  ) combined
  order by is_read asc, last_received_at desc;
$$;


ALTER FUNCTION "public"."get_my_notifications_inbox"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_unread_inbox_count"() RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with notif as (
    select coalesce(sum(ni.unread_count), 0)::integer as c
    from public.notifications_inbox ni
    join public.profiles p
      on p.email_lc = ni.user_email_lc
    where p.id = auth.uid()
      and ni.is_read = false
      and ni.dismissed_at is null
  ),
  dm as (
    select coalesce(sum(i.unread_count), 0)::integer as c
    from public.get_my_event_dm_inbox() i
  )
  select notif.c + dm.c
  from notif, dm;
$$;


ALTER FUNCTION "public"."get_my_unread_inbox_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_event_chat_thread"("p_event_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_thread_id uuid;
begin
  select id
  into v_thread_id
  from public.event_chat_threads
  where event_id = p_event_id;

  if v_thread_id is null then
    insert into public.event_chat_threads (event_id)
    values (p_event_id)
    returning id into v_thread_id;
  end if;

  return v_thread_id;
end;
$$;


ALTER FUNCTION "public"."get_or_create_event_chat_thread"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_event_dm_thread"("p_event_id" "uuid", "p_user_email" "text", "p_other_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_email_lc text;
  v_other_email_lc text;
  v_user_a text;
  v_user_b text;
  v_thread_id uuid;
begin
  v_user_email_lc := nullif(lower(trim(p_user_email)), '');
  v_other_email_lc := nullif(lower(trim(p_other_email)), '');

  if p_event_id is null then
    raise exception 'event_id_required';
  end if;

  if v_user_email_lc is null or v_other_email_lc is null then
    raise exception 'participant_email_required';
  end if;

  if v_user_email_lc = v_other_email_lc then
    raise exception 'cannot_dm_self';
  end if;

  if exists (
    select 1
    from public.blocked_users b
    where
      (lower(trim(b.blocker_email)) = v_user_email_lc and lower(trim(b.blocked_email)) = v_other_email_lc)
      or
      (lower(trim(b.blocker_email)) = v_other_email_lc and lower(trim(b.blocked_email)) = v_user_email_lc)
  ) then
    raise exception 'blocked_user_interaction';
  end if;

  if not exists (
    select 1
    from public.get_event_access_decision(
      p_event_id := p_event_id,
      p_viewer_email := v_user_email_lc
    ) d
    where coalesce(d.can_see, false)
  ) then
    raise exception 'sender_cannot_see_event';
  end if;

  if not exists (
    select 1
    from public.get_event_access_decision(
      p_event_id := p_event_id,
      p_viewer_email := v_other_email_lc
    ) d
    where coalesce(d.can_see, false)
  ) then
    raise exception 'recipient_cannot_see_event';
  end if;

  v_user_a := public.event_dm_user_low(v_user_email_lc, v_other_email_lc);
  v_user_b := public.event_dm_user_high(v_user_email_lc, v_other_email_lc);

  insert into public.event_dm_threads (
    event_id,
    user_a_email_lc,
    user_b_email_lc
  )
  values (
    p_event_id,
    v_user_a,
    v_user_b
  )
  on conflict (event_id, user_a_email_lc, user_b_email_lc) do nothing;

  select t.id
  into v_thread_id
  from public.event_dm_threads t
  where t.event_id = p_event_id
    and t.user_a_email_lc = v_user_a
    and t.user_b_email_lc = v_user_b
  limit 1;

  insert into public.event_dm_reads (thread_id, user_email_lc, last_read_at)
  values (v_thread_id, v_user_email_lc, now())
  on conflict (thread_id, user_email_lc) do nothing;

  insert into public.event_dm_reads (thread_id, user_email_lc, last_read_at)
  values (v_thread_id, v_other_email_lc, now())
  on conflict (thread_id, user_email_lc) do nothing;

  return v_thread_id;
end;
$$;


ALTER FUNCTION "public"."get_or_create_event_dm_thread"("p_event_id" "uuid", "p_user_email" "text", "p_other_email" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "template" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "type" "text" DEFAULT 'event_updated'::"text" NOT NULL,
    "last_sent_at" timestamp with time zone,
    CONSTRAINT "notifications_outbox_type_check" CHECK (("type" = ANY (ARRAY['invite_created'::"text", 'host_message'::"text", 'event_cancelled'::"text", 'chat_message_batch'::"text", 'event_updated'::"text", 'rsvp_received'::"text", 'join_request_created'::"text", 'join_request_approved'::"text", 'join_request_denied'::"text", 'rsvp_deadline_reminder'::"text", 'event_dm_message'::"text", 'guest_rsvp_confirmation'::"text", 'reach_out_suggestion'::"text"])))
);


ALTER TABLE "public"."notifications_outbox" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_outbox"("p_limit" integer) RETURNS SETOF "public"."notifications_outbox"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.notifications_outbox
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED;
END;
$$;


ALTER FUNCTION "public"."get_pending_outbox"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_push_notifications"("p_limit" integer) RETURNS TABLE("id" "uuid", "event_id" "uuid", "recipient_email" "text", "type" "text", "payload" "jsonb", "device_token" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
with locked as (
  select *
  from notifications_outbox o
  where o.status = 'pending'
    and o.type in (
      'invite_created',
      'chat_message_batch',
      'event_updated',
      'rsvp_received',
      'join_request_created',
      'join_request_approved',
      'join_request_denied',
      'event_cancelled',
      'host_message',
      'rsvp_deadline_reminder',
      'event_dm_message'
    )
  order by o.created_at asc
  limit p_limit
  for update skip locked
),
tokens as (
  select distinct on (email_lc)
    email_lc,
    device_token
  from push_tokens
  order by email_lc, created_at desc
)
select
  l.id,
  l.event_id,
  l.recipient_email,
  l.type,
  l.payload,
  t.device_token
from locked l
join tokens t
  on t.email_lc = lower(trim(l.recipient_email));
$$;


ALTER FUNCTION "public"."get_pending_push_notifications"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_push_targets"("p_email" "text") RETURNS TABLE("device_token" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select device_token
  from push_tokens
  where email_lc = lower(trim(p_email));
$$;


ALTER FUNCTION "public"."get_push_targets"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_series_position"("p_event_id" "uuid") RETURNS TABLE("session_number" integer, "session_total" integer)
    LANGUAGE "sql" STABLE
    AS $$
  select
    x.session_number::integer,
    x.session_total::integer
  from (
    select
      e.id,
      row_number() over (order by e.starts_at asc nulls last, e.created_at asc) as session_number,
      count(*) over () as session_total
    from public.events e
    where e.series_id = (
      select series_id
      from public.events
      where id = p_event_id
    )
  ) x
  where x.id = p_event_id;
$$;


ALTER FUNCTION "public"."get_series_position"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_badge_count_for_email"("p_email_lc" "text") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with clean as (
    select lower(trim(p_email_lc)) as email_lc
  ),
  notif as (
    select coalesce(sum(ni.unread_count), 0)::integer as c
    from public.notifications_inbox ni
    join clean on clean.email_lc = ni.user_email_lc
    where ni.is_read = false
      and ni.dismissed_at is null
  ),
  my_threads as (
    select
      t.id as thread_id,
      case
        when t.user_a_email_lc = clean.email_lc then t.user_b_email_lc
        else t.user_a_email_lc
      end as counterpart_email_lc
    from public.event_dm_threads t
    cross join clean
    where clean.email_lc in (t.user_a_email_lc, t.user_b_email_lc)
      and t.last_message_at is not null
  ),
  dm_counts as (
    select
      mt.thread_id,
      count(*)::integer as unread_count
    from my_threads mt
    cross join clean
    left join public.event_dm_reads r
      on r.thread_id = mt.thread_id
     and r.user_email_lc = clean.email_lc
    join public.event_dm_messages m
      on m.thread_id = mt.thread_id
    where m.recipient_email_lc = clean.email_lc
      and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    group by mt.thread_id
  ),
  dm as (
    select coalesce(sum(dc.unread_count), 0)::integer as c
    from dm_counts dc
  )
  select notif.c + dm.c
  from notif, dm;
$$;


ALTER FUNCTION "public"."get_unread_badge_count_for_email"("p_email_lc" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (
    id,
    email_lc,
    full_name,
    created_at,
    updated_at
  )
  values (
    new.id,
    lower(new.email),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    now(),
    now()
  )
  on conflict (id) do update
  set
    email_lc = excluded.email_lc,
    updated_at = now();

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_profile_circle"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.social_circles (user_id, circle_name, members)
  VALUES (NEW.id, 'My Inner Circle', ARRAY[]::TEXT[])
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_profile_circle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_rsvp_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_guest_name text;
  v_response_label text;
begin
  if new.guest_token like 'HOST-%' then
    return new;
  end if;

  v_guest_name := coalesce(
    nullif(trim(new.name), ''),
    split_part(lower(trim(new.email_lc)), '@', 1),
    'Someone'
  );

  v_response_label := case lower(trim(new.status))
    when 'yes' then 'is going'
    when 'going' then 'is going'
    when 'maybe' then 'might go'
    when 'interested' then 'is interested'
    when 'no' then 'declined'
    when 'not_going' then 'declined'
    when 'declined' then 'declined'
    when 'voted' then 'voted'
    else 'responded'
  end;

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    payload
  )
  select
    e.id,
    e.host_email,
    'host_rsvp_notification',
    'rsvp_received',
    jsonb_build_object(
      'event_title', e.title,
      'guest_name', v_guest_name,
      'guest_email', lower(trim(new.email_lc)),
      'response', new.status,
      'response_label', v_response_label,
      'message', nullif(trim(new.message), ''),
      'manage_url', 'https://pallinky.com/m/' || e.manage_handle
    )
  from public.events e
  where e.id = new.event_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_rsvp_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hide_person_from_my_people"("p_email_lc" "text" DEFAULT NULL::"text", "p_phone_e164" "text" DEFAULT NULL::"text", "p_matched_user_id" "uuid" DEFAULT NULL::"uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_email_lc text;
  v_phone_e164 text;
  v_removed_circle_members integer := 0;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  v_email_lc := nullif(lower(trim(p_email_lc)), '');
  v_phone_e164 := nullif(trim(p_phone_e164), '');

  if v_phone_e164 is not null then
    v_phone_e164 := regexp_replace(v_phone_e164, '[\s\-\(\)]', '', 'g');
  end if;

  if v_email_lc is null and v_phone_e164 is null and p_matched_user_id is null then
    raise exception 'missing_identity';
  end if;

  insert into public.hidden_people (
    user_id,
    email_lc,
    phone_e164,
    matched_user_id,
    reason
  )
  values (
    v_user_id,
    v_email_lc,
    v_phone_e164,
    p_matched_user_id,
    p_reason
  )
  on conflict do nothing;

  delete from public.social_circle_members scm
  using public.social_circles sc
  where sc.id = scm.circle_id
    and sc.user_id = v_user_id
    and (
      (v_email_lc is not null and scm.member_email_lc = v_email_lc)
      or (v_phone_e164 is not null and scm.member_phone_e164 = v_phone_e164)
      or (p_matched_user_id is not null and scm.member_user_id = p_matched_user_id)
    );

  get diagnostics v_removed_circle_members = row_count;

  return json_build_object(
    'ok', true,
    'removed_circle_members', v_removed_circle_members
  );
end;
$$;


ALTER FUNCTION "public"."hide_person_from_my_people"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_chat_participant"("p_event_id" "uuid", "p_user_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email_lc text;
  v_decision record;
  v_is_participant boolean := false;
  v_event_type text;
begin
  v_email_lc := nullif(lower(trim(p_user_email)), '');

  if v_email_lc is null then
    return false;
  end if;

  select *
  into v_decision
  from public.get_event_access_decision(
    p_event_id := p_event_id,
    p_viewer_email := v_email_lc
  );

  if not coalesce(v_decision.can_see, false) then
    return false;
  end if;

  select coalesce(e.event_type, 'formal')
  into v_event_type
  from public.events e
  where e.id = p_event_id;

  if coalesce(v_decision.is_host, false) then
    return true;
  end if;

  select exists (
    select 1
    from public.rsvps r
    where r.event_id = p_event_id
      and r.email_lc = v_email_lc
      and (
        (v_event_type = 'formal' and lower(trim(coalesce(r.status, ''))) in ('yes', 'maybe', 'going'))
        or
        (v_event_type = 'vibe' and lower(trim(coalesce(r.status, ''))) in ('interested', 'yes', 'maybe', 'going'))
      )
  )
  into v_is_participant;

  return v_is_participant;
end;
$$;


ALTER FUNCTION "public"."is_event_chat_participant"("p_event_id" "uuid", "p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_dm_participant"("p_thread_id" "uuid", "p_user_email" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.event_dm_threads t
    where t.id = p_thread_id
      and lower(trim(p_user_email)) in (t.user_a_email_lc, t.user_b_email_lc)
  );
$$;


ALTER FUNCTION "public"."is_event_dm_participant"("p_thread_id" "uuid", "p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_event_chat_read"("p_event_id" "uuid", "p_user_email" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_thread_id uuid;
  v_user_email_lc text;
begin
  v_user_email_lc := nullif(lower(trim(p_user_email)), '');

  if v_user_email_lc is null then
    raise exception 'not_event_chat_participant';
  end if;

  if not public.is_event_chat_participant(p_event_id, v_user_email_lc) then
    raise exception 'not_event_chat_participant';
  end if;

  select id
  into v_thread_id
  from public.event_chat_threads
  where event_id = p_event_id
  limit 1;

  if v_thread_id is null then
    return;
  end if;

  insert into public.event_chat_reads (
    thread_id,
    user_email_lc,
    last_read_at
  )
  values (
    v_thread_id,
    v_user_email_lc,
    now()
  )
  on conflict (thread_id, user_email_lc)
  do update set last_read_at = now();
end;
$$;


ALTER FUNCTION "public"."mark_event_chat_read"("p_event_id" "uuid", "p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_event_dm_thread_read"("p_thread_id" "uuid", "p_user_email" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_email_lc text;
begin
  v_user_email_lc := nullif(lower(trim(p_user_email)), '');

  if v_user_email_lc is null then
    raise exception 'user_email_required';
  end if;

  if not public.is_event_dm_participant(p_thread_id, v_user_email_lc) then
    raise exception 'not_event_dm_participant';
  end if;

  insert into public.event_dm_reads (
    thread_id,
    user_email_lc,
    last_read_at
  )
  values (
    p_thread_id,
    v_user_email_lc,
    now()
  )
  on conflict (thread_id, user_email_lc)
  do update set
    last_read_at = excluded.last_read_at;
end;
$$;


ALTER FUNCTION "public"."mark_event_dm_thread_read"("p_thread_id" "uuid", "p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_group_read"("p_event_id" "uuid", "p_notification_type" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_email_lc text;
begin
  select email_lc
  into v_user_email_lc
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_user_email_lc is null then
    raise exception 'not_authenticated';
  end if;

  update public.notifications_inbox
  set
    unread_count = 0,
    is_read = true,
    read_at = now(),
    updated_at = now()
  where user_email_lc = v_user_email_lc
    and event_id is not distinct from p_event_id
    and (
      p_notification_type is null
      or notification_type = p_notification_type
    );
end;
$$;


ALTER FUNCTION "public"."mark_notification_group_read"("p_event_id" "uuid", "p_notification_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_outbox_failed"("p_id" "uuid", "p_error" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_attempts int;
BEGIN
  UPDATE notifications_outbox
  SET attempts = attempts + 1,
      last_error = p_error,
      last_attempt_at = now()
  WHERE id = p_id
  RETURNING attempts INTO v_attempts;

  -- If it failed for the 3rd time, raise a notice that shows up in Supabase Logs
  IF v_attempts >= 3 THEN
    RAISE WARNING 'CRITICAL_EMAIL_FAILURE: Message % failed after 3 attempts. Error: %', p_id, p_error;
  END IF;
END;
$$;


ALTER FUNCTION "public"."mark_outbox_failed"("p_id" "uuid", "p_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_outbox_sent"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.notifications_outbox
    SET status = 'sent',
        attempts = attempts + 1
    WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."mark_outbox_sent"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_push_sent"("p_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_updated int;
begin
  update notifications_outbox
  set status = 'sent',
      processed_at = now(),
      last_sent_at = now(),
      attempts = attempts + 1
  where id = p_id
    and status = 'pending';

  get diagnostics v_updated = row_count;

  return v_updated = 1;
end;
$$;


ALTER FUNCTION "public"."mark_push_sent"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_report_actioned"("p_report_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.reports
  set status = 'actioned',
      actioned_at = now(),
      reviewed_at = coalesce(reviewed_at, now())
  where id = p_report_id;
end;
$$;


ALTER FUNCTION "public"."mark_report_actioned"("p_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_report_reviewed"("p_report_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.reports
  set status = 'reviewed',
      reviewed_at = now()
  where id = p_report_id;
end;
$$;


ALTER FUNCTION "public"."mark_report_reviewed"("p_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_device_contacts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.device_contacts dc
  set matched_user_id = p.id
  from public.profiles p
  where dc.user_id = v_user_id
    and dc.email_lc is not null
    and p.email_lc = dc.email_lc
    and dc.matched_user_id is distinct from p.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."match_device_contacts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_event_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_changed boolean := false;
  v_host_email_lc text;
begin
  v_host_email_lc := lower(trim(new.host_email));

  if (old.starts_at is distinct from new.starts_at)
     or (old.ends_at is distinct from new.ends_at)
     or (old.location is distinct from new.location)
  then
    v_changed := true;
  end if;

  if v_changed then
    insert into public.notifications_outbox (
      event_id,
      recipient_email,
      template,
      type,
      payload
    )
    select distinct
      new.id,
      r.email_lc,
      'event_updated',
      'event_updated',
      jsonb_build_object(
        'event_id', new.id,
        'event_title', new.title,
        'starts_at', new.starts_at,
        'ends_at', new.ends_at,
        'location', new.location
      )
    from public.rsvps r
    where r.event_id = new.id
      and r.email_lc is not null
      and r.email_lc <> v_host_email_lc;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_event_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_invite_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_title text;
  v_host_name text;
  v_event_type text;
  v_series_id uuid;
begin
  select
    e.title,
    e.host_name,
    e.event_type,
    e.series_id
  into
    v_event_title,
    v_host_name,
    v_event_type,
    v_series_id
  from public.events e
  where e.id = new.event_id;

  if new.invitee_email_lc is not null then
    if exists (
      select 1
      from public.notifications_outbox o
      where o.event_id = new.event_id
        and o.type = 'invite_created'
        and lower(o.recipient_email) = lower(new.invitee_email_lc)
    ) then
      return new;
    end if;

    insert into public.notifications_outbox (
      event_id,
      recipient_email,
      template,
      type,
      payload
    )
    values (
      new.event_id,
      new.invitee_email_lc,
      'invite_created',
      'invite_created',
      jsonb_build_object(
        'event_id', new.event_id,
        'event_title', v_event_title,
        'host_name', v_host_name,
        'event_type', v_event_type,
        'is_series', v_series_id is not null,
        'series_id', v_series_id
      )
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_invite_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_event_chat_message"("p_event_id" "uuid", "p_sender_email" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_thread_id uuid;
  v_clean_body text;
  v_sender_email_lc text;
  v_event_title text;
begin
  v_clean_body := trim(p_body);
  v_sender_email_lc := lower(trim(p_sender_email));

  if v_clean_body is null or v_clean_body = '' then
    raise exception 'empty_message';
  end if;

  if not public.is_event_chat_participant(p_event_id, v_sender_email_lc) then
    raise exception 'not_event_chat_participant';
  end if;

  if exists (
    select 1
    from public.blocked_users b
    join public.rsvps r
      on r.event_id = p_event_id
     and r.email_lc is not null
    where
      (
        lower(trim(b.blocker_email)) = v_sender_email_lc
        and lower(trim(b.blocked_email)) = lower(trim(r.email_lc))
      )
      or
      (
        lower(trim(b.blocked_email)) = v_sender_email_lc
        and lower(trim(b.blocker_email)) = lower(trim(r.email_lc))
      )
  ) then
    raise exception 'blocked_user_interaction';
  end if;

  select id
  into v_thread_id
  from public.event_chat_threads
  where event_id = p_event_id
  limit 1;

  if v_thread_id is null then
    insert into public.event_chat_threads (event_id)
    values (p_event_id)
    returning id into v_thread_id;
  end if;

  insert into public.event_chat_messages (
    thread_id,
    event_id,
    sender_email_lc,
    body
  )
  values (
    v_thread_id,
    p_event_id,
    v_sender_email_lc,
    v_clean_body
  );

  select title
  into v_event_title
  from public.events
  where id = p_event_id;

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    payload
  )
  select distinct
    p_event_id,
    r.email_lc,
    'chat_message',
    'chat_message_batch',
    jsonb_build_object(
      'event_id', p_event_id,
      'event_title', v_event_title
    )
  from public.rsvps r
  where r.event_id = p_event_id
    and r.email_lc is not null
    and r.email_lc <> v_sender_email_lc
    and not exists (
      select 1
      from public.blocked_users b
      where
        (lower(trim(b.blocker_email)) = v_sender_email_lc and lower(trim(b.blocked_email)) = lower(trim(r.email_lc)))
        or
        (lower(trim(b.blocker_email)) = lower(trim(r.email_lc)) and lower(trim(b.blocked_email)) = v_sender_email_lc)
    )
    and public.chat_notification_allowed(p_event_id, r.email_lc);
end;
$$;


ALTER FUNCTION "public"."post_event_chat_message"("p_event_id" "uuid", "p_sender_email" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_invite_notification_if_rsvp_exists"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if exists (
    select 1
    from public.rsvps r
    where r.event_id = new.event_id
      and lower(r.email_lc) = lower(new.recipient_email)
  ) then
    return null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_invite_notification_if_rsvp_exists"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_device_contacts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_count int;
begin
  v_user_id := auth.uid();

  delete from public.device_contacts
  where user_id = v_user_id
    and id not in (
      select id
      from public.device_contacts
      where user_id = v_user_id
      order by updated_at desc
      limit 200
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."prune_device_contacts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_join_request"("p_request_id" "uuid", "p_decision" "text", "p_decided_by_email" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_req record;
begin
  select *
  into v_req
  from public.rsvp_join_requests
  where id = p_request_id
  limit 1;

  if v_req.id is null then
    raise exception 'request_not_found';
  end if;

  if v_req.status <> 'pending' then
    return;
  end if;

  -- APPROVE
  if p_decision = 'approved' then
    insert into public.rsvps (
      event_id,
      name,
      email,
      status,
      person_id,
      phone_e164
    )
    values (
      v_req.event_id,
      v_req.requester_name,
      v_req.requester_email,
      v_req.requested_status,
      v_req.person_id,
      v_req.requester_phone_e164
    )
    on conflict (event_id, email_lc)
    do update set
      status = excluded.status,
      name = excluded.name,
      person_id = coalesce(rsvps.person_id, excluded.person_id),
      updated_at = now();
  end if;

  -- UPDATE REQUEST
  update public.rsvp_join_requests
  set
    status = p_decision,
    decided_at = now(),
    decided_by_email_lc = lower(trim(p_decided_by_email)),
    updated_at = now()
  where id = p_request_id;

end;
$$;


ALTER FUNCTION "public"."resolve_join_request"("p_request_id" "uuid", "p_decision" "text", "p_decided_by_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_or_create_person"("p_email_lc" "text", "p_phone_e164" "text", "p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text;
  v_phone text;
  v_person_id uuid;
  v_email_person_id uuid;
  v_phone_person_id uuid;
begin
  v_email := nullif(lower(trim(p_email_lc)), '');
  v_phone := nullif(trim(p_phone_e164), '');

  if v_email is not null then
    select id
    into v_email_person_id
    from public.people
    where email_lc = v_email
    limit 1;
  end if;

  if v_phone is not null then
    select id
    into v_phone_person_id
    from public.people
    where phone_e164 = v_phone
    limit 1;
  end if;

  v_person_id := coalesce(v_email_person_id, v_phone_person_id);

  if v_person_id is null then
    begin
      insert into public.people (email_lc, phone_e164)
      values (v_email, v_phone)
      returning id into v_person_id;
    exception
      when unique_violation then
        select id
        into v_person_id
        from public.people
        where (v_email is not null and email_lc = v_email)
           or (v_phone is not null and phone_e164 = v_phone)
        limit 1;
    end;
  else
    update public.people
    set
      email_lc = case
        when public.people.email_lc is null
         and v_email is not null
         and v_email_person_id is null
        then v_email
        else public.people.email_lc
      end,
      phone_e164 = case
        when public.people.phone_e164 is null
         and v_phone is not null
         and v_phone_person_id is null
        then v_phone
        else public.people.phone_e164
      end
    where id = v_person_id;
  end if;

  return v_person_id;
end;
$$;


ALTER FUNCTION "public"."resolve_or_create_person"("p_email_lc" "text", "p_phone_e164" "text", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_or_create_person"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text;
  v_phone text;
  v_person_id uuid;
  v_email_person_id uuid;
  v_phone_person_id uuid;
begin
  v_email := nullif(lower(trim(p_email_lc)), '');
  v_phone := nullif(trim(p_phone_e164), '');

  if v_email is not null then
    select id into v_email_person_id
    from public.people
    where email_lc = v_email
    limit 1;
  end if;

  if v_phone is not null then
    select id into v_phone_person_id
    from public.people
    where phone_e164 = v_phone
    limit 1;
  end if;

  v_person_id := coalesce(v_email_person_id, v_phone_person_id);

  if v_person_id is null then
    begin
      insert into public.people (email_lc, phone_e164, matched_user_id)
      values (v_email, v_phone, p_matched_user_id)
      returning id into v_person_id;
    exception
      when unique_violation then
        select id into v_person_id
        from public.people
        where (v_email is not null and email_lc = v_email)
           or (v_phone is not null and phone_e164 = v_phone)
        limit 1;
    end;
  else
    update public.people
    set
      email_lc = case
        when public.people.email_lc is null
         and v_email is not null
         and v_email_person_id is null
        then v_email
        else public.people.email_lc
      end,
      phone_e164 = case
        when public.people.phone_e164 is null
         and v_phone is not null
         and v_phone_person_id is null
        then v_phone
        else public.people.phone_e164
      end,
      matched_user_id = coalesce(public.people.matched_user_id, p_matched_user_id)
    where id = v_person_id;
  end if;

  return v_person_id;
end;
$$;


ALTER FUNCTION "public"."resolve_or_create_person"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_event_invite"("p_event_id" "uuid", "p_invite_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_actor_email_lc text;
  v_event public.events%rowtype;
  v_invite public.event_invites%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select lower(trim(email_lc))
  into v_actor_email_lc
  from public.profiles
  where id = v_user_id
  limit 1;

  if v_actor_email_lc is null then
    raise exception 'profile_not_found';
  end if;

  select *
  into v_event
  from public.events
  where id = p_event_id
  limit 1;

  if v_event.id is null then
    raise exception 'event_not_found';
  end if;

  if lower(trim(v_event.host_email)) <> v_actor_email_lc then
    raise exception 'not_event_host';
  end if;

  select *
  into v_invite
  from public.event_invites
  where id = p_invite_id
    and event_id = p_event_id
  limit 1;

  if v_invite.id is null then
    raise exception 'invite_not_found';
  end if;

  update public.event_invites
  set
    status = 'revoked',
    revoked_at = now()
  where id = p_invite_id
    and event_id = p_event_id;

  delete from public.rsvp_join_requests
  where event_id = p_event_id
    and status = 'pending'
    and (
      (
        v_invite.invitee_email_lc is not null
        and requester_email_lc = v_invite.invitee_email_lc
      )
      or (
        v_invite.invitee_phone_e164 is not null
        and requester_phone_e164 = v_invite.invitee_phone_e164
      )
      or (
        v_invite.person_id is not null
        and person_id = v_invite.person_id
      )
    );

  return json_build_object(
    'ok', true,
    'invite_id', p_invite_id,
    'status', 'revoked'
  );
end;
$$;


ALTER FUNCTION "public"."revoke_event_invite"("p_event_id" "uuid", "p_invite_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_push_subscription"("p_email" "text", "p_subscription_json" "jsonb", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.push_subscriptions (email_lc, subscription_json, user_agent)
    VALUES (lower(trim(p_email)), p_subscription_json, p_user_agent)
    ON CONFLICT (email_lc, subscription_json) 
    DO UPDATE SET 
        updated_at = now(),
        user_agent = EXCLUDED.user_agent;
END;
$$;


ALTER FUNCTION "public"."save_push_subscription"("p_email" "text", "p_subscription_json" "jsonb", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_push_token"("p_email" "text", "p_device_token" "text", "p_platform" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from push_tokens
  where email_lc = lower(trim(p_email));

  insert into push_tokens (
    email_lc,
    device_token,
    platform,
    created_at
  )
  values (
    lower(trim(p_email)),
    p_device_token,
    p_platform,
    now()
  )
  on conflict (device_token)
  do update set
    email_lc = excluded.email_lc,
    platform = excluded.platform,
    created_at = now();
end;
$$;


ALTER FUNCTION "public"."save_push_token"("p_email" "text", "p_device_token" "text", "p_platform" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_event_dm_message"("p_event_id" "uuid", "p_sender_email" "text", "p_recipient_email" "text", "p_body" "text") RETURNS TABLE("thread_id" "uuid", "message_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_sender_email_lc text;
  v_recipient_email_lc text;
  v_clean_body text;
  v_thread_id uuid;
  v_message_id uuid;
  v_created_at timestamptz;
  v_event_title text;
  v_sender_name text;
begin
  v_sender_email_lc := nullif(lower(trim(p_sender_email)), '');
  v_recipient_email_lc := nullif(lower(trim(p_recipient_email)), '');
  v_clean_body := trim(coalesce(p_body, ''));

  if p_event_id is null then
    raise exception 'event_id_required';
  end if;

  if v_sender_email_lc is null or v_recipient_email_lc is null then
    raise exception 'participant_email_required';
  end if;

  if v_sender_email_lc = v_recipient_email_lc then
    raise exception 'cannot_dm_self';
  end if;

  if v_clean_body = '' then
    raise exception 'empty_message';
  end if;

  if exists (
    select 1
    from public.blocked_users b
    where
      (lower(trim(b.blocker_email)) = v_sender_email_lc and lower(trim(b.blocked_email)) = v_recipient_email_lc)
      or
      (lower(trim(b.blocker_email)) = v_recipient_email_lc and lower(trim(b.blocked_email)) = v_sender_email_lc)
  ) then
    raise exception 'blocked_user_interaction';
  end if;

  v_thread_id := public.get_or_create_event_dm_thread(
    p_event_id,
    v_sender_email_lc,
    v_recipient_email_lc
  );

  insert into public.event_dm_messages (
    thread_id,
    event_id,
    sender_email_lc,
    recipient_email_lc,
    body
  )
  values (
    v_thread_id,
    p_event_id,
    v_sender_email_lc,
    v_recipient_email_lc,
    v_clean_body
  )
  returning public.event_dm_messages.id, public.event_dm_messages.created_at
  into v_message_id, v_created_at;

  update public.event_dm_threads
  set
    last_message_at = v_created_at,
    last_message_preview = left(v_clean_body, 140)
  where public.event_dm_threads.id = v_thread_id;

  insert into public.event_dm_reads (
    thread_id,
    user_email_lc,
    last_read_at
  )
  values (
    v_thread_id,
    v_sender_email_lc,
    v_created_at
  )
  on conflict on constraint event_dm_reads_pkey
  do update set
    last_read_at = excluded.last_read_at;

  insert into public.event_dm_reads (
    thread_id,
    user_email_lc,
    last_read_at
  )
  values (
    v_thread_id,
    v_recipient_email_lc,
    '-infinity'::timestamptz
  )
  on conflict on constraint event_dm_reads_pkey
  do nothing;

  select e.title
  into v_event_title
  from public.events e
  where e.id = p_event_id
  limit 1;

  select coalesce(nullif(trim(p.full_name), ''), v_sender_email_lc)
  into v_sender_name
  from public.profiles p
  where p.email_lc = v_sender_email_lc
  limit 1;

  v_sender_name := coalesce(v_sender_name, v_sender_email_lc);

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    payload
  )
  values (
    p_event_id,
    v_recipient_email_lc,
    'event_dm_message',
    'event_dm_message',
    jsonb_build_object(
      'thread_id', v_thread_id,
      'message_id', v_message_id,
      'event_id', p_event_id,
      'event_title', v_event_title,
      'sender_email_lc', v_sender_email_lc,
      'sender_name', v_sender_name,
      'body', left(v_clean_body, 160)
    )
  );

  return query
  select v_thread_id, v_message_id, v_created_at;
end;
$$;


ALTER FUNCTION "public"."send_event_dm_message"("p_event_id" "uuid", "p_sender_email" "text", "p_recipient_email" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_host_message_by_manage_token"("p_manage_token" "text", "p_subject" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_id uuid;
  v_event_title text;
  v_host_name text;
  v_host_email_lc text;
  v_slug text;
begin
  select
    e.id,
    e.title,
    e.host_name,
    lower(trim(e.host_email)),
    e.slug
  into
    v_event_id,
    v_event_title,
    v_host_name,
    v_host_email_lc,
    v_slug
  from public.events e
  where e.manage_handle = p_manage_token
  limit 1;

  if v_event_id is null then
    raise exception 'Event not found';
  end if;

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    payload
  )
  select distinct
    v_event_id,
    r.email_lc,
    'host_message',
    'host_message',
    jsonb_build_object(
      'event_title', v_event_title,
      'host_name', v_host_name,
      'subject', p_subject,
      'message', p_body,
      'slug', v_slug
    )
  from public.rsvps r
  where r.event_id = v_event_id
    and r.email_lc is not null
    and r.email_lc <> v_host_email_lc;
end;
$$;


ALTER FUNCTION "public"."send_host_message_by_manage_token"("p_manage_token" "text", "p_subject" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_rsvp"("p_slug" "text", "p_name" "text", "p_status" "text", "p_guest_token" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_message" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_id uuid;
  v_email_lc text;
  v_guest_token text;
  v_person_id uuid;
  v_existing_person_id uuid;
  v_invitee_name text;
  v_best_name text;
  v_event_title text;
  v_host_name text;
begin
  select id, title, host_name
  into v_event_id, v_event_title, v_host_name
  from public.events
  where slug = p_slug
  limit 1;

  if v_event_id is null then
    return json_build_object('error', 'Event not found');
  end if;

  v_email_lc := nullif(lower(trim(p_email)), '');

  v_guest_token := coalesce(
    nullif(trim(p_guest_token), ''),
    md5(random()::text || clock_timestamp()::text || coalesce(v_email_lc, '') || coalesce(p_name, ''))
  );

  if v_email_lc is not null then
    select id into v_person_id
    from public.people
    where email_lc = v_email_lc
    limit 1;

    if v_person_id is null then
      insert into public.people (email_lc)
      values (v_email_lc)
      returning id into v_person_id;
    end if;
  end if;

  select ei.invitee_name
  into v_invitee_name
  from public.event_invites ei
  where ei.event_id = v_event_id
    and (
      (v_person_id is not null and ei.person_id = v_person_id)
      or (v_email_lc is not null and ei.invitee_email_lc = v_email_lc)
    )
  order by ei.created_at desc
  limit 1;

  v_best_name := coalesce(
    nullif(trim(v_invitee_name), ''),
    nullif(trim(p_name), ''),
    split_part(v_email_lc, '@', 1),
    'Someone'
  );

  insert into public.rsvps (
    event_id,
    name,
    status,
    guest_token,
    email,
    message,
    person_id
  )
  values (
    v_event_id,
    v_best_name,
    p_status,
    v_guest_token,
    p_email,
    p_message,
    v_person_id
  )
  on conflict on constraint rsvps_event_id_email_lc_key
  do update set
    name = excluded.name,
    status = excluded.status,
    message = excluded.message,
    guest_token = excluded.guest_token,
    email = excluded.email,
    person_id = excluded.person_id,
    updated_at = now();

  if v_email_lc is not null then
    insert into public.notifications_outbox (
      event_id,
      recipient_email,
      template,
      type,
      payload
    )
    values (
      v_event_id,
      v_email_lc,
      'guest_rsvp_confirmation',
      'guest_rsvp_confirmation',
      jsonb_build_object(
        'event_title', v_event_title,
        'host_name', v_host_name,
        'slug', p_slug,
        'response', p_status,
        'guest_name', v_best_name
      )
    );
  end if;

  return json_build_object('success', true);
end;
$$;


ALTER FUNCTION "public"."submit_rsvp"("p_slug" "text", "p_name" "text", "p_status" "text", "p_guest_token" "text", "p_email" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_rsvp_enriched"("p_event_id" "uuid", "p_name" "text", "p_email" "text", "p_status" "text", "p_phone_e164" "text" DEFAULT NULL::"text", "p_message" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
  v_email_lc text;
  v_localpart text;
  v_guest_name text;
  v_existing_name text;
  v_invite_name text;
  v_person_id uuid;
  v_guest_token text;
  v_decision record;
  v_result json;
  v_event_title text;
  v_host_name text;
  v_slug text;
begin
  v_email_lc := nullif(lower(trim(p_email)), '');
  v_localpart := split_part(coalesce(v_email_lc, ''), '@', 1);
  v_guest_token := md5(random()::text || clock_timestamp()::text || coalesce(v_email_lc, ''));

  if v_email_lc is null then
    return json_build_object('error', 'Email required');
  end if;

  select e.title, e.host_name, e.slug
  into v_event_title, v_host_name, v_slug
  from public.events e
  where e.id = p_event_id
  limit 1;

  v_person_id := public.resolve_or_create_person(
    v_email_lc,
    p_phone_e164,
    nullif(trim(p_name), '')
  );

  select r.name
  into v_existing_name
  from public.rsvps r
  where r.event_id = p_event_id
    and r.email_lc = v_email_lc
  order by r.updated_at desc nulls last
  limit 1;

  select ei.invitee_name
  into v_invite_name
  from public.event_invites ei
  where ei.event_id = p_event_id
    and (
      ei.invitee_email_lc = v_email_lc
      or (v_person_id is not null and ei.person_id = v_person_id)
    )
    and nullif(trim(ei.invitee_name), '') is not null
  order by ei.id desc
  limit 1;

  v_guest_name := coalesce(
    nullif(trim(p_name), ''),
    case
      when nullif(trim(v_existing_name), '') is not null
       and lower(trim(v_existing_name)) <> v_localpart
      then trim(v_existing_name)
      else null
    end,
    nullif(trim(v_invite_name), ''),
    nullif(trim(v_existing_name), ''),
    v_localpart,
    'Someone'
  );

  select *
  into v_decision
  from public.get_event_access_decision(
    p_event_id := p_event_id,
    p_viewer_email := v_email_lc,
    p_guest_token := v_guest_token
  );

  if not coalesce(v_decision.can_see, false) then
    return json_build_object('error', 'viewer_cannot_see_event');
  end if;

  if coalesce(v_decision.requires_host_approval, false) then
    insert into public.rsvp_join_requests (
      event_id,
      requester_name,
      requester_email,
      guest_token,
      requested_status,
      message,
      source,
      status,
      person_id
    )
    values (
      p_event_id,
      v_guest_name,
      v_email_lc,
      v_guest_token,
      coalesce(nullif(trim(lower(p_status)), ''), 'interested'),
      nullif(trim(p_message), ''),
      'rsvp',
      'pending',
      v_person_id
    );

    return json_build_object(
      'success', false,
      'join_request_created', true,
      'reason', 'approval_required'
    );
  end if;

  if not coalesce(v_decision.can_rsvp, false) then
    return json_build_object('error', coalesce(v_decision.reason, 'viewer_cannot_rsvp'));
  end if;

  insert into public.rsvps (
    event_id,
    name,
    email,
    status,
    guest_token,
    person_id
  )
  values (
    p_event_id,
    v_guest_name,
    v_email_lc,
    coalesce(nullif(trim(lower(p_status)), ''), 'interested'),
    v_guest_token,
    v_person_id
  )
  on conflict on constraint rsvps_event_id_email_lc_key
  do update set
    name = excluded.name,
    status = excluded.status,
    email = excluded.email,
    person_id = coalesce(public.rsvps.person_id, excluded.person_id),
    guest_token = excluded.guest_token,
    updated_at = now()
  returning json_build_object(
    'success', true,
    'email_lc', rsvps.email_lc,
    'status', rsvps.status,
    'guest_token', rsvps.guest_token
  )
  into v_result;

  insert into public.notifications_outbox (
    event_id,
    recipient_email,
    template,
    type,
    payload
  )
  values (
    p_event_id,
    v_email_lc,
    'guest_rsvp_confirmation',
    'guest_rsvp_confirmation',
    jsonb_build_object(
      'event_title', v_event_title,
      'host_name', v_host_name,
      'slug', v_slug,
      'response', coalesce(nullif(trim(lower(p_status)), ''), 'interested'),
      'guest_name', v_guest_name,
      'token', v_guest_token
    )
  );

  return v_result;
end;
$$;


ALTER FUNCTION "public"."submit_rsvp_enriched"("p_event_id" "uuid", "p_name" "text", "p_email" "text", "p_status" "text", "p_phone_e164" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_vibe_rsvp"("p_slug" "text", "p_user_email" "text", "p_guest_name" "text" DEFAULT NULL::"text", "p_selected_dates" "text"[] DEFAULT '{}'::"text"[], "p_note" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'interested'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$declare
  v_event_id uuid;
  v_email_lc text;
  v_guest_token text;
  v_person_id uuid;
  v_invitee_name text;
  v_profile_name text;
  v_final_name text;
begin
  v_email_lc := nullif(lower(trim(p_user_email)), '');

  select id into v_event_id
  from public.events
  where slug = p_slug
  limit 1;

  if v_event_id is null then
    return json_build_object('error', 'Event not found');
  end if;

v_guest_token := md5(random()::text || clock_timestamp()::text || coalesce(v_email_lc, ''));

  v_person_id := public.resolve_or_create_person(
    v_email_lc,
    null,
    p_guest_name
  );

  select ei.invitee_name
  into v_invitee_name
  from public.event_invites ei
  where ei.event_id = v_event_id
    and (
      ei.person_id = v_person_id
      or (v_email_lc is not null and ei.invitee_email_lc = v_email_lc)
    )
  order by ei.created_at desc
  limit 1;

  if v_invitee_name is null then
    select full_name
    into v_profile_name
    from public.profiles
    where email_lc = v_email_lc
    limit 1;
  end if;

  v_final_name := coalesce(
    nullif(trim(v_invitee_name), ''),
    nullif(trim(v_profile_name), ''),
    nullif(trim(p_guest_name), ''),
    split_part(v_email_lc, '@', 1),
    'Someone'
  );

  insert into public.vibe_responses (
    event_id,
    guest_name,
    selected_dates,
    note,
    user_email
  )
  values (
    v_event_id,
    v_final_name,
    coalesce(p_selected_dates, '{}'::text[]),
    nullif(trim(p_note), ''),
    v_email_lc
  )
  on conflict (event_id, user_email)
  do update set
    guest_name = excluded.guest_name,
    selected_dates = excluded.selected_dates,
    note = excluded.note;

  -- ✅ FIX: removed email_lc column from insert
  insert into public.rsvps (
  event_id,
  name,
  email,
  status,
  guest_token,
  person_id,
  responded_at,
  updated_at
)
values (
  v_event_id,
  v_final_name,
  v_email_lc,
  'voted',
  v_guest_token,
  v_person_id,
  now(),
  now()
)
on conflict on constraint rsvps_event_id_email_lc_key
do update set
  name = excluded.name,
  status = 'voted',
  person_id = excluded.person_id,
  updated_at = now();

    return json_build_object(
    'success', true,
    'guest_token', v_guest_token
  );
end;$$;


ALTER FUNCTION "public"."submit_vibe_rsvp"("p_slug" "text", "p_user_email" "text", "p_guest_name" "text", "p_selected_dates" "text"[], "p_note" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_device_contacts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_device_contacts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_event_dm_threads_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_event_dm_threads_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_notifications_inbox_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_notifications_inbox_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_rsvp_join_requests_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_rsvp_join_requests_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unhide_person_from_my_people"("p_email_lc" "text" DEFAULT NULL::"text", "p_phone_e164" "text" DEFAULT NULL::"text", "p_matched_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_email_lc text;
  v_phone_e164 text;
  v_deleted integer := 0;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  v_email_lc := nullif(lower(trim(p_email_lc)), '');
  v_phone_e164 := nullif(trim(p_phone_e164), '');

  if v_phone_e164 is not null then
    v_phone_e164 := regexp_replace(v_phone_e164, '[\s\-\(\)]', '', 'g');
  end if;

  delete from public.hidden_people hp
  where hp.user_id = v_user_id
    and (
      (v_email_lc is not null and hp.email_lc = v_email_lc)
      or (v_phone_e164 is not null and hp.phone_e164 = v_phone_e164)
      or (p_matched_user_id is not null and hp.matched_user_id = p_matched_user_id)
    );

  get diagnostics v_deleted = row_count;

  return json_build_object(
    'ok', true,
    'restored', v_deleted
  );
end;
$$;


ALTER FUNCTION "public"."unhide_person_from_my_people"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event_by_manage_token"("p_manage_token" "text", "p_title" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_description" "text", "p_cover_image_url" "text", "p_expires_at" timestamp with time zone, "p_gif_key" "text", "p_event_type" "text", "p_proposed_dates" "text"[], "p_visibility" integer, "p_invite_list_visibility" "text", "p_guest_list_visibility" "text", "p_send_rsvp_reminders" boolean, "p_remind_after_days" integer, "p_rsvp_deadline" "date", "p_send_final_reminder_at_deadline" boolean, "p_forwarding_mode" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
  where manage_handle = p_manage_token;
end;
$$;


ALTER FUNCTION "public"."update_event_by_manage_token"("p_manage_token" "text", "p_title" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_description" "text", "p_cover_image_url" "text", "p_expires_at" timestamp with time zone, "p_gif_key" "text", "p_event_type" "text", "p_proposed_dates" "text"[], "p_visibility" integer, "p_invite_list_visibility" "text", "p_guest_list_visibility" "text", "p_send_rsvp_reminders" boolean, "p_remind_after_days" integer, "p_rsvp_deadline" "date", "p_send_final_reminder_at_deadline" boolean, "p_forwarding_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_device_contacts"("p_contacts" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_contact jsonb;
  v_count integer := 0;
  v_display_name text;
  v_phone_e164 text;
  v_email_lc text;
  v_device_contact_id text;
  v_avatar_uri text;
  v_target_id uuid;
  v_device_match_id uuid;
  v_email_match_id uuid;
  v_phone_match_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if jsonb_typeof(p_contacts) <> 'array' then
    raise exception 'p_contacts_must_be_json_array';
  end if;

  for v_contact in
    select value from jsonb_array_elements(p_contacts)
  loop
    v_display_name := nullif(trim(v_contact->>'display_name'), '');
    v_phone_e164 := nullif(trim(v_contact->>'phone_e164'), '');
    v_email_lc := lower(nullif(trim(v_contact->>'email_lc'), ''));
    v_device_contact_id := nullif(trim(v_contact->>'device_contact_id'), '');
    v_avatar_uri := nullif(trim(v_contact->>'avatar_uri'), '');

    if v_phone_e164 is null and v_email_lc is null then
      continue;
    end if;

    v_target_id := null;
    v_device_match_id := null;
    v_email_match_id := null;
    v_phone_match_id := null;

    if v_device_contact_id is not null then
      select id into v_device_match_id
      from public.device_contacts
      where user_id = v_user_id
        and device_contact_id = v_device_contact_id
      limit 1;
    end if;

    if v_email_lc is not null then
      select id into v_email_match_id
      from public.device_contacts
      where user_id = v_user_id
        and email_lc = v_email_lc
      limit 1;
    end if;

    if v_phone_e164 is not null then
      select id into v_phone_match_id
      from public.device_contacts
      where user_id = v_user_id
        and phone_e164 = v_phone_e164
      limit 1;
    end if;

    v_target_id := coalesce(v_device_match_id, v_email_match_id, v_phone_match_id);

    if v_target_id is not null then
      update public.device_contacts
      set
        display_name = coalesce(v_display_name, display_name),
        avatar_uri = coalesce(v_avatar_uri, avatar_uri),
        device_contact_id = coalesce(device_contact_id, v_device_contact_id),
        email_lc = coalesce(email_lc, v_email_lc),
        phone_e164 = coalesce(phone_e164, v_phone_e164)
      where id = v_target_id;

      v_count := v_count + 1;
      continue;
    end if;

    insert into public.device_contacts (
      user_id,
      display_name,
      phone_e164,
      email_lc,
      device_contact_id,
      avatar_uri
    )
    values (
      v_user_id,
      v_display_name,
      v_phone_e164,
      v_email_lc,
      v_device_contact_id,
      v_avatar_uri
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."upsert_device_contacts"("p_contacts" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_notifications_inbox_from_outbox"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_email_lc text;
  v_group_key text;
  v_message text;
begin
  v_user_email_lc := lower(trim(new.recipient_email));

  if v_user_email_lc is null or v_user_email_lc = '' then
    return new;
  end if;

  if new.type = 'event_dm_message' then
    return new;
  end if;

  v_group_key := public.build_notification_group_key(
    v_user_email_lc,
    new.event_id,
    new.type
  );

  v_message :=
    case new.type
      when 'rsvp_received' then
        trim(
          coalesce(new.payload->>'guest_name', 'Someone')
          || ' '
          || coalesce(new.payload->>'response_label', 'responded')
          || case
            when nullif(trim(coalesce(new.payload->>'message', '')), '') is not null
            then ': "' || trim(new.payload->>'message') || '"'
            else ''
          end
        )
      when 'invite_created' then coalesce(new.payload->>'event_title', 'You have a new invite')
      when 'chat_message_batch' then coalesce(new.payload->>'event_title', 'New messages')
      when 'event_updated' then coalesce(new.payload->>'event_title', 'Event updated')
      when 'join_request_created' then coalesce(new.payload->>'guest_name', 'Someone')
      when 'join_request_approved' then coalesce(new.payload->>'event_title', 'Request approved')
      when 'join_request_denied' then coalesce(new.payload->>'event_title', 'Request declined')
      when 'event_cancelled' then coalesce(new.payload->>'event_title', 'Event cancelled')
      when 'host_message' then coalesce(new.payload->>'message', new.payload->>'subject', 'Message from host')
      when 'rsvp_deadline_reminder' then coalesce(new.payload->>'event_title', 'RSVP reminder')
      when 'guest_rsvp_confirmation' then coalesce(new.payload->>'event_title', 'RSVP recorded')
      else coalesce(new.payload->>'event_title', 'Notification')
    end;

  insert into public.notifications_inbox (
    user_email_lc,
    event_id,
    notification_type,
    group_key,
    latest_outbox_id,
    latest_payload,
    latest_message,
    unread_count,
    total_count,
    is_read,
    first_received_at,
    last_received_at
  )
  values (
    v_user_email_lc,
    new.event_id,
    new.type,
    v_group_key,
    new.id,
    coalesce(new.payload, '{}'::jsonb),
    v_message,
    1,
    1,
    false,
    now(),
    now()
  )
  on conflict (group_key)
  do update set
    latest_outbox_id = excluded.latest_outbox_id,
    latest_payload = excluded.latest_payload,
    latest_message = excluded.latest_message,
    unread_count = public.notifications_inbox.unread_count + 1,
    total_count = public.notifications_inbox.total_count + 1,
    is_read = false,
    read_at = null,
    last_received_at = now(),
    updated_at = now();

  return new;
end;
$$;


ALTER FUNCTION "public"."upsert_notifications_inbox_from_outbox"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_email" "text" NOT NULL,
    "blocked_email" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."blocked_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."closed_cards" (
    "id" bigint NOT NULL,
    "user_email_lc" "text" NOT NULL,
    "event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."closed_cards" OWNER TO "postgres";


ALTER TABLE "public"."closed_cards" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."closed_cards_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."device_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "phone_e164" "text",
    "email_lc" "text",
    "device_contact_id" "text",
    "avatar_uri" "text",
    "matched_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "person_id" "uuid",
    CONSTRAINT "device_contacts_contact_required" CHECK ((("phone_e164" IS NOT NULL) OR ("email_lc" IS NOT NULL)))
);

ALTER TABLE ONLY "public"."device_contacts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."device_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "email_lc" "text" NOT NULL,
    "is_unsubscribed" boolean DEFAULT false NOT NULL,
    "unsubscribed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sender_email_lc" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone
);


ALTER TABLE "public"."event_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_chat_reads" (
    "thread_id" "uuid" NOT NULL,
    "user_email_lc" "text" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_chat_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_chat_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_chat_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_dm_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sender_email_lc" "text" NOT NULL,
    "recipient_email_lc" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    CONSTRAINT "event_dm_messages_distinct_participants_chk" CHECK (("sender_email_lc" <> "recipient_email_lc")),
    CONSTRAINT "event_dm_messages_nonempty_body_chk" CHECK (("length"(TRIM(BOTH FROM "body")) > 0))
);


ALTER TABLE "public"."event_dm_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_dm_reads" (
    "thread_id" "uuid" NOT NULL,
    "user_email_lc" "text" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_dm_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_dm_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_a_email_lc" "text" NOT NULL,
    "user_b_email_lc" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone,
    "last_message_preview" "text",
    CONSTRAINT "event_dm_threads_distinct_users_chk" CHECK (("user_a_email_lc" <> "user_b_email_lc")),
    CONSTRAINT "event_dm_threads_sorted_users_chk" CHECK (("user_a_email_lc" < "user_b_email_lc"))
);


ALTER TABLE "public"."event_dm_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "invitee_email_lc" "text",
    "invitee_phone_e164" "text",
    "invitee_name" "text",
    "invited_by_email_lc" "text" NOT NULL,
    "invited_by_invite_id" "uuid",
    "source_type" "text" NOT NULL,
    "source_ref" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "can_forward" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claimed_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "requires_host_approval" boolean DEFAULT false NOT NULL,
    "device_contact_id" "uuid",
    "person_id" "uuid",
    CONSTRAINT "event_invites_identifier_check" CHECK ((("invitee_email_lc" IS NOT NULL) OR ("invitee_phone_e164" IS NOT NULL))),
    CONSTRAINT "event_invites_source_type_check" CHECK (("source_type" = ANY (ARRAY['host_friend'::"text", 'host_circle'::"text", 'host_manual'::"text", 'forward'::"text"]))),
    CONSTRAINT "event_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."event_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text",
    "content" "text",
    "context" "text"
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hidden_people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_lc" "text",
    "phone_e164" "text",
    "matched_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hidden_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text",
    CONSTRAINT "hidden_people_identity_check" CHECK ((("email_lc" IS NOT NULL) OR ("phone_e164" IS NOT NULL) OR ("matched_user_id" IS NOT NULL)))
);


ALTER TABLE "public"."hidden_people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rsvps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "guest_token" "text",
    "name" "text" NOT NULL,
    "email" "text",
    "email_lc" "text" GENERATED ALWAYS AS ("lower"(TRIM(BOTH FROM "email"))) STORED,
    "status" "text" NOT NULL,
    "message" "text",
    "responded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "person_id" "uuid",
    "phone_e164" "text"
);


ALTER TABLE "public"."rsvps" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."member_stats" AS
 SELECT "email_lc",
    "count"("id") AS "total_events",
    "max"("updated_at") AS "last_seen",
    "array_agg"(DISTINCT "event_id") AS "shared_event_ids"
   FROM "public"."rsvps"
  GROUP BY "email_lc";


ALTER VIEW "public"."member_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications_inbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email_lc" "text" NOT NULL,
    "event_id" "uuid",
    "notification_type" "text" NOT NULL,
    "group_key" "text" NOT NULL,
    "latest_outbox_id" "uuid",
    "latest_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "latest_message" "text",
    "unread_count" integer DEFAULT 0 NOT NULL,
    "total_count" integer DEFAULT 0 NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "first_received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dismissed_at" timestamp with time zone
);


ALTER TABLE "public"."notifications_inbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_lc" "text",
    "phone_e164" "text",
    "matched_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_lc" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."predicted_circles" AS
 SELECT "r"."name",
    "count"("r"."event_id") AS "total_hangouts",
    "max"("r"."responded_at") AS "last_seen",
        CASE
            WHEN ("count"("r"."event_id") >= 4) THEN 'Inner Circle'::"text"
            WHEN ("count"("r"."event_id") >= 2) THEN 'Frequent'::"text"
            ELSE 'New Connection'::"text"
        END AS "circle_type",
        CASE
            WHEN ("max"("r"."responded_at") < ("now"() - '30 days'::interval)) THEN 'Reach Out? 💌'::"text"
            ELSE NULL::"text"
        END AS "status_tag",
    "r"."email_lc",
    "p"."avatar_url"
   FROM ("public"."rsvps" "r"
     LEFT JOIN "public"."profiles" "p" ON (("r"."email_lc" = "p"."email_lc")))
  WHERE ("r"."status" = 'yes'::"text")
  GROUP BY "r"."name", "r"."email_lc", "p"."avatar_url"
  ORDER BY ("count"("r"."event_id")) DESC;


ALTER VIEW "public"."predicted_circles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "subscription_json" "jsonb" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions_pwa_old" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_lc" "text" NOT NULL,
    "subscription_json" "jsonb" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions_pwa_old" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_lc" "text" NOT NULL,
    "device_token" "text" NOT NULL,
    "platform" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reach_out_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "responder_email_lc" "text" NOT NULL,
    "response_type" "text" NOT NULL,
    "response_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "suggested_dates" "jsonb",
    "suggested_location" "text",
    CONSTRAINT "reach_out_responses_response_type_check" CHECK (("response_type" = ANY (ARRAY['interested'::"text", 'suggest_time'::"text", 'suggest_place'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."reach_out_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_email" "text",
    "target_type" "text",
    "target_id" "uuid",
    "reason" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'open'::"text",
    "reviewed_at" timestamp with time zone,
    "actioned_at" timestamp with time zone,
    "target_user_email" "text",
    "details" "text"
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rsvp_join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "requester_name" "text" NOT NULL,
    "requester_email" "text",
    "requester_email_lc" "text" GENERATED ALWAYS AS ("lower"(TRIM(BOTH FROM "requester_email"))) STORED,
    "requester_phone_e164" "text",
    "guest_token" "text",
    "requested_status" "text" NOT NULL,
    "message" "text",
    "source" "text" DEFAULT 'rsvp'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "decided_at" timestamp with time zone,
    "decided_by_email_lc" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "person_id" "uuid",
    CONSTRAINT "rsvp_join_requests_identifier_check" CHECK ((("requester_email_lc" IS NOT NULL) OR ("requester_phone_e164" IS NOT NULL) OR ("guest_token" IS NOT NULL))),
    CONSTRAINT "rsvp_join_requests_requested_status_check" CHECK (("lower"(TRIM(BOTH FROM "requested_status")) = ANY (ARRAY['yes'::"text", 'maybe'::"text", 'no'::"text", 'going'::"text", 'interested'::"text"]))),
    CONSTRAINT "rsvp_join_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'denied'::"text"])))
);


ALTER TABLE "public"."rsvp_join_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rsvp_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."rsvp_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_circle_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "circle_id" "uuid" NOT NULL,
    "member_name" "text",
    "member_email_lc" "text",
    "member_user_id" "uuid",
    "sort_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "member_phone_e164" "text",
    "device_contact_id" "uuid",
    "person_id" "uuid",
    CONSTRAINT "social_circle_members_email_or_name_chk" CHECK ((COALESCE(NULLIF(TRIM(BOTH FROM "member_email_lc"), ''::"text"), NULLIF(TRIM(BOTH FROM "member_name"), ''::"text")) IS NOT NULL))
);


ALTER TABLE "public"."social_circle_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_circles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "circle_name" "text" NOT NULL,
    "members" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."social_circles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_intent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "user_email" "text" NOT NULL,
    "keep_in_loop" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."social_intent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vibe_responses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid",
    "guest_name" "text" NOT NULL,
    "selected_dates" "text"[],
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_email" "text"
);


ALTER TABLE "public"."vibe_responses" OWNER TO "postgres";


ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."closed_cards"
    ADD CONSTRAINT "closed_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."closed_cards"
    ADD CONSTRAINT "closed_cards_user_email_lc_event_id_key" UNIQUE ("user_email_lc", "event_id");



ALTER TABLE ONLY "public"."device_contacts"
    ADD CONSTRAINT "device_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_subscriptions"
    ADD CONSTRAINT "email_subscriptions_event_id_email_lc_key" UNIQUE ("event_id", "email_lc");



ALTER TABLE ONLY "public"."email_subscriptions"
    ADD CONSTRAINT "email_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_chat_messages"
    ADD CONSTRAINT "event_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_chat_reads"
    ADD CONSTRAINT "event_chat_reads_pkey" PRIMARY KEY ("thread_id", "user_email_lc");



ALTER TABLE ONLY "public"."event_chat_threads"
    ADD CONSTRAINT "event_chat_threads_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."event_chat_threads"
    ADD CONSTRAINT "event_chat_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_dm_messages"
    ADD CONSTRAINT "event_dm_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_dm_reads"
    ADD CONSTRAINT "event_dm_reads_pkey" PRIMARY KEY ("thread_id", "user_email_lc");



ALTER TABLE ONLY "public"."event_dm_threads"
    ADD CONSTRAINT "event_dm_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_event_email_key" UNIQUE ("event_id", "invitee_email_lc");



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_event_phone_key" UNIQUE ("event_id", "invitee_phone_e164");



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_manage_handle_key" UNIQUE ("manage_handle");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hidden_people"
    ADD CONSTRAINT "hidden_people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications_inbox"
    ADD CONSTRAINT "notifications_inbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications_outbox"
    ADD CONSTRAINT "notifications_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vibe_responses"
    ADD CONSTRAINT "one_vote_per_user" UNIQUE ("event_id", "user_email");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_lc_key" UNIQUE ("email_lc");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions_pwa_old"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_device_token_key" UNIQUE ("device_token");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_email_lc_device_token_key" UNIQUE ("email_lc", "device_token");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reach_out_responses"
    ADD CONSTRAINT "reach_out_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rsvp_join_requests"
    ADD CONSTRAINT "rsvp_join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rsvp_tokens"
    ADD CONSTRAINT "rsvp_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rsvp_tokens"
    ADD CONSTRAINT "rsvp_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_event_id_email_key" UNIQUE ("event_id", "email");



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_event_id_email_lc_key" UNIQUE ("event_id", "email_lc");



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_circle_members"
    ADD CONSTRAINT "social_circle_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_circles"
    ADD CONSTRAINT "social_circles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_intent"
    ADD CONSTRAINT "social_intent_event_id_user_email_key" UNIQUE ("event_id", "user_email");



ALTER TABLE ONLY "public"."social_intent"
    ADD CONSTRAINT "social_intent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions_pwa_old"
    ADD CONSTRAINT "unique_user_subscription" UNIQUE ("email_lc", "subscription_json");



ALTER TABLE ONLY "public"."vibe_responses"
    ADD CONSTRAINT "vibe_responses_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "device_contacts_device_dedupe" ON "public"."device_contacts" USING "btree" ("user_id", "device_contact_id") WHERE ("device_contact_id" IS NOT NULL);



CREATE UNIQUE INDEX "device_contacts_email_dedupe" ON "public"."device_contacts" USING "btree" ("user_id", "email_lc") WHERE ("email_lc" IS NOT NULL);



CREATE INDEX "device_contacts_email_lookup" ON "public"."device_contacts" USING "btree" ("email_lc");



CREATE UNIQUE INDEX "device_contacts_phone_dedupe" ON "public"."device_contacts" USING "btree" ("user_id", "phone_e164") WHERE ("phone_e164" IS NOT NULL);



CREATE INDEX "device_contacts_phone_lookup" ON "public"."device_contacts" USING "btree" ("phone_e164");



CREATE INDEX "device_contacts_user_idx" ON "public"."device_contacts" USING "btree" ("user_id");



CREATE INDEX "event_dm_messages_recipient_created_idx" ON "public"."event_dm_messages" USING "btree" ("recipient_email_lc", "created_at" DESC);



CREATE INDEX "event_dm_messages_thread_created_idx" ON "public"."event_dm_messages" USING "btree" ("thread_id", "created_at");



CREATE INDEX "event_dm_reads_user_email_idx" ON "public"."event_dm_reads" USING "btree" ("user_email_lc");



CREATE INDEX "event_dm_threads_event_id_idx" ON "public"."event_dm_threads" USING "btree" ("event_id");



CREATE UNIQUE INDEX "event_dm_threads_event_pair_uidx" ON "public"."event_dm_threads" USING "btree" ("event_id", "user_a_email_lc", "user_b_email_lc");



CREATE INDEX "event_dm_threads_last_message_at_idx" ON "public"."event_dm_threads" USING "btree" ("last_message_at" DESC NULLS LAST);



CREATE INDEX "event_invites_email_idx" ON "public"."event_invites" USING "btree" ("invitee_email_lc");



CREATE INDEX "event_invites_event_id_idx" ON "public"."event_invites" USING "btree" ("event_id");



CREATE INDEX "event_invites_phone_idx" ON "public"."event_invites" USING "btree" ("invitee_phone_e164");



CREATE INDEX "event_invites_status_idx" ON "public"."event_invites" USING "btree" ("status");



CREATE INDEX "events_series_id_idx" ON "public"."events" USING "btree" ("series_id");



CREATE INDEX "hidden_people_user_email_idx" ON "public"."hidden_people" USING "btree" ("user_id", "email_lc");



CREATE UNIQUE INDEX "hidden_people_user_identity_uniq" ON "public"."hidden_people" USING "btree" ("user_id", COALESCE("email_lc", ''::"text"), COALESCE("phone_e164", ''::"text"), COALESCE("matched_user_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE INDEX "hidden_people_user_matched_idx" ON "public"."hidden_people" USING "btree" ("user_id", "matched_user_id");



CREATE INDEX "hidden_people_user_phone_idx" ON "public"."hidden_people" USING "btree" ("user_id", "phone_e164");



CREATE INDEX "idx_blocked_users_lookup" ON "public"."blocked_users" USING "btree" ("blocker_email", "blocked_email");



CREATE INDEX "idx_event_chat_messages_thread_created" ON "public"."event_chat_messages" USING "btree" ("thread_id", "created_at");



CREATE INDEX "idx_event_chat_reads_thread_user" ON "public"."event_chat_reads" USING "btree" ("thread_id", "user_email_lc");



CREATE INDEX "idx_event_chat_threads_event" ON "public"."event_chat_threads" USING "btree" ("event_id");



CREATE INDEX "idx_events_host_email" ON "public"."events" USING "btree" ("host_email");



CREATE INDEX "idx_events_manage_handle" ON "public"."events" USING "btree" ("manage_handle");



CREATE INDEX "idx_notifications_outbox_event_recipient_type" ON "public"."notifications_outbox" USING "btree" ("event_id", "recipient_email", "type", "created_at" DESC);



CREATE INDEX "idx_notifications_outbox_last_sent" ON "public"."notifications_outbox" USING "btree" ("event_id", "recipient_email", "last_sent_at") WHERE ("type" = 'chat_message_batch'::"text");



CREATE INDEX "idx_notifications_outbox_pending" ON "public"."notifications_outbox" USING "btree" ("status", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_notifications_outbox_recipient" ON "public"."notifications_outbox" USING "btree" ("recipient_email");



CREATE INDEX "idx_notifications_outbox_recipient_event_type" ON "public"."notifications_outbox" USING "btree" ("recipient_email", "event_id", "type");



CREATE INDEX "idx_notifications_outbox_status_created" ON "public"."notifications_outbox" USING "btree" ("status", "created_at");



CREATE INDEX "idx_notifications_outbox_type" ON "public"."notifications_outbox" USING "btree" ("type");



CREATE INDEX "idx_push_tokens_email" ON "public"."push_tokens" USING "btree" ("email_lc");



CREATE INDEX "idx_push_tokens_email_token" ON "public"."push_tokens" USING "btree" ("email_lc", "device_token");



CREATE INDEX "idx_rsvp_tokens_event_email" ON "public"."rsvp_tokens" USING "btree" ("event_id", "email");



CREATE INDEX "idx_rsvp_tokens_token" ON "public"."rsvp_tokens" USING "btree" ("token");



CREATE INDEX "idx_rsvps_person_id" ON "public"."rsvps" USING "btree" ("person_id");



CREATE UNIQUE INDEX "notifications_inbox_group_key_idx" ON "public"."notifications_inbox" USING "btree" ("group_key");



CREATE INDEX "notifications_inbox_user_dismissed_idx" ON "public"."notifications_inbox" USING "btree" ("user_email_lc", "dismissed_at", "last_received_at" DESC);



CREATE INDEX "notifications_inbox_user_event_type_idx" ON "public"."notifications_inbox" USING "btree" ("user_email_lc", "event_id", "notification_type");



CREATE INDEX "notifications_inbox_user_unread_idx" ON "public"."notifications_inbox" USING "btree" ("user_email_lc", "is_read", "last_received_at" DESC);



CREATE UNIQUE INDEX "notifications_outbox_invite_dedupe" ON "public"."notifications_outbox" USING "btree" ("event_id", "lower"("recipient_email"), "type") WHERE ("type" = 'invite_created'::"text");



CREATE UNIQUE INDEX "people_email_idx" ON "public"."people" USING "btree" ("email_lc") WHERE ("email_lc" IS NOT NULL);



CREATE UNIQUE INDEX "people_phone_idx" ON "public"."people" USING "btree" ("phone_e164") WHERE ("phone_e164" IS NOT NULL);



CREATE INDEX "reach_out_responses_event_id_idx" ON "public"."reach_out_responses" USING "btree" ("event_id");



CREATE INDEX "reach_out_responses_responder_email_idx" ON "public"."reach_out_responses" USING "btree" ("responder_email_lc");



CREATE INDEX "reports_status_created_at_idx" ON "public"."reports" USING "btree" ("status", "created_at");



CREATE INDEX "reports_target_user_email_idx" ON "public"."reports" USING "btree" ("target_user_email");



CREATE UNIQUE INDEX "rsvp_join_requests_event_email_pending_uniq" ON "public"."rsvp_join_requests" USING "btree" ("event_id", "requester_email_lc") WHERE (("requester_email_lc" IS NOT NULL) AND ("status" = 'pending'::"text"));



CREATE UNIQUE INDEX "rsvp_join_requests_event_guest_token_pending_uniq" ON "public"."rsvp_join_requests" USING "btree" ("event_id", "guest_token") WHERE (("guest_token" IS NOT NULL) AND ("status" = 'pending'::"text"));



CREATE UNIQUE INDEX "rsvp_join_requests_event_phone_pending_uniq" ON "public"."rsvp_join_requests" USING "btree" ("event_id", "requester_phone_e164") WHERE (("requester_phone_e164" IS NOT NULL) AND ("status" = 'pending'::"text"));



CREATE UNIQUE INDEX "rsvp_tokens_event_email_idx" ON "public"."rsvp_tokens" USING "btree" ("event_id", "email");



CREATE INDEX "rsvps_person_id_idx" ON "public"."rsvps" USING "btree" ("person_id");



CREATE UNIQUE INDEX "social_circle_members_circle_email_uq" ON "public"."social_circle_members" USING "btree" ("circle_id", "member_email_lc") WHERE ("member_email_lc" IS NOT NULL);



CREATE INDEX "social_circle_members_circle_id_idx" ON "public"."social_circle_members" USING "btree" ("circle_id");



CREATE UNIQUE INDEX "social_circle_members_circle_name_uq" ON "public"."social_circle_members" USING "btree" ("circle_id", "lower"("member_name")) WHERE (("member_email_lc" IS NULL) AND ("member_name" IS NOT NULL));



CREATE INDEX "social_circle_members_member_email_lc_idx" ON "public"."social_circle_members" USING "btree" ("member_email_lc");



CREATE OR REPLACE TRIGGER "enforce_rsvp_access" BEFORE INSERT ON "public"."rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_rsvp_access"();



CREATE OR REPLACE TRIGGER "ensure_notification_type_trigger" BEFORE INSERT ON "public"."notifications_outbox" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_notification_type"();



CREATE OR REPLACE TRIGGER "event_invite_notification_trigger" AFTER INSERT ON "public"."event_invites" FOR EACH ROW EXECUTE FUNCTION "public"."notify_invite_created"();



CREATE OR REPLACE TRIGGER "on_profile_created_circle" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_profile_circle"();



CREATE OR REPLACE TRIGGER "on_rsvp_created" AFTER INSERT ON "public"."rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_rsvp_notification"();



CREATE OR REPLACE TRIGGER "touch_rsvp_join_requests_updated_at" BEFORE UPDATE ON "public"."rsvp_join_requests" FOR EACH ROW EXECUTE FUNCTION "public"."touch_rsvp_join_requests_updated_at"();



CREATE OR REPLACE TRIGGER "trg_device_contacts_updated_at" BEFORE UPDATE ON "public"."device_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_device_contacts_updated_at"();



CREATE OR REPLACE TRIGGER "trg_notifications_outbox_to_inbox" AFTER INSERT ON "public"."notifications_outbox" FOR EACH ROW EXECUTE FUNCTION "public"."upsert_notifications_inbox_from_outbox"();



CREATE OR REPLACE TRIGGER "trg_prevent_duplicate_invite_notifications" BEFORE INSERT ON "public"."notifications_outbox" FOR EACH ROW WHEN (("new"."type" = 'invite_created'::"text")) EXECUTE FUNCTION "public"."prevent_invite_notification_if_rsvp_exists"();



CREATE OR REPLACE TRIGGER "trg_touch_event_dm_threads_updated_at" BEFORE UPDATE ON "public"."event_dm_threads" FOR EACH ROW EXECUTE FUNCTION "public"."touch_event_dm_threads_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_notifications_inbox_updated_at" BEFORE UPDATE ON "public"."notifications_inbox" FOR EACH ROW EXECUTE FUNCTION "public"."touch_notifications_inbox_updated_at"();



ALTER TABLE ONLY "public"."closed_cards"
    ADD CONSTRAINT "closed_cards_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_contacts"
    ADD CONSTRAINT "device_contacts_matched_user_id_fkey" FOREIGN KEY ("matched_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."device_contacts"
    ADD CONSTRAINT "device_contacts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id");



ALTER TABLE ONLY "public"."email_subscriptions"
    ADD CONSTRAINT "email_subscriptions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_chat_messages"
    ADD CONSTRAINT "event_chat_messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_chat_messages"
    ADD CONSTRAINT "event_chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."event_chat_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_chat_reads"
    ADD CONSTRAINT "event_chat_reads_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."event_chat_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_chat_threads"
    ADD CONSTRAINT "event_chat_threads_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_dm_messages"
    ADD CONSTRAINT "event_dm_messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_dm_messages"
    ADD CONSTRAINT "event_dm_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."event_dm_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_dm_reads"
    ADD CONSTRAINT "event_dm_reads_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."event_dm_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_dm_threads"
    ADD CONSTRAINT "event_dm_threads_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_device_contact_fkey" FOREIGN KEY ("device_contact_id") REFERENCES "public"."device_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_invited_by_invite_id_fkey" FOREIGN KEY ("invited_by_invite_id") REFERENCES "public"."event_invites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_invites"
    ADD CONSTRAINT "event_invites_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id");



ALTER TABLE ONLY "public"."hidden_people"
    ADD CONSTRAINT "hidden_people_matched_user_id_fkey" FOREIGN KEY ("matched_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hidden_people"
    ADD CONSTRAINT "hidden_people_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications_inbox"
    ADD CONSTRAINT "notifications_inbox_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications_outbox"
    ADD CONSTRAINT "notifications_outbox_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_matched_user_id_fkey" FOREIGN KEY ("matched_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."reach_out_responses"
    ADD CONSTRAINT "reach_out_responses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rsvp_join_requests"
    ADD CONSTRAINT "rsvp_join_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rsvp_join_requests"
    ADD CONSTRAINT "rsvp_join_requests_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id");



ALTER TABLE ONLY "public"."rsvp_tokens"
    ADD CONSTRAINT "rsvp_tokens_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rsvps"
    ADD CONSTRAINT "rsvps_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id");



ALTER TABLE ONLY "public"."social_circle_members"
    ADD CONSTRAINT "social_circle_members_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "public"."social_circles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_circle_members"
    ADD CONSTRAINT "social_circle_members_device_contact_fkey" FOREIGN KEY ("device_contact_id") REFERENCES "public"."device_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."social_circle_members"
    ADD CONSTRAINT "social_circle_members_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id");



ALTER TABLE ONLY "public"."social_intent"
    ADD CONSTRAINT "social_intent_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vibe_responses"
    ADD CONSTRAINT "vibe_responses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



CREATE POLICY "Allow All Profile Actions" ON "public"."profiles" USING (true) WITH CHECK (true);



CREATE POLICY "Allow app to manage subscriptions" ON "public"."push_subscriptions" USING (true) WITH CHECK (true);



CREATE POLICY "Allow individual rsvp updates via token" ON "public"."rsvps" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."push_subscriptions_pwa_old" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert/update social intent" ON "public"."social_intent" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public read access to rsvps" ON "public"."rsvps" FOR SELECT USING (true);



CREATE POLICY "Allow public read-only access to events by slug" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "Allow public rsvp submission" ON "public"."rsvps" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public update" ON "public"."push_subscriptions_pwa_old" FOR UPDATE USING (true);



CREATE POLICY "Allow update access via manage_handle" ON "public"."events" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can wave back" ON "public"."vibe_responses" FOR INSERT WITH CHECK (true);



CREATE POLICY "Hosts can see waves" ON "public"."vibe_responses" FOR SELECT USING (true);



CREATE POLICY "Public handle closed cards" ON "public"."closed_cards" USING (true) WITH CHECK (true);



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Service role full access" ON "public"."notifications_outbox" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create invites for their events" ON "public"."event_invites" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can manage their own hidden cards" ON "public"."closed_cards" USING ((("auth"."jwt"() ->> 'email'::"text") = "user_email_lc"));



CREATE POLICY "Users can read their invites" ON "public"."event_invites" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING ((("auth"."jwt"() ->> 'email'::"text") = "email_lc"));



CREATE POLICY "Users can update their invites" ON "public"."event_invites" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."closed_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."device_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "device_contacts_delete_own" ON "public"."device_contacts" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "device_contacts_insert_own" ON "public"."device_contacts" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "device_contacts_select_own" ON "public"."device_contacts" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "device_contacts_update_own" ON "public"."device_contacts" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."event_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions_pwa_old" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_intent" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vibe_responses" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."add_device_contacts_to_circle"("p_circle_id" "uuid", "p_contact_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."add_device_contacts_to_circle"("p_circle_id" "uuid", "p_contact_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_device_contacts_to_circle"("p_circle_id" "uuid", "p_contact_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_notifications_inbox_from_outbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_notifications_inbox_from_outbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_notifications_inbox_from_outbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."block_user"("p_blocked_email" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."block_user"("p_blocked_email" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_user"("p_blocked_email" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."build_notification_group_key"("p_user_email_lc" "text", "p_event_id" "uuid", "p_notification_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."build_notification_group_key"("p_user_email_lc" "text", "p_event_id" "uuid", "p_notification_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_notification_group_key"("p_user_email_lc" "text", "p_event_id" "uuid", "p_notification_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_event_by_manage_token"("p_manage_token" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_event_by_manage_token"("p_manage_token" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_event_by_manage_token"("p_manage_token" "text", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."chat_notification_allowed"("p_event_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."chat_notification_allowed"("p_event_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."chat_notification_allowed"("p_event_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_event_draft"("p_title" "text", "p_host_name" "text", "p_host_email" "text", "p_keyword" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_description" "text", "p_cover_image_url" "text", "p_gif_key" "text", "p_expires_in_days" integer, "p_event_type" "text", "p_proposed_dates" "text"[], "p_visibility" integer, "p_invite_list_visibility" "text", "p_guest_list_visibility" "text", "p_send_rsvp_reminders" boolean, "p_remind_after_days" integer, "p_rsvp_deadline" "date", "p_send_final_reminder_at_deadline" boolean, "p_forwarding_mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_event_draft"("p_title" "text", "p_host_name" "text", "p_host_email" "text", "p_keyword" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_description" "text", "p_cover_image_url" "text", "p_gif_key" "text", "p_expires_in_days" integer, "p_event_type" "text", "p_proposed_dates" "text"[], "p_visibility" integer, "p_invite_list_visibility" "text", "p_guest_list_visibility" "text", "p_send_rsvp_reminders" boolean, "p_remind_after_days" integer, "p_rsvp_deadline" "date", "p_send_final_reminder_at_deadline" boolean, "p_forwarding_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_event_draft"("p_title" "text", "p_host_name" "text", "p_host_email" "text", "p_keyword" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_description" "text", "p_cover_image_url" "text", "p_gif_key" "text", "p_expires_in_days" integer, "p_event_type" "text", "p_proposed_dates" "text"[], "p_visibility" integer, "p_invite_list_visibility" "text", "p_guest_list_visibility" "text", "p_send_rsvp_reminders" boolean, "p_remind_after_days" integer, "p_rsvp_deadline" "date", "p_send_final_reminder_at_deadline" boolean, "p_forwarding_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_event_invites_from_device_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[], "p_source_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_event_invites_from_device_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[], "p_source_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_event_invites_from_device_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[], "p_source_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_report"("p_target_type" "text", "p_target_id" "uuid", "p_target_user_email" "text", "p_reason" "text", "p_details" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_report"("p_target_type" "text", "p_target_id" "uuid", "p_target_user_email" "text", "p_reason" "text", "p_details" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_report"("p_target_type" "text", "p_target_id" "uuid", "p_target_user_email" "text", "p_reason" "text", "p_details" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_my_account_data"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_my_account_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_my_account_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dismiss_notification_group"("p_inbox_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dismiss_notification_group"("p_inbox_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dismiss_notification_group"("p_inbox_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_rsvp_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_rsvp_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_rsvp_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_final_rsvp_deadline_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_final_rsvp_deadline_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_final_rsvp_deadline_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_notification_type"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_notification_type"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_notification_type"() TO "service_role";



GRANT ALL ON FUNCTION "public"."event_dm_user_high"("p_email_1" "text", "p_email_2" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."event_dm_user_high"("p_email_1" "text", "p_email_2" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."event_dm_user_high"("p_email_1" "text", "p_email_2" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."event_dm_user_low"("p_email_1" "text", "p_email_2" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."event_dm_user_low"("p_email_1" "text", "p_email_2" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."event_dm_user_low"("p_email_1" "text", "p_email_2" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_vibe_by_manage_token"("p_manage_token" "text", "p_winning_starts_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_vibe_by_manage_token"("p_manage_token" "text", "p_winning_starts_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_vibe_by_manage_token"("p_manage_token" "text", "p_winning_starts_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_access_decision"("p_event_id" "uuid", "p_viewer_email" "text", "p_viewer_phone_e164" "text", "p_guest_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_access_decision"("p_event_id" "uuid", "p_viewer_email" "text", "p_viewer_phone_e164" "text", "p_guest_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_access_decision"("p_event_id" "uuid", "p_viewer_email" "text", "p_viewer_phone_e164" "text", "p_guest_token" "text") TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_by_manage_token"("p_manage_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_by_manage_token"("p_manage_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_by_manage_token"("p_manage_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_chat_messages"("p_event_id" "uuid", "p_user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_chat_messages"("p_event_id" "uuid", "p_user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_chat_messages"("p_event_id" "uuid", "p_user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_chat_summary"("p_event_id" "uuid", "p_user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_chat_summary"("p_event_id" "uuid", "p_user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_chat_summary"("p_event_id" "uuid", "p_user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_dm_messages"("p_thread_id" "uuid", "p_user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_dm_messages"("p_thread_id" "uuid", "p_user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_dm_messages"("p_thread_id" "uuid", "p_user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_guest_list"("p_slug" "text", "p_viewer_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_guest_list"("p_slug" "text", "p_viewer_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_guest_list"("p_slug" "text", "p_viewer_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_host_dashboard_by_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_host_dashboard_by_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_host_dashboard_by_email"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_device_contacts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_device_contacts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_device_contacts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_event_dm_inbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_event_dm_inbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_event_dm_inbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_notifications_inbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_notifications_inbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_notifications_inbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_unread_inbox_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_unread_inbox_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_unread_inbox_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_event_chat_thread"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_event_chat_thread"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_event_chat_thread"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_event_dm_thread"("p_event_id" "uuid", "p_user_email" "text", "p_other_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_event_dm_thread"("p_event_id" "uuid", "p_user_email" "text", "p_other_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_event_dm_thread"("p_event_id" "uuid", "p_user_email" "text", "p_other_email" "text") TO "service_role";



GRANT ALL ON TABLE "public"."notifications_outbox" TO "anon";
GRANT ALL ON TABLE "public"."notifications_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications_outbox" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_outbox"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_outbox"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_outbox"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_push_notifications"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_push_notifications"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_push_notifications"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_push_targets"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_push_targets"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_push_targets"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_series_position"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_series_position"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_series_position"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_badge_count_for_email"("p_email_lc" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_badge_count_for_email"("p_email_lc" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_badge_count_for_email"("p_email_lc" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_profile_circle"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_profile_circle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_profile_circle"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_rsvp_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_rsvp_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_rsvp_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hide_person_from_my_people"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hide_person_from_my_people"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hide_person_from_my_people"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_event_chat_participant"("p_event_id" "uuid", "p_user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_event_chat_participant"("p_event_id" "uuid", "p_user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_event_chat_participant"("p_event_id" "uuid", "p_user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_event_dm_participant"("p_thread_id" "uuid", "p_user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_event_dm_participant"("p_thread_id" "uuid", "p_user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_event_dm_participant"("p_thread_id" "uuid", "p_user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_event_chat_read"("p_event_id" "uuid", "p_user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_event_chat_read"("p_event_id" "uuid", "p_user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_event_chat_read"("p_event_id" "uuid", "p_user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_event_dm_thread_read"("p_thread_id" "uuid", "p_user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_event_dm_thread_read"("p_thread_id" "uuid", "p_user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_event_dm_thread_read"("p_thread_id" "uuid", "p_user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_group_read"("p_event_id" "uuid", "p_notification_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_group_read"("p_event_id" "uuid", "p_notification_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_group_read"("p_event_id" "uuid", "p_notification_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_outbox_failed"("p_id" "uuid", "p_error" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_outbox_failed"("p_id" "uuid", "p_error" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_outbox_failed"("p_id" "uuid", "p_error" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_outbox_sent"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_outbox_sent"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_outbox_sent"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_push_sent"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_push_sent"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_push_sent"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_report_actioned"("p_report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_report_actioned"("p_report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_report_actioned"("p_report_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_report_reviewed"("p_report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_report_reviewed"("p_report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_report_reviewed"("p_report_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_device_contacts"() TO "anon";
GRANT ALL ON FUNCTION "public"."match_device_contacts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_device_contacts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_event_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_event_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_event_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_invite_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_invite_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_invite_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."post_event_chat_message"("p_event_id" "uuid", "p_sender_email" "text", "p_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."post_event_chat_message"("p_event_id" "uuid", "p_sender_email" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_event_chat_message"("p_event_id" "uuid", "p_sender_email" "text", "p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_invite_notification_if_rsvp_exists"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_invite_notification_if_rsvp_exists"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_invite_notification_if_rsvp_exists"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_device_contacts"() TO "anon";
GRANT ALL ON FUNCTION "public"."prune_device_contacts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_device_contacts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_join_request"("p_request_id" "uuid", "p_decision" "text", "p_decided_by_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_join_request"("p_request_id" "uuid", "p_decision" "text", "p_decided_by_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_join_request"("p_request_id" "uuid", "p_decision" "text", "p_decided_by_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_or_create_person"("p_email_lc" "text", "p_phone_e164" "text", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_or_create_person"("p_email_lc" "text", "p_phone_e164" "text", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_or_create_person"("p_email_lc" "text", "p_phone_e164" "text", "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_or_create_person"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_or_create_person"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_or_create_person"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_event_invite"("p_event_id" "uuid", "p_invite_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_event_invite"("p_event_id" "uuid", "p_invite_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_event_invite"("p_event_id" "uuid", "p_invite_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_push_subscription"("p_email" "text", "p_subscription_json" "jsonb", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."save_push_subscription"("p_email" "text", "p_subscription_json" "jsonb", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_push_subscription"("p_email" "text", "p_subscription_json" "jsonb", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_push_token"("p_email" "text", "p_device_token" "text", "p_platform" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."save_push_token"("p_email" "text", "p_device_token" "text", "p_platform" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_push_token"("p_email" "text", "p_device_token" "text", "p_platform" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_event_dm_message"("p_event_id" "uuid", "p_sender_email" "text", "p_recipient_email" "text", "p_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_event_dm_message"("p_event_id" "uuid", "p_sender_email" "text", "p_recipient_email" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_event_dm_message"("p_event_id" "uuid", "p_sender_email" "text", "p_recipient_email" "text", "p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_host_message_by_manage_token"("p_manage_token" "text", "p_subject" "text", "p_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_host_message_by_manage_token"("p_manage_token" "text", "p_subject" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_host_message_by_manage_token"("p_manage_token" "text", "p_subject" "text", "p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_rsvp"("p_slug" "text", "p_name" "text", "p_status" "text", "p_guest_token" "text", "p_email" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_rsvp"("p_slug" "text", "p_name" "text", "p_status" "text", "p_guest_token" "text", "p_email" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_rsvp"("p_slug" "text", "p_name" "text", "p_status" "text", "p_guest_token" "text", "p_email" "text", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_rsvp_enriched"("p_event_id" "uuid", "p_name" "text", "p_email" "text", "p_status" "text", "p_phone_e164" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_rsvp_enriched"("p_event_id" "uuid", "p_name" "text", "p_email" "text", "p_status" "text", "p_phone_e164" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_rsvp_enriched"("p_event_id" "uuid", "p_name" "text", "p_email" "text", "p_status" "text", "p_phone_e164" "text", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_vibe_rsvp"("p_slug" "text", "p_user_email" "text", "p_guest_name" "text", "p_selected_dates" "text"[], "p_note" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_vibe_rsvp"("p_slug" "text", "p_user_email" "text", "p_guest_name" "text", "p_selected_dates" "text"[], "p_note" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_vibe_rsvp"("p_slug" "text", "p_user_email" "text", "p_guest_name" "text", "p_selected_dates" "text"[], "p_note" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_device_contacts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_device_contacts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_device_contacts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_event_dm_threads_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_event_dm_threads_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_event_dm_threads_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_notifications_inbox_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_notifications_inbox_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_notifications_inbox_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_rsvp_join_requests_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_rsvp_join_requests_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_rsvp_join_requests_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unhide_person_from_my_people"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unhide_person_from_my_people"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unhide_person_from_my_people"("p_email_lc" "text", "p_phone_e164" "text", "p_matched_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_event_by_manage_token"("p_manage_token" "text", "p_title" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_description" "text", "p_cover_image_url" "text", "p_expires_at" timestamp with time zone, "p_gif_key" "text", "p_event_type" "text", "p_proposed_dates" "text"[], "p_visibility" integer, "p_invite_list_visibility" "text", "p_guest_list_visibility" "text", "p_send_rsvp_reminders" boolean, "p_remind_after_days" integer, "p_rsvp_deadline" "date", "p_send_final_reminder_at_deadline" boolean, "p_forwarding_mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_event_by_manage_token"("p_manage_token" "text", "p_title" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_description" "text", "p_cover_image_url" "text", "p_expires_at" timestamp with time zone, "p_gif_key" "text", "p_event_type" "text", "p_proposed_dates" "text"[], "p_visibility" integer, "p_invite_list_visibility" "text", "p_guest_list_visibility" "text", "p_send_rsvp_reminders" boolean, "p_remind_after_days" integer, "p_rsvp_deadline" "date", "p_send_final_reminder_at_deadline" boolean, "p_forwarding_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_by_manage_token"("p_manage_token" "text", "p_title" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_location" "text", "p_description" "text", "p_cover_image_url" "text", "p_expires_at" timestamp with time zone, "p_gif_key" "text", "p_event_type" "text", "p_proposed_dates" "text"[], "p_visibility" integer, "p_invite_list_visibility" "text", "p_guest_list_visibility" "text", "p_send_rsvp_reminders" boolean, "p_remind_after_days" integer, "p_rsvp_deadline" "date", "p_send_final_reminder_at_deadline" boolean, "p_forwarding_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_device_contacts"("p_contacts" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_device_contacts"("p_contacts" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_device_contacts"("p_contacts" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_notifications_inbox_from_outbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_notifications_inbox_from_outbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_notifications_inbox_from_outbox"() TO "service_role";


















GRANT ALL ON TABLE "public"."blocked_users" TO "anon";
GRANT ALL ON TABLE "public"."blocked_users" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_users" TO "service_role";



GRANT ALL ON TABLE "public"."closed_cards" TO "anon";
GRANT ALL ON TABLE "public"."closed_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."closed_cards" TO "service_role";



GRANT ALL ON SEQUENCE "public"."closed_cards_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."closed_cards_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."closed_cards_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."device_contacts" TO "anon";
GRANT ALL ON TABLE "public"."device_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."device_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."email_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."email_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."email_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."event_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."event_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."event_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."event_chat_reads" TO "anon";
GRANT ALL ON TABLE "public"."event_chat_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."event_chat_reads" TO "service_role";



GRANT ALL ON TABLE "public"."event_chat_threads" TO "anon";
GRANT ALL ON TABLE "public"."event_chat_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."event_chat_threads" TO "service_role";



GRANT ALL ON TABLE "public"."event_dm_messages" TO "anon";
GRANT ALL ON TABLE "public"."event_dm_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."event_dm_messages" TO "service_role";



GRANT ALL ON TABLE "public"."event_dm_reads" TO "anon";
GRANT ALL ON TABLE "public"."event_dm_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."event_dm_reads" TO "service_role";



GRANT ALL ON TABLE "public"."event_dm_threads" TO "anon";
GRANT ALL ON TABLE "public"."event_dm_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."event_dm_threads" TO "service_role";



GRANT ALL ON TABLE "public"."event_invites" TO "anon";
GRANT ALL ON TABLE "public"."event_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."event_invites" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."hidden_people" TO "anon";
GRANT ALL ON TABLE "public"."hidden_people" TO "authenticated";
GRANT ALL ON TABLE "public"."hidden_people" TO "service_role";



GRANT ALL ON TABLE "public"."rsvps" TO "anon";
GRANT ALL ON TABLE "public"."rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."member_stats" TO "anon";
GRANT ALL ON TABLE "public"."member_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."member_stats" TO "service_role";



GRANT ALL ON TABLE "public"."notifications_inbox" TO "anon";
GRANT ALL ON TABLE "public"."notifications_inbox" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications_inbox" TO "service_role";



GRANT ALL ON TABLE "public"."people" TO "anon";
GRANT ALL ON TABLE "public"."people" TO "authenticated";
GRANT ALL ON TABLE "public"."people" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."predicted_circles" TO "anon";
GRANT ALL ON TABLE "public"."predicted_circles" TO "authenticated";
GRANT ALL ON TABLE "public"."predicted_circles" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions_pwa_old" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions_pwa_old" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions_pwa_old" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."reach_out_responses" TO "anon";
GRANT ALL ON TABLE "public"."reach_out_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."reach_out_responses" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."rsvp_join_requests" TO "anon";
GRANT ALL ON TABLE "public"."rsvp_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."rsvp_join_requests" TO "service_role";



GRANT ALL ON TABLE "public"."rsvp_tokens" TO "anon";
GRANT ALL ON TABLE "public"."rsvp_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."rsvp_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."social_circle_members" TO "anon";
GRANT ALL ON TABLE "public"."social_circle_members" TO "authenticated";
GRANT ALL ON TABLE "public"."social_circle_members" TO "service_role";



GRANT ALL ON TABLE "public"."social_circles" TO "anon";
GRANT ALL ON TABLE "public"."social_circles" TO "authenticated";
GRANT ALL ON TABLE "public"."social_circles" TO "service_role";



GRANT ALL ON TABLE "public"."social_intent" TO "anon";
GRANT ALL ON TABLE "public"."social_intent" TO "authenticated";
GRANT ALL ON TABLE "public"."social_intent" TO "service_role";



GRANT ALL ON TABLE "public"."vibe_responses" TO "anon";
GRANT ALL ON TABLE "public"."vibe_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."vibe_responses" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































