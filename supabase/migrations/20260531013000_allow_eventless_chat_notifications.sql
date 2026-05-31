-- Direct/group chat notifications are not always tied to an event.

alter table if exists public.notifications_outbox
  alter column event_id drop not null;

alter table if exists public.notifications_inbox
  alter column event_id drop not null;

notify pgrst, 'reload schema';
