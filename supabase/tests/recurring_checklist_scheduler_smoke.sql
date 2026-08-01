-- Transactional scheduler, migration-state, lineage and failure-audit test.
-- No fixture or generated period survives the rollback.

begin;

set local timezone = 'UTC';
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $contract$
declare
  recurrence_default text;
  worker_definition text;
  matching_cron_jobs integer;
begin
  select pg_get_expr(attribute.adbin, attribute.adrelid)
  into recurrence_default
  from pg_attrdef as attribute
  inner join pg_attribute as column_attribute
    on column_attribute.attrelid = attribute.adrelid
    and column_attribute.attnum = attribute.adnum
  where attribute.adrelid = 'public.yacht_checklists'::regclass
    and column_attribute.attname = 'recurrence_enabled';

  if recurrence_default is distinct from 'false'
    or not exists (
      select 1
      from pg_attribute as attribute
      where attribute.attrelid = 'public.yacht_checklists'::regclass
        and attribute.attname = 'recurrence_enabled'
        and attribute.attnotnull
        and not attribute.attisdropped
    )
  then
    raise exception 'recurrence_enabled is not NOT NULL DEFAULT false.';
  end if;

  if private.bluedeck_valid_recurrence_template('[null]'::jsonb)
    or private.bluedeck_valid_recurrence_template(
      '[{"task_text":123}]'::jsonb
    )
    or private.bluedeck_valid_recurrence_template(
      '[{"task_text":"task","after_photo_url":"forbidden"}]'::jsonb
    )
    or private.bluedeck_valid_recurrence_template(
      '[{"task_text":"task","before_photo_url":"https://example.invalid/tracker"}]'::jsonb
    )
    or private.bluedeck_valid_recurrence_template(
      jsonb_build_array(
        jsonb_build_object('task_text', repeat('x', 501))
      )
    )
    or private.bluedeck_valid_recurrence_template(
      (
        select jsonb_agg(
          jsonb_build_object('task_text', 'Task ' || task.ordinality)
          order by task.ordinality
        )
        from generate_series(1, 201) as task(ordinality)
      )
    )
    or private.bluedeck_valid_recurrence_template_for_yacht(
      '[{"task_text":"task","before_photo_url":"00000000-0000-0000-0000-000000000002/manual-checklist/item/before.jpg"}]'::jsonb,
      '00000000-0000-0000-0000-000000000001'::uuid
    )
  then
    raise exception 'Malformed or oversized recurrence templates were accepted.';
  end if;

  if private.bluedeck_valid_recurrence_period(
      '2026-W31',
      '2026-07-26'::date,
      '{"frequency":"Weekly"}'::jsonb
    )
    or not private.bluedeck_valid_recurrence_period(
      '2026-W30',
      '2026-07-26'::date,
      '{"frequency":"Weekly"}'::jsonb
    )
  then
    raise exception 'Recurring periods are not normalized to their due date.';
  end if;

  if not has_function_privilege(
      'authenticated',
      'private.bluedeck_valid_recurrence_template(jsonb)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'private.bluedeck_valid_recurrence_template_for_yacht(jsonb,uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'private.bluedeck_valid_recurrence_period(text,date,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'private.bluedeck_recurrence_before_photo(text)',
      'EXECUTE'
    )
  then
    raise exception 'Validator and sanitizer ACL boundaries are invalid.';
  end if;

  if to_regprocedure(
    'private.bluedeck_renew_recurring_checklists(timestamp with time zone)'
  ) is null
    or to_regprocedure(
      'private.bluedeck_reconcile_recurring_checklists(boolean)'
    ) is null
    or to_regprocedure(
      'public.bluedeck_create_recurring_checklist(uuid,text,date)'
    ) is null
  then
    raise exception 'A recurring checklist scheduler function is missing.';
  end if;

  if has_function_privilege(
      'anon',
      'private.bluedeck_renew_recurring_checklists(timestamp with time zone)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'private.bluedeck_renew_recurring_checklists(timestamp with time zone)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'private.bluedeck_renew_recurring_checklists(timestamp with time zone)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.bluedeck_create_recurring_checklist(uuid,text,date)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_create_recurring_checklist(uuid,text,date)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_create_recurring_checklist(uuid,text,date)',
      'EXECUTE'
    )
  then
    raise exception 'Recurring checklist function grants are not least-privilege.';
  end if;

  if not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.yacht_checklists'::regclass
        and trigger.tgname = 'bluedeck_guard_checklist_recurrence'
        and trigger.tgenabled <> 'D'
        and not trigger.tgisinternal
    )
    or not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.yacht_checklist_items'::regclass
        and trigger.tgname = 'bluedeck_guard_recurring_item_insert'
        and trigger.tgenabled <> 'D'
        and not trigger.tgisinternal
    )
    or not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.yacht_checklist_items'::regclass
        and trigger.tgname = 'bluedeck_refresh_recurrence_after_item'
        and trigger.tgenabled <> 'D'
        and not trigger.tgisinternal
    )
    or not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.yacht_checklist_items'::regclass
        and trigger.tgname = 'bluedeck_guard_recurring_item_target_update'
        and trigger.tgenabled <> 'D'
        and not trigger.tgisinternal
    )
    or not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.yacht_checklist_items'::regclass
        and trigger.tgname = 'bluedeck_guard_recurring_item_delete'
        and trigger.tgenabled <> 'D'
        and not trigger.tgisinternal
    )
  then
    raise exception 'A recurring checklist ownership trigger is missing or disabled.';
  end if;

  if to_regclass('cron.job_run_details') is null then
    raise exception 'pg_cron run-detail auditing is unavailable.';
  end if;

  select count(*)::integer
  into matching_cron_jobs
  from cron.job as job
  where job.jobname = 'bluedeck-renew-recurring-checklists'
    or job.command ilike '%bluedeck_renew_recurring_checklists%'
    or job.command ilike '%/api/checklists/renew-recurring%';

  if matching_cron_jobs <> 1
    or not exists (
      select 1
      from cron.job as job
      where job.jobname = 'bluedeck-renew-recurring-checklists'
        and job.schedule = '5 * * * *'
        and job.active is true
        and btrim(job.command) =
          'select private.bluedeck_renew_recurring_checklists();'
    )
  then
    raise exception 'The exact single canonical hourly pg_cron job is not installed.';
  end if;

  select pg_get_functiondef(
    'private.bluedeck_renew_recurring_checklists(timestamp with time zone)'::regprocedure
  )
  into worker_definition;

  if worker_definition ~* 'exception[[:space:]]+when[[:space:]]+others'
    or worker_definition !~* 'raise[[:space:]]+exception'
  then
    raise exception 'The cron worker can hide a renewal failure from job_run_details.';
  end if;

  if exists (
      select 1
      from public.yacht_checklists as checklist
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
          or checklist.recurrence_key is distinct from
            private.bluedeck_recurring_key(checklist.id)
        )
    )
    or exists (
      select 1
      from public.yacht_checklists as checklist
      where checklist.recurrence_period is not null
        and not private.bluedeck_valid_recurrence_period(
          checklist.recurrence_period,
          checklist.due_date,
          checklist.items
        )
    )
    or exists (
      select 1
      from public.yacht_checklists as child
      inner join public.yacht_checklists as parent
        on parent.id = child.recurring_from
      where parent.recurring_from is not null
        or private.bluedeck_recurring_parent(null, parent.items) is not null
    )
    or exists (
      select 1
      from public.yacht_checklists as child
      where child.recurring_from is not null
        and child.recurrence_key is not null
        and child.recurrence_key is distinct from
          private.bluedeck_recurring_key(child.recurring_from)
    )
    or exists (
      select 1
      from public.yacht_checklists as checklist
      where private.bluedeck_recurring_parent(null, checklist.items) is not null
        and checklist.recurring_from is distinct from
          private.bluedeck_recurring_parent(null, checklist.items)
    )
  then
    raise exception 'Migrated recurring rows are not canonical, active or sanitized.';
  end if;

  if exists (
    select 1
    from public.yacht_checklists as checklist
    where checklist.recurrence_enabled is true
    group by
      checklist.yacht_id,
      checklist.assigned_to,
      lower(btrim(coalesce(checklist.title, ''))),
      lower(btrim(coalesce(checklist.department, ''))),
      lower(btrim(coalesce(checklist.checklist_type, ''))),
      private.bluedeck_recurring_frequency(checklist.items)
    having count(*) > 1
  ) then
    raise exception 'More than one root is enabled for a legacy signature.';
  end if;
end;
$contract$;

do $seed$
declare
  owner_user_id uuid := gen_random_uuid();
  crew_user_id uuid := gen_random_uuid();
  crew_profile_id uuid := gen_random_uuid();
  yacht_id uuid := gen_random_uuid();
  other_yacht_id uuid := gen_random_uuid();
  root_id uuid := gen_random_uuid();
  root_item_id uuid := gen_random_uuid();
  membership_id uuid := gen_random_uuid();
  chain_child_id uuid := gen_random_uuid();
  chain_grandchild_id uuid := gen_random_uuid();
  duplicate_older_id uuid := gen_random_uuid();
  duplicate_newer_id uuid := gen_random_uuid();
  cycle_a_id uuid := gen_random_uuid();
  cycle_b_id uuid := gen_random_uuid();
  missing_parent_row_id uuid := gen_random_uuid();
  missing_parent_id uuid := gen_random_uuid();
  foreign_parent_id uuid := gen_random_uuid();
  cross_tenant_child_id uuid := gen_random_uuid();
  legacy_root_older_id uuid := gen_random_uuid();
  legacy_root_newer_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      owner_user_id,
      'authenticated',
      'authenticated',
      'scheduler-owner-' || owner_user_id || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      '{"role":"owner","full_name":"Scheduler Smoke Owner"}'::jsonb,
      now(),
      now()
    ),
    (
      crew_user_id,
      'authenticated',
      'authenticated',
      'scheduler-crew-' || crew_user_id || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      '{"role":"crew","full_name":"Scheduler Smoke Crew"}'::jsonb,
      now(),
      now()
    );

  insert into public.profiles (id, email, full_name, role)
  values
    (
      owner_user_id,
      'scheduler-owner-' || owner_user_id || '@example.invalid',
      'Scheduler Smoke Owner',
      'owner'
    ),
    (
      crew_user_id,
      'scheduler-crew-' || crew_user_id || '@example.invalid',
      'Scheduler Smoke Crew',
      'crew'
    );

  insert into public.crew_profiles (
    id,
    user_id,
    public_crew_id,
    full_name,
    email,
    current_position,
    status
  )
  values (
    crew_profile_id,
    crew_user_id,
    'SMOKE-SCH-' || left(crew_profile_id::text, 8),
    'Scheduler Smoke Crew',
    'scheduler-crew-' || crew_user_id || '@example.invalid',
    'Engineer',
    'active'
  );

  perform set_config(
    'bluedeck_scheduler.captain_before_path',
    yacht_id::text || '/manual-checklist/' || root_item_id::text
      || '/before-generator.jpg',
    true
  );

  insert into public.yachts (id, name, model, flag, owner_id)
  values
    (
      yacht_id,
      'Recurring Scheduler Smoke Yacht',
      'Test 60',
      'Cayman Islands',
      owner_user_id
    ),
    (
      other_yacht_id,
      'Recurring Scheduler Isolation Yacht',
      'Test 61',
      'Malta',
      owner_user_id
    );

  insert into public.yacht_crew_memberships (
    id,
    yacht_id,
    crew_profile_id,
    position,
    department,
    status
  )
  values (
    membership_id,
    yacht_id,
    crew_profile_id,
    'Engineer',
    'Engineering',
    'active'
  );

  insert into public.yacht_checklists (
    id,
    yacht_id,
    title,
    department,
    checklist_type,
    assigned_to,
    items,
    status,
    recurrence_enabled
  )
  values (
    root_id,
    yacht_id,
    'Scheduler Root ' || root_id,
    'Engineering',
    'Safety',
    crew_profile_id,
    jsonb_build_object(
      'frequency', 'Daily',
      'tasks', jsonb_build_array('Inspect generator')
    ),
    'open',
    true
  );

  insert into public.yacht_checklist_items (
    id,
    checklist_id,
    task_text,
    completed,
    note
  )
  values (
    root_item_id,
    root_id,
    'Inspect generator',
    false,
    jsonb_build_object(
      'before_photo_url',
      current_setting('bluedeck_scheduler.captain_before_path')
    )::text
  );

  insert into public.yacht_checklists (
    id,
    yacht_id,
    title,
    department,
    checklist_type,
    assigned_to,
    items,
    status,
    due_date,
    recurrence_period,
    recurring_from,
    recurrence_enabled,
    created_at
  )
  values
    (
      chain_child_id,
      yacht_id,
      'Legacy Chain Child',
      'Engineering',
      'Safety',
      crew_profile_id,
      jsonb_build_object(
        'frequency', 'Daily',
        'recurring_from', root_id,
        'recurring_period', '2196-01-01'
      ),
      'open',
      '2196-01-01'::date,
      '2196-01-01',
      null,
      false,
      '2196-01-01 00:00:00+00'::timestamptz
    ),
    (
      chain_grandchild_id,
      yacht_id,
      'Legacy Chain Grandchild',
      'Engineering',
      'Safety',
      crew_profile_id,
      jsonb_build_object(
        'frequency', 'Daily',
        'recurring_from', chain_child_id,
        'recurring_period', '2196-01-02'
      ),
      'open',
      '2196-01-02'::date,
      '2196-01-02',
      chain_child_id,
      false,
      '2196-01-02 00:00:00+00'::timestamptz
    ),
    (
      duplicate_older_id,
      yacht_id,
      'Duplicate History Older',
      'Engineering',
      'Safety',
      crew_profile_id,
      jsonb_build_object(
        'frequency', 'Daily',
        'recurring_from', root_id,
        'recurring_period', '2196-01-03'
      ),
      'open',
      '2196-01-03'::date,
      '2196-01-03',
      root_id,
      false,
      '2196-01-03 00:00:00+00'::timestamptz
    ),
    (
      duplicate_newer_id,
      yacht_id,
      'Duplicate History Newer',
      'Engineering',
      'Safety',
      crew_profile_id,
      jsonb_build_object(
        'frequency', 'Daily',
        'recurring_from', root_id,
        'recurring_period', '2196-01-03'
      ),
      'open',
      '2196-01-03'::date,
      '2196-01-03',
      root_id,
      false,
      '2196-01-04 00:00:00+00'::timestamptz
    ),
    (
      cycle_a_id,
      yacht_id,
      'Legacy Cycle A',
      'Engineering',
      'Safety',
      crew_profile_id,
      jsonb_build_object('frequency', 'Daily'),
      'open',
      '2196-01-04'::date,
      '2196-01-04',
      null,
      false,
      '2196-01-05 00:00:00+00'::timestamptz
    ),
    (
      cycle_b_id,
      yacht_id,
      'Legacy Cycle B',
      'Engineering',
      'Safety',
      crew_profile_id,
      jsonb_build_object('frequency', 'Daily'),
      'open',
      '2196-01-05'::date,
      '2196-01-05',
      null,
      false,
      '2196-01-06 00:00:00+00'::timestamptz
    ),
    (
      missing_parent_row_id,
      yacht_id,
      'Legacy Missing Parent',
      'Engineering',
      'Safety',
      crew_profile_id,
      jsonb_build_object(
        'frequency', 'Daily',
        'recurring_from', missing_parent_id,
        'recurring_period', '2196-01-06'
      ),
      'open',
      '2196-01-06'::date,
      '2196-01-06',
      null,
      false,
      '2196-01-07 00:00:00+00'::timestamptz
    ),
    (
      foreign_parent_id,
      other_yacht_id,
      'Foreign Yacht Root',
      'Engineering',
      'Safety',
      crew_profile_id,
      jsonb_build_object('frequency', 'Daily'),
      'open',
      '2196-01-07'::date,
      '2196-01-07',
      null,
      false,
      '2196-01-08 00:00:00+00'::timestamptz
    ),
    (
      cross_tenant_child_id,
      yacht_id,
      'Cross Yacht Legacy Child',
      'Engineering',
      'Safety',
      crew_profile_id,
      jsonb_build_object(
        'frequency', 'Daily',
        'recurring_from', foreign_parent_id,
        'recurring_period', '2196-01-08'
      ),
      'open',
      '2196-01-08'::date,
      '2196-01-08',
      null,
      false,
      '2196-01-09 00:00:00+00'::timestamptz
    ),
    (
      legacy_root_older_id,
      yacht_id,
      '  Legacy Signature Candidate  ',
      ' Engineering ',
      ' Safety ',
      crew_profile_id,
      jsonb_build_object(
        'frequency', ' Daily ',
        'tasks', jsonb_build_array('Inspect legacy older task')
      ),
      'open',
      null,
      null,
      null,
      false,
      '2195-01-01 00:00:00+00'::timestamptz
    ),
    (
      legacy_root_newer_id,
      yacht_id,
      'legacy signature candidate',
      'engineering',
      'safety',
      crew_profile_id,
      jsonb_build_object(
        'frequency', 'daily',
        'tasks', jsonb_build_array('Inspect legacy newer task')
      ),
      'open',
      null,
      null,
      null,
      false,
      '2195-01-02 00:00:00+00'::timestamptz
    );

  insert into public.yacht_checklist_items (
    checklist_id,
    task_text,
    completed
  )
  values
    (legacy_root_older_id, 'Inspect legacy older task', false),
    (legacy_root_newer_id, 'Inspect legacy newer task', false);

  update public.yacht_checklists
  set recurring_from = cycle_b_id,
      items = items || jsonb_build_object('recurring_from', cycle_b_id)
  where id = cycle_a_id;

  update public.yacht_checklists
  set recurring_from = cycle_a_id,
      items = items || jsonb_build_object('recurring_from', cycle_a_id)
  where id = cycle_b_id;

  perform set_config('bluedeck_scheduler.root_id', root_id::text, true);
  perform set_config('bluedeck_scheduler.root_item_id', root_item_id::text, true);
  perform set_config(
    'bluedeck_scheduler.other_yacht_id',
    other_yacht_id::text,
    true
  );
  perform set_config('bluedeck_scheduler.membership_id', membership_id::text, true);
  perform set_config('bluedeck_scheduler.chain_child_id', chain_child_id::text, true);
  perform set_config(
    'bluedeck_scheduler.chain_grandchild_id',
    chain_grandchild_id::text,
    true
  );
  perform set_config(
    'bluedeck_scheduler.duplicate_older_id',
    duplicate_older_id::text,
    true
  );
  perform set_config(
    'bluedeck_scheduler.duplicate_newer_id',
    duplicate_newer_id::text,
    true
  );
  perform set_config('bluedeck_scheduler.cycle_a_id', cycle_a_id::text, true);
  perform set_config('bluedeck_scheduler.cycle_b_id', cycle_b_id::text, true);
  perform set_config(
    'bluedeck_scheduler.missing_parent_row_id',
    missing_parent_row_id::text,
    true
  );
  perform set_config(
    'bluedeck_scheduler.cross_tenant_child_id',
    cross_tenant_child_id::text,
    true
  );
  perform set_config(
    'bluedeck_scheduler.legacy_root_older_id',
    legacy_root_older_id::text,
    true
  );
  perform set_config(
    'bluedeck_scheduler.legacy_root_newer_id',
    legacy_root_newer_id::text,
    true
  );
end;
$seed$;

do $lineage$
declare
  root_id uuid := current_setting('bluedeck_scheduler.root_id')::uuid;
  cycle_root_id uuid := least(
    current_setting('bluedeck_scheduler.cycle_a_id'),
    current_setting('bluedeck_scheduler.cycle_b_id')
  )::uuid;
  cycle_child_id uuid := greatest(
    current_setting('bluedeck_scheduler.cycle_a_id'),
    current_setting('bluedeck_scheduler.cycle_b_id')
  )::uuid;
  missing_parent_row_id uuid :=
    current_setting('bluedeck_scheduler.missing_parent_row_id')::uuid;
  cross_tenant_child_id uuid :=
    current_setting('bluedeck_scheduler.cross_tenant_child_id')::uuid;
  first_reconcile jsonb;
  second_reconcile jsonb;
  legacy_idempotency_result jsonb;
begin
  first_reconcile := private.bluedeck_reconcile_recurring_checklists(true);
  second_reconcile := private.bluedeck_reconcile_recurring_checklists(false);

  if coalesce((first_reconcile ->> 'ok')::boolean, false) is distinct from true
    or coalesce((second_reconcile ->> 'ok')::boolean, false) is distinct from true
    or coalesce((second_reconcile ->> 'normalized')::integer, -1) <> 0
  then
    raise exception 'Recurring lineage reconciliation is not idempotent: %, %',
      first_reconcile,
      second_reconcile;
  end if;

  if exists (
    select 1
    from public.yacht_checklists as checklist
    where checklist.id in (
      current_setting('bluedeck_scheduler.chain_child_id')::uuid,
      current_setting('bluedeck_scheduler.chain_grandchild_id')::uuid
    )
      and (
        checklist.recurring_from is distinct from root_id
        or checklist.items ->> 'recurring_from' is distinct from root_id::text
        or checklist.recurrence_key is distinct from
          private.bluedeck_recurring_key(root_id)
      )
  ) then
    raise exception 'A legacy child chain was not normalized to its canonical root.';
  end if;

  if (
      select recurrence_enabled
      from public.yacht_checklists
      where id = current_setting('bluedeck_scheduler.legacy_root_newer_id')::uuid
    ) is distinct from true
    or (
      select recurrence_enabled
      from public.yacht_checklists
      where id = current_setting('bluedeck_scheduler.legacy_root_older_id')::uuid
    ) is distinct from false
  then
    raise exception 'Legacy signature selection did not retain only the newest root.';
  end if;

  if (
      select count(*)
      from public.yacht_checklists
      where id in (
        current_setting('bluedeck_scheduler.duplicate_older_id')::uuid,
        current_setting('bluedeck_scheduler.duplicate_newer_id')::uuid
      )
    ) <> 2
    or (
      select recurrence_key
      from public.yacht_checklists
      where id = current_setting('bluedeck_scheduler.duplicate_newer_id')::uuid
    ) is distinct from private.bluedeck_recurring_key(root_id)
    or (
      select recurrence_key
      from public.yacht_checklists
      where id = current_setting('bluedeck_scheduler.duplicate_older_id')::uuid
    ) is not null
  then
    raise exception 'Duplicate history was not preserved and deterministically re-keyed.';
  end if;

  delete from public.yacht_checklists
  where id = current_setting('bluedeck_scheduler.duplicate_newer_id')::uuid;

  legacy_idempotency_result := public.bluedeck_create_recurring_checklist(
    root_id,
    '2196-01-03',
    '2196-01-03'::date
  );
  if coalesce((legacy_idempotency_result ->> 'created')::boolean, true)
      is distinct from false
    or (legacy_idempotency_result ->> 'checklist_id')::uuid is distinct from
      current_setting('bluedeck_scheduler.duplicate_older_id')::uuid
    or (
      select count(*)
      from public.yacht_checklists as checklist
      where checklist.recurrence_period = '2196-01-03'
        and private.bluedeck_recurring_parent(
          checklist.recurring_from,
          checklist.items
        ) = root_id
    ) <> 1
  then
    raise exception 'Semantic root-plus-period idempotency failed after key-winner deletion: %',
      legacy_idempotency_result;
  end if;

  if (
      select recurring_from
      from public.yacht_checklists
      where id = cycle_root_id
    ) is not null
    or (
      select items ? 'recurring_from'
      from public.yacht_checklists
      where id = cycle_root_id
    )
    or (
      select recurring_from
      from public.yacht_checklists
      where id = cycle_child_id
    ) is distinct from cycle_root_id
    or (
      select recurrence_key
      from public.yacht_checklists
      where id = cycle_child_id
    ) is distinct from private.bluedeck_recurring_key(cycle_root_id)
  then
    raise exception 'A legacy recurrence cycle was not broken deterministically.';
  end if;

  if (
      select recurring_from
      from public.yacht_checklists
      where id = missing_parent_row_id
    ) is not null
    or (
      select items ? 'recurring_from'
      from public.yacht_checklists
      where id = missing_parent_row_id
    )
    or (
      select recurrence_key
      from public.yacht_checklists
      where id = missing_parent_row_id
    ) is distinct from private.bluedeck_recurring_key(missing_parent_row_id)
  then
    raise exception 'A missing legacy parent did not resolve to a safe local root.';
  end if;

  if (
      select recurring_from
      from public.yacht_checklists
      where id = cross_tenant_child_id
    ) is not null
    or (
      select items ? 'recurring_from'
      from public.yacht_checklists
      where id = cross_tenant_child_id
    )
    or (
      select recurrence_key
      from public.yacht_checklists
      where id = cross_tenant_child_id
    ) is distinct from private.bluedeck_recurring_key(cross_tenant_child_id)
  then
    raise exception 'Cross-yacht legacy lineage escaped tenant isolation.';
  end if;
end;
$lineage$;

do $identity_guard$
declare
  identity_change_rejected boolean := false;
begin
  begin
    update public.yacht_checklists
    set yacht_id = current_setting('bluedeck_scheduler.other_yacht_id')::uuid
    where id = current_setting('bluedeck_scheduler.root_id')::uuid;
  exception
    when check_violation then
      identity_change_rejected := position(
        'identity is immutable' in sqlerrm
      ) > 0;
  end;

  if not identity_change_rejected then
    raise exception 'A recurring root crossed its immutable yacht boundary.';
  end if;
end;
$identity_guard$;

do $unique_parent_conflict$
declare
  root_id uuid := current_setting('bluedeck_scheduler.root_id')::uuid;
  wrong_parent_id uuid :=
    current_setting('bluedeck_scheduler.legacy_root_newer_id')::uuid;
  conflict_raised boolean := false;
begin
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
    recurrence_enabled
  )
  select
    source.yacht_id,
    'Corrupted Different-Parent Period Conflict',
    source.department,
    source.checklist_type,
    source.assigned_to,
    jsonb_build_object(
      'frequency', 'Daily',
      'recurring_from', wrong_parent_id,
      'recurring_period', '2196-02-01'
    ),
    'open',
    '2196-02-01'::date,
    private.bluedeck_recurring_key(root_id),
    '2196-02-01',
    wrong_parent_id,
    false
  from public.yacht_checklists as source
  where source.id = root_id;

  begin
    perform public.bluedeck_create_recurring_checklist(
      root_id,
      '2196-02-01',
      '2196-02-01'::date
    );
  exception
    when sqlstate 'P0001' then
      conflict_raised := true;
  end;

  if not conflict_raised then
    raise exception 'A different-parent unique-key conflict was silently accepted.';
  end if;
end;
$unique_parent_conflict$;

do $semantic_parent_conflict$
declare
  root_id uuid := current_setting('bluedeck_scheduler.root_id')::uuid;
  conflict_raised boolean := false;
begin
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
    recurrence_enabled
  )
  select
    current_setting('bluedeck_scheduler.other_yacht_id')::uuid,
    'Corrupted Cross-Yacht Semantic Period',
    source.department,
    source.checklist_type,
    source.assigned_to,
    jsonb_build_object(
      'frequency', 'Daily',
      'recurring_from', root_id,
      'recurring_period', '2196-02-02'
    ),
    'open',
    '2196-02-02'::date,
    null,
    '2196-02-02',
    root_id,
    false
  from public.yacht_checklists as source
  where source.id = root_id;

  begin
    perform public.bluedeck_create_recurring_checklist(
      root_id,
      '2196-02-02',
      '2196-02-02'::date
    );
  exception
    when sqlstate 'P0001' then
      conflict_raised := true;
  end;

  if not conflict_raised then
    raise exception 'A cross-yacht semantic period conflict was silently accepted.';
  end if;
end;
$semantic_parent_conflict$;

do $idempotency_and_offboarding$
declare
  root_id uuid := current_setting('bluedeck_scheduler.root_id')::uuid;
  enabled_before integer;
  first_result jsonb;
  second_result jsonb;
  offboard_result jsonb;
begin
  select count(*)::integer
  into enabled_before
  from public.yacht_checklists
  where recurrence_enabled is true;

  first_result := private.bluedeck_renew_recurring_checklists(
    '2197-02-03 00:05:00+00'::timestamptz
  );
  second_result := private.bluedeck_renew_recurring_checklists(
    '2197-02-03 23:59:00+00'::timestamptz
  );

  if coalesce((first_result ->> 'ok')::boolean, false) is distinct from true
    or coalesce((first_result ->> 'created')::integer, 0)
      + coalesce((first_result ->> 'skipped')::integer, 0) <> enabled_before
    or coalesce((second_result ->> 'created')::integer, -1) <> 0
    or coalesce((second_result ->> 'skipped')::integer, -1) <> enabled_before
  then
    raise exception 'Hourly renewal is not deterministic and idempotent: %, %',
      first_result,
      second_result;
  end if;

  update public.yacht_crew_memberships
  set status = 'inactive'
  where id = current_setting('bluedeck_scheduler.membership_id')::uuid;

  offboard_result := private.bluedeck_renew_recurring_checklists(
    '2197-02-04 00:05:00+00'::timestamptz
  );

  if coalesce((offboard_result ->> 'disabled')::integer, 0) < 1
    or (
      select recurrence_enabled
      from public.yacht_checklists
      where id = root_id
    ) is distinct from false
    or exists (
      select 1
      from public.yacht_checklists
      where recurring_from = root_id
        and recurrence_period = '2197-02-04'
    )
  then
    raise exception 'Offboarding did not stop future recurrence: %', offboard_result;
  end if;

  update public.yacht_crew_memberships
  set status = 'active'
  where id = current_setting('bluedeck_scheduler.membership_id')::uuid;

  update public.yacht_checklists
  set recurrence_enabled = true
  where id = root_id;
end;
$idempotency_and_offboarding$;

alter table public.yacht_checklists
  disable trigger bluedeck_guard_checklist_recurrence;
update public.yacht_checklists
set recurrence_key = repeat('0', 64)
where id = current_setting('bluedeck_scheduler.root_id')::uuid;
alter table public.yacht_checklists
  enable trigger bluedeck_guard_checklist_recurrence;

do $structural_failure$
declare
  failure_raised boolean := false;
begin
  begin
    perform private.bluedeck_renew_recurring_checklists(
      '2197-02-05 00:05:00+00'::timestamptz
    );
  exception
    when others then
      if sqlstate = 'P0001'
        and sqlerrm = 'Invalid enabled recurring checklist source metadata.'
      then
        failure_raised := true;
      else
        raise;
      end if;
  end;

  if not failure_raised then
    raise exception 'The scheduler silently disabled a structurally invalid source.';
  end if;
end;
$structural_failure$;

update public.yacht_checklists
set recurrence_key = private.bluedeck_recurring_key(
  current_setting('bluedeck_scheduler.root_id')::uuid
)
where id = current_setting('bluedeck_scheduler.root_id')::uuid;

-- Fault injection: the direct cron target must raise, so pg_cron records a
-- failed run in cron.job_run_details instead of a false-success audit entry.
create or replace function public.bluedeck_create_recurring_checklist(
  p_source_id uuid,
  p_period_key text,
  p_due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $fault$
begin
  raise exception using
    errcode = 'P0001',
    message = 'forced recurring checklist smoke failure';
end;
$fault$;

do $failure_propagation$
declare
  failure_raised boolean := false;
begin
  begin
    perform private.bluedeck_renew_recurring_checklists(
      '2197-02-06 00:05:00+00'::timestamptz
    );
  exception
    when others then
      if sqlstate = 'P0001'
        and sqlerrm = 'forced recurring checklist smoke failure'
      then
        failure_raised := true;
      else
        raise;
      end if;
  end;

  if not failure_raised then
    raise exception 'The scheduler swallowed a renewal failure.';
  end if;
end;
$failure_propagation$;

rollback;
