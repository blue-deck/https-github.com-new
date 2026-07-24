-- Private yacht files use the yacht UUID as the first object-path segment.
-- Core table RLS remains authoritative for which records may reference them.

begin;

create schema if not exists private;

create or replace function private.bluedeck_storage_path_yacht_id(
  object_name text
)
returns uuid
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  select case
    when split_part(coalesce(object_name, ''), '/', 1)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
    else null
  end;
$function$;

create or replace function private.bluedeck_storage_path_task_id(
  object_name text
)
returns uuid
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  select case
    when split_part(coalesce(object_name, ''), '/', 2)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 2)::uuid
    else null
  end;
$function$;

create or replace function private.bluedeck_can_write_task_photo(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    private.bluedeck_is_yacht_owner(
      private.bluedeck_storage_path_yacht_id(object_name)
    )
    or exists (
      select 1
      from public.yacht_checklist_items as item
      join public.yacht_checklists as checklist
        on checklist.id = item.checklist_id
      where item.id = private.bluedeck_storage_path_task_id(object_name)
        and checklist.yacht_id =
          private.bluedeck_storage_path_yacht_id(object_name)
        and private.bluedeck_can_edit_checklist(checklist.id)
    );
$function$;

revoke all on function
  private.bluedeck_storage_path_yacht_id(text)
from public, anon;
revoke all on function
  private.bluedeck_storage_path_task_id(text)
from public, anon;
revoke all on function
  private.bluedeck_can_write_task_photo(text)
from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function
  private.bluedeck_storage_path_yacht_id(text)
to authenticated, service_role;
grant execute on function
  private.bluedeck_storage_path_task_id(text)
to authenticated, service_role;
grant execute on function
  private.bluedeck_can_write_task_photo(text)
to authenticated, service_role;

insert into storage.buckets (id, name, public)
values
  ('task-photos', 'task-photos', false),
  ('documents', 'documents', false),
  ('yacht-documents', 'yacht-documents', false)
on conflict (id) do update
set public = false;

-- Remove every policy that explicitly includes one of these buckets, plus
-- unconditional policies that would bypass all bucket restrictions.
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
        position('''task-photos''' in coalesce(qual, '')) > 0
        or position('''task-photos''' in coalesce(with_check, '')) > 0
        or position('''documents''' in coalesce(qual, '')) > 0
        or position('''documents''' in coalesce(with_check, '')) > 0
        or position('''yacht-documents''' in coalesce(qual, '')) > 0
        or position('''yacht-documents''' in coalesce(with_check, '')) > 0
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

drop policy if exists "BlueDeck authenticated storage read"
  on storage.objects;
drop policy if exists "BlueDeck authenticated storage uploads"
  on storage.objects;
drop policy if exists "BlueDeck authenticated storage updates"
  on storage.objects;
drop policy if exists "BlueDeck authenticated storage delete"
  on storage.objects;

drop policy if exists "Task photo yacht access read"
  on storage.objects;
create policy "Task photo yacht access read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-photos'
  and private.bluedeck_has_yacht_access(
    private.bluedeck_storage_path_yacht_id(name)
  )
);

drop policy if exists "Task photo yacht access uploads"
  on storage.objects;
create policy "Task photo yacht access uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-photos'
  and private.bluedeck_can_write_task_photo(name)
);

drop policy if exists "Task photo yacht access updates"
  on storage.objects;
drop policy if exists "Task photo uploader or yacht owner updates"
  on storage.objects;
create policy "Task photo uploader or yacht owner updates"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-photos'
  and private.bluedeck_has_yacht_access(
    private.bluedeck_storage_path_yacht_id(name)
  )
  and (
    owner_id::text = (select auth.uid())::text
    or private.bluedeck_is_yacht_owner(
      private.bluedeck_storage_path_yacht_id(name)
    )
  )
)
with check (
  bucket_id = 'task-photos'
  and private.bluedeck_can_write_task_photo(name)
  and (
    owner_id::text = (select auth.uid())::text
    or private.bluedeck_is_yacht_owner(
      private.bluedeck_storage_path_yacht_id(name)
    )
  )
);

drop policy if exists "Task photo yacht access deletes"
  on storage.objects;
drop policy if exists "Task photo uploader or yacht owner deletes"
  on storage.objects;
create policy "Task photo uploader or yacht owner deletes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-photos'
  and private.bluedeck_has_yacht_access(
    private.bluedeck_storage_path_yacht_id(name)
  )
  and (
    owner_id::text = (select auth.uid())::text
    or private.bluedeck_is_yacht_owner(
      private.bluedeck_storage_path_yacht_id(name)
    )
  )
);

drop policy if exists "Yacht document access read"
  on storage.objects;
create policy "Yacht document access read"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('documents', 'yacht-documents')
  and private.bluedeck_is_yacht_manager(
    private.bluedeck_storage_path_yacht_id(name)
  )
);

drop policy if exists "Yacht document owner uploads"
  on storage.objects;
create policy "Yacht document owner uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('documents', 'yacht-documents')
  and private.bluedeck_is_yacht_owner(
    private.bluedeck_storage_path_yacht_id(name)
  )
);

drop policy if exists "Yacht document owner updates"
  on storage.objects;
create policy "Yacht document owner updates"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('documents', 'yacht-documents')
  and private.bluedeck_is_yacht_owner(
    private.bluedeck_storage_path_yacht_id(name)
  )
)
with check (
  bucket_id in ('documents', 'yacht-documents')
  and private.bluedeck_is_yacht_owner(
    private.bluedeck_storage_path_yacht_id(name)
  )
);

drop policy if exists "Yacht document owner deletes"
  on storage.objects;
create policy "Yacht document owner deletes"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('documents', 'yacht-documents')
  and private.bluedeck_is_yacht_owner(
    private.bluedeck_storage_path_yacht_id(name)
  )
);

-- Task evidence must never fall back to the public crew portfolio bucket.
drop policy if exists "Crew portfolio task fallback uploads"
  on storage.objects;
drop policy if exists "Crew portfolio task fallback updates"
  on storage.objects;
drop policy if exists "Crew portfolio task fallback uploader updates"
  on storage.objects;
drop policy if exists "Crew portfolio task fallback deletes"
  on storage.objects;
drop policy if exists "Crew portfolio task fallback uploader deletes"
  on storage.objects;

commit;
