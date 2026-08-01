-- Durable, database-owned recurring checklist renewal.
--
-- A recurring source is an explicitly enabled canonical root. Its immutable
-- snapshot contains stable source-item identity, authored task text and an
-- optional captain-provided before-photo reference. Completion and after-photo
-- evidence never flow into a future period. Generated rows always point
-- directly to the canonical root and can never become sources themselves.

begin;

set local timezone = 'UTC';

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create temporary table bluedeck_recurring_migration_state
on commit drop
as
select not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'yacht_checklists'
    and column_name = 'recurrence_enabled'
) or not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'yacht_checklists'
    and column_name = 'recurrence_template'
) or not exists (
  select 1
  from pg_trigger as trigger
  where trigger.tgrelid = 'public.yacht_checklists'::regclass
    and trigger.tgname = 'bluedeck_guard_checklist_recurrence'
    and not trigger.tgisinternal
) as select_legacy_roots;

alter table public.yacht_checklists
  add column if not exists recurrence_enabled boolean,
  add column if not exists recurrence_template jsonb;

update public.yacht_checklists
set recurrence_enabled = false
where recurrence_enabled is null;

alter table public.yacht_checklists
  alter column recurrence_enabled set default false,
  alter column recurrence_enabled set not null;

create or replace function private.bluedeck_recurring_parent(
  p_column_parent uuid,
  p_items jsonb
)
returns uuid
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  legacy_parent text;
begin
  if p_column_parent is not null then
    return p_column_parent;
  end if;

  if jsonb_typeof(p_items) is distinct from 'object' then
    return null;
  end if;

  legacy_parent := lower(btrim(coalesce(p_items ->> 'recurring_from', '')));
  if legacy_parent ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return legacy_parent::uuid;
  end if;

  return null;
end;
$function$;

create or replace function private.bluedeck_recurring_frequency(p_items jsonb)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  select case
    when jsonb_typeof(p_items) = 'object'
      and lower(btrim(coalesce(p_items ->> 'frequency', '')))
        in ('daily', 'weekly', 'monthly')
    then lower(btrim(p_items ->> 'frequency'))
    else null
  end;
$function$;

create or replace function private.bluedeck_valid_recurrence_period(
  p_period text,
  p_due_date date,
  p_items jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, private
as $function$
declare
  recurrence_frequency text;
begin
  if p_period is null then
    return true;
  end if;

  recurrence_frequency := private.bluedeck_recurring_frequency(p_items);
  if p_due_date is null or recurrence_frequency is null then
    return false;
  end if;

  return p_period = case recurrence_frequency
    when 'daily' then to_char(p_due_date, 'YYYY-MM-DD')
    when 'weekly' then to_char(p_due_date, 'IYYY-"W"IW')
    when 'monthly' then to_char(p_due_date, 'YYYY-MM')
  end;
end;
$function$;

create or replace function private.bluedeck_recurring_key(p_root_id uuid)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  select case
    when p_root_id is null then null
    else encode(extensions.digest(lower(p_root_id::text), 'sha256'), 'hex')
  end;
$function$;

create or replace function private.bluedeck_recurrence_before_photo(
  p_note text
)
returns text
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $function$
declare
  parsed_note jsonb;
  before_photo text;
begin
  if nullif(btrim(coalesce(p_note, '')), '') is null then
    return null;
  end if;

  begin
    parsed_note := p_note::jsonb;
  exception
    when data_exception then
      return null;
  end;

  if jsonb_typeof(parsed_note) is distinct from 'object' then
    return null;
  end if;

  before_photo := coalesce(
    nullif(btrim(parsed_note ->> 'before_photo_url'), ''),
    nullif(btrim(parsed_note #>> '{photos,before}'), '')
  );

  if before_photo is null or char_length(before_photo) > 2048 then
    return null;
  end if;

  if position('..' in before_photo) > 0 then
    return null;
  end if;

  if before_photo ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
    or before_photo ~*
      '^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/task-photos/[A-Za-z0-9][A-Za-z0-9._/-]*$'
  then
    return before_photo;
  end if;

  return null;
end;
$function$;

create or replace function private.bluedeck_legacy_captain_before_photo(
  p_note text
)
returns text
language plpgsql
immutable
security invoker
set search_path = pg_catalog, private
as $function$
declare
  before_photo text;
begin
  before_photo := private.bluedeck_recurrence_before_photo(p_note);

  -- Before the recurrence snapshot existed, the captain checklist UI was the
  -- only writer that used this path segment. Do not promote ambiguous legacy
  -- crew evidence into instructions for future periods.
  if before_photo is not null
    and position('/manual-checklist/' in lower(before_photo)) > 0
  then
    return before_photo;
  end if;

  return null;
end;
$function$;

create or replace function private.bluedeck_yacht_scoped_before_photo(
  p_before_photo text,
  p_yacht_id uuid
)
returns text
language plpgsql
immutable
security invoker
set search_path = pg_catalog, private
as $function$
declare
  before_photo text;
  yacht_prefix text;
begin
  if p_yacht_id is null or p_before_photo is null then
    return null;
  end if;

  before_photo := private.bluedeck_recurrence_before_photo(
    jsonb_build_object('before_photo_url', p_before_photo)::text
  );
  if before_photo is null then
    return null;
  end if;

  yacht_prefix := lower(p_yacht_id::text) || '/';
  if lower(before_photo) like yacht_prefix || '%'
    or lower(before_photo) like
      '%/storage/v1/object/public/task-photos/' || yacht_prefix || '%'
  then
    return before_photo;
  end if;

  return null;
end;
$function$;

create or replace function private.bluedeck_template_from_items_metadata(
  p_items jsonb
)
returns jsonb
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('task_text', btrim(task.value #>> '{}'))
      order by task.ordinality
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    case
      when jsonb_typeof(p_items) = 'object'
        and jsonb_typeof(p_items -> 'tasks') = 'array'
      then p_items -> 'tasks'
      else '[]'::jsonb
    end
  ) with ordinality as task(value, ordinality)
  where jsonb_typeof(task.value) = 'string'
    and nullif(btrim(task.value #>> '{}'), '') is not null;
$function$;

create or replace function private.bluedeck_valid_recurrence_template(
  p_template jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog
as $function$
declare
  template_item jsonb;
  before_photo text;
begin
  if jsonb_typeof(p_template) is distinct from 'array' then
    return false;
  end if;

  if jsonb_array_length(p_template) = 0
    or jsonb_array_length(p_template) > 200
  then
    return false;
  end if;

  for template_item in
    select item.value
    from jsonb_array_elements(p_template) as item(value)
  loop
    if jsonb_typeof(template_item) is distinct from 'object' then
      return false;
    end if;

    if jsonb_typeof(template_item -> 'task_text') is distinct from 'string'
      or nullif(btrim(coalesce(template_item ->> 'task_text', '')), '') is null
      or char_length(btrim(template_item ->> 'task_text')) > 500
    then
      return false;
    end if;

    if exists (
      select 1
      from jsonb_object_keys(template_item) as template_key(key)
      where template_key.key not in (
        'source_item_id',
        'task_text',
        'before_photo_url'
      )
    ) then
      return false;
    end if;

    if template_item ? 'before_photo_url' then
      if jsonb_typeof(template_item -> 'before_photo_url') is distinct from 'string' then
        return false;
      end if;

      before_photo := btrim(template_item ->> 'before_photo_url');
      if before_photo = ''
        or char_length(before_photo) > 2048
        or private.bluedeck_recurrence_before_photo(
          jsonb_build_object('before_photo_url', before_photo)::text
        ) is distinct from before_photo
      then
        return false;
      end if;
    end if;

    if template_item ? 'source_item_id' and (
      jsonb_typeof(template_item -> 'source_item_id') is distinct from 'string'
      or lower(btrim(template_item ->> 'source_item_id')) !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) then
      return false;
    end if;
  end loop;

  return true;
end;
$function$;

create or replace function private.bluedeck_valid_recurrence_template_for_yacht(
  p_template jsonb,
  p_yacht_id uuid
)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, private
as $function$
declare
  template_item jsonb;
  before_photo text;
begin
  if p_yacht_id is null
    or not private.bluedeck_valid_recurrence_template(p_template)
  then
    return false;
  end if;

  for template_item in
    select item.value
    from jsonb_array_elements(p_template) as item(value)
  loop
    if template_item ? 'before_photo_url' then
      before_photo := template_item ->> 'before_photo_url';
      if private.bluedeck_yacht_scoped_before_photo(
        before_photo,
        p_yacht_id
      ) is distinct from before_photo then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$function$;

drop function if exists private.bluedeck_build_recurrence_template(uuid);
create or replace function private.bluedeck_build_recurrence_template(
  p_checklist_id uuid,
  p_capture_before_item_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'source_item_id', source_item.id,
          'task_text', source_item.task_text,
          'before_photo_url', source_item.before_photo_url
        )
      )
      order by
        source_item.authored_order nulls last,
        source_item.created_at nulls last,
        source_item.id
    ),
    '[]'::jsonb
  )
  from (
    select
      item.id,
      item.created_at,
      coalesce(
        preserved_template.ordinality,
        metadata_template.ordinality
      ) as authored_order,
      btrim(item.task_text) as task_text,
      private.bluedeck_yacht_scoped_before_photo(
        case
          when item.id = p_capture_before_item_id then
            private.bluedeck_recurrence_before_photo(item.note)
          when preserved_template.matched then
            preserved_template.before_photo_url
          else private.bluedeck_legacy_captain_before_photo(item.note)
        end,
        checklist.yacht_id
      ) as before_photo_url
    from public.yacht_checklist_items as item
    inner join public.yacht_checklists as checklist
      on checklist.id = item.checklist_id
    left join lateral (
      select
        true as matched,
        template_item.value ->> 'before_photo_url' as before_photo_url,
        template_item.ordinality
      from jsonb_array_elements(
        case
          when jsonb_typeof(checklist.recurrence_template) = 'array'
            then checklist.recurrence_template
          else '[]'::jsonb
        end
      ) with ordinality as template_item(value, ordinality)
      where template_item.value ->> 'source_item_id' = item.id::text
      limit 1
    ) as preserved_template on true
    left join lateral (
      select min(metadata_item.ordinality) as ordinality
      from jsonb_array_elements(
        case
          when jsonb_typeof(checklist.items) = 'object'
            and jsonb_typeof(checklist.items -> 'tasks') = 'array'
          then checklist.items -> 'tasks'
          else '[]'::jsonb
        end
      ) with ordinality as metadata_item(value, ordinality)
      where jsonb_typeof(metadata_item.value) = 'string'
        and btrim(metadata_item.value #>> '{}') = btrim(item.task_text)
    ) as metadata_template on true
    where item.checklist_id = p_checklist_id
      and nullif(btrim(coalesce(item.task_text, '')), '') is not null
  ) as source_item;
$function$;

create or replace function private.bluedeck_has_active_checklist_assignee(
  p_yacht_id uuid,
  p_crew_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    p_yacht_id is not null
    and p_crew_profile_id is not null
    and exists (
      select 1
      from public.yacht_crew_memberships as membership
      where membership.yacht_id = p_yacht_id
        and membership.crew_profile_id = p_crew_profile_id
        and lower(btrim(coalesce(membership.status, ''))) = 'active'
    );
$function$;

create or replace function private.bluedeck_lock_active_checklist_assignee(
  p_yacht_id uuid,
  p_crew_profile_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $function$
declare
  active_membership_id uuid;
begin
  if p_yacht_id is null or p_crew_profile_id is null then
    return false;
  end if;

  select membership.id
  into active_membership_id
  from public.yacht_crew_memberships as membership
  where membership.yacht_id = p_yacht_id
    and membership.crew_profile_id = p_crew_profile_id
    and lower(btrim(coalesce(membership.status, ''))) = 'active'
  order by membership.id
  limit 1
  for share;

  return active_membership_id is not null;
end;
$function$;

create or replace function private.bluedeck_reconcile_recurring_checklists(
  p_select_legacy_roots boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  enabled_count integer := 0;
  normalized_count integer := 0;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('bluedeck:recurring-checklists', 0)
  );

  -- Replacing the validator also changes the semantics of an existing CHECK
  -- constraint. Sanitize older snapshots before any unrelated lineage/key
  -- update can be rejected by that stricter constraint or the prior trigger.
  update public.yacht_checklists as checklist
  set recurrence_enabled = false,
      recurrence_template = null
  where checklist.recurrence_template is not null
    and not private.bluedeck_valid_recurrence_template_for_yacht(
      checklist.recurrence_template,
      checklist.yacht_id
    );

  with recursive lineage as (
    select
      checklist.id as descendant_id,
      checklist.id as current_id,
      checklist.yacht_id as descendant_yacht_id,
      checklist.assigned_to as descendant_assigned_to,
      private.bluedeck_recurring_parent(
        checklist.recurring_from,
        checklist.items
      ) as parent_id,
      array[checklist.id]::uuid[] as visited,
      0 as depth
    from public.yacht_checklists as checklist
    where private.bluedeck_recurring_frequency(checklist.items) is not null
      or private.bluedeck_recurring_parent(
        checklist.recurring_from,
        checklist.items
      ) is not null
      or checklist.recurrence_key is not null
      or checklist.recurrence_period is not null

    union all

    select
      lineage.descendant_id,
      parent.id,
      lineage.descendant_yacht_id,
      lineage.descendant_assigned_to,
      private.bluedeck_recurring_parent(parent.recurring_from, parent.items),
      lineage.visited || parent.id,
      lineage.depth + 1
    from lineage
    inner join public.yacht_checklists as parent
      on parent.id = lineage.parent_id
      and parent.yacht_id is not distinct from lineage.descendant_yacht_id
      and parent.assigned_to is not distinct from
        lineage.descendant_assigned_to
    where lineage.parent_id is not null
      and not parent.id = any(lineage.visited)
  ),
  resolved as (
    select distinct on (lineage.descendant_id)
      lineage.descendant_id,
      case
        when lineage.parent_id = any(lineage.visited) then (
          select min(visited_id::text)::uuid
          from unnest(lineage.visited) as visited(visited_id)
        )
        else lineage.current_id
      end as root_id
    from lineage
    where lineage.parent_id is null
      or lineage.parent_id = any(lineage.visited)
      or not exists (
        select 1
        from public.yacht_checklists as parent
        where parent.id = lineage.parent_id
          and parent.yacht_id is not distinct from
            lineage.descendant_yacht_id
          and parent.assigned_to is not distinct from
            lineage.descendant_assigned_to
      )
    order by
      lineage.descendant_id,
      lineage.depth desc,
      lineage.current_id desc
  )
  update public.yacht_checklists as checklist
  set recurring_from = case
        when checklist.id = resolved.root_id then null
        else resolved.root_id
      end,
      items = case
        when jsonb_typeof(checklist.items) = 'object' then
          (checklist.items - 'recurring_from')
          || case
            when checklist.id = resolved.root_id then '{}'::jsonb
            else jsonb_build_object('recurring_from', resolved.root_id)
          end
        else checklist.items
      end
  from resolved
  where checklist.id = resolved.descendant_id
    and (
      checklist.recurring_from is distinct from case
        when checklist.id = resolved.root_id then null
        else resolved.root_id
      end
      or checklist.items is distinct from case
        when jsonb_typeof(checklist.items) = 'object' then
          (checklist.items - 'recurring_from')
          || case
            when checklist.id = resolved.root_id then '{}'::jsonb
            else jsonb_build_object('recurring_from', resolved.root_id)
          end
        else checklist.items
      end
    );

  get diagnostics normalized_count = row_count;

  update public.yacht_checklists as checklist
  set recurrence_key = null
  where checklist.recurrence_period is null
    and checklist.recurrence_key is not null
    and jsonb_typeof(checklist.items) = 'object'
    and btrim(coalesce(checklist.items ->> 'recurring_period', ''))
      ~ '^[0-9]{4}-(W[0-9]{2}|[0-9]{2}(-[0-9]{2})?)$';

  update public.yacht_checklists as checklist
  set recurrence_period = btrim(checklist.items ->> 'recurring_period')
  where checklist.recurrence_period is null
    and jsonb_typeof(checklist.items) = 'object'
    and btrim(coalesce(checklist.items ->> 'recurring_period', ''))
      ~ '^[0-9]{4}-(W[0-9]{2}|[0-9]{2}(-[0-9]{2})?)$';

  -- The retired HTTP worker used a locale-style week calculation. Normalize
  -- all historical period keys from their due date before the ISO-week worker
  -- starts, clearing stale keys first so the existing unique index cannot turn
  -- a correct period merge into a migration failure.
  with expected_periods as (
    select
      checklist.id,
      case private.bluedeck_recurring_frequency(checklist.items)
        when 'daily' then to_char(checklist.due_date, 'YYYY-MM-DD')
        when 'weekly' then to_char(checklist.due_date, 'IYYY-"W"IW')
        when 'monthly' then to_char(checklist.due_date, 'YYYY-MM')
      end as expected_period
    from public.yacht_checklists as checklist
    where checklist.recurrence_period is not null
      and checklist.due_date is not null
  )
  update public.yacht_checklists as checklist
  set recurrence_key = null
  from expected_periods
  where checklist.id = expected_periods.id
    and expected_periods.expected_period is not null
    and checklist.recurrence_period is distinct from
      expected_periods.expected_period
    and checklist.recurrence_key is not null;

  with expected_periods as (
    select
      checklist.id,
      case private.bluedeck_recurring_frequency(checklist.items)
        when 'daily' then to_char(checklist.due_date, 'YYYY-MM-DD')
        when 'weekly' then to_char(checklist.due_date, 'IYYY-"W"IW')
        when 'monthly' then to_char(checklist.due_date, 'YYYY-MM')
      end as expected_period
    from public.yacht_checklists as checklist
    where checklist.recurrence_period is not null
      and checklist.due_date is not null
  )
  update public.yacht_checklists as checklist
  set recurrence_period = expected_periods.expected_period,
      items = case
        when jsonb_typeof(checklist.items) = 'object' then
          jsonb_set(
            checklist.items,
            '{recurring_period}',
            to_jsonb(expected_periods.expected_period),
            true
          )
        else checklist.items
      end
  from expected_periods
  where checklist.id = expected_periods.id
    and expected_periods.expected_period is not null
    and (
      checklist.recurrence_period is distinct from
        expected_periods.expected_period
      or checklist.items ->> 'recurring_period' is distinct from
        expected_periods.expected_period
    );

  with mapped as (
    select
      checklist.id,
      checklist.recurrence_period,
      private.bluedeck_recurring_key(
        coalesce(checklist.recurring_from, checklist.id)
      ) as root_key,
      row_number() over (
        partition by
          private.bluedeck_recurring_key(
            coalesce(checklist.recurring_from, checklist.id)
          ),
          checklist.recurrence_period
        order by checklist.created_at desc nulls last, checklist.id desc
      ) as duplicate_rank
    from public.yacht_checklists as checklist
    where private.bluedeck_recurring_frequency(checklist.items) is not null
      or checklist.recurring_from is not null
      or checklist.recurrence_period is not null
  )
  update public.yacht_checklists as checklist
  set recurrence_key = null
  from mapped
  where checklist.id = mapped.id
    and checklist.recurrence_key is not null
    and checklist.recurrence_key is distinct from case
      when mapped.recurrence_period is null or mapped.duplicate_rank = 1
        then mapped.root_key
      else null
    end;

  -- Clear stale/conflicting keys first, then assign only rows whose desired
  -- key differs. This preserves unique-index safety without rewriting every
  -- recurring row on each hourly reconciliation.
  with mapped as (
    select
      checklist.id,
      checklist.recurrence_period,
      private.bluedeck_recurring_key(
        coalesce(checklist.recurring_from, checklist.id)
      ) as root_key,
      row_number() over (
        partition by
          private.bluedeck_recurring_key(
            coalesce(checklist.recurring_from, checklist.id)
          ),
          checklist.recurrence_period
        order by checklist.created_at desc nulls last, checklist.id desc
      ) as duplicate_rank
    from public.yacht_checklists as checklist
    where private.bluedeck_recurring_frequency(checklist.items) is not null
      or checklist.recurring_from is not null
      or checklist.recurrence_period is not null
  )
  update public.yacht_checklists as checklist
  set recurrence_key = case
    when mapped.recurrence_period is null or mapped.duplicate_rank = 1
      then mapped.root_key
    else null
  end
  from mapped
  where checklist.id = mapped.id
    and checklist.recurrence_key is distinct from case
      when mapped.recurrence_period is null or mapped.duplicate_rank = 1
        then mapped.root_key
      else null
    end;

  if p_select_legacy_roots then
    update public.yacht_checklists
    set recurrence_enabled = false,
        recurrence_template = null;

    with candidates as materialized (
      select
        checklist.id,
        checklist.assigned_to,
        checklist.yacht_id,
        lower(btrim(checklist.title)) as normalized_title,
        lower(btrim(coalesce(checklist.department, '')))
          as normalized_department,
        lower(btrim(coalesce(checklist.checklist_type, '')))
          as normalized_checklist_type,
        private.bluedeck_recurring_frequency(checklist.items)
          as normalized_frequency,
        checklist.created_at
      from public.yacht_checklists as checklist
      where checklist.recurring_from is null
        and private.bluedeck_recurring_parent(null, checklist.items) is null
        and checklist.recurrence_period is null
        and private.bluedeck_recurring_frequency(checklist.items) is not null
        and checklist.assigned_to is not null
        and checklist.yacht_id is not null
        and nullif(btrim(coalesce(checklist.title, '')), '') is not null
        and private.bluedeck_has_active_checklist_assignee(
          checklist.yacht_id,
          checklist.assigned_to
        )
        and exists (
          select 1
          from public.yacht_checklist_items as item
          where item.checklist_id = checklist.id
            and nullif(btrim(coalesce(item.task_text, '')), '') is not null
        )
        and private.bluedeck_valid_recurrence_template_for_yacht(
          private.bluedeck_build_recurrence_template(checklist.id),
          checklist.yacht_id
        )
    ),
    selected as (
      select candidate.id
      from (
        select
          candidates.*,
          row_number() over (
            partition by
              candidates.assigned_to,
              candidates.yacht_id,
              candidates.normalized_title,
              candidates.normalized_department,
              candidates.normalized_checklist_type,
              candidates.normalized_frequency
            order by candidates.created_at desc nulls last, candidates.id desc
          ) as signature_rank
        from candidates
      ) as candidate
      where candidate.signature_rank = 1
    )
    update public.yacht_checklists as checklist
    set recurrence_enabled = true,
        recurrence_template = private.bluedeck_build_recurrence_template(
          checklist.id
        ),
        recurrence_key = private.bluedeck_recurring_key(checklist.id),
        recurrence_period = null
    from selected
    where checklist.id = selected.id;
  end if;

  with refreshed_templates as materialized (
    select
      checklist.id,
      private.bluedeck_build_recurrence_template(checklist.id)
        as refreshed_template
    from public.yacht_checklists as checklist
    where checklist.recurrence_enabled is true
  )
  update public.yacht_checklists as checklist
  set recurrence_template = refreshed_templates.refreshed_template
  from refreshed_templates
  where checklist.id = refreshed_templates.id
    and private.bluedeck_valid_recurrence_template_for_yacht(
      refreshed_templates.refreshed_template,
      checklist.yacht_id
    )
    and checklist.recurrence_template is distinct from
      refreshed_templates.refreshed_template;

  update public.yacht_checklists as checklist
  set recurrence_enabled = false,
      recurrence_template = case
        when not private.bluedeck_valid_recurrence_template_for_yacht(
          checklist.recurrence_template,
          checklist.yacht_id
        ) then null
        else checklist.recurrence_template
      end
  where checklist.recurrence_enabled is true
    and (
      checklist.recurring_from is not null
      or private.bluedeck_recurring_parent(null, checklist.items) is not null
      or checklist.recurrence_period is not null
      or private.bluedeck_recurring_frequency(checklist.items) is null
      or not private.bluedeck_valid_recurrence_template_for_yacht(
        checklist.recurrence_template,
        checklist.yacht_id
      )
      or not private.bluedeck_has_active_checklist_assignee(
        checklist.yacht_id,
        checklist.assigned_to
      )
    );

  with ranked_enabled as (
    select
      checklist.id,
      row_number() over (
        partition by
          checklist.yacht_id,
          checklist.assigned_to,
          lower(btrim(coalesce(checklist.title, ''))),
          lower(btrim(coalesce(checklist.department, ''))),
          lower(btrim(coalesce(checklist.checklist_type, ''))),
          private.bluedeck_recurring_frequency(checklist.items)
        order by checklist.created_at desc nulls last, checklist.id desc
      ) as signature_rank
    from public.yacht_checklists as checklist
    where checklist.recurrence_enabled is true
  )
  update public.yacht_checklists as checklist
  set recurrence_enabled = false
  from ranked_enabled
  where checklist.id = ranked_enabled.id
    and ranked_enabled.signature_rank > 1;

  update public.yacht_checklists as checklist
  set recurrence_template = null
  where checklist.recurrence_template is not null
    and not private.bluedeck_valid_recurrence_template_for_yacht(
      checklist.recurrence_template,
      checklist.yacht_id
    );

  select count(*)::integer
  into enabled_count
  from public.yacht_checklists
  where recurrence_enabled;

  return jsonb_build_object(
    'ok', true,
    'normalized', normalized_count,
    'enabled', enabled_count
  );
end;
$function$;

select private.bluedeck_reconcile_recurring_checklists(
  (select select_legacy_roots from bluedeck_recurring_migration_state)
);

alter table public.yacht_checklists
  drop constraint if exists yacht_checklists_recurrence_template_shape_check;
alter table public.yacht_checklists
  add constraint yacht_checklists_recurrence_template_shape_check
  check (
    recurrence_template is null
    or private.bluedeck_valid_recurrence_template_for_yacht(
      recurrence_template,
      yacht_id
    )
  );

alter table public.yacht_checklists
  drop constraint if exists yacht_checklists_recurrence_period_due_check;
alter table public.yacht_checklists
  add constraint yacht_checklists_recurrence_period_due_check
  check (
    private.bluedeck_valid_recurrence_period(
      recurrence_period,
      due_date,
      items
    )
  );

alter table public.yacht_checklists
  drop constraint if exists yacht_checklists_enabled_root_check;
alter table public.yacht_checklists
  add constraint yacht_checklists_enabled_root_check
  check (
    recurrence_enabled is false
    or (
      recurring_from is null
      and recurrence_template is not null
      and recurrence_period is null
    )
  );

create unique index if not exists yacht_checklists_recurrence_period_unique_idx
  on public.yacht_checklists (recurrence_key, recurrence_period)
  where recurrence_key is not null
    and recurrence_period is not null;

create unique index if not exists yacht_checklists_enabled_signature_unique_idx
  on public.yacht_checklists (
    yacht_id,
    assigned_to,
    (lower(btrim(coalesce(title, '')))),
    (lower(btrim(coalesce(department, '')))),
    (lower(btrim(coalesce(checklist_type, '')))),
    (lower(btrim(coalesce(items ->> 'frequency', ''))))
  )
  where recurrence_enabled is true
    and recurring_from is null;

create index if not exists yacht_checklists_enabled_assignee_idx
  on public.yacht_checklists (yacht_id, assigned_to)
  where recurrence_enabled is true;

create index if not exists yacht_crew_memberships_active_assignment_idx
  on public.yacht_crew_memberships (yacht_id, crew_profile_id)
  where lower(btrim(coalesce(status, ''))) = 'active';

create or replace function private.bluedeck_guard_checklist_recurrence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  internal_actor boolean;
  manager_actor boolean;
  next_template jsonb;
begin
  new.recurrence_enabled := coalesce(new.recurrence_enabled, false);
  internal_actor := coalesce(
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

  if tg_op = 'INSERT' then
    manager_actor := internal_actor
      or private.bluedeck_is_yacht_manager(new.yacht_id);

    if not internal_actor and (
      new.recurrence_key is not null
      or new.recurrence_period is not null
      or new.recurring_from is not null
      or new.recurrence_template is not null
    ) then
      raise exception using
        errcode = '42501',
        message = 'Recurring checklist lineage metadata is maintained by BlueDeck.';
    end if;

    if new.recurrence_enabled and not manager_actor then
      raise exception using
        errcode = '42501',
        message = 'Only a yacht manager may enable recurring checklists.';
    end if;

    if new.recurrence_enabled then
      if private.bluedeck_recurring_parent(new.recurring_from, new.items)
        is not null
      then
        raise exception using
          errcode = '23514',
          message = 'Only a canonical checklist root may recur.';
      end if;

      if private.bluedeck_recurring_frequency(new.items) is null
        or not private.bluedeck_lock_active_checklist_assignee(
          new.yacht_id,
          new.assigned_to
        )
      then
        raise exception using
          errcode = '23514',
          message = 'A recurring checklist requires a supported frequency and an active same-yacht assignee.';
      end if;

      next_template := private.bluedeck_template_from_items_metadata(new.items);
      if not private.bluedeck_valid_recurrence_template_for_yacht(
        next_template,
        new.yacht_id
      ) then
        raise exception using
          errcode = '23514',
          message = 'Add at least one non-empty task before enabling recurrence.';
      end if;

      new.recurrence_template := next_template;
      new.recurrence_key := private.bluedeck_recurring_key(new.id);
      new.recurrence_period := null;
      new.recurring_from := null;
    elsif new.recurrence_template is not null
      and not private.bluedeck_valid_recurrence_template_for_yacht(
        new.recurrence_template,
        new.yacht_id
      )
    then
      raise exception using
        errcode = '23514',
        message = 'Recurring checklist template metadata is invalid.';
    end if;

    return new;
  end if;

  if pg_trigger_depth() > 1
    and (to_jsonb(new) - 'recurrence_template')
      is not distinct from (to_jsonb(old) - 'recurrence_template')
    and new.recurrence_template is distinct from old.recurrence_template
  then
    if new.recurrence_enabled
      and not private.bluedeck_valid_recurrence_template_for_yacht(
        new.recurrence_template,
        new.yacht_id
      )
    then
      raise exception using
        errcode = '23514',
        message = 'A recurring checklist must retain at least one non-empty task.';
    end if;
    return new;
  end if;

  if (
      old.recurrence_enabled is true
      or old.recurrence_template is not null
      or old.recurrence_period is not null
      or private.bluedeck_recurring_parent(
        old.recurring_from,
        old.items
      ) is not null
    )
    and (
      new.yacht_id is distinct from old.yacht_id
      or new.assigned_to is distinct from old.assigned_to
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Recurring checklist yacht and assignee identity is immutable; create a new root instead.';
  end if;

  manager_actor := internal_actor
    or (
      private.bluedeck_is_yacht_manager(old.yacht_id)
      and private.bluedeck_is_yacht_manager(new.yacht_id)
    );

  if new.recurrence_enabled is distinct from old.recurrence_enabled
    and not manager_actor
  then
    raise exception using
      errcode = '42501',
      message = 'Only a yacht manager may change checklist recurrence.';
  end if;

  if new.recurrence_template is distinct from old.recurrence_template
    and not internal_actor
  then
    raise exception using
      errcode = '42501',
      message = 'Recurring checklist templates are refreshed from manager-authored tasks.';
  end if;

  if not internal_actor and (
    new.recurrence_key is distinct from old.recurrence_key
    or new.recurrence_period is distinct from old.recurrence_period
    or new.recurring_from is distinct from old.recurring_from
  ) then
    raise exception using
      errcode = '42501',
      message = 'Recurring checklist lineage metadata is maintained by BlueDeck.';
  end if;

  if new.recurrence_enabled then
    if private.bluedeck_recurring_parent(new.recurring_from, new.items)
      is not null
    then
      raise exception using
        errcode = '23514',
        message = 'Only a canonical checklist root may recur.';
    end if;

    if private.bluedeck_recurring_frequency(new.items) is null
      or not private.bluedeck_lock_active_checklist_assignee(
        new.yacht_id,
        new.assigned_to
      )
    then
      raise exception using
        errcode = '23514',
        message = 'A recurring checklist requires a supported frequency and an active same-yacht assignee.';
    end if;

    if old.recurrence_enabled is distinct from true then
      new.recurrence_template := private.bluedeck_build_recurrence_template(
        old.id
      );
    end if;

    if not private.bluedeck_valid_recurrence_template_for_yacht(
      new.recurrence_template,
      new.yacht_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Add at least one non-empty task before enabling recurrence.';
    end if;

    new.recurrence_key := private.bluedeck_recurring_key(new.id);
    new.recurrence_period := null;
    new.recurring_from := null;
  elsif new.recurrence_template is not null
    and not private.bluedeck_valid_recurrence_template_for_yacht(
      new.recurrence_template,
      new.yacht_id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Recurring checklist template metadata is invalid.';
  end if;

  return new;
end;
$function$;

create or replace function private.bluedeck_guard_recurring_item_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  checklist_record record;
  old_checklist_id uuid;
  new_checklist_id uuid;
  old_yacht_id uuid;
  new_yacht_id uuid;
  old_enabled boolean := false;
  new_enabled boolean := false;
  old_definition_changed boolean := false;
  internal_actor boolean;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_checklist_id := old.checklist_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    new_checklist_id := new.checklist_id;
  end if;
  if tg_op = 'DELETE' then
    old_definition_changed := true;
  elsif tg_op = 'UPDATE' then
    old_definition_changed :=
      new_checklist_id is distinct from old_checklist_id
      or new.task_text is distinct from old.task_text;
  end if;

  internal_actor := coalesce(
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

  -- Lock both sides of a move in UUID order so opposite concurrent moves
  -- cannot deadlock while checking the protected recurring roots.
  for checklist_record in
    select checklist.id, checklist.yacht_id, checklist.recurrence_enabled
    from public.yacht_checklists as checklist
    where checklist.id in (old_checklist_id, new_checklist_id)
    order by checklist.id
    for no key update
  loop
    if checklist_record.id = old_checklist_id then
      old_yacht_id := checklist_record.yacht_id;
      old_enabled := checklist_record.recurrence_enabled;
    end if;
    if checklist_record.id = new_checklist_id then
      new_yacht_id := checklist_record.yacht_id;
      new_enabled := checklist_record.recurrence_enabled;
    end if;
  end loop;

  if old_enabled is true
    and old_definition_changed
    and not internal_actor
    and not private.bluedeck_is_yacht_manager(old_yacht_id)
  then
    raise exception using
      errcode = '42501',
      message = 'Assigned crew cannot alter task definitions on a recurring checklist root.';
  end if;

  if new_enabled is true
    and (
      tg_op = 'INSERT'
      or new_checklist_id is distinct from old_checklist_id
    )
    and not internal_actor
    and not private.bluedeck_is_yacht_manager(new_yacht_id)
  then
    raise exception using
      errcode = '42501',
      message = 'Assigned crew cannot add tasks to a recurring checklist root.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop function if exists private.bluedeck_refresh_recurrence_template(uuid);
create or replace function private.bluedeck_refresh_recurrence_template(
  p_checklist_id uuid,
  p_capture_before_item_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  update public.yacht_checklists as checklist
  set recurrence_template = private.bluedeck_build_recurrence_template(
    checklist.id,
    p_capture_before_item_id
  )
  where checklist.id = p_checklist_id
    and checklist.recurrence_enabled is true;
end;
$function$;

create or replace function private.bluedeck_refresh_recurrence_after_item()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  source_yacht_id uuid;
  source_enabled boolean;
  internal_actor boolean;
  capture_before_item_id uuid;
begin
  internal_actor := coalesce(
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

  if tg_op = 'DELETE' then
    select checklist.yacht_id, checklist.recurrence_enabled
    into source_yacht_id, source_enabled
    from public.yacht_checklists as checklist
    where checklist.id = old.checklist_id;

    if source_enabled is true
      and (
        internal_actor
        or private.bluedeck_is_yacht_manager(source_yacht_id)
      )
    then
      perform private.bluedeck_refresh_recurrence_template(
        old.checklist_id,
        null
      );
    end if;
    return null;
  end if;

  if tg_op = 'UPDATE'
    and old.checklist_id is distinct from new.checklist_id
  then
    select checklist.yacht_id, checklist.recurrence_enabled
    into source_yacht_id, source_enabled
    from public.yacht_checklists as checklist
    where checklist.id = old.checklist_id;

    if source_enabled is true
      and (
        internal_actor
        or private.bluedeck_is_yacht_manager(source_yacht_id)
      )
    then
      perform private.bluedeck_refresh_recurrence_template(
        old.checklist_id,
        null
      );
    end if;
  end if;

  if tg_op = 'INSERT' then
    capture_before_item_id := new.id;
  elsif old.checklist_id is distinct from new.checklist_id
    or private.bluedeck_recurrence_before_photo(old.note) is distinct from
      private.bluedeck_recurrence_before_photo(new.note)
  then
    capture_before_item_id := new.id;
  else
    capture_before_item_id := null;
  end if;

  if new.checklist_id is not null then
    select checklist.yacht_id, checklist.recurrence_enabled
    into source_yacht_id, source_enabled
    from public.yacht_checklists as checklist
    where checklist.id = new.checklist_id;

    if source_enabled is true
      and (
        internal_actor
        or private.bluedeck_is_yacht_manager(source_yacht_id)
      )
    then
      perform private.bluedeck_refresh_recurrence_template(
        new.checklist_id,
        capture_before_item_id
      );
    end if;
  end if;

  return null;
end;
$function$;

drop trigger if exists bluedeck_guard_checklist_recurrence
  on public.yacht_checklists;
create trigger bluedeck_guard_checklist_recurrence
before insert or update on public.yacht_checklists
for each row execute function private.bluedeck_guard_checklist_recurrence();

drop trigger if exists bluedeck_guard_recurring_item_insert
  on public.yacht_checklist_items;
create trigger bluedeck_guard_recurring_item_insert
before insert on public.yacht_checklist_items
for each row execute function private.bluedeck_guard_recurring_item_insert();

drop trigger if exists bluedeck_guard_recurring_item_target_update
  on public.yacht_checklist_items;
create trigger bluedeck_guard_recurring_item_target_update
before update of checklist_id, task_text on public.yacht_checklist_items
for each row execute function private.bluedeck_guard_recurring_item_insert();

drop trigger if exists bluedeck_guard_recurring_item_delete
  on public.yacht_checklist_items;
create trigger bluedeck_guard_recurring_item_delete
before delete on public.yacht_checklist_items
for each row execute function private.bluedeck_guard_recurring_item_insert();

drop trigger if exists bluedeck_refresh_recurrence_after_item
  on public.yacht_checklist_items;
create trigger bluedeck_refresh_recurrence_after_item
after insert or update or delete on public.yacht_checklist_items
for each row execute function private.bluedeck_refresh_recurrence_after_item();

create or replace function public.bluedeck_create_recurring_checklist(
  p_source_id uuid,
  p_period_key text,
  p_due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
set timezone = 'UTC'
as $function$
declare
  source_checklist public.yacht_checklists%rowtype;
  existing_checklist public.yacht_checklists%rowtype;
  conflicting_checklist public.yacht_checklists%rowtype;
  source_items jsonb;
  recurrence_frequency text;
  recurrence_key_value text;
  new_checklist_id uuid;
  cloned_task_count integer := 0;
begin
  if p_source_id is null
    or p_due_date is null
    or p_period_key is null
  then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bluedeck:recurring-checklists', 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(
      'bluedeck:recurring-checklist-root:' || p_source_id::text,
      0
    )
  );

  select checklist.*
  into source_checklist
  from public.yacht_checklists as checklist
  where checklist.id = p_source_id
  for share;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'source_not_found');
  end if;

  recurrence_frequency := private.bluedeck_recurring_frequency(
    source_checklist.items
  );
  if recurrence_frequency is null
    or source_checklist.recurrence_enabled is not true
    or source_checklist.recurrence_period is not null
    or source_checklist.recurrence_key is distinct from
      private.bluedeck_recurring_key(source_checklist.id)
    or private.bluedeck_recurring_parent(
      source_checklist.recurring_from,
      source_checklist.items
    ) is not null
    or not private.bluedeck_lock_active_checklist_assignee(
      source_checklist.yacht_id,
      source_checklist.assigned_to
    )
    or not private.bluedeck_valid_recurrence_template_for_yacht(
      source_checklist.recurrence_template,
      source_checklist.yacht_id
    )
  then
    return jsonb_build_object('ok', false, 'reason', 'source_ineligible');
  end if;

  if not private.bluedeck_valid_recurrence_period(
    p_period_key,
    p_due_date,
    source_checklist.items
  ) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_period');
  end if;

  recurrence_key_value := private.bluedeck_recurring_key(
    source_checklist.id
  );

  select checklist.*
  into existing_checklist
  from public.yacht_checklists as checklist
  where checklist.recurrence_period = p_period_key
    and private.bluedeck_recurring_parent(
      checklist.recurring_from,
      checklist.items
    ) = source_checklist.id
  order by
    (checklist.recurrence_key is not null) desc,
    checklist.created_at desc nulls last,
    checklist.id desc
  limit 1
  for share;

  if found then
    if existing_checklist.yacht_id is distinct from source_checklist.yacht_id
      or existing_checklist.assigned_to is distinct from
        source_checklist.assigned_to
      or existing_checklist.recurring_from is distinct from
        source_checklist.id
      or jsonb_typeof(existing_checklist.items) is distinct from 'object'
      or existing_checklist.items ->> 'recurring_from' is distinct from
        source_checklist.id::text
      or existing_checklist.items ->> 'recurring_period' is distinct from
        p_period_key
      or private.bluedeck_recurring_frequency(
        existing_checklist.items
      ) is distinct from recurrence_frequency
      or existing_checklist.recurrence_enabled is true
      or existing_checklist.recurrence_template is not null
      or (
        existing_checklist.recurrence_key is not null
        and existing_checklist.recurrence_key is distinct from
          recurrence_key_value
      )
    then
      raise exception using
        errcode = 'P0001',
        message = 'Existing recurring checklist period has incompatible lineage.';
    end if;

    return jsonb_build_object(
      'ok', true,
      'created', false,
      'checklist_id', existing_checklist.id,
      'canonical_root_id', source_checklist.id
    );
  end if;

  source_items := jsonb_strip_nulls(
    jsonb_build_object(
      'frequency', recurrence_frequency,
      'captain_note', case
        when jsonb_typeof(source_checklist.items -> 'captain_note') = 'string'
          then nullif(left(btrim(source_checklist.items ->> 'captain_note'), 2000), '')
        else null
      end,
      'source_template', case
        when jsonb_typeof(source_checklist.items -> 'source_template') = 'string'
          then nullif(left(btrim(source_checklist.items ->> 'source_template'), 100), '')
        else null
      end,
      'summary', case
        when jsonb_typeof(source_checklist.items -> 'summary') = 'string'
          then nullif(left(btrim(source_checklist.items ->> 'summary'), 1000), '')
        else null
      end,
      'assigned_by_name', case
        when jsonb_typeof(source_checklist.items -> 'assigned_by_name') = 'string'
          then nullif(left(btrim(source_checklist.items ->> 'assigned_by_name'), 200), '')
        else null
      end,
      'captain_name', case
        when jsonb_typeof(source_checklist.items -> 'captain_name') = 'string'
          then nullif(left(btrim(source_checklist.items ->> 'captain_name'), 200), '')
        else null
      end,
      'tasks', (
        select jsonb_agg(
          to_jsonb(btrim(template_item.value ->> 'task_text'))
          order by template_item.ordinality
        )
        from jsonb_array_elements(
          source_checklist.recurrence_template
        ) with ordinality as template_item(value, ordinality)
      )
    )
  );

  insert into public.yacht_checklists (
    yacht_id,
    title,
    department,
    checklist_type,
    assigned_to,
    items,
    status,
    due_date,
    recurrence_key,
    recurrence_period,
    recurring_from,
    recurrence_enabled,
    recurrence_template
  )
  values (
    source_checklist.yacht_id,
    source_checklist.title,
    source_checklist.department,
    source_checklist.checklist_type,
    source_checklist.assigned_to,
    source_items || jsonb_build_object(
        'frequency', recurrence_frequency,
        'recurring_from', source_checklist.id,
        'recurring_period', p_period_key
      ),
    'open',
    p_due_date,
    recurrence_key_value,
    p_period_key,
    source_checklist.id,
    false,
    null
  )
  on conflict (recurrence_key, recurrence_period)
    where recurrence_key is not null
      and recurrence_period is not null
  do nothing
  returning id into new_checklist_id;

  if new_checklist_id is null then
    select checklist.*
    into conflicting_checklist
    from public.yacht_checklists as checklist
    where checklist.recurrence_key = recurrence_key_value
      and checklist.recurrence_period = p_period_key
    for share;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'Recurring checklist uniqueness conflict disappeared unexpectedly.';
    end if;

    if conflicting_checklist.yacht_id is distinct from
        source_checklist.yacht_id
      or conflicting_checklist.assigned_to is distinct from
        source_checklist.assigned_to
      or conflicting_checklist.recurring_from is distinct from
        source_checklist.id
      or private.bluedeck_recurring_parent(
        conflicting_checklist.recurring_from,
        conflicting_checklist.items
      ) is distinct from source_checklist.id
      or jsonb_typeof(conflicting_checklist.items) is distinct from 'object'
      or conflicting_checklist.items ->> 'recurring_from' is distinct from
        source_checklist.id::text
      or conflicting_checklist.items ->> 'recurring_period' is distinct from
        p_period_key
      or private.bluedeck_recurring_frequency(
        conflicting_checklist.items
      ) is distinct from recurrence_frequency
      or conflicting_checklist.recurrence_enabled is true
      or conflicting_checklist.recurrence_template is not null
    then
      raise exception using
        errcode = 'P0001',
        message = 'Recurring checklist uniqueness conflict has incompatible lineage.';
    end if;

    return jsonb_build_object(
      'ok', true,
      'created', false,
      'checklist_id', conflicting_checklist.id,
      'canonical_root_id', source_checklist.id
    );
  end if;

  insert into public.yacht_checklist_items (
    checklist_id,
    task_text,
    completed,
    note,
    created_at
  )
  select
    new_checklist_id,
    btrim(template_item.value ->> 'task_text'),
    false,
    case
      when template_item.value ? 'before_photo_url' then
        jsonb_build_object(
          'before_photo_url',
          template_item.value ->> 'before_photo_url'
        )::text
      else null
    end,
    statement_timestamp()
      + interval '1 microsecond'
        * (template_item.ordinality - 1)::double precision
  from jsonb_array_elements(
    source_checklist.recurrence_template
  ) with ordinality as template_item(value, ordinality)
  order by template_item.ordinality;

  get diagnostics cloned_task_count = row_count;
  if cloned_task_count <> jsonb_array_length(
    source_checklist.recurrence_template
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Recurring checklist template cloning was incomplete.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'checklist_id', new_checklist_id,
    'canonical_root_id', source_checklist.id
  );
end;
$function$;

create or replace function private.bluedeck_renew_recurring_checklists(
  p_now timestamptz default statement_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
set timezone = 'UTC'
as $function$
declare
  source_record record;
  renewal_result jsonb;
  current_day date := (p_now at time zone 'UTC')::date;
  period_key text;
  created_count integer := 0;
  skipped_count integer := 0;
  disabled_count integer := 0;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('bluedeck:recurring-checklists', 0)
  );

  if exists (
    select 1
    from public.yacht_checklists as checklist
    where checklist.recurrence_enabled is true
      and (
        private.bluedeck_recurring_parent(
          checklist.recurring_from,
          checklist.items
        ) is not null
        or checklist.recurrence_period is not null
        or private.bluedeck_recurring_frequency(checklist.items) is null
        or not private.bluedeck_valid_recurrence_template_for_yacht(
          checklist.recurrence_template,
          checklist.yacht_id
        )
        or checklist.recurrence_key is distinct from
          private.bluedeck_recurring_key(checklist.id)
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Invalid enabled recurring checklist source metadata.';
  end if;

  update public.yacht_checklists as checklist
  set recurrence_enabled = false
  where checklist.recurrence_enabled is true
    and not private.bluedeck_has_active_checklist_assignee(
      checklist.yacht_id,
      checklist.assigned_to
    );
  get diagnostics disabled_count = row_count;

  for source_record in
    select
      checklist.id,
      private.bluedeck_recurring_frequency(checklist.items) as frequency
    from public.yacht_checklists as checklist
    where checklist.recurrence_enabled is true
      and private.bluedeck_recurring_parent(
        checklist.recurring_from,
        checklist.items
      ) is null
      and private.bluedeck_recurring_frequency(checklist.items) is not null
      and private.bluedeck_valid_recurrence_template_for_yacht(
        checklist.recurrence_template,
        checklist.yacht_id
      )
      and private.bluedeck_has_active_checklist_assignee(
        checklist.yacht_id,
        checklist.assigned_to
      )
    order by checklist.id
  loop
    period_key := case source_record.frequency
      when 'daily' then to_char(current_day, 'YYYY-MM-DD')
      when 'weekly' then to_char(current_day, 'IYYY-"W"IW')
      when 'monthly' then to_char(current_day, 'YYYY-MM')
    end;

    renewal_result := public.bluedeck_create_recurring_checklist(
      source_record.id,
      period_key,
      current_day
    );

    if coalesce((renewal_result ->> 'ok')::boolean, false)
      is distinct from true
    then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Recurring checklist %s failed: %s',
          source_record.id,
          coalesce(renewal_result ->> 'reason', 'unknown_error')
        );
    end if;

    if coalesce((renewal_result ->> 'created')::boolean, false) then
      created_count := created_count + 1;
    else
      skipped_count := skipped_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'created', created_count,
    'skipped', skipped_count,
    'disabled', disabled_count,
    'renewed_at', p_now
  );
end;
$function$;

revoke all on function private.bluedeck_recurring_parent(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_recurring_frequency(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_valid_recurrence_period(
  text,
  date,
  jsonb
) from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_recurring_key(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_recurrence_before_photo(text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_legacy_captain_before_photo(text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_yacht_scoped_before_photo(text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_template_from_items_metadata(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_valid_recurrence_template(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_valid_recurrence_template_for_yacht(
  jsonb,
  uuid
) from public, anon, authenticated, service_role;
-- CHECK constraints run their outer function with the row writer's ACL. These
-- pure validators are SECURITY DEFINER so private sanitizers remain
-- non-callable; they read no tables and use fixed search paths.
grant execute on function private.bluedeck_valid_recurrence_template(jsonb)
  to authenticated, service_role;
grant execute on function private.bluedeck_valid_recurrence_template_for_yacht(
  jsonb,
  uuid
) to authenticated, service_role;
grant execute on function private.bluedeck_valid_recurrence_period(
  text,
  date,
  jsonb
) to authenticated, service_role;
revoke all on function private.bluedeck_build_recurrence_template(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_has_active_checklist_assignee(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_lock_active_checklist_assignee(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_reconcile_recurring_checklists(boolean)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_checklist_recurrence()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_recurring_item_insert()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_refresh_recurrence_template(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_refresh_recurrence_after_item()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_renew_recurring_checklists(timestamptz)
  from public, anon, authenticated, service_role;

revoke all on function public.bluedeck_create_recurring_checklist(
  uuid,
  text,
  date
) from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_create_recurring_checklist(
  uuid,
  text,
  date
) to service_role;

comment on column public.yacht_checklists.recurrence_enabled is
  'Manager-owned opt-in. Only enabled canonical roots with an active same-yacht assignee are renewed.';
comment on column public.yacht_checklists.recurrence_template is
  'Sanitized immutable future-period snapshot: internal source item id, task_text and optional captain before-photo reference only.';
comment on function public.bluedeck_create_recurring_checklist(uuid, text, date)
is 'Creates one idempotent period from an enabled canonical root snapshot; generated rows are never recurrence sources.';
comment on function private.bluedeck_renew_recurring_checklists(timestamptz)
is 'Hourly database worker for enabled canonical checklist roots. Any renewal failure is raised for cron.job_run_details auditing.';

do $cron$
declare
  existing_job record;
begin
  for existing_job in
    select job.jobid
    from cron.job as job
    where job.jobname = 'bluedeck-renew-recurring-checklists'
      or job.command ilike '%bluedeck_renew_recurring_checklists%'
      or job.command ilike '%/api/checklists/renew-recurring%'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'bluedeck-renew-recurring-checklists',
    '5 * * * *',
    $cron_command$select private.bluedeck_renew_recurring_checklists();$cron_command$
  );
end;
$cron$;

commit;
