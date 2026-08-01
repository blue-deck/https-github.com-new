begin;

do $test$
declare
  queue_record record;
  worker_id uuid := gen_random_uuid();
  object_id uuid := gen_random_uuid();
  exhausted_object_id uuid := gen_random_uuid();
  exhausted_queue_id bigint;
  account_id uuid := gen_random_uuid();
  cleaned_account_id uuid;
  wrong_lease_finished boolean;
  correct_lease_finished boolean;
begin
  insert into private.bluedeck_storage_deletion_queue (
    storage_object_id,
    bucket_id,
    object_name,
    reason
  ) values (
    object_id,
    'task-photos',
    gen_random_uuid()::text || '/' || gen_random_uuid()::text || '/proof.jpg',
    'legacy_task_orphan'
  );

  select *
  into queue_record
  from public.bluedeck_claim_storage_deletions(worker_id, 1);

  if queue_record.queue_id is null
    or queue_record.lease_token is null
    or queue_record.bucket_id <> 'task-photos'
  then
    raise exception 'A queued Storage deletion could not be leased.';
  end if;

  if public.bluedeck_storage_deletion_lease_state(
    queue_record.queue_id,
    queue_record.lease_token
  ) <> 'gone' or public.bluedeck_storage_deletion_lease_state(
    queue_record.queue_id,
    gen_random_uuid()
  ) <> 'invalid' then
    raise exception 'Storage deletion lease state is not capability-bound.';
  end if;

  if public.bluedeck_queue_canonical_task_photo_repair(
    gen_random_uuid(),
    'invalid/source.jpg',
    'invalid/target.jpg'
  ) then
    raise exception 'An unbound canonical-path repair was queued.';
  end if;

  wrong_lease_finished := public.bluedeck_finish_storage_deletion(
    queue_record.queue_id,
    gen_random_uuid(),
    true,
    ''
  );
  correct_lease_finished := public.bluedeck_finish_storage_deletion(
    queue_record.queue_id,
    queue_record.lease_token,
    true,
    ''
  );
  if wrong_lease_finished
    or not correct_lease_finished
    or exists (
    select 1
    from private.bluedeck_storage_deletion_queue
    where id = queue_record.queue_id
  ) then
    raise exception 'Storage deletion lease finalization was replayable or incomplete.';
  end if;

  insert into private.bluedeck_storage_deletion_queue (
    storage_object_id,
    bucket_id,
    object_name,
    reason,
    status,
    attempts,
    leased_at,
    lease_token,
    worker_id,
    updated_at
  ) values (
    exhausted_object_id,
    'task-photos',
    gen_random_uuid()::text || '/' || gen_random_uuid()::text || '/exhausted.jpg',
    'legacy_task_orphan',
    'processing',
    20,
    statement_timestamp() - interval '16 minutes',
    gen_random_uuid(),
    gen_random_uuid(),
    statement_timestamp()
  ) returning id into exhausted_queue_id;

  perform * from public.bluedeck_claim_storage_deletions(worker_id, 100);
  if not exists (
    select 1
    from private.bluedeck_storage_deletion_queue as exhausted
    where exhausted.id = exhausted_queue_id
      and exhausted.status = 'failed'
      and exhausted.last_error_code = 'lease_exhausted'
      and exhausted.leased_at is null
      and exhausted.lease_token is null
      and exhausted.worker_id is null
  ) then
    raise exception 'An exhausted crashed lease did not reach a terminal state.';
  end if;

  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    account_id,
    'authenticated',
    'authenticated',
    'failed-signup-' || account_id || '@example.invalid',
    '',
    '{}'::jsonb,
    '{}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  );

  insert into private.bluedeck_account_provisioning (
    user_id,
    state,
    failure_code
  ) values (
    account_id,
    'failed',
    'smoke_failure'
  );

  select cleanup.user_id
  into cleaned_account_id
  from public.bluedeck_claim_stale_signup_cleanup(1) as cleanup;

  if cleaned_account_id is distinct from account_id
    or not exists (
      select 1
      from auth.users
      where id = account_id
        and banned_until > statement_timestamp()
    )
  then
    raise exception 'Failed signup cleanup was not durably quarantined.';
  end if;

  if has_table_privilege(
    'service_role',
    'private.bluedeck_storage_deletion_queue',
    'SELECT'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_claim_storage_deletions(uuid,integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_storage_deletion_lease_state(bigint,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.bluedeck_queue_canonical_task_photo_repair(uuid,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.bluedeck_finish_storage_deletion(bigint,uuid,boolean,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.bluedeck_storage_deletion_queue_health()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_claim_stale_signup_cleanup(integer)',
    'EXECUTE'
  ) then
    raise exception 'Retention worker ACLs are unsafe.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'private'
      and tablename = 'bluedeck_storage_deletion_queue'
      and indexname = 'bluedeck_storage_deletion_queue_path_idx'
  ) or not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'storage.objects'::regclass
      and tgname = 'bluedeck_guard_queued_storage_path'
      and not tgisinternal
  ) then
    raise exception 'Storage deletion path serialization is incomplete.';
  end if;

  if not exists (
    select 1
    from cron.job
    where jobname = 'bluedeck-retention-database-phase'
      and schedule = '37 2 * * *'
  ) then
    raise exception 'Retention database phase is not scheduled.';
  end if;
end;
$test$;

rollback;
