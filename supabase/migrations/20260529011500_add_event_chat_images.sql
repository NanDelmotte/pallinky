insert into storage.buckets (id, name, public, avif_autodetection, type)
values ('chat-images', 'chat-images', true, false, 'STANDARD')
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read access for chat images'
  ) then
    create policy "Public read access for chat images"
      on storage.objects
      for select
      using (bucket_id = 'chat-images');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload chat images'
  ) then
    create policy "Authenticated users can upload chat images"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'chat-images');
  end if;
end $$;

do $$
begin
  if to_regclass('public.event_chat_messages') is not null then
    alter table public.event_chat_messages
      add column if not exists image_url text;
  end if;
end $$;
