-- Make checklist completion and task-photo evidence authoritative at the
-- database boundary. Browser writes may build open checklists and correct
-- evidence during the existing 24-hour sent window, but they cannot create
-- pre-completed records or mutate archived audit history. Database-owned
-- schedulers, service-role retention jobs and table-owner maintenance retain
-- their existing internal path.

begin;

set local timezone = 'UTC';

create or replace function private.bluedeck_is_internal_checklist_actor()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select
    coalesce(
      auth.jwt() ->> 'role',
      nullif(current_setting('request.jwt.claim.role', true), ''),
      ''
    ) = 'service_role'
    or (
      auth.uid() is null
      and coalesce(
        auth.jwt() ->> 'role',
        nullif(current_setting('request.jwt.claim.role', true), ''),
        ''
      ) not in ('anon', 'authenticated')
      and session_user in ('postgres', 'supabase_admin')
    );
$function$;

create or replace function private.bluedeck_checklist_evidence_is_mutable(
  p_status text,
  p_completed_at timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select case lower(btrim(coalesce(p_status, '')))
    when 'open' then p_completed_at is null
    when 'completed' then
      p_completed_at is not null
      and p_completed_at > statement_timestamp() - interval '24 hours'
      and p_completed_at <= statement_timestamp() + interval '5 minutes'
    else false
  end;
$function$;

alter table public.yacht_checklists
  drop constraint if exists yacht_checklists_bounded_payload_check;
alter table public.yacht_checklists
  add constraint yacht_checklists_bounded_payload_check check (
    nullif(btrim(coalesce(title, '')), '') is not null
    and octet_length(title) <= 512
    and (department is null or octet_length(department) <= 256)
    and (checklist_type is null or octet_length(checklist_type) <= 256)
    and items is not null
    and jsonb_typeof(items) in ('array', 'object')
    and octet_length(items::text) <= 131072
  ) not valid;

alter table public.yacht_checklist_items
  drop constraint if exists yacht_checklist_items_bounded_payload_check;
alter table public.yacht_checklist_items
  add constraint yacht_checklist_items_bounded_payload_check check (
    nullif(btrim(coalesce(task_text, '')), '') is not null
    and char_length(task_text) <= 500
    and octet_length(task_text) <= 2000
    and octet_length(coalesce(note, '')) <= 16384
  ) not valid;

-- CHECK ... NOT VALID still protects every new or changed row. Validate
-- immediately when the live history is already clean; otherwise preserve the
-- legacy record verbatim and leave only that pre-existing row unvalidated.
-- This avoids silently truncating checklist instructions or evidence while
-- making the boundary strict for all future writes.
do $bounded_payload_preflight$
begin
  if not exists (
    select 1
    from public.yacht_checklists as checklist
    where nullif(btrim(coalesce(checklist.title, '')), '') is null
      or octet_length(checklist.title) > 512
      or octet_length(checklist.department) > 256
      or octet_length(checklist.checklist_type) > 256
      or checklist.items is null
      or jsonb_typeof(checklist.items) not in ('array', 'object')
      or octet_length(checklist.items::text) > 131072
  ) then
    alter table public.yacht_checklists
      validate constraint yacht_checklists_bounded_payload_check;
  end if;

  if not exists (
    select 1
    from public.yacht_checklist_items as item
    where nullif(btrim(coalesce(item.task_text, '')), '') is null
      or char_length(item.task_text) > 500
      or octet_length(item.task_text) > 2000
      or octet_length(coalesce(item.note, '')) > 16384
  ) then
    alter table public.yacht_checklist_items
      validate constraint yacht_checklist_items_bounded_payload_check;
  end if;
end;
$bounded_payload_preflight$;

-- Some deployed schemas still expose legacy top-level proof columns while
-- newer clients write the same values into note JSON. Bound either shape
-- without requiring those optional columns to exist everywhere.
do $top_level_photo_bounds$
declare
  column_name text;
  constraint_name text;
  has_legacy_violation boolean;
begin
  for column_name, constraint_name in
    values
      ('before_photo_url', 'yacht_checklist_items_before_photo_bound_check'),
      ('after_photo_url', 'yacht_checklist_items_after_photo_bound_check')
  loop
    if exists (
      select 1
      from pg_catalog.pg_attribute as attribute
      where attribute.attrelid =
          'public.yacht_checklist_items'::regclass
        and attribute.attname = column_name
        and attribute.attnum > 0
        and not attribute.attisdropped
    ) then
      execute format(
        'alter table public.yacht_checklist_items drop constraint if exists %I',
        constraint_name
      );
      execute format(
        'alter table public.yacht_checklist_items add constraint %I check (octet_length(coalesce(%I, '''')) <= 4096) not valid',
        constraint_name,
        column_name
      );
      execute format(
        'select exists (select 1 from public.yacht_checklist_items where octet_length(coalesce(%I, '''')) > 4096)',
        column_name
      ) into has_legacy_violation;
      if not has_legacy_violation then
        execute format(
          'alter table public.yacht_checklist_items validate constraint %I',
          constraint_name
        );
      end if;
    end if;
  end loop;
end;
$top_level_photo_bounds$;

create table if not exists private.bluedeck_checklist_item_tombstones (
  item_id uuid primary key,
  yacht_id uuid,
  deleted_at timestamptz not null default statement_timestamp(),
  deleted_by uuid,
  source text not null default 'item-delete',
  constraint bluedeck_checklist_item_tombstone_source_check check (
    source in ('item-delete', 'legacy-orphan-storage')
  )
);

alter table private.bluedeck_checklist_item_tombstones
  enable row level security;

revoke all on table private.bluedeck_checklist_item_tombstones
  from public, anon, authenticated, service_role;
grant select on table private.bluedeck_checklist_item_tombstones
  to service_role;

-- A canonical object whose task row disappeared predates this ledger. Record
-- its UUID now so a browser cannot recreate that task ID and regain access to
-- orphaned evidence after this migration.
insert into private.bluedeck_checklist_item_tombstones (
  item_id,
  yacht_id,
  deleted_at,
  source
)
select distinct on (task_id.value)
  task_id.value,
  yacht_id.value,
  coalesce(object.created_at, statement_timestamp()),
  'legacy-orphan-storage'
from storage.objects as object
cross join lateral (
  values (private.bluedeck_storage_path_yacht_id(object.name))
) as yacht_id(value)
cross join lateral (
  values (private.bluedeck_storage_path_task_id(object.name))
) as task_id(value)
where object.bucket_id = 'task-photos'
  and yacht_id.value is not null
  and task_id.value is not null
  and exists (
    select 1
    from public.yachts as yacht
    where yacht.id = yacht_id.value
  )
  and not exists (
    select 1
    from public.yacht_checklist_items as item
    where item.id = task_id.value
  )
order by task_id.value, object.created_at nulls last
on conflict (item_id) do nothing;

create index if not exists yacht_checklists_open_yacht_quota_idx
  on public.yacht_checklists (yacht_id)
  where lower(btrim(coalesce(status, ''))) = 'open';

create or replace function private.bluedeck_guard_checklist_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  checklist_count integer;
  open_checklist_count integer;
begin
  if new.yacht_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bluedeck:yacht-checklist-quota:' || new.yacht_id::text,
      0
    )
  );

  perform yacht.id
  from public.yachts as yacht
  where yacht.id = new.yacht_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Checklist yacht does not exist.';
  end if;

  select count(*)::integer
  into checklist_count
  from public.yacht_checklists as checklist
  where checklist.yacht_id = new.yacht_id;

  if checklist_count >= 5000 then
    raise exception using
      errcode = '54000',
      message = 'A yacht can retain at most 5000 checklist records.';
  end if;

  if lower(btrim(coalesce(new.status, ''))) = 'open' then
    select count(*)::integer
    into open_checklist_count
    from public.yacht_checklists as checklist
    where checklist.yacht_id = new.yacht_id
      and lower(btrim(coalesce(checklist.status, ''))) = 'open';

    if open_checklist_count >= 250 then
      raise exception using
        errcode = '54000',
        message = 'A yacht can have at most 250 open checklists.';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.bluedeck_guard_checklist_item_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  item_count integer;
begin
  if new.checklist_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bluedeck:checklist-item-quota:' || new.checklist_id::text,
      0
    )
  );

  perform checklist.id
  from public.yacht_checklists as checklist
  where checklist.id = new.checklist_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Checklist task parent does not exist.';
  end if;

  select count(*)::integer
  into item_count
  from public.yacht_checklist_items as item
  where item.checklist_id = new.checklist_id;

  if item_count >= 200 then
    raise exception using
      errcode = '54000',
      message = 'A checklist can contain at most 200 tasks.';
  end if;

  return new;
end;
$function$;

create or replace function private.bluedeck_can_insert_checklist_item(
  p_checklist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    auth.uid() is not null
    and p_checklist_id is not null
    and exists (
      select 1
      from public.yacht_checklists as checklist
      where checklist.id = p_checklist_id
        and lower(btrim(coalesce(checklist.status, ''))) = 'open'
        and checklist.completed_at is null
        and (
          private.bluedeck_is_yacht_manager(checklist.yacht_id)
          or (
            private.bluedeck_is_active_yacht_member(checklist.yacht_id)
            and private.bluedeck_is_own_crew_profile(checklist.assigned_to)
          )
        )
    );
$function$;

create or replace function private.bluedeck_can_read_checklist(
  target_checklist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    auth.uid() is not null
    and target_checklist_id is not null
    and exists (
      select 1
      from public.yacht_checklists as checklist
      where checklist.id = target_checklist_id
        and (
          private.bluedeck_is_yacht_manager(checklist.yacht_id)
          or (
            private.bluedeck_is_active_yacht_member(checklist.yacht_id)
            and private.bluedeck_is_own_crew_profile(checklist.assigned_to)
          )
        )
    );
$function$;

create or replace function private.bluedeck_guard_checklist_insert_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if private.bluedeck_is_internal_checklist_actor() then
    return new;
  end if;

  -- Normalize instead of trusting browser-supplied audit fields. This keeps
  -- older manager clients compatible while making forged completion inert.
  new.status := 'open';
  new.completed_at := null;
  return new;
end;
$function$;

create or replace function private.bluedeck_guard_checklist_item_insert_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if exists (
    select 1
    from private.bluedeck_checklist_item_tombstones as tombstone
    where tombstone.item_id = new.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'A deleted checklist task identifier cannot be reused.';
  end if;

  if private.bluedeck_is_internal_checklist_actor() then
    return new;
  end if;

  -- Take the same quota mutex before the shared parent lock. Without this
  -- ordering, concurrent inserts could both hold FOR SHARE and deadlock while
  -- the later quota trigger upgrades one of them to FOR UPDATE.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'bluedeck:checklist-item-quota:' || new.checklist_id::text,
      0
    )
  );

  -- Serialize browser task creation with checklist completion/deletion. RLS
  -- performs the same authorization check after this trigger.
  perform checklist.id
  from public.yacht_checklists as checklist
  where checklist.id = new.checklist_id
  for share;

  if not private.bluedeck_can_insert_checklist_item(new.checklist_id) then
    raise exception using
      errcode = '42501',
      message = 'Tasks may be added only to an open checklist the actor may edit.';
  end if;

  if not private.bluedeck_task_photo_sources_are_authorized(
    new.id,
    new.checklist_id,
    to_jsonb(new) ->> 'before_photo_url',
    to_jsonb(new) ->> 'after_photo_url',
    new.note,
    true
  ) then
    raise exception using
      errcode = '42501',
      message = 'Task-photo references must belong to the new checklist task.';
  end if;

  new.completed := false;
  new.completed_at := null;
  new.completed_by := null;
  return new;
end;
$function$;

-- Replace the original update guard so manager and assigned-crew completion
-- transitions use the same server timestamp and all finalized checklist rows
-- become immutable to browser actors.
create or replace function private.bluedeck_guard_checklist_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  task_count integer;
  incomplete_task_count integer;
  manager_actor boolean;
begin
  if private.bluedeck_is_internal_checklist_actor() then
    return new;
  end if;

  if lower(btrim(coalesce(old.status, ''))) = 'completed'
    or old.completed_at is not null
  then
    raise exception using
      errcode = '42501',
      message = 'A completed checklist is immutable.';
  end if;

  manager_actor := private.bluedeck_is_yacht_manager(old.yacht_id);

  if new.yacht_id is distinct from old.yacht_id
    or new.assigned_to is distinct from old.assigned_to
  then
    raise exception using
      errcode = '42501',
      message = 'Checklist yacht and assignee are immutable.';
  end if;

  if new.status is distinct from old.status then
    if lower(btrim(coalesce(old.status, ''))) <> 'open'
      or lower(btrim(coalesce(new.status, ''))) <> 'completed'
    then
      raise exception using
        errcode = '23514',
        message = 'A checklist may only move from open to completed.';
    end if;

    if (
      to_jsonb(new)
        - array['status', 'completed_at', 'updated_at']::text[]
    ) is distinct from (
      to_jsonb(old)
        - array['status', 'completed_at', 'updated_at']::text[]
    ) then
      raise exception using
        errcode = '42501',
        message = 'Checklist completion cannot rewrite checklist content.';
    end if;

    select
      count(*)::integer,
      count(*) filter (where item.completed is distinct from true)::integer
    into task_count, incomplete_task_count
    from public.yacht_checklist_items as item
    where item.checklist_id = old.id;

    if task_count = 0 or incomplete_task_count > 0 then
      raise exception using
        errcode = '23514',
        message = 'Every checklist task must be completed first.';
    end if;

    new.status := 'completed';
    new.completed_at := statement_timestamp();
  elsif new.completed_at is distinct from old.completed_at then
    raise exception using
      errcode = '42501',
      message = 'Checklist completion time is maintained by BlueDeck.';
  end if;

  if manager_actor then
    return new;
  end if;

  if (
    to_jsonb(new)
      - array['status', 'completed_at', 'updated_at']::text[]
  ) is distinct from (
    to_jsonb(old)
      - array['status', 'completed_at', 'updated_at']::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Assigned crew may update only checklist completion fields.';
  end if;

  return new;
end;
$function$;

-- Open tasks remain editable under their existing manager/assignee rules.
-- Recently completed task proof gets the existing 24-hour correction window,
-- but task identity and completion audit fields stay frozen for every browser
-- actor. After that window, no browser update is permitted.
create or replace function private.bluedeck_guard_checklist_item_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  source_yacht_id uuid;
  source_status text;
  source_completed_at timestamptz;
  manager_actor boolean;
begin
  if private.bluedeck_is_internal_checklist_actor() then
    return new;
  end if;

  select checklist.yacht_id, checklist.status, checklist.completed_at
  into source_yacht_id, source_status, source_completed_at
  from public.yacht_checklists as checklist
  where checklist.id = old.checklist_id
  for share;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Checklist task parent does not exist.';
  end if;

  if not private.bluedeck_checklist_evidence_is_mutable(
    source_status,
    source_completed_at
  ) then
    raise exception using
      errcode = '42501',
      message = 'Archived checklist evidence is immutable.';
  end if;

  if new.checklist_id is distinct from old.checklist_id then
    raise exception using
      errcode = '42501',
      message = 'Checklist task parent is immutable.';
  end if;

  if not private.bluedeck_task_photo_sources_are_authorized(
    new.id,
    new.checklist_id,
    to_jsonb(new) ->> 'before_photo_url',
    to_jsonb(new) ->> 'after_photo_url',
    new.note,
    false
  ) then
    raise exception using
      errcode = '42501',
      message = 'Task-photo references must remain bound to this checklist task.';
  end if;

  if lower(btrim(coalesce(source_status, ''))) = 'completed' then
    if (
      to_jsonb(new)
        - array[
          'before_photo_url',
          'after_photo_url',
          'note',
          'updated_at'
        ]::text[]
    ) is distinct from (
      to_jsonb(old)
        - array[
          'before_photo_url',
          'after_photo_url',
          'note',
          'updated_at'
        ]::text[]
    ) then
      raise exception using
        errcode = '42501',
        message = 'Only proof may be corrected during the completion window.';
    end if;

    if new.completed is distinct from old.completed
      or new.completed_at is distinct from old.completed_at
      or new.completed_by is distinct from old.completed_by
    then
      raise exception using
        errcode = '42501',
        message = 'Task completion identity and time are immutable.';
    end if;

    return new;
  end if;

  new.completed := coalesce(new.completed, false);
  manager_actor := private.bluedeck_is_yacht_manager(source_yacht_id);

  if not manager_actor and (
    to_jsonb(new)
      - array[
        'completed',
        'completed_at',
        'completed_by',
        'before_photo_url',
        'after_photo_url',
        'note',
        'updated_at'
      ]::text[]
  ) is distinct from (
    to_jsonb(old)
      - array[
        'completed',
        'completed_at',
        'completed_by',
        'before_photo_url',
        'after_photo_url',
        'note',
        'updated_at'
      ]::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Assigned crew may update only task completion and proof fields.';
  end if;

  if new.completed is distinct from coalesce(old.completed, false) then
    if new.completed then
      new.completed_at := statement_timestamp();
      new.completed_by := auth.uid()::text;
    else
      new.completed_at := null;
      new.completed_by := null;
    end if;
  elsif new.completed_at is distinct from old.completed_at
    or new.completed_by is distinct from old.completed_by
  then
    raise exception using
      errcode = '42501',
      message = 'Task completion identity and time are maintained by BlueDeck.';
  end if;

  return new;
end;
$function$;

create or replace function private.bluedeck_guard_checklist_delete_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
begin
  if private.bluedeck_is_internal_checklist_actor() then
    return old;
  end if;

  if lower(btrim(coalesce(old.status, ''))) = 'completed'
    or old.completed_at is not null
  then
    raise exception using
      errcode = '42501',
      message = 'Completed checklists may be purged only by BlueDeck retention.';
  end if;

  return old;
end;
$function$;

create or replace function private.bluedeck_guard_checklist_item_delete_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  source_yacht_id uuid;
  source_status text;
  source_completed_at timestamptz;
  internal_actor boolean;
begin
  internal_actor := private.bluedeck_is_internal_checklist_actor();

  if internal_actor then
    select checklist.yacht_id
    into source_yacht_id
    from public.yacht_checklists as checklist
    where checklist.id = old.checklist_id;
  else
    select checklist.yacht_id, checklist.status, checklist.completed_at
    into source_yacht_id, source_status, source_completed_at
    from public.yacht_checklists as checklist
    where checklist.id = old.checklist_id
    for share;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Checklist task parent does not exist.';
    end if;

    if lower(btrim(coalesce(source_status, ''))) = 'completed'
      or source_completed_at is not null
    then
      raise exception using
        errcode = '42501',
        message = 'Completed checklist tasks may be purged only by BlueDeck retention.';
    end if;
  end if;

  insert into private.bluedeck_checklist_item_tombstones (
    item_id,
    yacht_id,
    deleted_by,
    source
  )
  values (
    old.id,
    source_yacht_id,
    auth.uid(),
    'item-delete'
  )
  on conflict (item_id) do nothing;

  return old;
end;
$function$;

drop trigger if exists bluedeck_guard_checklist_insert_integrity
  on public.yacht_checklists;
create trigger bluedeck_guard_checklist_insert_integrity
before insert on public.yacht_checklists
for each row execute function
  private.bluedeck_guard_checklist_insert_integrity();

drop trigger if exists bluedeck_guard_checklist_quota
  on public.yacht_checklists;
create trigger bluedeck_guard_checklist_quota
before insert on public.yacht_checklists
for each row execute function private.bluedeck_guard_checklist_quota();

drop trigger if exists bluedeck_guard_checklist_update
  on public.yacht_checklists;
create trigger bluedeck_guard_checklist_update
before update on public.yacht_checklists
for each row execute function private.bluedeck_guard_checklist_update();

drop trigger if exists bluedeck_guard_checklist_delete_integrity
  on public.yacht_checklists;
create trigger bluedeck_guard_checklist_delete_integrity
before delete on public.yacht_checklists
for each row execute function
  private.bluedeck_guard_checklist_delete_integrity();

drop trigger if exists bluedeck_guard_checklist_item_insert_integrity
  on public.yacht_checklist_items;
create trigger bluedeck_guard_checklist_item_insert_integrity
before insert on public.yacht_checklist_items
for each row execute function
  private.bluedeck_guard_checklist_item_insert_integrity();

drop trigger if exists bluedeck_guard_checklist_item_quota
  on public.yacht_checklist_items;
create trigger bluedeck_guard_checklist_item_quota
before insert on public.yacht_checklist_items
for each row execute function private.bluedeck_guard_checklist_item_quota();

drop trigger if exists bluedeck_guard_checklist_item_update
  on public.yacht_checklist_items;
create trigger bluedeck_guard_checklist_item_update
before update on public.yacht_checklist_items
for each row execute function private.bluedeck_guard_checklist_item_update();

drop trigger if exists bluedeck_guard_checklist_item_delete_integrity
  on public.yacht_checklist_items;
create trigger bluedeck_guard_checklist_item_delete_integrity
before delete on public.yacht_checklist_items
for each row execute function
  private.bluedeck_guard_checklist_item_delete_integrity();

-- Defense in depth: the insert policies validate the normalized post-trigger
-- row, while update/delete policies continue to rely on the transition guards.
drop policy if exists bluedeck_checklists_select_yacht
  on public.yacht_checklists;
create policy bluedeck_checklists_select_yacht
on public.yacht_checklists
for select
to authenticated
using (
  private.bluedeck_is_yacht_manager(yacht_id)
  or (
    private.bluedeck_is_active_yacht_member(yacht_id)
    and private.bluedeck_is_own_crew_profile(assigned_to)
  )
);

drop policy if exists bluedeck_checklist_items_select_yacht
  on public.yacht_checklist_items;
create policy bluedeck_checklist_items_select_yacht
on public.yacht_checklist_items
for select
to authenticated
using (private.bluedeck_can_read_checklist(checklist_id));

drop policy if exists bluedeck_checklists_insert_authorized
  on public.yacht_checklists;
create policy bluedeck_checklists_insert_authorized
on public.yacht_checklists
for insert
to authenticated
with check (
  lower(btrim(coalesce(status, ''))) = 'open'
  and completed_at is null
  and (
    private.bluedeck_is_yacht_manager(yacht_id)
    or (
      private.bluedeck_is_active_yacht_member(yacht_id)
      and private.bluedeck_is_own_crew_profile(assigned_to)
    )
  )
);

drop policy if exists bluedeck_checklist_items_insert_authorized
  on public.yacht_checklist_items;
create policy bluedeck_checklist_items_insert_authorized
on public.yacht_checklist_items
for insert
to authenticated
with check (
  completed is false
  and completed_at is null
  and completed_by is null
  and private.bluedeck_can_insert_checklist_item(checklist_id)
);

-- Canonicalize every storage-reference shape accepted by the application.
-- Any non-empty proof value that cannot pass this exact parser is rejected by
-- the browser-write guard below rather than silently disappearing.
create or replace function private.bluedeck_task_photo_reference_path(
  p_reference text
)
returns text
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  reference_value text;
  normalized_path text;
  url_match text[];
begin
  reference_value := btrim(coalesce(p_reference, ''));
  if reference_value = '' or octet_length(reference_value) > 4096 then
    return null;
  end if;

  if reference_value ~ '^https?://' then
    url_match := regexp_match(
      reference_value,
      '^https?://[A-Za-z0-9.-]+/storage/v1/object/(public|sign|authenticated)/task-photos/([^?#]+)([?#].*)?$'
    );
    if url_match is null then
      return null;
    end if;
    normalized_path := url_match[2];
  else
    normalized_path := regexp_replace(reference_value, '[?#].*$', '');
    normalized_path := regexp_replace(
      normalized_path,
      '^/?task-photos/',
      ''
    );
    normalized_path := regexp_replace(normalized_path, '^/+', '');
  end if;

  normalized_path := btrim(normalized_path);
  if octet_length(normalized_path) between 1 and 1024
    and normalized_path ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
    and position('%' in normalized_path) = 0
    and position(chr(92) in normalized_path) = 0
    and position('//' in normalized_path) = 0
    and right(normalized_path, 1) <> '/'
    and normalized_path !~ '(^|/)[.]{1,2}(/|$)'
  then
    return normalized_path;
  end if;

  return null;
end;
$function$;

-- A task-photo object can be bound either by the canonical
-- <yacht>/<task>/... path or by an exact staged path atomically captured in
-- the private ledger when the task is inserted. Both legacy top-level proof
-- columns and every supported note key feed the same parser.
create or replace function private.bluedeck_task_photo_item_paths(
  p_before_photo_url text,
  p_after_photo_url text,
  p_note text
)
returns text[]
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  parsed_note jsonb;
  reference_value text;
  normalized_path text;
  result text[] := array[]::text[];
begin
  if nullif(btrim(coalesce(p_note, '')), '') is not null then
    begin
      parsed_note := p_note::jsonb;
    exception
      when data_exception then
        parsed_note := null;
    end;

    if jsonb_typeof(parsed_note) is distinct from 'object' then
      parsed_note := null;
    end if;
  end if;

  foreach reference_value in array array[
    p_before_photo_url,
    p_after_photo_url,
    parsed_note ->> 'before_photo_url',
    parsed_note ->> 'after_photo_url',
    parsed_note #>> '{photos,before}',
    parsed_note #>> '{photos,after}'
  ]
  loop
    normalized_path := private.bluedeck_task_photo_reference_path(
      reference_value
    );
    if normalized_path is not null
      and not normalized_path = any(result)
    then
      result := array_append(result, normalized_path);
    end if;
  end loop;

  return result;
end;
$function$;

create or replace function private.bluedeck_is_staged_manager_task_photo(
  p_object_name text
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog, private
as $function$
  select
    p_object_name is not null
    and char_length(p_object_name) between 1 and 1024
    and position('..' in p_object_name) = 0
    and p_object_name ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
    and private.bluedeck_storage_path_yacht_id(p_object_name) is not null
    and lower(split_part(p_object_name, '/', 2)) = 'manual-checklist'
    and split_part(p_object_name, '/', 3) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and nullif(split_part(p_object_name, '/', 4), '') is not null
    and split_part(p_object_name, '/', 5) = '';
$function$;

create table if not exists private.bluedeck_task_photo_bindings (
  object_name text not null,
  item_id uuid not null
    references public.yacht_checklist_items(id) on delete cascade,
  bound_by uuid,
  created_at timestamptz not null default statement_timestamp(),
  constraint bluedeck_task_photo_bindings_pkey
    primary key (object_name, item_id),
  constraint bluedeck_task_photo_binding_path_check check (
    char_length(object_name) between 1 and 1024
    and position('..' in object_name) = 0
    and object_name ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
  )
);

alter table private.bluedeck_task_photo_bindings enable row level security;

create index if not exists bluedeck_task_photo_bindings_item_idx
  on private.bluedeck_task_photo_bindings (item_id);

revoke all on table private.bluedeck_task_photo_bindings
  from public, anon, authenticated, service_role;
grant select, insert, delete on table
  private.bluedeck_task_photo_bindings
to service_role;

-- Backfill only the legacy captain staging format, and only where the object
-- was owned by the immutable yacht owner. Mutable task notes never become a
-- general authorization source.
insert into private.bluedeck_task_photo_bindings (
  object_name,
  item_id,
  bound_by
)
select
  object.name,
  item.id,
  yacht.owner_id
from public.yacht_checklist_items as item
inner join public.yacht_checklists as checklist
  on checklist.id = item.checklist_id
inner join public.yachts as yacht
  on yacht.id = checklist.yacht_id
cross join lateral unnest(
  private.bluedeck_task_photo_item_paths(
    to_jsonb(item) ->> 'before_photo_url',
    to_jsonb(item) ->> 'after_photo_url',
    item.note
  )
) as note_path(value)
inner join storage.objects as object
  on object.bucket_id = 'task-photos'
  and object.name = note_path.value
where private.bluedeck_is_staged_manager_task_photo(object.name)
  and private.bluedeck_storage_path_yacht_id(object.name) = checklist.yacht_id
  and coalesce(object.owner_id, object.owner::text) = yacht.owner_id::text
on conflict (object_name, item_id) do nothing;

create or replace function private.bluedeck_bind_staged_task_photos()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage
as $function$
declare
  source_yacht_id uuid;
  source_status text;
  source_completed_at timestamptz;
  internal_actor boolean;
  manager_actor boolean;
  object_record record;
begin
  select checklist.yacht_id, checklist.status, checklist.completed_at
  into source_yacht_id, source_status, source_completed_at
  from public.yacht_checklists as checklist
  where checklist.id = new.checklist_id;

  if not found then
    return new;
  end if;

  internal_actor := private.bluedeck_is_internal_checklist_actor();
  manager_actor := private.bluedeck_is_yacht_manager(source_yacht_id);

  for object_record in
    select object.name
    from unnest(
      private.bluedeck_task_photo_item_paths(
        to_jsonb(new) ->> 'before_photo_url',
        to_jsonb(new) ->> 'after_photo_url',
        new.note
      )
    ) as note_path(value)
    inner join storage.objects as object
      on object.bucket_id = 'task-photos'
      and object.name = note_path.value
    where private.bluedeck_storage_path_yacht_id(object.name) = source_yacht_id
      and (
        internal_actor
        or (
          manager_actor
          and lower(btrim(coalesce(source_status, ''))) = 'open'
          and source_completed_at is null
          and private.bluedeck_is_staged_manager_task_photo(object.name)
          and coalesce(object.owner_id, object.owner::text) = auth.uid()::text
          and not exists (
            select 1
            from private.bluedeck_task_photo_bindings as binding
            where binding.object_name = object.name
          )
        )
      )
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(
        'bluedeck:task-photo-binding:' || object_record.name,
        0
      )
    );

    if internal_actor or not exists (
      select 1
      from private.bluedeck_task_photo_bindings as binding
      where binding.object_name = object_record.name
    ) then
      insert into private.bluedeck_task_photo_bindings (
        object_name,
        item_id,
        bound_by
      )
      values (
        object_record.name,
        new.id,
        auth.uid()
      )
      on conflict (object_name, item_id) do nothing;
    end if;
  end loop;

  return new;
end;
$function$;

drop trigger if exists bluedeck_bind_staged_task_photos
  on public.yacht_checklist_items;
create trigger bluedeck_bind_staged_task_photos
after insert on public.yacht_checklist_items
for each row execute function private.bluedeck_bind_staged_task_photos();

create or replace function private.bluedeck_task_photo_sources_are_authorized(
  p_item_id uuid,
  p_checklist_id uuid,
  p_before_photo_url text,
  p_after_photo_url text,
  p_note text,
  p_allow_manager_staging boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, private, storage
as $function$
declare
  source_yacht_id uuid;
  parsed_note jsonb;
  reference_value text;
  normalized_path text;
begin
  select checklist.yacht_id
  into source_yacht_id
  from public.yacht_checklists as checklist
  where checklist.id = p_checklist_id;

  if source_yacht_id is null then
    return false;
  end if;

  if nullif(btrim(coalesce(p_note, '')), '') is not null then
    begin
      parsed_note := p_note::jsonb;
    exception
      when data_exception then
        parsed_note := null;
    end;

    if jsonb_typeof(parsed_note) is distinct from 'object' then
      parsed_note := null;
    end if;
  end if;

  foreach reference_value in array array[
    p_before_photo_url,
    p_after_photo_url,
    parsed_note ->> 'before_photo_url',
    parsed_note ->> 'after_photo_url',
    parsed_note #>> '{photos,before}',
    parsed_note #>> '{photos,after}'
  ]
  loop
    reference_value := btrim(coalesce(reference_value, ''));
    if reference_value = '' then
      continue;
    end if;

    normalized_path := private.bluedeck_task_photo_reference_path(
      reference_value
    );
    if normalized_path is null then
      return false;
    end if;

    if private.bluedeck_storage_path_yacht_id(normalized_path)
        is distinct from source_yacht_id
    then
      return false;
    end if;

    if private.bluedeck_storage_path_task_id(normalized_path) = p_item_id
      or exists (
        select 1
        from private.bluedeck_task_photo_bindings as binding
        where binding.object_name = normalized_path
          and binding.item_id = p_item_id
      )
    then
      continue;
    end if;

    if p_allow_manager_staging
      and private.bluedeck_is_yacht_manager(source_yacht_id)
      and private.bluedeck_is_staged_manager_task_photo(normalized_path)
    then
      perform pg_advisory_xact_lock(
        hashtextextended(
          'bluedeck:task-photo-binding:' || normalized_path,
          0
        )
      );

      if not exists (
          select 1
          from private.bluedeck_task_photo_bindings as binding
          where binding.object_name = normalized_path
        )
        and exists (
          select 1
          from storage.objects as object
          where object.bucket_id = 'task-photos'
            and object.name = normalized_path
            and coalesce(object.owner_id, object.owner::text) = auth.uid()::text
        )
      then
        continue;
      end if;
    end if;

    return false;
  end loop;

  return true;
end;
$function$;

create or replace function private.bluedeck_can_read_task_photo(
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    p_object_name is not null
    and char_length(p_object_name) between 1 and 1024
    and position('..' in p_object_name) = 0
    and private.bluedeck_storage_path_yacht_id(p_object_name) is not null
    and (
      exists (
        select 1
        from public.yacht_checklist_items as item
        inner join public.yacht_checklists as checklist
          on checklist.id = item.checklist_id
        where checklist.yacht_id =
            private.bluedeck_storage_path_yacht_id(p_object_name)
          and (
            item.id = private.bluedeck_storage_path_task_id(p_object_name)
            or exists (
              select 1
              from private.bluedeck_task_photo_bindings as binding
              where binding.object_name = p_object_name
                and binding.item_id = item.id
            )
          )
          and (
            private.bluedeck_is_yacht_manager(checklist.yacht_id)
            or (
              private.bluedeck_is_active_yacht_member(checklist.yacht_id)
              and private.bluedeck_is_own_crew_profile(checklist.assigned_to)
            )
          )
      )
      or (
        private.bluedeck_is_staged_manager_task_photo(p_object_name)
        and not exists (
          select 1
          from private.bluedeck_task_photo_bindings as binding
          where binding.object_name = p_object_name
        )
        and private.bluedeck_is_yacht_manager(
          private.bluedeck_storage_path_yacht_id(p_object_name)
        )
      )
    );
$function$;

create or replace function private.bluedeck_can_write_task_photo(
  object_name text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  path_yacht_id uuid;
  has_binding boolean;
begin
  if $1 is null
    or char_length($1) not between 1 and 1024
    or position('..' in $1) > 0
  then
    return false;
  end if;

  path_yacht_id := private.bluedeck_storage_path_yacht_id($1);
  if path_yacht_id is null then
    return false;
  end if;

  -- Keep evidence state stable for the duration of a Storage write.
  perform checklist.id
  from public.yacht_checklist_items as item
  inner join public.yacht_checklists as checklist
    on checklist.id = item.checklist_id
  where checklist.yacht_id = path_yacht_id
    and (
      item.id = private.bluedeck_storage_path_task_id($1)
      or exists (
        select 1
        from private.bluedeck_task_photo_bindings as binding
        where binding.object_name = $1
          and binding.item_id = item.id
      )
    )
  order by checklist.id
  for share of checklist;

  select exists (
    select 1
    from public.yacht_checklist_items as item
    inner join public.yacht_checklists as checklist
      on checklist.id = item.checklist_id
    where checklist.yacht_id = path_yacht_id
      and (
        item.id = private.bluedeck_storage_path_task_id($1)
        or exists (
          select 1
          from private.bluedeck_task_photo_bindings as binding
          where binding.object_name = $1
            and binding.item_id = item.id
        )
      )
  ) into has_binding;

  -- A path shared with any archived/invalid checklist is immutable even when
  -- another open item also references it.
  if exists (
    select 1
    from public.yacht_checklist_items as item
    inner join public.yacht_checklists as checklist
      on checklist.id = item.checklist_id
    where checklist.yacht_id = path_yacht_id
      and (
        item.id = private.bluedeck_storage_path_task_id($1)
        or exists (
          select 1
          from private.bluedeck_task_photo_bindings as binding
          where binding.object_name = $1
            and binding.item_id = item.id
        )
      )
      and not private.bluedeck_checklist_evidence_is_mutable(
        checklist.status,
        checklist.completed_at
      )
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.yacht_checklist_items as item
    inner join public.yacht_checklists as checklist
      on checklist.id = item.checklist_id
    where checklist.yacht_id = path_yacht_id
      and (
        item.id = private.bluedeck_storage_path_task_id($1)
        or exists (
          select 1
          from private.bluedeck_task_photo_bindings as binding
          where binding.object_name = $1
            and binding.item_id = item.id
        )
      )
      and private.bluedeck_checklist_evidence_is_mutable(
        checklist.status,
        checklist.completed_at
      )
      and (
        private.bluedeck_is_yacht_manager(checklist.yacht_id)
        or (
          private.bluedeck_is_active_yacht_member(checklist.yacht_id)
          and private.bluedeck_is_own_crew_profile(checklist.assigned_to)
        )
      )
  ) then
    return true;
  end if;

  -- Existing manager clients upload captain-authored before photos before the
  -- checklist item exists. Keep only this strict, yacht-scoped staging path;
  -- once a task note binds it, the normal mutable-parent rules above apply.
  return not has_binding
    and private.bluedeck_is_staged_manager_task_photo($1)
    and private.bluedeck_is_yacht_manager(path_yacht_id);
end;
$function$;

create or replace function private.bluedeck_guard_task_photo_object_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
begin
  if private.bluedeck_is_internal_checklist_actor() then
    return new;
  end if;

  if old.bucket_id = 'task-photos'
    and (
      new.bucket_id is distinct from old.bucket_id
      or new.name is distinct from old.name
      or new.owner_id is distinct from old.owner_id
      or new.owner is distinct from old.owner
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Task-photo object identity is immutable.';
  end if;

  return new;
end;
$function$;

drop trigger if exists bluedeck_guard_task_photo_object_update
  on storage.objects;
create trigger bluedeck_guard_task_photo_object_update
before update on storage.objects
for each row execute function
  private.bluedeck_guard_task_photo_object_update();

drop policy if exists "Task photo yacht access read"
  on storage.objects;
create policy "Task photo yacht access read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-photos'
  and private.bluedeck_can_read_task_photo(name)
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
  and owner_id::text = (select auth.uid())::text
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
  and private.bluedeck_can_write_task_photo(name)
  and (
    owner_id::text = (select auth.uid())::text
    or private.bluedeck_is_yacht_manager(
      private.bluedeck_storage_path_yacht_id(name)
    )
  )
)
with check (
  bucket_id = 'task-photos'
  and private.bluedeck_can_write_task_photo(name)
  and (
    owner_id::text = (select auth.uid())::text
    or private.bluedeck_is_yacht_manager(
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
  and private.bluedeck_can_write_task_photo(name)
  and (
    owner_id::text = (select auth.uid())::text
    or private.bluedeck_is_yacht_manager(
      private.bluedeck_storage_path_yacht_id(name)
    )
  )
);

revoke all on function private.bluedeck_is_internal_checklist_actor()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_checklist_evidence_is_mutable(
  text,
  timestamptz
) from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_checklist_quota()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_checklist_item_quota()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_can_insert_checklist_item(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_can_read_checklist(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_checklist_insert_integrity()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_checklist_item_insert_integrity()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_checklist_update()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_checklist_item_update()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_checklist_delete_integrity()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_checklist_item_delete_integrity()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_task_photo_reference_path(text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_task_photo_item_paths(
  text,
  text,
  text
)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_is_staged_manager_task_photo(text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_bind_staged_task_photos()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_task_photo_sources_are_authorized(
  uuid,
  uuid,
  text,
  text,
  text,
  boolean
) from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_can_read_task_photo(text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_can_write_task_photo(text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_task_photo_object_update()
  from public, anon, authenticated, service_role;

grant execute on function private.bluedeck_can_insert_checklist_item(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_can_read_checklist(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_can_read_task_photo(text)
  to authenticated, service_role;
grant execute on function private.bluedeck_can_write_task_photo(text)
  to authenticated, service_role;

comment on function private.bluedeck_can_read_task_photo(text) is
  'Task-photo read predicate: yacht manager or active assigned crew only; unbound manager staging stays manager-only.';
comment on function private.bluedeck_can_write_task_photo(text) is
  'Task-photo write predicate: authorized mutable checklist evidence or a strict unbound manager staging path. Archived/shared evidence is immutable.';

commit;
