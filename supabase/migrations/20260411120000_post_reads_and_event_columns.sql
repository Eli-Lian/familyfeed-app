-- Per-member read tracking + optional event fields on posts + shop scoped to family

alter table public.shop_items
  add column if not exists family_id uuid references public.families (id) on delete cascade;

create index if not exists shop_items_family_id_idx on public.shop_items (family_id);

alter table public.posts
  add column if not exists event_date date;
alter table public.posts
  add column if not exists event_time time;

create table if not exists public.post_reads (
  post_id uuid not null references public.posts (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (post_id, member_id)
);

create index if not exists post_reads_post_id_idx on public.post_reads (post_id);
create index if not exists post_reads_member_id_idx on public.post_reads (member_id);

alter table public.post_reads enable row level security;

create policy "post_reads_select_authenticated"
  on public.post_reads for select to authenticated using (true);
create policy "post_reads_insert_authenticated"
  on public.post_reads for insert to authenticated with check (true);
create policy "post_reads_delete_authenticated"
  on public.post_reads for delete to authenticated using (true);
create policy "post_reads_update_authenticated"
  on public.post_reads for update to authenticated using (true) with check (true);

alter table public.post_reads replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_reads'
  ) then
    alter publication supabase_realtime add table public.post_reads;
  end if;
end $$;
