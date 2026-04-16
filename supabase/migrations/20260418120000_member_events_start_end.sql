-- Von–Bis (start/end date & time) for member_events

alter table public.member_events
  add column if not exists start_date date,
  add column if not exists start_time time,
  add column if not exists end_date date,
  add column if not exists end_time time;

update public.member_events
set
  start_date = coalesce(start_date, "date"),
  start_time = coalesce(start_time, "time");
