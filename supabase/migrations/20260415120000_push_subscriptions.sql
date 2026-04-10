-- Push notification subscriptions (Web Push), one row per member

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  subscription text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_member_id_key unique (member_id)
);

create index push_subscriptions_member_id_idx on public.push_subscriptions (member_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_authenticated"
  on public.push_subscriptions for select to authenticated using (true);
create policy "push_subscriptions_insert_authenticated"
  on public.push_subscriptions for insert to authenticated with check (true);
create policy "push_subscriptions_update_authenticated"
  on public.push_subscriptions for update to authenticated using (true) with check (true);
create policy "push_subscriptions_delete_authenticated"
  on public.push_subscriptions for delete to authenticated using (true);
