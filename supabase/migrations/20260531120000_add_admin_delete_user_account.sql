-- Admin cleanup wrapper used by the admin-delete-user Edge Function.

begin;

create or replace function public.admin_delete_user_account(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_lc text;
  v_person_ids uuid[];
  v_deleted_profiles integer := 0;
  v_detached_people integer := 0;
  v_deleted_auth_identities integer := 0;
begin
  if p_target_user_id is null then
    raise exception 'target_user_id_required';
  end if;

  select lower(trim(email_lc))
  into v_email_lc
  from public.profiles
  where id = p_target_user_id;

  select coalesce(array_agg(id), array[]::uuid[])
  into v_person_ids
  from public.people
  where matched_user_id = p_target_user_id
     or (
       v_email_lc is not null
       and lower(trim(email_lc)) = v_email_lc
     );

  if to_regprocedure('public.delete_my_account_data()') is not null then
    perform set_config('request.jwt.claim.sub', p_target_user_id::text, true);
    perform set_config('request.jwt.claim.email', coalesce(v_email_lc, ''), true);
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', p_target_user_id::text,
        'email', v_email_lc
      )::text,
      true
    );
    execute 'select public.delete_my_account_data()';
  end if;

  if to_regclass('public.person_identities') is not null then
    delete from public.person_identities
    where identity_type = 'auth_user_id'
      and identity_value = p_target_user_id::text;

    get diagnostics v_deleted_auth_identities = row_count;
  end if;

  if to_regclass('public.people') is not null then
    update public.people
    set matched_user_id = null
    where matched_user_id = p_target_user_id;

    get diagnostics v_detached_people = row_count;
  end if;

  if to_regclass('public.profiles') is not null then
    delete from public.profiles
    where id = p_target_user_id;

    get diagnostics v_deleted_profiles = row_count;
  end if;

  return jsonb_build_object(
    'target_user_id', p_target_user_id,
    'email_lc', v_email_lc,
    'person_ids', v_person_ids,
    'deleted_profiles', v_deleted_profiles,
    'detached_people', v_detached_people,
    'deleted_auth_identities', v_deleted_auth_identities
  );
end;
$$;

revoke all on function public.admin_delete_user_account(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user_account(uuid) to service_role;

commit;
