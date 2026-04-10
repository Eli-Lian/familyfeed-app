-- Recurring member events (client expands occurrences for calendar / dashboard)

alter table public.member_events
  add column if not exists recurrence text not null default 'none';

alter table public.member_events
  drop constraint if exists member_events_recurrence_check;

alter table public.member_events
  add constraint member_events_recurrence_check
  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));
