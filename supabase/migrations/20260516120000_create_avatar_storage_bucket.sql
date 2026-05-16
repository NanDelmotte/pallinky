-- Ensure dev/staging projects have the same public avatar bucket expected by the app.
insert into storage.buckets (id, name, public, avif_autodetection, type)
values ('avatars', 'avatars', true, false, 'STANDARD')
on conflict (id) do update
set
  public = excluded.public,
  avif_autodetection = excluded.avif_autodetection,
  type = excluded.type;

-- Public buckets still need an object read policy when storage RLS is enabled.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read access for avatars'
  ) then
    create policy "Public read access for avatars"
      on storage.objects
      for select
      using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload avatars'
  ) then
    create policy "Authenticated users can upload avatars"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Avatar owners can update avatars'
  ) then
    create policy "Avatar owners can update avatars"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'avatars' and (owner = auth.uid() or owner_id = auth.uid()::text))
      with check (bucket_id = 'avatars' and (owner = auth.uid() or owner_id = auth.uid()::text));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Avatar owners can delete avatars'
  ) then
    create policy "Avatar owners can delete avatars"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'avatars' and (owner = auth.uid() or owner_id = auth.uid()::text));
  end if;
end $$;
