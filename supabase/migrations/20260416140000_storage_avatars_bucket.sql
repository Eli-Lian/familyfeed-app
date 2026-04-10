-- Public bucket for member profile photos + RLS on storage.objects

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_select_public" on storage.objects;
drop policy if exists "avatars_insert_authenticated" on storage.objects;
drop policy if exists "avatars_update_authenticated" on storage.objects;
drop policy if exists "avatars_delete_authenticated" on storage.objects;

create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

create policy "avatars_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

create policy "avatars_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars');
