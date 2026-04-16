-- Link auth.users to member profiles (onboarding + invitations + push)

alter table public.members
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists members_user_id_idx on public.members (user_id) where user_id is not null;

-- Accept invite: attach member row to the authenticated user when present
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

  insert into public.members (family_id, name, role, avatar, color, photo_url, user_id)
  values (
    inv.family_id,
    trim(p_name),
    nullif(trim(p_role), ''),
    nullif(trim(p_avatar), ''),
    coalesce(nullif(trim(p_color), ''), '#C8522A'),
    null,
    auth.uid()
  );

  update public.invitations
  set used_at = now()
  where id = inv.id;
end;
$$;
