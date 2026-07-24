-- Crew certificates and identity documents must never be publicly readable.
-- Object names are expected to use: <crew_profile_id>/<safe-file-name>.

begin;

create schema if not exists private;

create or replace function private.bluedeck_owns_crew_profile_storage_path(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    auth.uid() is not null
    and object_name is not null
    and exists (
      select 1
      from public.crew_profiles as profile
      where object_name like profile.id::text || '/%'
        and (
          profile.user_id = auth.uid()
          or (
            profile.user_id is null
            and exists (
              select 1
              from auth.users as account
              where account.id = auth.uid()
                and account.email_confirmed_at is not null
                and nullif(lower(btrim(account.email)), '') =
                  nullif(lower(btrim(profile.email)), '')
            )
          )
        )
    );
$function$;

revoke all on function
  private.bluedeck_owns_crew_profile_storage_path(text)
from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function
  private.bluedeck_owns_crew_profile_storage_path(text)
to authenticated, service_role;

insert into storage.buckets (id, name, public)
values ('crew-documents', 'crew-documents', false)
on conflict (id) do update
set public = false;

insert into storage.buckets (id, name, public)
values ('crew-portfolio', 'crew-portfolio', true)
on conflict (id) do update
set public = true;

-- Policy names have varied between environments. Remove every existing policy
-- whose expression mentions either crew bucket, plus unconditional policies
-- that would bypass every bucket restriction, then install one canonical set.
do $block$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        position('crew-documents' in coalesce(qual, '')) > 0
        or position('crew-documents' in coalesce(with_check, '')) > 0
        or position('crew-portfolio' in coalesce(qual, '')) > 0
        or position('crew-portfolio' in coalesce(with_check, '')) > 0
        or lower(btrim(coalesce(qual, ''))) in ('true', '(true)')
        or lower(btrim(coalesce(with_check, ''))) in ('true', '(true)')
      )
  loop
    execute format(
      'drop policy if exists %I on storage.objects',
      policy_row.policyname
    );
  end loop;
end;
$block$;

drop policy if exists "Public crew media read" on storage.objects;
create policy "Public crew media read"
on storage.objects
for select
to public
using (bucket_id = 'crew-portfolio');

-- Remove legacy bucket-wide authenticated policies. The next migration
-- installs path-scoped task/yacht policies; leaving them absent here is
-- deliberately fail-closed during a rolling migration.
drop policy if exists "BlueDeck authenticated storage read" on storage.objects;
drop policy if exists "BlueDeck authenticated storage uploads" on storage.objects;
drop policy if exists "BlueDeck authenticated storage updates" on storage.objects;
drop policy if exists "BlueDeck authenticated storage delete" on storage.objects;

-- Replace the older combined crew media write policies with portfolio-only
-- compatibility policies. Portfolio media remains intentionally public.
drop policy if exists "Authenticated crew document uploads" on storage.objects;
drop policy if exists "Authenticated crew document updates" on storage.objects;
drop policy if exists "Authenticated crew document delete" on storage.objects;
drop policy if exists "Authenticated crew document deletes" on storage.objects;

drop policy if exists "Authenticated crew portfolio uploads" on storage.objects;
create policy "Authenticated crew portfolio uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'crew-portfolio'
  and (
    name like ((select auth.uid())::text || '/%')
    or private.bluedeck_owns_crew_profile_storage_path(name)
  )
);

drop policy if exists "Authenticated crew portfolio updates" on storage.objects;
create policy "Authenticated crew portfolio updates"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'crew-portfolio'
  and (
    name like ((select auth.uid())::text || '/%')
    or private.bluedeck_owns_crew_profile_storage_path(name)
  )
)
with check (
  bucket_id = 'crew-portfolio'
  and (
    name like ((select auth.uid())::text || '/%')
    or private.bluedeck_owns_crew_profile_storage_path(name)
  )
);

drop policy if exists "Authenticated crew portfolio deletes" on storage.objects;
create policy "Authenticated crew portfolio deletes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'crew-portfolio'
  and (
    name like ((select auth.uid())::text || '/%')
    or private.bluedeck_owns_crew_profile_storage_path(name)
  )
);

-- Private crew document access is limited to the authenticated owner of the
-- crew profile named by the first object-path segment.
drop policy if exists "Crew document owner read" on storage.objects;
create policy "Crew document owner read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'crew-documents'
  and private.bluedeck_owns_crew_profile_storage_path(name)
);

drop policy if exists "Crew document owner uploads" on storage.objects;
create policy "Crew document owner uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'crew-documents'
  and private.bluedeck_owns_crew_profile_storage_path(name)
);

drop policy if exists "Crew document owner updates" on storage.objects;
create policy "Crew document owner updates"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'crew-documents'
  and private.bluedeck_owns_crew_profile_storage_path(name)
)
with check (
  bucket_id = 'crew-documents'
  and private.bluedeck_owns_crew_profile_storage_path(name)
);

drop policy if exists "Crew document owner deletes" on storage.objects;
create policy "Crew document owner deletes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'crew-documents'
  and private.bluedeck_owns_crew_profile_storage_path(name)
);

commit;
