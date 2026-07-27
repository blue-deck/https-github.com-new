-- Keep crew career data available only to durable Crew and Captain accounts.
--
-- Management may still retain and read its own internal crew_profile row so
-- yacht memberships and operational authority continue to work. Career child
-- records and career-media writes require a durable marketplace entitlement.

begin;

create schema if not exists private;

create or replace function private.bluedeck_has_crew_career_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.marketplace_entitlements as entitlement
      where entitlement.user_id = auth.uid()
        and entitlement.account_role in ('crew', 'captain')
    );
$function$;

revoke all on function private.bluedeck_has_crew_career_access()
from public, anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;
grant execute on function private.bluedeck_has_crew_career_access()
to authenticated, service_role;

-- Keep the existing SELECT policy intact. A management-linked profile is an
-- internal membership identity even though it is not a career/CV workspace.
drop policy if exists bluedeck_crew_profiles_insert_own
  on public.crew_profiles;
create policy bluedeck_crew_profiles_insert_own
on public.crew_profiles
for insert
to authenticated
with check (
  private.bluedeck_has_crew_career_access()
  and user_id = auth.uid()
);

drop policy if exists bluedeck_crew_profiles_update_own
  on public.crew_profiles;
create policy bluedeck_crew_profiles_update_own
on public.crew_profiles
for update
to authenticated
using (
  private.bluedeck_has_crew_career_access()
  and private.bluedeck_is_own_crew_profile(id)
)
with check (
  private.bluedeck_has_crew_career_access()
  and user_id = auth.uid()
);

do $policies$
declare
  target_table text;
begin
  foreach target_table in array array[
    'crew_documents',
    'crew_experiences',
    'crew_references',
    'crew_portfolio_photos'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'bluedeck_' || target_table || '_select_own',
      target_table
    );
    execute format(
      'create policy %I on public.%I for select to authenticated '
      || 'using ('
      || 'private.bluedeck_has_crew_career_access() '
      || 'and private.bluedeck_is_own_crew_profile(crew_profile_id)'
      || ')',
      'bluedeck_' || target_table || '_select_own',
      target_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      'bluedeck_' || target_table || '_insert_own',
      target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated '
      || 'with check ('
      || 'private.bluedeck_has_crew_career_access() '
      || 'and private.bluedeck_is_own_crew_profile(crew_profile_id)'
      || ')',
      'bluedeck_' || target_table || '_insert_own',
      target_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      'bluedeck_' || target_table || '_update_own',
      target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated '
      || 'using ('
      || 'private.bluedeck_has_crew_career_access() '
      || 'and private.bluedeck_is_own_crew_profile(crew_profile_id)'
      || ') with check ('
      || 'private.bluedeck_has_crew_career_access() '
      || 'and private.bluedeck_is_own_crew_profile(crew_profile_id)'
      || ')',
      'bluedeck_' || target_table || '_update_own',
      target_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      'bluedeck_' || target_table || '_delete_own',
      target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated '
      || 'using ('
      || 'private.bluedeck_has_crew_career_access() '
      || 'and private.bluedeck_is_own_crew_profile(crew_profile_id)'
      || ')',
      'bluedeck_' || target_table || '_delete_own',
      target_table
    );
  end loop;
end;
$policies$;

-- Portfolio objects also hold dashboard avatars. Owner and Management
-- accounts may maintain only their own <uid>/dashboard-* objects; all other
-- career-media writes remain limited to Crew and Captain.
drop policy if exists "Authenticated crew portfolio uploads"
  on storage.objects;
create policy "Authenticated crew portfolio uploads"
on storage.objects
for insert
to authenticated
with check (
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

drop policy if exists "Authenticated crew portfolio updates"
  on storage.objects;
create policy "Authenticated crew portfolio updates"
on storage.objects
for update
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
)
with check (
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

drop policy if exists "Authenticated crew portfolio deletes"
  on storage.objects;
create policy "Authenticated crew portfolio deletes"
on storage.objects
for delete
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

drop policy if exists "Crew document owner uploads"
  on storage.objects;
create policy "Crew document owner uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'crew-documents'
  and private.bluedeck_has_crew_career_access()
  and private.bluedeck_owns_crew_profile_storage_path(name)
);

drop policy if exists "Crew document owner updates"
  on storage.objects;
create policy "Crew document owner updates"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'crew-documents'
  and private.bluedeck_has_crew_career_access()
  and private.bluedeck_owns_crew_profile_storage_path(name)
)
with check (
  bucket_id = 'crew-documents'
  and private.bluedeck_has_crew_career_access()
  and private.bluedeck_owns_crew_profile_storage_path(name)
);

drop policy if exists "Crew document owner deletes"
  on storage.objects;
create policy "Crew document owner deletes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'crew-documents'
  and private.bluedeck_has_crew_career_access()
  and private.bluedeck_owns_crew_profile_storage_path(name)
);

comment on function private.bluedeck_has_crew_career_access() is
  'True only when auth.uid() has a durable Crew or Captain marketplace entitlement.';

commit;
