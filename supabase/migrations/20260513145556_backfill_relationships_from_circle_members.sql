-- supabase/migrations/20260513160100_backfill_relationships_from_circle_members.sql

insert into public.relationships (
  owner_user_id,
  related_person_id,
  relationship_type,
  source,
  created_at,
  updated_at
)
select distinct
  sc.user_id as owner_user_id,
  scm.person_id as related_person_id,
  'direct' as relationship_type,
  'imported_circle' as source,
  coalesce(scm.created_at, now()) as created_at,
  now() as updated_at
from public.social_circle_members scm
join public.social_circles sc
  on sc.id = scm.circle_id
where scm.person_id is not null
on conflict (owner_user_id, related_person_id) do nothing;