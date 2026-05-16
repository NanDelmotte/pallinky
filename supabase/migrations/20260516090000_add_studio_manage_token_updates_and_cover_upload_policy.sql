create or replace function public.update_event_studio_by_manage_token(
  p_manage_token text,
  p_gif_key text,
  p_cover_image_url text,
  p_font_family text,
  p_thanks_gif_url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set
    gif_key = coalesce(p_gif_key, gif_key),
    cover_image_url = p_cover_image_url,
    font_family = coalesce(p_font_family, font_family),
    thanks_gif_url = p_thanks_gif_url,
    updated_at = now()
  where manage_handle = p_manage_token
     or manage_token_hash = encode(extensions.digest(p_manage_token, 'sha256'), 'hex');
end;
$$;

grant execute on function public.update_event_studio_by_manage_token(text, text, text, text, text) to anon;
grant execute on function public.update_event_studio_by_manage_token(text, text, text, text, text) to authenticated;
grant execute on function public.update_event_studio_by_manage_token(text, text, text, text, text) to service_role;

create or replace function public.can_upload_cover_for_manage_token(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_manage_token text;
begin
  v_manage_token := (storage.foldername(object_name))[1];

  if v_manage_token is null or v_manage_token = '' then
    return false;
  end if;

  return exists (
    select 1
    from public.events e
    where e.manage_handle = v_manage_token
       or e.manage_token_hash = encode(extensions.digest(v_manage_token, 'sha256'), 'hex')
  );
end;
$$;

grant execute on function public.can_upload_cover_for_manage_token(text) to anon;
grant execute on function public.can_upload_cover_for_manage_token(text) to authenticated;
grant execute on function public.can_upload_cover_for_manage_token(text) to service_role;

drop policy if exists "Studio cover uploads with manage token" on storage.objects;

create policy "Studio cover uploads with manage token"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'covers'
  and public.can_upload_cover_for_manage_token(name)
);
