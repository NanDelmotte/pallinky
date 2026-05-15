-- supabase/migrations/20260513160000_create_relationships.sql

create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),

  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  related_person_id uuid not null references public.people(id) on delete cascade,

  relationship_type text not null default 'direct',
  source text not null default 'manual',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint relationships_type_check
    check (relationship_type in ('direct')),

  constraint relationships_source_check
    check (source in ('manual', 'qr', 'shared_event', 'imported_circle')),

  constraint relationships_owner_related_unique
    unique (owner_user_id, related_person_id)
);

create index if not exists relationships_owner_user_id_idx
  on public.relationships(owner_user_id);

create index if not exists relationships_related_person_id_idx
  on public.relationships(related_person_id);