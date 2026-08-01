-- Crew profile, CV, gallery and dashboard images are private-by-default.
-- Public discovery and employer access are served by authorization-aware
-- application proxies; the storage bucket itself must never be anonymous.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'crew-portfolio',
  'crew-portfolio',
  false,
  10485760,
  array[
    'image/avif',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Environments may contain differently named legacy read policies. Remove
-- every crew-portfolio SELECT policy before installing one canonical owner
-- policy; service_role continues to bypass RLS for guarded application routes.
do $block$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'SELECT'
      and position('crew-portfolio' in coalesce(qual, '')) > 0
  loop
    execute format(
      'drop policy if exists %I on storage.objects',
      policy_row.policyname
    );
  end loop;
end;
$block$;

drop policy if exists "Public crew media read" on storage.objects;
drop policy if exists "Crew portfolio owner read" on storage.objects;
create policy "Crew portfolio owner read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'crew-portfolio'
  and (
    (
      private.bluedeck_has_crew_career_access()
      and (
        name like ((select auth.uid())::text || '/%')
        or private.bluedeck_owns_crew_profile_storage_path(name)
      )
    )
    or name like ((select auth.uid())::text || '/dashboard-%')
  )
);

commit;
