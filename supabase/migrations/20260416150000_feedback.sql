-- In-app feedback (settings modal)

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  message text not null,
  name text,
  user_email text,
  created_at timestamptz not null default now(),
  constraint feedback_category_check check (category in ('bug', 'idea', 'general'))
);

create index feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

create policy "feedback_insert_authenticated"
  on public.feedback for insert
  to authenticated
  with check (true);

-- No select/update/delete for app users (review in Supabase dashboard / service role)
