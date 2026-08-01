-- Transactional adversarial smoke test for canonical recurring checklists.
-- Isolated actors and rows are rolled back at the end.

begin;

set local timezone = 'UTC';

do $seed$
declare
  owner_user_id uuid := gen_random_uuid();
  crew_user_id uuid := gen_random_uuid();
  owner_session_id uuid := gen_random_uuid();
  crew_session_id uuid := gen_random_uuid();
  crew_profile_id uuid := gen_random_uuid();
  yacht_id uuid := gen_random_uuid();
  crew_owned_yacht_id uuid := gen_random_uuid();
  root_id uuid := gen_random_uuid();
  first_item_id uuid := gen_random_uuid();
  second_item_id uuid := gen_random_uuid();
  movable_checklist_id uuid := gen_random_uuid();
  movable_item_id uuid := gen_random_uuid();
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
      'recurring-owner-' || owner_user_id || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      '{"role":"owner","full_name":"Recurring Smoke Owner"}'::jsonb,
      now(),
      now()
    ),
    (
      crew_user_id,
      'authenticated',
      'authenticated',
      'recurring-crew-' || crew_user_id || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      '{"role":"crew","full_name":"Recurring Smoke Crew"}'::jsonb,
      now(),
      now()
    );

  insert into private.bluedeck_account_provisioning (
    user_id,
    state,
    failure_code
  ) values
    (owner_user_id, 'ready', ''),
    (crew_user_id, 'ready', '');

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values
    (owner_session_id, owner_user_id, now(), now()),
    (crew_session_id, crew_user_id, now(), now());

  insert into public.profiles (id, email, full_name, role)
  values
    (
      owner_user_id,
      'recurring-owner-' || owner_user_id || '@example.invalid',
      'Recurring Smoke Owner',
      'owner'
    ),
    (
      crew_user_id,
      'recurring-crew-' || crew_user_id || '@example.invalid',
      'Recurring Smoke Crew',
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
    'SMOKE-REC-' || left(crew_profile_id::text, 8),
    'Recurring Smoke Crew',
    'recurring-crew-' || crew_user_id || '@example.invalid',
    'Deckhand',
    'active'
  );

  insert into public.yachts (id, name, model, flag, owner_id)
  values
    (
      yacht_id,
      'Recurring Checklist Smoke Yacht',
      'Test 50',
      'Malta',
      owner_user_id
    ),
    (
      crew_owned_yacht_id,
      'Crew Managed Source Yacht',
      'Test 51',
      'Malta',
      crew_user_id
    );

  insert into public.yacht_crew_memberships (
    yacht_id,
    crew_profile_id,
    position,
    department,
    status
  )
  values (
    yacht_id,
    crew_profile_id,
    'Deckhand',
    'Deck',
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
    movable_checklist_id,
    crew_owned_yacht_id,
    'Cross-yacht movable source',
    'Deck',
    'Operations',
    crew_profile_id,
    jsonb_build_object(
      'frequency', 'One-time',
      'tasks', jsonb_build_array('Source yacht task')
    ),
    'open',
    false
  );

  insert into public.yacht_checklist_items (
    id,
    checklist_id,
    task_text,
    completed
  )
  values (
    movable_item_id,
    movable_checklist_id,
    'Source yacht task',
    false
  );

  perform set_config('bluedeck_smoke.owner_user_id', owner_user_id::text, true);
  perform set_config('bluedeck_smoke.crew_user_id', crew_user_id::text, true);
  perform set_config('bluedeck_smoke.owner_session_id', owner_session_id::text, true);
  perform set_config('bluedeck_smoke.crew_session_id', crew_session_id::text, true);
  perform set_config('bluedeck_smoke.crew_profile_id', crew_profile_id::text, true);
  perform set_config('bluedeck_smoke.yacht_id', yacht_id::text, true);
  perform set_config('bluedeck_smoke.root_id', root_id::text, true);
  perform set_config('bluedeck_smoke.first_item_id', first_item_id::text, true);
  perform set_config('bluedeck_smoke.second_item_id', second_item_id::text, true);
  perform set_config(
    'bluedeck_smoke.captain_before_path',
    yacht_id::text || '/' || first_item_id::text || '/before-captain.jpg',
    true
  );
  perform set_config(
    'bluedeck_smoke.crew_before_path',
    yacht_id::text || '/' || first_item_id::text || '/before-crew-overwrite.jpg',
    true
  );
  perform set_config(
    'bluedeck_smoke.crew_after_path',
    yacht_id::text || '/' || first_item_id::text || '/after-crew-evidence.jpg',
    true
  );
  perform set_config(
    'bluedeck_smoke.crew_nested_after_path',
    yacht_id::text || '/' || first_item_id::text || '/after-crew-nested.jpg',
    true
  );
  perform set_config(
    'bluedeck_smoke.movable_item_id',
    movable_item_id::text,
    true
  );
  perform set_config(
    'bluedeck_smoke.movable_checklist_id',
    movable_checklist_id::text,
    true
  );
end;
$seed$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_smoke.owner_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_smoke.owner_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_smoke.owner_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
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
  recurrence_enabled
)
values (
  current_setting('bluedeck_smoke.root_id')::uuid,
  current_setting('bluedeck_smoke.yacht_id')::uuid,
  'Recurring Bilge Inspection ' || current_setting('bluedeck_smoke.root_id'),
  'Deck',
  'Safety',
  current_setting('bluedeck_smoke.crew_profile_id')::uuid,
  jsonb_build_object(
    'frequency', 'Daily',
    'captain_note', 'Follow the written procedure.',
    'source_template', 'manual',
    'summary', 'Recurring smoke fixture.',
    'tasks', jsonb_build_array('Inspect pump', 'Secure hatch'),
    'completed', true,
    'after_photo_url', 'must-not-propagate.jpg',
    'photos', jsonb_build_object('after', 'must-not-propagate-nested.jpg')
  ),
  'open',
  '2198-12-31'::date,
  true
);

insert into public.yacht_checklist_items (
  id,
  checklist_id,
  task_text,
  completed,
  completed_at,
  completed_by,
  note
)
values
  (
    current_setting('bluedeck_smoke.first_item_id')::uuid,
    current_setting('bluedeck_smoke.root_id')::uuid,
    'Inspect pump',
    true,
    now(),
    'captain@example.invalid',
    jsonb_build_object(
      'before_photo_url', current_setting('bluedeck_smoke.captain_before_path'),
      'after_photo_url', current_setting('bluedeck_smoke.crew_after_path'),
      'completed', true,
      'photos', jsonb_build_object(
        'after', current_setting('bluedeck_smoke.crew_nested_after_path')
      )
    )::text
  ),
  (
    current_setting('bluedeck_smoke.second_item_id')::uuid,
    current_setting('bluedeck_smoke.root_id')::uuid,
    'Secure hatch',
    false,
    null,
    null,
    'not-json-and-never-a-template-reference'
  );

update public.yacht_checklist_items
set task_text = 'Inspect bilge pump'
where id = current_setting('bluedeck_smoke.first_item_id')::uuid;

do $manager_assertions$
declare
  root_template jsonb;
  direct_template_rejected boolean := false;
  zero_task_rejected boolean := false;
begin
  select checklist.recurrence_template
  into root_template
  from public.yacht_checklists as checklist
  where checklist.id = current_setting('bluedeck_smoke.root_id')::uuid;

  if root_template is distinct from jsonb_build_array(
    jsonb_build_object(
      'source_item_id', current_setting('bluedeck_smoke.first_item_id'),
      'task_text', 'Inspect bilge pump',
      'before_photo_url', current_setting('bluedeck_smoke.captain_before_path')
    ),
    jsonb_build_object(
      'source_item_id', current_setting('bluedeck_smoke.second_item_id'),
      'task_text', 'Secure hatch'
    )
  ) then
    raise exception 'Manager-authored task refresh did not produce a sanitized snapshot: %',
      root_template;
  end if;

  begin
    update public.yacht_checklists
    set recurrence_template = '[{"task_text":"forged"}]'::jsonb
    where id = current_setting('bluedeck_smoke.root_id')::uuid;
  exception
    when insufficient_privilege then
      direct_template_rejected := true;
  end;

  if not direct_template_rejected then
    raise exception 'A browser manager directly rewrote recurrence_template.';
  end if;

  update public.yacht_checklists
  set recurrence_enabled = false
  where id = current_setting('bluedeck_smoke.root_id')::uuid;

  update public.yacht_checklists
  set recurrence_enabled = true
  where id = current_setting('bluedeck_smoke.root_id')::uuid;

  begin
    delete from public.yacht_checklist_items
    where checklist_id = current_setting('bluedeck_smoke.root_id')::uuid;
  exception
    when check_violation then
      zero_task_rejected := true;
  end;

  if not zero_task_rejected then
    raise exception 'An enabled recurring root was allowed to lose every task.';
  end if;

  if (
    select count(*)
    from public.yacht_checklist_items
    where checklist_id = current_setting('bluedeck_smoke.root_id')::uuid
  ) <> 2 then
    raise exception 'The rejected zero-task delete was not atomic.';
  end if;
end;
$manager_assertions$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_smoke.crew_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_smoke.crew_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_smoke.crew_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);

do $crew_adversarial$
declare
  recurrence_change_rejected boolean := false;
  root_insert_rejected boolean := false;
  task_rewrite_rejected boolean := false;
  target_move_rejected boolean := false;
  source_move_rejected boolean := false;
  root_delete_rejected boolean := false;
  affected integer := 0;
begin
  begin
    update public.yacht_checklists
    set recurrence_enabled = false
    where id = current_setting('bluedeck_smoke.root_id')::uuid;
  exception
    when insufficient_privilege then
      recurrence_change_rejected := true;
  end;

  begin
    insert into public.yacht_checklist_items (
      checklist_id,
      task_text,
      completed
    )
    values (
      current_setting('bluedeck_smoke.root_id')::uuid,
      'Crew forged future task',
      false
    );
  exception
    when insufficient_privilege then
      root_insert_rejected := true;
  end;

  begin
    update public.yacht_checklist_items
    set task_text = 'Crew rewrote captain task'
    where id = current_setting('bluedeck_smoke.first_item_id')::uuid;
  exception
    when insufficient_privilege then
      task_rewrite_rejected := true;
  end;

  begin
    update public.yacht_checklist_items
    set checklist_id = current_setting('bluedeck_smoke.root_id')::uuid
    where id = current_setting('bluedeck_smoke.movable_item_id')::uuid;
  exception
    when insufficient_privilege then
      target_move_rejected := true;
  end;

  begin
    update public.yacht_checklist_items
    set checklist_id =
      current_setting('bluedeck_smoke.movable_checklist_id')::uuid
    where id = current_setting('bluedeck_smoke.first_item_id')::uuid;
    get diagnostics affected = row_count;
    source_move_rejected := affected = 0;
  exception
    when insufficient_privilege then
      source_move_rejected := true;
  end;

  begin
    delete from public.yacht_checklist_items
    where id = current_setting('bluedeck_smoke.first_item_id')::uuid;
    get diagnostics affected = row_count;
    root_delete_rejected := affected = 0;
  exception
    when insufficient_privilege then
      root_delete_rejected := true;
  end;

  update public.yacht_checklist_items
  set note = jsonb_build_object(
    'before_photo_url', current_setting('bluedeck_smoke.crew_before_path'),
    'after_photo_url', current_setting('bluedeck_smoke.crew_after_path'),
    'completed', true
  )::text
  where id = current_setting('bluedeck_smoke.first_item_id')::uuid;
  get diagnostics affected = row_count;

  if not recurrence_change_rejected
    or not root_insert_rejected
    or not task_rewrite_rejected
    or not target_move_rejected
    or not source_move_rejected
    or not root_delete_rejected
    or affected <> 1
  then
    raise exception 'Assigned-crew recurring-root boundaries failed.';
  end if;
end;
$crew_adversarial$;

reset role;

-- Run the same destructive mutations with table-owner RLS bypass while the
-- JWT still identifies the crew member. These must be stopped by the trigger
-- itself, not merely hidden by a row policy.
do $crew_trigger_defense$
declare
  source_move_rejected boolean := false;
  root_delete_rejected boolean := false;
begin
  begin
    update public.yacht_checklist_items
    set checklist_id =
      current_setting('bluedeck_smoke.movable_checklist_id')::uuid
    where id = current_setting('bluedeck_smoke.first_item_id')::uuid;
  exception
    when insufficient_privilege then
      source_move_rejected := true;
  end;

  begin
    delete from public.yacht_checklist_items
    where id = current_setting('bluedeck_smoke.first_item_id')::uuid;
  exception
    when insufficient_privilege then
      root_delete_rejected := true;
  end;

  if not source_move_rejected or not root_delete_rejected then
    raise exception 'Recurring task mutation trigger trusted a crew JWT under RLS bypass.';
  end if;
end;
$crew_trigger_defense$;

-- A later manager task edit must not accidentally bless the crew member's
-- replacement proof URL into the next-period template.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_smoke.owner_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_smoke.owner_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_smoke.owner_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);

update public.yacht_checklist_items
set task_text = 'Inspect bilge pump and alarm'
where id = current_setting('bluedeck_smoke.first_item_id')::uuid;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $creation_assertions$
declare
  root_id uuid := current_setting('bluedeck_smoke.root_id')::uuid;
  expected_template jsonb := jsonb_build_array(
    jsonb_build_object(
      'source_item_id', current_setting('bluedeck_smoke.first_item_id'),
      'task_text', 'Inspect bilge pump and alarm',
      'before_photo_url', current_setting('bluedeck_smoke.captain_before_path')
    ),
    jsonb_build_object(
      'source_item_id', current_setting('bluedeck_smoke.second_item_id'),
      'task_text', 'Secure hatch'
    )
  );
  first_result jsonb;
  second_result jsonb;
  weekly_result jsonb;
  monthly_result jsonb;
  invalid_period_result jsonb;
  child_result jsonb;
  cloned_id uuid;
  cloned_row public.yacht_checklists%rowtype;
  cloned_task_count integer;
  cloned_created_at_count integer;
  cloned_task_order text[];
  period_mutation_rejected boolean := false;
begin
  if (
    select recurrence_template
    from public.yacht_checklists
    where id = root_id
  ) is distinct from expected_template then
    raise exception 'Crew evidence unexpectedly changed the future-period snapshot.';
  end if;

  if (
    select recurrence_key
    from public.yacht_checklists
    where id = root_id
  ) is distinct from encode(extensions.digest(lower(root_id::text), 'sha256'), 'hex') then
    raise exception 'The source recurrence key is not rooted in the canonical UUID.';
  end if;

  invalid_period_result := public.bluedeck_create_recurring_checklist(
    root_id,
    '2199-01-02',
    '2199-01-01'::date
  );
  if invalid_period_result ->> 'reason' is distinct from 'invalid_period' then
    raise exception 'A mismatched period key was accepted: %', invalid_period_result;
  end if;

  first_result := public.bluedeck_create_recurring_checklist(
    root_id,
    '2199-01-01',
    '2199-01-01'::date
  );
  if coalesce((first_result ->> 'created')::boolean, false) is distinct from true then
    raise exception 'First canonical renewal failed: %', first_result;
  end if;

  cloned_id := (first_result ->> 'checklist_id')::uuid;
  second_result := public.bluedeck_create_recurring_checklist(
    root_id,
    '2199-01-01',
    '2199-01-01'::date
  );
  if coalesce((second_result ->> 'created')::boolean, true) is distinct from false then
    raise exception 'Canonical renewal was not idempotent: %', second_result;
  end if;

  child_result := public.bluedeck_create_recurring_checklist(
    cloned_id,
    '2199-01-02',
    '2199-01-02'::date
  );
  if child_result ->> 'reason' is distinct from 'source_ineligible' then
    raise exception 'A generated checklist became a recurrence source: %', child_result;
  end if;

  select checklist.*
  into strict cloned_row
  from public.yacht_checklists as checklist
  where checklist.id = cloned_id;

  if cloned_row.recurrence_enabled is distinct from false
    or cloned_row.recurrence_template is not null
    or cloned_row.recurring_from is distinct from root_id
    or cloned_row.recurrence_key is distinct from
      encode(extensions.digest(lower(root_id::text), 'sha256'), 'hex')
    or cloned_row.recurrence_period is distinct from '2199-01-01'
    or cloned_row.status is distinct from 'open'
    or cloned_row.completed_at is not null
  then
    raise exception 'Generated checklist lineage or clean state is invalid.';
  end if;

  begin
    update public.yacht_checklists
    set due_date = '2199-01-02'::date
    where id = cloned_id;
  exception
    when check_violation then
      period_mutation_rejected := true;
  end;
  if not period_mutation_rejected then
    raise exception 'A generated daily period drifted away from its due date.';
  end if;

  if cloned_row.items -> 'tasks' is distinct from
      '["Inspect bilge pump and alarm","Secure hatch"]'::jsonb
    or cloned_row.items ?| array[
      'after_photo_url',
      'before_photo_url',
      'completed',
      'completed_at',
      'completed_by',
      'photos'
    ]
  then
    raise exception 'Generated checklist metadata contains stale tasks or evidence: %',
      cloned_row.items;
  end if;

  select
    count(*)::integer,
    count(distinct item.created_at)::integer,
    array_agg(item.task_text order by item.created_at, item.id)
  into cloned_task_count, cloned_created_at_count, cloned_task_order
  from public.yacht_checklist_items as item
  where item.checklist_id = cloned_id;

  if cloned_task_count <> 2
    or cloned_created_at_count <> 2
    or cloned_task_order is distinct from
      array['Inspect bilge pump and alarm', 'Secure hatch']::text[]
    or exists (
      select 1
      from public.yacht_checklist_items as item
      where item.checklist_id = cloned_id
        and (
          item.completed is distinct from false
          or item.completed_at is not null
          or item.completed_by is not null
        )
    )
    or not exists (
      select 1
      from public.yacht_checklist_items as item
      where item.checklist_id = cloned_id
        and item.task_text = 'Inspect bilge pump and alarm'
        and item.note::jsonb = jsonb_build_object(
          'before_photo_url',
          current_setting('bluedeck_smoke.captain_before_path')
        )
    )
    or exists (
      select 1
      from public.yacht_checklist_items as item
      where item.checklist_id = cloned_id
        and coalesce(item.note, '') ilike any (
          array['%after%', '%crew-overwrite%', '%completed%']
        )
    )
  then
    raise exception 'Generated task rows did not clone only sanitized authored instructions.';
  end if;

  update public.yacht_checklists
  set items = jsonb_set(items, '{frequency}', to_jsonb('Weekly'::text), true)
  where id = root_id;

  weekly_result := public.bluedeck_create_recurring_checklist(
    root_id,
    to_char('2199-01-07'::date, 'IYYY-"W"IW'),
    '2199-01-07'::date
  );
  if coalesce((weekly_result ->> 'created')::boolean, false) is distinct from true
    or not exists (
      select 1
      from public.yacht_checklists as checklist
      where checklist.id = (weekly_result ->> 'checklist_id')::uuid
        and checklist.recurring_from = root_id
        and checklist.recurrence_period =
          to_char('2199-01-07'::date, 'IYYY-"W"IW')
        and checklist.due_date = '2199-01-07'::date
    )
  then
    raise exception 'A valid weekly recurrence period was not created: %',
      weekly_result;
  end if;

  update public.yacht_checklists
  set items = jsonb_set(items, '{frequency}', to_jsonb('Monthly'::text), true)
  where id = root_id;

  monthly_result := public.bluedeck_create_recurring_checklist(
    root_id,
    to_char('2199-02-14'::date, 'YYYY-MM'),
    '2199-02-14'::date
  );
  if coalesce((monthly_result ->> 'created')::boolean, false) is distinct from true
    or not exists (
      select 1
      from public.yacht_checklists as checklist
      where checklist.id = (monthly_result ->> 'checklist_id')::uuid
        and checklist.recurring_from = root_id
        and checklist.recurrence_period = to_char('2199-02-14'::date, 'YYYY-MM')
        and checklist.due_date = '2199-02-14'::date
    )
  then
    raise exception 'A valid monthly recurrence period was not created: %',
      monthly_result;
  end if;
end;
$creation_assertions$;

rollback;
