-- Create each recurring checklist and its task rows atomically. A deterministic
-- recurrence key plus period key prevents duplicate cron runs from producing
-- duplicate checklists.

begin;

create extension if not exists "pgcrypto";

alter table public.yacht_checklists
  add column if not exists recurrence_key text,
  add column if not exists recurrence_period text,
  add column if not exists recurring_from uuid
    references public.yacht_checklists(id) on delete set null;

do $block$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.yacht_checklists'::regclass
      and conname = 'yacht_checklists_recurrence_key_length_check'
  ) then
    alter table public.yacht_checklists
      add constraint yacht_checklists_recurrence_key_length_check
      check (recurrence_key is null or char_length(recurrence_key) = 64);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.yacht_checklists'::regclass
      and conname = 'yacht_checklists_recurrence_period_length_check'
  ) then
    alter table public.yacht_checklists
      add constraint yacht_checklists_recurrence_period_length_check
      check (
        recurrence_period is null
        or char_length(recurrence_period) between 7 and 10
      );
  end if;
end;
$block$;

create unique index if not exists yacht_checklists_recurrence_period_unique_idx
  on public.yacht_checklists (recurrence_key, recurrence_period)
  where recurrence_key is not null
    and recurrence_period is not null;

create index if not exists yacht_checklists_recurring_from_idx
  on public.yacht_checklists (recurring_from)
  where recurring_from is not null;

create or replace function public.bluedeck_create_recurring_checklist(
  p_source_id uuid,
  p_period_key text,
  p_due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  source_checklist public.yacht_checklists%rowtype;
  source_items jsonb;
  recurrence_frequency text;
  recurrence_key_value text;
  new_checklist_id uuid;
begin
  if p_source_id is null
    or p_due_date is null
    or p_period_key is null
    or p_period_key !~ '^[0-9]{4}-(W[0-9]{2}|[0-9]{2}(-[0-9]{2})?)$'
  then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  select checklist.*
  into source_checklist
  from public.yacht_checklists as checklist
  where checklist.id = p_source_id
  for share;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'source_not_found');
  end if;

  source_items := case
    when jsonb_typeof(source_checklist.items) = 'object'
      then source_checklist.items
    else '{}'::jsonb
  end;
  recurrence_frequency := lower(
    btrim(coalesce(source_items ->> 'frequency', ''))
  );

  if recurrence_frequency not in ('daily', 'weekly', 'monthly')
    or source_checklist.assigned_to is null
    or source_checklist.yacht_id is null
    or nullif(btrim(coalesce(source_checklist.title, '')), '') is null
  then
    return jsonb_build_object('ok', false, 'reason', 'not_recurring');
  end if;

  recurrence_key_value := encode(
    extensions.digest(
      lower(
        concat_ws(
          '|',
          source_checklist.assigned_to::text,
          source_checklist.yacht_id::text,
          btrim(source_checklist.title),
          btrim(coalesce(source_checklist.department, '')),
          btrim(coalesce(source_checklist.checklist_type, '')),
          recurrence_frequency
        )
      ),
      'sha256'
    ),
    'hex'
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
    recurring_from
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
    source_checklist.id
  )
  on conflict (recurrence_key, recurrence_period)
    where recurrence_key is not null
      and recurrence_period is not null
  do nothing
  returning id into new_checklist_id;

  if new_checklist_id is null then
    return jsonb_build_object('ok', true, 'created', false);
  end if;

  insert into public.yacht_checklist_items (
    checklist_id,
    task_text,
    completed
  )
  select
    new_checklist_id,
    item.task_text,
    false
  from public.yacht_checklist_items as item
  where item.checklist_id = source_checklist.id
    and nullif(btrim(coalesce(item.task_text, '')), '') is not null
  order by item.created_at, item.id;

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'checklist_id', new_checklist_id
  );
end;
$function$;

revoke all on function public.bluedeck_create_recurring_checklist(
  uuid,
  text,
  date
) from public, anon, authenticated;
grant execute on function public.bluedeck_create_recurring_checklist(
  uuid,
  text,
  date
) to service_role;

comment on function public.bluedeck_create_recurring_checklist(uuid, text, date)
is 'Atomically creates one idempotent recurring checklist period and clones its tasks.';

commit;
