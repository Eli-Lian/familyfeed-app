-- Family invitations (email + token join flow)

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null,
  token text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists invitations_family_id_idx on public.invitations (family_id);
create index if not exists invitations_token_pending_idx on public.invitations (token) where used_at is null;

alter table public.invitations enable row level security;

create policy "invitations_select_own_family"
  on public.invitations for select to authenticated
  using (
    family_id in (select id from public.families where created_by = auth.uid())
  );

create policy "invitations_insert_own_family"
  on public.invitations for insert to authenticated
  with check (
    family_id in (select id from public.families where created_by = auth.uid())
    and invited_by = auth.uid()
  );

create policy "invitations_delete_own_family"
  on public.invitations for delete to authenticated
  using (
    family_id in (select id from public.families where created_by = auth.uid())
  );

-- Public lookup for /join (token only)
create or replace function public.get_invitation_by_token(p_token text)
returns table (
  invitation_id uuid,
  family_id uuid,
  family_name text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.family_id, f.name, i.email
  from public.invitations i
  join public.families f on f.id = i.family_id
  where i.token = p_token
    and i.used_at is null
  limit 1;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- Accept invite: add member + mark used (no auth required)
create or replace function public.accept_family_invitation(
  p_token text,
  p_name text,
  p_role text,
  p_avatar text,
  p_color text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations%rowtype;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name_required';
  end if;

  select * into inv
  from public.invitations
  where token = p_token
    and used_at is null
  for update;

  if not found then
    raise exception 'invalid_or_used_invitation';
  end if;

  insert into public.members (family_id, name, role, avatar, color, photo_url)
  values (
    inv.family_id,
    trim(p_name),
    nullif(trim(p_role), ''),
    nullif(trim(p_avatar), ''),
    coalesce(nullif(trim(p_color), ''), '#C8522A'),
    null
  );

  update public.invitations
  set used_at = now()
  where id = inv.id;
end;
$$;

grant execute on function public.accept_family_invitation(text, text, text, text, text) to anon, authenticated;
