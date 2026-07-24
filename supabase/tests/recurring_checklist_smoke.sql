-- Transactional production-schema smoke test. No rows survive the rollback.

begin;

do $test$
declare
  source_id uuid;
  first_result jsonb;
  second_result jsonb;
  cloned_id uuid;
  source_tasks integer;
  cloned_tasks integer;
begin
  select id
  into source_id
  from public.yacht_checklists
  where lower(coalesce(items ->> 'frequency', ''))
      in ('daily', 'weekly', 'monthly')
    and assigned_to is not null
  order by created_at
  limit 1;

  if source_id is null then
    raise exception 'No recurring checklist source is available for smoke test.';
  end if;

  first_result := public.bluedeck_create_recurring_checklist(
    source_id,
    '2099-01',
    '2099-01-01'::date
  );

  if coalesce((first_result ->> 'created')::boolean, false)
      is distinct from true
  then
    raise exception 'First recurring checklist creation failed.';
  end if;

  cloned_id := (first_result ->> 'checklist_id')::uuid;
  second_result := public.bluedeck_create_recurring_checklist(
    source_id,
    '2099-01',
    '2099-01-01'::date
  );

  if coalesce((second_result ->> 'created')::boolean, true)
      is distinct from false
  then
    raise exception 'Recurring checklist idempotency failed.';
  end if;

  select count(*)
  into source_tasks
  from public.yacht_checklist_items
  where checklist_id = source_id;

  select count(*)
  into cloned_tasks
  from public.yacht_checklist_items
  where checklist_id = cloned_id;

  if source_tasks is distinct from cloned_tasks then
    raise exception 'Checklist task cloning was not atomic.';
  end if;
end;
$test$;

rollback;
