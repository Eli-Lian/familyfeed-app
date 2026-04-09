-- Family app: tables, RLS (authenticated only), Realtime publication
-- Run in Supabase SQL Editor or: supabase db push

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar text,
  color text,
  role text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  type text not null,
  content text,
  pinned boolean not null default false,
  "date" date,
  "time" time,
  reads integer not null default 0,
  created_at timestamptz not null default now()
);

create index posts_member_id_idx on public.posts (member_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  "text" text not null,
  created_at timestamptz not null default now()
);

create index comments_post_id_idx on public.comments (post_id);
create index comments_member_id_idx on public.comments (member_id);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  type text not null,
  "text" text,
  bg text,
  photo_url text,
  seen_by jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index stories_member_id_idx on public.stories (member_id);

create table public.member_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  title text not null,
  "date" date,
  "time" time,
  icon text,
  urgent boolean not null default false,
  added_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index member_events_member_id_idx on public.member_events (member_id);

create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  "text" text not null,
  qty text,
  cat text,
  done boolean not null default false,
  member_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index shop_items_member_id_idx on public.shop_items (member_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: only JWT role `authenticated` may read/write
-- ---------------------------------------------------------------------------

alter table public.members enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.stories enable row level security;
alter table public.member_events enable row level security;
alter table public.shop_items enable row level security;

-- members
create policy "members_select_authenticated"
  on public.members for select to authenticated using (true);
create policy "members_insert_authenticated"
  on public.members for insert to authenticated with check (true);
create policy "members_update_authenticated"
  on public.members for update to authenticated using (true) with check (true);
create policy "members_delete_authenticated"
  on public.members for delete to authenticated using (true);

-- posts
create policy "posts_select_authenticated"
  on public.posts for select to authenticated using (true);
create policy "posts_insert_authenticated"
  on public.posts for insert to authenticated with check (true);
create policy "posts_update_authenticated"
  on public.posts for update to authenticated using (true) with check (true);
create policy "posts_delete_authenticated"
  on public.posts for delete to authenticated using (true);

-- comments
create policy "comments_select_authenticated"
  on public.comments for select to authenticated using (true);
create policy "comments_insert_authenticated"
  on public.comments for insert to authenticated with check (true);
create policy "comments_update_authenticated"
  on public.comments for update to authenticated using (true) with check (true);
create policy "comments_delete_authenticated"
  on public.comments for delete to authenticated using (true);

-- stories
create policy "stories_select_authenticated"
  on public.stories for select to authenticated using (true);
create policy "stories_insert_authenticated"
  on public.stories for insert to authenticated with check (true);
create policy "stories_update_authenticated"
  on public.stories for update to authenticated using (true) with check (true);
create policy "stories_delete_authenticated"
  on public.stories for delete to authenticated using (true);

-- member_events
create policy "member_events_select_authenticated"
  on public.member_events for select to authenticated using (true);
create policy "member_events_insert_authenticated"
  on public.member_events for insert to authenticated with check (true);
create policy "member_events_update_authenticated"
  on public.member_events for update to authenticated using (true) with check (true);
create policy "member_events_delete_authenticated"
  on public.member_events for delete to authenticated using (true);

-- shop_items
create policy "shop_items_select_authenticated"
  on public.shop_items for select to authenticated using (true);
create policy "shop_items_insert_authenticated"
  on public.shop_items for insert to authenticated with check (true);
create policy "shop_items_update_authenticated"
  on public.shop_items for update to authenticated using (true) with check (true);
create policy "shop_items_delete_authenticated"
  on public.shop_items for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Realtime: add tables to publication + replica identity for UPDATE/DELETE
-- ---------------------------------------------------------------------------

alter table public.members replica identity full;
alter table public.posts replica identity full;
alter table public.comments replica identity full;
alter table public.stories replica identity full;
alter table public.member_events replica identity full;
alter table public.shop_items replica identity full;

alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.stories;
alter publication supabase_realtime add table public.member_events;
alter publication supabase_realtime add table public.shop_items;
