-- Transactional adversarial smoke test for checklist completion integrity and
-- task-photo evidence authorization. All actors and rows are isolated and the
-- transaction is rolled back at the end.

begin;

set local timezone = 'UTC';

do $structure$
declare
  trigger_count integer;
begin
  select count(*)::integer
  into trigger_count
  from pg_catalog.pg_trigger as trigger
  where trigger.tgrelid in (
      'public.yacht_checklists'::regclass,
      'public.yacht_checklist_items'::regclass
    )
    and trigger.tgname in (
      'bluedeck_guard_checklist_insert_integrity',
      'bluedeck_guard_checklist_quota',
      'bluedeck_guard_checklist_update',
      'bluedeck_guard_checklist_delete_integrity',
      'bluedeck_guard_checklist_item_insert_integrity',
      'bluedeck_guard_checklist_item_quota',
      'bluedeck_guard_checklist_item_update',
      'bluedeck_guard_checklist_item_delete_integrity',
      'bluedeck_bind_staged_task_photos'
    )
    and not trigger.tgisinternal;

  if trigger_count <> 9 then
    raise exception 'Checklist integrity trigger set is incomplete: %',
      trigger_count;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = 'storage.objects'::regclass
      and trigger.tgname = 'bluedeck_guard_task_photo_object_update'
      and not trigger.tgisinternal
  ) then
    raise exception 'Task-photo identity guard trigger is missing.';
  end if;

  if has_function_privilege(
      'anon',
      'private.bluedeck_can_insert_checklist_item(uuid)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'private.bluedeck_can_read_task_photo(text)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'private.bluedeck_can_write_task_photo(text)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'private.bluedeck_can_read_checklist(uuid)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'private.bluedeck_can_insert_checklist_item(uuid)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'private.bluedeck_can_read_task_photo(text)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'private.bluedeck_can_write_task_photo(text)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'private.bluedeck_can_read_checklist(uuid)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'private.bluedeck_guard_checklist_insert_integrity()',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'private.bluedeck_guard_checklist_quota()',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'private.bluedeck_guard_checklist_item_quota()',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'private.bluedeck_task_photo_reference_path(text)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'private.bluedeck_task_photo_item_paths(text,text,text)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'private.bluedeck_task_photo_sources_are_authorized(uuid,uuid,text,text,text,boolean)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'private.bluedeck_guard_checklist_update()',
      'execute'
    )
  then
    raise exception 'Checklist integrity helper privileges are unsafe.';
  end if;

  if not coalesce((
      select class.relrowsecurity
      from pg_catalog.pg_class as class
      where class.oid =
        'private.bluedeck_task_photo_bindings'::regclass
    ), false)
    or has_table_privilege(
      'authenticated',
      'private.bluedeck_task_photo_bindings',
      'select'
    )
    or not has_table_privilege(
      'service_role',
      'private.bluedeck_task_photo_bindings',
      'select'
    )
    or not has_table_privilege(
      'service_role',
      'private.bluedeck_task_photo_bindings',
      'insert'
    )
    or not has_table_privilege(
      'service_role',
      'private.bluedeck_task_photo_bindings',
      'delete'
    )
  then
    raise exception 'Private task-photo binding ledger permissions are unsafe.';
  end if;

  if not coalesce((
      select class.relrowsecurity
      from pg_catalog.pg_class as class
      where class.oid =
        'private.bluedeck_checklist_item_tombstones'::regclass
    ), false)
    or has_table_privilege(
      'authenticated',
      'private.bluedeck_checklist_item_tombstones',
      'select'
    )
    or not has_table_privilege(
      'service_role',
      'private.bluedeck_checklist_item_tombstones',
      'select'
    )
  then
    raise exception 'Checklist task tombstone permissions are unsafe.';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conrelid in (
        'public.yacht_checklists'::regclass,
        'public.yacht_checklist_items'::regclass
      )
      and constraint_record.conname in (
        'yacht_checklists_bounded_payload_check',
        'yacht_checklist_items_bounded_payload_check'
      )
      and constraint_record.contype = 'c'
      and position(
        'octet_length'
        in pg_catalog.pg_get_constraintdef(constraint_record.oid)
      ) > 0
  ) <> 2 then
    raise exception 'Checklist byte-bound constraints are incomplete.';
  end if;

  if position(
      'checklist_count >= 5000'
      in pg_catalog.pg_get_functiondef(
        'private.bluedeck_guard_checklist_quota()'::regprocedure
      )
    ) = 0
    or position(
      'open_checklist_count >= 250'
      in pg_catalog.pg_get_functiondef(
        'private.bluedeck_guard_checklist_quota()'::regprocedure
      )
    ) = 0
    or position(
      'item_count >= 200'
      in pg_catalog.pg_get_functiondef(
        'private.bluedeck_guard_checklist_item_quota()'::regprocedure
      )
    ) = 0
  then
    raise exception 'Serialized checklist quotas are incomplete.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'yacht_checklists'
      and policyname = 'bluedeck_checklists_select_yacht'
      and cmd = 'SELECT'
      and position('bluedeck_is_own_crew_profile' in coalesce(qual, '')) > 0
  ) or not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'yacht_checklist_items'
      and policyname = 'bluedeck_checklist_items_select_yacht'
      and cmd = 'SELECT'
      and position('bluedeck_can_read_checklist' in coalesce(qual, '')) > 0
  ) then
    raise exception 'Checklist read policies are not assignee-scoped.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Task photo yacht access read'
      and cmd = 'SELECT'
      and 'authenticated' = any(roles)
      and position(
        'bluedeck_can_read_task_photo'
        in coalesce(qual, '')
      ) > 0
      and position('bluedeck_has_yacht_access' in coalesce(qual, '')) = 0
  ) then
    raise exception 'Task-photo read policy is still yacht-wide.';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'Task photo yacht access uploads',
        'Task photo uploader or yacht owner updates',
        'Task photo uploader or yacht owner deletes'
      )
      and 'authenticated' = any(roles)
      and position(
        'bluedeck_can_write_task_photo'
        in coalesce(qual, '') || ' ' || coalesce(with_check, '')
      ) > 0
  ) <> 3 then
    raise exception 'Task-photo mutation policies do not share the archive guard.';
  end if;

  if not coalesce((
      select role.rolbypassrls
      from pg_catalog.pg_roles as role
      where role.rolname = 'service_role'
    ), false)
    or not has_table_privilege(
      'service_role',
      'storage.objects',
      'delete'
    )
  then
    raise exception 'Service-role Storage retention capability was removed.';
  end if;
end;
$structure$;

do $seed$
declare
  owner_user_id uuid := gen_random_uuid();
  crew_user_id uuid := gen_random_uuid();
  bystander_user_id uuid := gen_random_uuid();
  owner_session_id uuid := gen_random_uuid();
  crew_session_id uuid := gen_random_uuid();
  bystander_session_id uuid := gen_random_uuid();
  crew_profile_id uuid := gen_random_uuid();
  bystander_profile_id uuid := gen_random_uuid();
  yacht_id uuid := gen_random_uuid();
  quota_yacht_id uuid := gen_random_uuid();
  open_checklist_id uuid := gen_random_uuid();
  recent_checklist_id uuid := gen_random_uuid();
  archived_checklist_id uuid := gen_random_uuid();
  other_checklist_id uuid := gen_random_uuid();
  open_item_id uuid := gen_random_uuid();
  shared_open_item_id uuid := gen_random_uuid();
  deletable_open_item_id uuid := gen_random_uuid();
  recent_item_id uuid := gen_random_uuid();
  archived_item_id uuid := gen_random_uuid();
  other_item_id uuid := gen_random_uuid();
  open_object_id uuid := gen_random_uuid();
  shared_object_id uuid := gen_random_uuid();
  recent_object_id uuid := gen_random_uuid();
  archived_object_id uuid := gen_random_uuid();
  other_object_id uuid := gen_random_uuid();
  staged_object_id uuid := gen_random_uuid();
  shared_token uuid := gen_random_uuid();
  staged_token uuid := gen_random_uuid();
  open_path text;
  shared_path text;
  recent_path text;
  archived_path text;
  other_path text;
  staged_path text;
begin
  open_path := yacht_id::text || '/' || open_item_id::text
    || '/before-open.jpg';
  shared_path := yacht_id::text || '/manual-checklist/'
    || shared_token::text || '/shared-with-archive.jpg';
  recent_path := yacht_id::text || '/' || recent_item_id::text
    || '/recent-proof.jpg';
  archived_path := yacht_id::text || '/' || archived_item_id::text
    || '/archived-proof.jpg';
  other_path := yacht_id::text || '/' || other_item_id::text
    || '/other-assignee.jpg';
  staged_path := yacht_id::text || '/manual-checklist/'
    || staged_token::text || '/before-staged.jpg';

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
      'checklist-owner-' || owner_user_id || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      '{"role":"owner","full_name":"Checklist Owner"}'::jsonb,
      now(),
      now()
    ),
    (
      crew_user_id,
      'authenticated',
      'authenticated',
      'checklist-crew-' || crew_user_id || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      '{"role":"crew","full_name":"Assigned Crew"}'::jsonb,
      now(),
      now()
    ),
    (
      bystander_user_id,
      'authenticated',
      'authenticated',
      'checklist-bystander-' || bystander_user_id || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      '{"role":"crew","full_name":"Bystander Crew"}'::jsonb,
      now(),
      now()
    );

  insert into private.bluedeck_account_provisioning (
    user_id,
    state,
    failure_code
  ) values
    (owner_user_id, 'ready', ''),
    (crew_user_id, 'ready', ''),
    (bystander_user_id, 'ready', '');

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values
    (owner_session_id, owner_user_id, now(), now()),
    (crew_session_id, crew_user_id, now(), now()),
    (bystander_session_id, bystander_user_id, now(), now());

  insert into public.profiles (id, email, full_name, role)
  values
    (
      owner_user_id,
      'checklist-owner-' || owner_user_id || '@example.invalid',
      'Checklist Owner',
      'owner'
    ),
    (
      crew_user_id,
      'checklist-crew-' || crew_user_id || '@example.invalid',
      'Assigned Crew',
      'crew'
    ),
    (
      bystander_user_id,
      'checklist-bystander-' || bystander_user_id || '@example.invalid',
      'Bystander Crew',
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
  values
    (
      crew_profile_id,
      crew_user_id,
      'SMOKE-CHECK-' || left(crew_profile_id::text, 8),
      'Assigned Crew',
      'checklist-crew-' || crew_user_id || '@example.invalid',
      'Deckhand',
      'active'
    ),
    (
      bystander_profile_id,
      bystander_user_id,
      'SMOKE-CHECK-' || left(bystander_profile_id::text, 8),
      'Bystander Crew',
      'checklist-bystander-' || bystander_user_id || '@example.invalid',
      'Steward',
      'active'
    );

  insert into public.yachts (id, name, model, flag, owner_id)
  values
    (
      yacht_id,
      'Checklist Integrity Smoke Yacht',
      'Test 60',
      'Malta',
      owner_user_id
    ),
    (
      quota_yacht_id,
      'Checklist Quota Smoke Yacht',
      'Test 61',
      'Malta',
      owner_user_id
    );

  insert into public.yacht_crew_memberships (
    yacht_id,
    crew_profile_id,
    position,
    department,
    status
  )
  values
    (yacht_id, crew_profile_id, 'Deckhand', 'Deck', 'active'),
    (yacht_id, bystander_profile_id, 'Steward', 'Interior', 'active');

  insert into public.yacht_checklists (
    id,
    yacht_id,
    title,
    department,
    checklist_type,
    assigned_to,
    items,
    status,
    completed_at
  )
  values
    (
      open_checklist_id,
      yacht_id,
      'Open assigned checklist',
      'Deck',
      'Safety',
      crew_profile_id,
      '{"frequency":"one-time"}'::jsonb,
      'open',
      null
    ),
    (
      recent_checklist_id,
      yacht_id,
      'Recently completed checklist',
      'Deck',
      'Safety',
      crew_profile_id,
      '{"frequency":"one-time"}'::jsonb,
      'completed',
      statement_timestamp() - interval '1 hour'
    ),
    (
      archived_checklist_id,
      yacht_id,
      'Archived completed checklist',
      'Deck',
      'Safety',
      crew_profile_id,
      '{"frequency":"one-time"}'::jsonb,
      'completed',
      statement_timestamp() - interval '25 hours'
    ),
    (
      other_checklist_id,
      yacht_id,
      'Other assignee checklist',
      'Interior',
      'Service',
      bystander_profile_id,
      '{"frequency":"one-time"}'::jsonb,
      'open',
      null
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
      open_item_id,
      open_checklist_id,
      'Open task',
      false,
      null,
      null,
      jsonb_build_object('before_photo_url', open_path)::text
    ),
    (
      shared_open_item_id,
      open_checklist_id,
      'Open task with shared evidence',
      false,
      null,
      null,
      jsonb_build_object('before_photo_url', shared_path)::text
    ),
    (
      deletable_open_item_id,
      open_checklist_id,
      'Manager may delete this open task',
      false,
      null,
      null,
      null
    ),
    (
      recent_item_id,
      recent_checklist_id,
      'Recently completed task',
      true,
      statement_timestamp() - interval '1 hour',
      'checklist-crew-' || crew_user_id || '@example.invalid',
      jsonb_build_object('before_photo_url', recent_path)::text
    ),
    (
      archived_item_id,
      archived_checklist_id,
      'Archived task',
      true,
      statement_timestamp() - interval '25 hours',
      'checklist-crew-' || crew_user_id || '@example.invalid',
      jsonb_build_object(
        'before_photo_url', archived_path,
        'after_photo_url', shared_path
      )::text
    ),
    (
      other_item_id,
      other_checklist_id,
      'Other assignee task',
      false,
      null,
      null,
      jsonb_build_object('before_photo_url', other_path)::text
    );

  insert into storage.objects (
    id,
    bucket_id,
    name,
    owner,
    owner_id,
    metadata
  )
  values
    (open_object_id, 'task-photos', open_path, owner_user_id, owner_user_id::text, '{"size":0}'::jsonb),
    (shared_object_id, 'task-photos', shared_path, owner_user_id, owner_user_id::text, '{"size":0}'::jsonb),
    (recent_object_id, 'task-photos', recent_path, owner_user_id, owner_user_id::text, '{"size":0}'::jsonb),
    (archived_object_id, 'task-photos', archived_path, owner_user_id, owner_user_id::text, '{"size":0}'::jsonb),
    (other_object_id, 'task-photos', other_path, owner_user_id, owner_user_id::text, '{"size":0}'::jsonb),
    (staged_object_id, 'task-photos', staged_path, owner_user_id, owner_user_id::text, '{"size":0}'::jsonb);

  -- These two immutable bindings model one legacy staged object referenced by
  -- both an open task and archived evidence. The archive must win for writes.
  insert into private.bluedeck_task_photo_bindings (
    object_name,
    item_id,
    bound_by
  )
  values
    (shared_path, shared_open_item_id, owner_user_id),
    (shared_path, archived_item_id, owner_user_id);

  if (
    select count(*)
    from private.bluedeck_task_photo_bindings as binding
    where binding.object_name = shared_path
      and binding.item_id in (shared_open_item_id, archived_item_id)
  ) <> 2 then
    raise exception 'Shared task-photo bindings were not seeded.';
  end if;

  perform set_config('bluedeck_checklist.owner_user_id', owner_user_id::text, true);
  perform set_config('bluedeck_checklist.crew_user_id', crew_user_id::text, true);
  perform set_config('bluedeck_checklist.bystander_user_id', bystander_user_id::text, true);
  perform set_config('bluedeck_checklist.owner_session_id', owner_session_id::text, true);
  perform set_config('bluedeck_checklist.crew_session_id', crew_session_id::text, true);
  perform set_config('bluedeck_checklist.bystander_session_id', bystander_session_id::text, true);
  perform set_config('bluedeck_checklist.crew_profile_id', crew_profile_id::text, true);
  perform set_config('bluedeck_checklist.bystander_profile_id', bystander_profile_id::text, true);
  perform set_config('bluedeck_checklist.yacht_id', yacht_id::text, true);
  perform set_config(
    'bluedeck_checklist.quota_yacht_id',
    quota_yacht_id::text,
    true
  );
  perform set_config('bluedeck_checklist.open_id', open_checklist_id::text, true);
  perform set_config('bluedeck_checklist.recent_id', recent_checklist_id::text, true);
  perform set_config('bluedeck_checklist.archived_id', archived_checklist_id::text, true);
  perform set_config('bluedeck_checklist.other_id', other_checklist_id::text, true);
  perform set_config('bluedeck_checklist.open_item_id', open_item_id::text, true);
  perform set_config('bluedeck_checklist.shared_item_id', shared_open_item_id::text, true);
  perform set_config('bluedeck_checklist.deletable_item_id', deletable_open_item_id::text, true);
  perform set_config('bluedeck_checklist.recent_item_id', recent_item_id::text, true);
  perform set_config('bluedeck_checklist.archived_item_id', archived_item_id::text, true);
  perform set_config('bluedeck_checklist.other_item_id', other_item_id::text, true);
  perform set_config('bluedeck_checklist.open_object_id', open_object_id::text, true);
  perform set_config('bluedeck_checklist.shared_object_id', shared_object_id::text, true);
  perform set_config('bluedeck_checklist.recent_object_id', recent_object_id::text, true);
  perform set_config('bluedeck_checklist.archived_object_id', archived_object_id::text, true);
  perform set_config('bluedeck_checklist.other_object_id', other_object_id::text, true);
  perform set_config('bluedeck_checklist.staged_object_id', staged_object_id::text, true);
  perform set_config('bluedeck_checklist.open_path', open_path, true);
  perform set_config('bluedeck_checklist.shared_path', shared_path, true);
  perform set_config('bluedeck_checklist.recent_path', recent_path, true);
  perform set_config('bluedeck_checklist.archived_path', archived_path, true);
  perform set_config('bluedeck_checklist.other_path', other_path, true);
  perform set_config('bluedeck_checklist.staged_path', staged_path, true);
end;
$seed$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_checklist.owner_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_checklist.owner_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_checklist.owner_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);

do $manager$
declare
  normalized_checklist_id uuid := gen_random_uuid();
  normalized_item_id uuid := gen_random_uuid();
  item_quota_checklist_id uuid := gen_random_uuid();
  manager_bound_item_id uuid := gen_random_uuid();
  manager_storage_id uuid := gen_random_uuid();
  manager_stage_id uuid := gen_random_uuid();
  deleted_object_id uuid := gen_random_uuid();
  manager_stage_token uuid := gen_random_uuid();
  affected integer;
  visible_checklists integer;
  visible_items integer;
  visible_objects integer;
  rejected_recent_insert boolean := false;
  rejected_archived_insert boolean := false;
  rejected_recent_rewrite boolean := false;
  rejected_archived_update boolean := false;
  rejected_recent_delete boolean := false;
  rejected_completed_update boolean := false;
  rejected_completed_delete boolean := false;
  rejected_completed_item_insert boolean := false;
  rejected_archived_storage_insert boolean := false;
  rejected_object_rebind boolean := false;
  rejected_staged_rebind boolean := false;
  rejected_deleted_uuid_reuse boolean := false;
  rejected_oversized_title boolean := false;
  rejected_oversized_items boolean := false;
  rejected_oversized_task boolean := false;
  rejected_oversized_note boolean := false;
  rejected_open_quota boolean := false;
  rejected_item_quota boolean := false;
  manager_open_path text;
  manager_archived_path text;
  manager_stage_path text;
  deleted_path text;
  completion_time timestamptz;
  completion_actor text;
begin
  select count(*)::integer
  into visible_checklists
  from public.yacht_checklists
  where id = any(array[
    current_setting('bluedeck_checklist.open_id')::uuid,
    current_setting('bluedeck_checklist.recent_id')::uuid,
    current_setting('bluedeck_checklist.archived_id')::uuid,
    current_setting('bluedeck_checklist.other_id')::uuid
  ]);

  select count(*)::integer
  into visible_items
  from public.yacht_checklist_items
  where id = any(array[
    current_setting('bluedeck_checklist.open_item_id')::uuid,
    current_setting('bluedeck_checklist.shared_item_id')::uuid,
    current_setting('bluedeck_checklist.deletable_item_id')::uuid,
    current_setting('bluedeck_checklist.recent_item_id')::uuid,
    current_setting('bluedeck_checklist.archived_item_id')::uuid,
    current_setting('bluedeck_checklist.other_item_id')::uuid
  ]);

  if visible_checklists <> 4 or visible_items <> 6 then
    raise exception 'Yacht manager checklist read scope is incomplete: %, %',
      visible_checklists,
      visible_items;
  end if;

  begin
    insert into public.yacht_checklists (
      yacht_id,
      title,
      department,
      checklist_type,
      assigned_to,
      items,
      status
    )
    values (
      current_setting('bluedeck_checklist.yacht_id')::uuid,
      repeat('x', 513),
      'Deck',
      'Operations',
      current_setting('bluedeck_checklist.crew_profile_id')::uuid,
      '{}'::jsonb,
      'open'
    );
  exception
    when check_violation then
      rejected_oversized_title := true;
  end;

  begin
    insert into public.yacht_checklists (
      yacht_id,
      title,
      department,
      checklist_type,
      assigned_to,
      items,
      status
    )
    values (
      current_setting('bluedeck_checklist.yacht_id')::uuid,
      'Oversized serialized payload',
      'Deck',
      'Operations',
      current_setting('bluedeck_checklist.crew_profile_id')::uuid,
      jsonb_build_object('blob', repeat('x', 131073)),
      'open'
    );
  exception
    when check_violation then
      rejected_oversized_items := true;
  end;

  begin
    insert into public.yacht_checklist_items (checklist_id, task_text)
    values (
      current_setting('bluedeck_checklist.open_id')::uuid,
      repeat('x', 2001)
    );
  exception
    when check_violation then
      rejected_oversized_task := true;
  end;

  begin
    insert into public.yacht_checklist_items (checklist_id, task_text, note)
    values (
      current_setting('bluedeck_checklist.open_id')::uuid,
      'Oversized note task',
      repeat('x', 16385)
    );
  exception
    when check_violation then
      rejected_oversized_note := true;
  end;

  if not rejected_oversized_title
    or not rejected_oversized_items
    or not rejected_oversized_task
    or not rejected_oversized_note
  then
    raise exception 'Checklist payload byte limits were bypassed.';
  end if;

  insert into public.yacht_checklists (
    id,
    yacht_id,
    title,
    department,
    checklist_type,
    assigned_to,
    items,
    status
  )
  values (
    item_quota_checklist_id,
    current_setting('bluedeck_checklist.yacht_id')::uuid,
    'Item quota boundary',
    'Deck',
    'Operations',
    current_setting('bluedeck_checklist.crew_profile_id')::uuid,
    '{}'::jsonb,
    'open'
  );

  insert into public.yacht_checklist_items (
    id,
    checklist_id,
    task_text
  )
  select
    gen_random_uuid(),
    item_quota_checklist_id,
    'Quota task ' || series.value
  from generate_series(1, 200) as series(value);

  begin
    insert into public.yacht_checklist_items (checklist_id, task_text)
    values (item_quota_checklist_id, 'Quota task 201');
  exception
    when sqlstate '54000' then
      rejected_item_quota := true;
  end;

  insert into public.yacht_checklists (
    id,
    yacht_id,
    title,
    department,
    checklist_type,
    assigned_to,
    items,
    status
  )
  select
    gen_random_uuid(),
    current_setting('bluedeck_checklist.quota_yacht_id')::uuid,
    'Open quota checklist ' || series.value,
    'Deck',
    'Operations',
    current_setting('bluedeck_checklist.crew_profile_id')::uuid,
    '{}'::jsonb,
    'open'
  from generate_series(1, 250) as series(value);

  begin
    insert into public.yacht_checklists (
      yacht_id,
      title,
      department,
      checklist_type,
      assigned_to,
      items,
      status
    )
    values (
      current_setting('bluedeck_checklist.quota_yacht_id')::uuid,
      'Open quota checklist 251',
      'Deck',
      'Operations',
      current_setting('bluedeck_checklist.crew_profile_id')::uuid,
      '{}'::jsonb,
      'open'
    );
  exception
    when sqlstate '54000' then
      rejected_open_quota := true;
  end;

  if not rejected_item_quota or not rejected_open_quota then
    raise exception 'Serialized checklist quotas were bypassed.';
  end if;

  insert into public.yacht_checklists (
    id,
    yacht_id,
    title,
    department,
    checklist_type,
    assigned_to,
    items,
    status,
    completed_at
  )
  values (
    normalized_checklist_id,
    current_setting('bluedeck_checklist.yacht_id')::uuid,
    'Manager forged completed insert',
    'Deck',
    'Operations',
    current_setting('bluedeck_checklist.crew_profile_id')::uuid,
    '{"frequency":"one-time"}'::jsonb,
    'completed',
    '2199-01-01 00:00:00+00'::timestamptz
  );

  if not exists (
    select 1
    from public.yacht_checklists
    where id = normalized_checklist_id
      and status = 'open'
      and completed_at is null
  ) then
    raise exception 'Manager forged checklist completion on INSERT.';
  end if;

  insert into public.yacht_checklist_items (
    id,
    checklist_id,
    task_text,
    completed,
    completed_at,
    completed_by
  )
  values (
    normalized_item_id,
    normalized_checklist_id,
    'Forged completed task insert',
    true,
    '2199-01-01 00:00:00+00'::timestamptz,
    'forged@example.invalid'
  );

  if not exists (
    select 1
    from public.yacht_checklist_items
    where id = normalized_item_id
      and completed is false
      and completed_at is null
      and completed_by is null
  ) then
    raise exception 'Manager forged task completion on INSERT.';
  end if;

  begin
    insert into public.yacht_checklist_items (checklist_id, task_text)
    values (
      current_setting('bluedeck_checklist.recent_id')::uuid,
      'Injected into completed checklist'
    );
  exception
    when insufficient_privilege then
      rejected_recent_insert := true;
  end;

  begin
    insert into public.yacht_checklist_items (checklist_id, task_text)
    values (
      current_setting('bluedeck_checklist.archived_id')::uuid,
      'Injected into archive'
    );
  exception
    when insufficient_privilege then
      rejected_archived_insert := true;
  end;

  update public.yacht_checklist_items
  set completed = true,
      completed_at = '2199-01-01 00:00:00+00'::timestamptz,
      completed_by = 'forged@example.invalid'
  where id = normalized_item_id;

  select completed_at, completed_by
  into completion_time, completion_actor
  from public.yacht_checklist_items
  where id = normalized_item_id;

  if completion_time is distinct from statement_timestamp()
    or completion_actor is distinct from
      current_setting('bluedeck_checklist.owner_user_id')
  then
    raise exception 'Manager controlled task completion audit fields: %, %',
      completion_time,
      completion_actor;
  end if;

  update public.yacht_checklists
  set status = 'completed',
      completed_at = '2199-01-01 00:00:00+00'::timestamptz
  where id = normalized_checklist_id;

  if not exists (
    select 1
    from public.yacht_checklists
    where id = normalized_checklist_id
      and status = 'completed'
      and completed_at = statement_timestamp()
  ) then
    raise exception 'Checklist completion timestamp was not server-authored.';
  end if;

  begin
    update public.yacht_checklists
    set title = 'Rewritten completed checklist'
    where id = normalized_checklist_id;
  exception
    when insufficient_privilege then
      rejected_completed_update := true;
  end;

  begin
    delete from public.yacht_checklists
    where id = normalized_checklist_id;
  exception
    when insufficient_privilege then
      rejected_completed_delete := true;
  end;

  begin
    insert into public.yacht_checklist_items (checklist_id, task_text)
    values (normalized_checklist_id, 'Late task injection');
  exception
    when insufficient_privilege then
      rejected_completed_item_insert := true;
  end;

  update public.yacht_checklist_items
  set note = jsonb_build_object(
    'before_photo_url', current_setting('bluedeck_checklist.recent_path'),
    'caption', 'Authorized 24-hour proof correction'
  )::text
  where id = current_setting('bluedeck_checklist.recent_item_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Manager could not correct recent proof.';
  end if;

  begin
    update public.yacht_checklist_items
    set task_text = 'Rewritten completed task'
    where id = current_setting('bluedeck_checklist.recent_item_id')::uuid;
  exception
    when insufficient_privilege then
      rejected_recent_rewrite := true;
  end;

  begin
    update public.yacht_checklist_items
    set note = '{"after_photo_url":"forged.jpg"}'
    where id = current_setting('bluedeck_checklist.archived_item_id')::uuid;
  exception
    when insufficient_privilege then
      rejected_archived_update := true;
  end;

  begin
    delete from public.yacht_checklist_items
    where id = current_setting('bluedeck_checklist.recent_item_id')::uuid;
  exception
    when insufficient_privilege then
      rejected_recent_delete := true;
  end;

  deleted_path := current_setting('bluedeck_checklist.yacht_id')
    || '/' || current_setting('bluedeck_checklist.deletable_item_id')
    || '/deleted-task-proof.jpg';
  insert into storage.objects (
    id,
    bucket_id,
    name,
    owner,
    owner_id,
    metadata
  )
  values (
    deleted_object_id,
    'task-photos',
    deleted_path,
    current_setting('bluedeck_checklist.owner_user_id')::uuid,
    current_setting('bluedeck_checklist.owner_user_id'),
    '{"size":0}'::jsonb
  );

  delete from public.yacht_checklist_items
  where id = current_setting('bluedeck_checklist.deletable_item_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Manager open-task deletion workflow was broken.';
  end if;

  begin
    insert into public.yacht_checklist_items (
      id,
      checklist_id,
      task_text
    )
    values (
      current_setting('bluedeck_checklist.deletable_item_id')::uuid,
      current_setting('bluedeck_checklist.open_id')::uuid,
      'Forbidden deleted UUID reuse'
    );
  exception
    when unique_violation then
      rejected_deleted_uuid_reuse := true;
  end;

  if not rejected_deleted_uuid_reuse
    or private.bluedeck_can_read_task_photo(deleted_path)
  then
    raise exception 'Deleted task evidence was resurrected through UUID reuse.';
  end if;

  perform set_config(
    'bluedeck_checklist.deleted_item_id',
    current_setting('bluedeck_checklist.deletable_item_id'),
    true
  );
  perform set_config(
    'bluedeck_checklist.deleted_path',
    deleted_path,
    true
  );

  if not rejected_recent_insert
    or not rejected_archived_insert
    or not rejected_recent_rewrite
    or not rejected_archived_update
    or not rejected_recent_delete
    or not rejected_completed_update
    or not rejected_completed_delete
    or not rejected_completed_item_insert
  then
    raise exception 'A manager bypassed checklist completion integrity.';
  end if;

  select count(*)::integer
  into visible_objects
  from storage.objects
  where id = any(array[
    current_setting('bluedeck_checklist.open_object_id')::uuid,
    current_setting('bluedeck_checklist.shared_object_id')::uuid,
    current_setting('bluedeck_checklist.recent_object_id')::uuid,
    current_setting('bluedeck_checklist.archived_object_id')::uuid,
    current_setting('bluedeck_checklist.other_object_id')::uuid,
    current_setting('bluedeck_checklist.staged_object_id')::uuid
  ]);
  if visible_objects <> 6 then
    raise exception 'Yacht manager lost authorized task-photo reads: %',
      visible_objects;
  end if;

  if private.bluedeck_can_write_task_photo(
      current_setting('bluedeck_checklist.archived_path')
    )
    or private.bluedeck_can_write_task_photo(
      current_setting('bluedeck_checklist.shared_path')
    )
    or not private.bluedeck_can_write_task_photo(
      current_setting('bluedeck_checklist.open_path')
    )
    or not private.bluedeck_can_write_task_photo(
      current_setting('bluedeck_checklist.recent_path')
    )
    or not private.bluedeck_can_write_task_photo(
      current_setting('bluedeck_checklist.staged_path')
    )
  then
    raise exception 'Manager task-photo helper crossed an archive boundary.';
  end if;

  update storage.objects
  set metadata = metadata || '{"manager_open_update":true}'::jsonb
  where id = current_setting('bluedeck_checklist.open_object_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Manager could not update open task evidence.';
  end if;

  begin
    update storage.objects
    set name = current_setting('bluedeck_checklist.open_path') || '.renamed'
    where id = current_setting('bluedeck_checklist.open_object_id')::uuid;
  exception
    when insufficient_privilege then
      rejected_object_rebind := true;
  end;

  if not rejected_object_rebind then
    raise exception 'Manager rebound an existing task-photo object.';
  end if;

  update storage.objects
  set metadata = metadata || '{"forged_archive_update":true}'::jsonb
  where id in (
    current_setting('bluedeck_checklist.archived_object_id')::uuid,
    current_setting('bluedeck_checklist.shared_object_id')::uuid
  );
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Manager overwrote archived/shared evidence.';
  end if;

  manager_open_path := current_setting('bluedeck_checklist.yacht_id')
    || '/' || current_setting('bluedeck_checklist.open_item_id')
    || '/manager-new-' || manager_storage_id || '.jpg';
  insert into storage.objects (
    id, bucket_id, name, owner, owner_id, metadata
  )
  values (
    manager_storage_id,
    'task-photos',
    manager_open_path,
    current_setting('bluedeck_checklist.owner_user_id')::uuid,
    current_setting('bluedeck_checklist.owner_user_id'),
    '{"size":0}'::jsonb
  );

  manager_archived_path := current_setting('bluedeck_checklist.yacht_id')
    || '/' || current_setting('bluedeck_checklist.archived_item_id')
    || '/manager-forged-' || manager_storage_id || '.jpg';
  begin
    insert into storage.objects (
      id, bucket_id, name, owner, owner_id, metadata
    )
    values (
      gen_random_uuid(),
      'task-photos',
      manager_archived_path,
      current_setting('bluedeck_checklist.owner_user_id')::uuid,
      current_setting('bluedeck_checklist.owner_user_id'),
      '{"size":0}'::jsonb
    );
  exception
    when insufficient_privilege then
      rejected_archived_storage_insert := true;
  end;

  manager_stage_path := current_setting('bluedeck_checklist.yacht_id')
    || '/manual-checklist/' || manager_stage_token
    || '/before-manager-staged.jpg';
  insert into storage.objects (
    id, bucket_id, name, owner, owner_id, metadata
  )
  values (
    manager_stage_id,
    'task-photos',
    manager_stage_path,
    current_setting('bluedeck_checklist.owner_user_id')::uuid,
    current_setting('bluedeck_checklist.owner_user_id'),
    '{"size":0}'::jsonb
  );

  insert into public.yacht_checklist_items (
    id,
    checklist_id,
    task_text,
    note
  )
  values (
    manager_bound_item_id,
    current_setting('bluedeck_checklist.open_id')::uuid,
    'Manager staged evidence binding',
    jsonb_build_object('before_photo_url', manager_stage_path)::text
  );

  begin
    insert into public.yacht_checklist_items (
      id,
      checklist_id,
      task_text,
      note
    )
    values (
      gen_random_uuid(),
      current_setting('bluedeck_checklist.open_id')::uuid,
      'Forbidden staged evidence rebinding',
      jsonb_build_object('before_photo_url', manager_stage_path)::text
    );
  exception
    when insufficient_privilege then
      rejected_staged_rebind := true;
  end;

  if not rejected_staged_rebind then
    raise exception 'Manager rebound one staged object to multiple tasks.';
  end if;

  perform set_config(
    'bluedeck_checklist.manager_bound_object_id',
    manager_stage_id::text,
    true
  );
  perform set_config(
    'bluedeck_checklist.manager_bound_path',
    manager_stage_path,
    true
  );

  if not rejected_archived_storage_insert then
    raise exception 'Manager inserted new evidence into an archived task.';
  end if;

  perform set_config('storage.allow_delete_query', 'true', true);

  delete from storage.objects where id = manager_storage_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Manager could not clean up mutable open evidence.';
  end if;

  delete from storage.objects
  where id = current_setting('bluedeck_checklist.archived_object_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Manager deleted archived task evidence.';
  end if;
end;
$manager$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_checklist.crew_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_checklist.crew_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_checklist.crew_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);

do $assigned_crew$
declare
  safe_item_id uuid := gen_random_uuid();
  crew_object_id uuid := gen_random_uuid();
  affected integer;
  visible_checklists integer;
  visible_items integer;
  visible_objects integer;
  rejected_other_insert boolean := false;
  rejected_archived_insert boolean := false;
  rejected_archived_storage_insert boolean := false;
  crew_open_path text;
  crew_archived_path text;
  completion_time timestamptz;
  completion_actor text;
  safe_path text;
  candidate_note text;
  rejected_reference_count integer := 0;
  top_level_swap_rejected boolean := false;
  top_level_oversize_rejected boolean := false;
begin
  select count(*)::integer
  into visible_checklists
  from public.yacht_checklists
  where id = any(array[
    current_setting('bluedeck_checklist.open_id')::uuid,
    current_setting('bluedeck_checklist.recent_id')::uuid,
    current_setting('bluedeck_checklist.archived_id')::uuid,
    current_setting('bluedeck_checklist.other_id')::uuid
  ]);

  select count(*)::integer
  into visible_items
  from public.yacht_checklist_items
  where id = any(array[
    current_setting('bluedeck_checklist.open_item_id')::uuid,
    current_setting('bluedeck_checklist.shared_item_id')::uuid,
    current_setting('bluedeck_checklist.deletable_item_id')::uuid,
    current_setting('bluedeck_checklist.recent_item_id')::uuid,
    current_setting('bluedeck_checklist.archived_item_id')::uuid,
    current_setting('bluedeck_checklist.other_item_id')::uuid
  ]);

  if visible_checklists <> 3 or visible_items <> 4 then
    raise exception 'Assigned crew checklist read scope is incorrect: %, %',
      visible_checklists,
      visible_items;
  end if;

  insert into public.yacht_checklist_items (
    id,
    checklist_id,
    task_text,
    completed,
    completed_at,
    completed_by
  )
  values (
    safe_item_id,
    current_setting('bluedeck_checklist.open_id')::uuid,
    'Assigned crew safe insert',
    true,
    '2199-01-01 00:00:00+00'::timestamptz,
    'forged@example.invalid'
  );

  if not exists (
    select 1
    from public.yacht_checklist_items
    where id = safe_item_id
      and completed is false
      and completed_at is null
      and completed_by is null
  ) then
    raise exception 'Assigned crew forged completion fields on INSERT.';
  end if;

  update public.yacht_checklist_items
  set completed = true,
      completed_at = '2199-01-01 00:00:00+00'::timestamptz,
      completed_by = 'forged@example.invalid'
  where id = safe_item_id;

  select completed_at, completed_by
  into completion_time, completion_actor
  from public.yacht_checklist_items
  where id = safe_item_id;

  if completion_time is distinct from statement_timestamp()
    or completion_actor is distinct from
      current_setting('bluedeck_checklist.crew_user_id')
  then
    raise exception 'Assigned crew controlled completion audit fields: %, %',
      completion_time,
      completion_actor;
  end if;

  safe_path := current_setting('bluedeck_checklist.yacht_id')
    || '/' || safe_item_id || '/safe-proof.jpg';

  -- Every supported note source must normalize exactly like the client and
  -- then remain bound to this item. These references all point elsewhere.
  foreach candidate_note in array array[
    jsonb_build_object(
      'before_photo_url',
      current_setting('bluedeck_checklist.open_path')
    )::text,
    jsonb_build_object(
      'after_photo_url',
      '/' || current_setting('bluedeck_checklist.open_path')
    )::text,
    jsonb_build_object(
      'photos',
      jsonb_build_object(
        'before',
        current_setting('bluedeck_checklist.open_path') || '?download=1#proof'
      )
    )::text,
    jsonb_build_object(
      'photos',
      jsonb_build_object(
        'after',
        'https://project.supabase.co/storage/v1/object/sign/task-photos/'
          || current_setting('bluedeck_checklist.open_path') || '?token=test'
      )
    )::text,
    jsonb_build_object(
      'before_photo_url',
      'https://project.supabase.co/storage/v1/object/authenticated/task-photos/'
        || current_setting('bluedeck_checklist.archived_path')
    )::text,
    jsonb_build_object('after_photo_url', 'forged.jpg')::text,
    jsonb_build_object(
      'before_photo_url',
      safe_path || repeat('x', 4097)
    )::text
  ]
  loop
    begin
      update public.yacht_checklist_items
      set note = candidate_note
      where id = safe_item_id;
    exception
      when insufficient_privilege then
        rejected_reference_count := rejected_reference_count + 1;
    end;
  end loop;

  if rejected_reference_count <> 7 then
    raise exception 'A cross-item or oversized note reference was accepted: %',
      rejected_reference_count;
  end if;

  -- The same raw, leading-slash, query/fragment, signed and authenticated
  -- shapes remain usable when their normalized path belongs to this item.
  foreach candidate_note in array array[
    jsonb_build_object('before_photo_url', '/' || safe_path)::text,
    jsonb_build_object(
      'after_photo_url',
      safe_path || '?download=1#proof'
    )::text,
    jsonb_build_object(
      'photos',
      jsonb_build_object(
        'before',
        'https://project.supabase.co/storage/v1/object/sign/task-photos/'
          || safe_path || '?token=test'
      )
    )::text,
    jsonb_build_object(
      'photos',
      jsonb_build_object(
        'after',
        'https://project.supabase.co/storage/v1/object/authenticated/task-photos/'
          || safe_path
      )
    )::text
  ]
  loop
    update public.yacht_checklist_items
    set note = candidate_note
    where id = safe_item_id;
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'A canonical proof reference shape was rejected.';
    end if;
  end loop;

  update public.yacht_checklist_items
  set note = null
  where id = safe_item_id;

  -- Exercise legacy schemas that still expose top-level proof columns. The
  -- dynamic form keeps this smoke portable to the current note-only schema.
  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.yacht_checklist_items'::regclass
      and attribute.attname = 'before_photo_url'
      and attribute.attnum > 0
      and not attribute.attisdropped
  ) then
    begin
      execute
        'update public.yacht_checklist_items set before_photo_url = $1 where id = $2'
      using current_setting('bluedeck_checklist.open_path'), safe_item_id;
    exception
      when insufficient_privilege or check_violation then
        top_level_swap_rejected := true;
    end;

    begin
      execute
        'update public.yacht_checklist_items set before_photo_url = $1 where id = $2'
      using safe_path || repeat('x', 4097), safe_item_id;
    exception
      when insufficient_privilege or check_violation then
        top_level_oversize_rejected := true;
    end;

    if not top_level_swap_rejected or not top_level_oversize_rejected then
      raise exception 'A legacy top-level proof field bypassed item binding.';
    end if;

    execute
      'update public.yacht_checklist_items set before_photo_url = $1 where id = $2'
    using safe_path || '?download=1#proof', safe_item_id;
    execute
      'update public.yacht_checklist_items set before_photo_url = null where id = $1'
    using safe_item_id;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.yacht_checklist_items'::regclass
      and attribute.attname = 'after_photo_url'
      and attribute.attnum > 0
      and not attribute.attisdropped
  ) then
    execute
      'update public.yacht_checklist_items set after_photo_url = $1 where id = $2'
    using
      'https://project.supabase.co/storage/v1/object/authenticated/task-photos/'
        || safe_path,
      safe_item_id;
    execute
      'update public.yacht_checklist_items set after_photo_url = null where id = $1'
    using safe_item_id;
  end if;

  begin
    insert into public.yacht_checklist_items (checklist_id, task_text)
    values (
      current_setting('bluedeck_checklist.other_id')::uuid,
      'Cross-assignee injected task'
    );
  exception
    when insufficient_privilege then
      rejected_other_insert := true;
  end;

  begin
    insert into public.yacht_checklist_items (checklist_id, task_text)
    values (
      current_setting('bluedeck_checklist.archived_id')::uuid,
      'Archive injected task'
    );
  exception
    when insufficient_privilege then
      rejected_archived_insert := true;
  end;

  if not rejected_other_insert or not rejected_archived_insert then
    raise exception 'Assigned crew inserted into a forbidden checklist.';
  end if;

  select count(*)::integer
  into visible_objects
  from storage.objects
  where id = any(array[
    current_setting('bluedeck_checklist.open_object_id')::uuid,
    current_setting('bluedeck_checklist.shared_object_id')::uuid,
    current_setting('bluedeck_checklist.recent_object_id')::uuid,
    current_setting('bluedeck_checklist.archived_object_id')::uuid,
    current_setting('bluedeck_checklist.other_object_id')::uuid,
    current_setting('bluedeck_checklist.staged_object_id')::uuid
  ]);
  if visible_objects <> 4 then
    raise exception 'Assigned crew task-photo scope is incorrect: %',
      visible_objects;
  end if;

  if not exists (
      select 1
      from storage.objects
      where id = current_setting(
        'bluedeck_checklist.manager_bound_object_id'
      )::uuid
    )
    or not private.bluedeck_can_read_task_photo(
      current_setting('bluedeck_checklist.manager_bound_path')
    )
  then
    raise exception 'Assigned crew could not read bound staged evidence.';
  end if;

  if private.bluedeck_can_read_task_photo(
      current_setting('bluedeck_checklist.other_path')
    )
    or private.bluedeck_can_read_task_photo(
      current_setting('bluedeck_checklist.staged_path')
    )
    or not private.bluedeck_can_read_task_photo(
      current_setting('bluedeck_checklist.archived_path')
    )
  then
    raise exception 'Assigned crew task-photo read helper leaked another scope.';
  end if;

  update storage.objects
  set metadata = metadata || '{"crew_overwrite":true}'::jsonb
  where id = current_setting('bluedeck_checklist.open_object_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Assigned crew overwrote manager-owned before evidence.';
  end if;

  crew_open_path := current_setting('bluedeck_checklist.yacht_id')
    || '/' || current_setting('bluedeck_checklist.open_item_id')
    || '/crew-new-' || crew_object_id || '.jpg';
  insert into storage.objects (
    id, bucket_id, name, owner, owner_id, metadata
  )
  values (
    crew_object_id,
    'task-photos',
    crew_open_path,
    current_setting('bluedeck_checklist.crew_user_id')::uuid,
    current_setting('bluedeck_checklist.crew_user_id'),
    '{"size":0}'::jsonb
  );

  update storage.objects
  set metadata = metadata || '{"crew_update":true}'::jsonb
  where id = crew_object_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Assigned crew could not update self-owned open evidence.';
  end if;

  crew_archived_path := current_setting('bluedeck_checklist.yacht_id')
    || '/' || current_setting('bluedeck_checklist.archived_item_id')
    || '/crew-forged-' || crew_object_id || '.jpg';
  begin
    insert into storage.objects (
      id, bucket_id, name, owner, owner_id, metadata
    )
    values (
      gen_random_uuid(),
      'task-photos',
      crew_archived_path,
      current_setting('bluedeck_checklist.crew_user_id')::uuid,
      current_setting('bluedeck_checklist.crew_user_id'),
      '{"size":0}'::jsonb
    );
  exception
    when insufficient_privilege then
      rejected_archived_storage_insert := true;
  end;

  if not rejected_archived_storage_insert then
    raise exception 'Assigned crew inserted archived task evidence.';
  end if;

  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where id = crew_object_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Assigned crew could not clean up self-owned open evidence.';
  end if;
end;
$assigned_crew$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_checklist.bystander_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_checklist.bystander_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_checklist.bystander_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);

do $bystander$
declare
  visible_checklists integer;
  visible_items integer;
  visible_objects integer;
  rejected_cross_assignee_insert boolean := false;
  rejected_cross_assignee_rebinding boolean := false;
begin
  select count(*)::integer
  into visible_checklists
  from public.yacht_checklists
  where id = any(array[
    current_setting('bluedeck_checklist.open_id')::uuid,
    current_setting('bluedeck_checklist.recent_id')::uuid,
    current_setting('bluedeck_checklist.archived_id')::uuid,
    current_setting('bluedeck_checklist.other_id')::uuid
  ]);

  select count(*)::integer
  into visible_items
  from public.yacht_checklist_items
  where id = any(array[
    current_setting('bluedeck_checklist.open_item_id')::uuid,
    current_setting('bluedeck_checklist.shared_item_id')::uuid,
    current_setting('bluedeck_checklist.deletable_item_id')::uuid,
    current_setting('bluedeck_checklist.recent_item_id')::uuid,
    current_setting('bluedeck_checklist.archived_item_id')::uuid,
    current_setting('bluedeck_checklist.other_item_id')::uuid
  ]);

  if visible_checklists <> 1 or visible_items <> 1 then
    raise exception 'Bystander checklist read scope is incorrect: %, %',
      visible_checklists,
      visible_items;
  end if;

  select count(*)::integer
  into visible_objects
  from storage.objects
  where id = any(array[
    current_setting('bluedeck_checklist.open_object_id')::uuid,
    current_setting('bluedeck_checklist.shared_object_id')::uuid,
    current_setting('bluedeck_checklist.recent_object_id')::uuid,
    current_setting('bluedeck_checklist.archived_object_id')::uuid,
    current_setting('bluedeck_checklist.other_object_id')::uuid,
    current_setting('bluedeck_checklist.staged_object_id')::uuid
  ]);

  if visible_objects <> 1
    or private.bluedeck_can_read_task_photo(
      current_setting('bluedeck_checklist.open_path')
    )
    or private.bluedeck_can_read_task_photo(
      current_setting('bluedeck_checklist.manager_bound_path')
    )
    or not private.bluedeck_can_read_task_photo(
      current_setting('bluedeck_checklist.other_path')
    )
  then
    raise exception 'An unrelated yacht member read assigned task evidence: %',
      visible_objects;
  end if;

  begin
    insert into public.yacht_checklist_items (checklist_id, task_text)
    values (
      current_setting('bluedeck_checklist.open_id')::uuid,
      'Bystander cross-assignee task'
    );
  exception
    when insufficient_privilege then
      rejected_cross_assignee_insert := true;
  end;

  begin
    update public.yacht_checklist_items
    set note = jsonb_build_object(
      'before_photo_url',
      current_setting('bluedeck_checklist.open_path')
    )::text
    where id = current_setting('bluedeck_checklist.other_item_id')::uuid;
  exception
    when insufficient_privilege then
      rejected_cross_assignee_rebinding := true;
  end;

  if not rejected_cross_assignee_insert
    or not rejected_cross_assignee_rebinding
    or private.bluedeck_can_read_task_photo(
      current_setting('bluedeck_checklist.open_path')
    )
  then
    raise exception 'Bystander crossed checklist or evidence ownership.';
  end if;
end;
$bystander$;

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $service_retention$
declare
  affected integer;
begin
  if not exists (
      select 1
      from private.bluedeck_checklist_item_tombstones as tombstone
      where tombstone.item_id = current_setting(
        'bluedeck_checklist.deleted_item_id'
      )::uuid
        and tombstone.source = 'item-delete'
    )
  then
    raise exception 'Deleted checklist task UUID was not tombstoned.';
  end if;

  if (
    select count(*)
    from private.bluedeck_task_photo_bindings as binding
    where binding.object_name = current_setting(
      'bluedeck_checklist.manager_bound_path'
    )
  ) <> 1 then
    raise exception 'Browser staged evidence binding is not one-to-one.';
  end if;

  update storage.objects
  set metadata = metadata || '{"retention_worker":true}'::jsonb
  where id = current_setting('bluedeck_checklist.archived_object_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Service role could not reach archived Storage evidence.';
  end if;

  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects
  where id = current_setting('bluedeck_checklist.archived_object_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Service-role retention could not purge archived Storage evidence.';
  end if;

  delete from public.yacht_checklists
  where id = current_setting('bluedeck_checklist.archived_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Service-role retention could not purge archived checklist rows.';
  end if;
end;
$service_retention$;

reset role;

rollback;
