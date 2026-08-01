-- Enforce the six-month checklist archive and remove expired invitation PII.
-- Storage objects are never deleted with SQL: the database queues exact
-- private objects and a narrowly authenticated application worker removes the
-- physical object through the supported Storage API.

begin;

create schema if not exists private;

create table if not exists private.bluedeck_storage_deletion_queue (
  id bigint generated always as identity primary key,
  storage_object_id uuid not null,
  bucket_id text not null,
  object_name text not null,
  reason text not null,
  source_id uuid,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default statement_timestamp(),
  leased_at timestamptz,
  lease_token uuid,
  worker_id uuid,
  last_error_code text not null default '',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint bluedeck_storage_deletion_queue_object_uidx unique (
    storage_object_id
  ),
  constraint bluedeck_storage_deletion_queue_bucket_check check (
    bucket_id in (
      'crew-documents',
      'crew-portfolio',
      'documents',
      'task-photos',
      'yacht-documents'
    )
  ),
  constraint bluedeck_storage_deletion_queue_path_check check (
    char_length(object_name) between 1 and 1024
    and position('..' in object_name) = 0
    and object_name ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
  ),
  constraint bluedeck_storage_deletion_queue_reason_check check (
    reason in (
      'canonical_path_repair',
      'checklist_retention',
      'legacy_task_orphan'
    )
  ),
  constraint bluedeck_storage_deletion_queue_status_check check (
    status in ('pending', 'processing', 'retry', 'failed')
  ),
  constraint bluedeck_storage_deletion_queue_attempts_check check (
    attempts between 0 and 20
  ),
  constraint bluedeck_storage_deletion_queue_lease_check check (
    (
      status = 'processing'
      and leased_at is not null
      and lease_token is not null
      and worker_id is not null
    )
    or (
      status <> 'processing'
      and leased_at is null
      and lease_token is null
      and worker_id is null
    )
  ),
  constraint bluedeck_storage_deletion_queue_error_check check (
    last_error_code = ''
    or last_error_code ~ '^[a-z0-9_]{1,64}$'
  ),
  constraint bluedeck_storage_deletion_queue_time_check check (
    created_at <= updated_at
  )
);

alter table private.bluedeck_storage_deletion_queue enable row level security;
revoke all on table private.bluedeck_storage_deletion_queue
  from public, anon, authenticated, service_role;

create index if not exists bluedeck_storage_deletion_queue_work_idx
  on private.bluedeck_storage_deletion_queue (
    available_at,
    created_at,
    id
  )
  where status in ('pending', 'retry', 'processing');

create index if not exists bluedeck_storage_deletion_queue_path_idx
  on private.bluedeck_storage_deletion_queue (bucket_id, object_name);

create or replace function private.bluedeck_storage_retention_lock_key(
  p_bucket_id text,
  p_object_name text
)
returns bigint
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  select hashtextextended(
    coalesce(p_bucket_id, '') || chr(31) || coalesce(p_object_name, ''),
    72413001
  );
$function$;

create or replace function private.bluedeck_lock_storage_deletion_queue_path()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    private.bluedeck_storage_retention_lock_key(new.bucket_id, new.object_name)
  );
  return new;
end;
$function$;

drop trigger if exists bluedeck_lock_storage_deletion_queue_path
  on private.bluedeck_storage_deletion_queue;
create trigger bluedeck_lock_storage_deletion_queue_path
before insert or update of bucket_id, object_name
on private.bluedeck_storage_deletion_queue
for each row execute function private.bluedeck_lock_storage_deletion_queue_path();

create or replace function private.bluedeck_guard_queued_storage_path()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  new_lock_key bigint;
  old_lock_key bigint;
begin
  new_lock_key := private.bluedeck_storage_retention_lock_key(
    new.bucket_id,
    new.name
  );
  old_lock_key := case
    when tg_op = 'UPDATE' then private.bluedeck_storage_retention_lock_key(
      old.bucket_id,
      old.name
    )
    else new_lock_key
  end;

  perform pg_catalog.pg_advisory_xact_lock(least(new_lock_key, old_lock_key));
  if new_lock_key <> old_lock_key then
    perform pg_catalog.pg_advisory_xact_lock(greatest(new_lock_key, old_lock_key));
  end if;

  if exists (
    select 1
    from private.bluedeck_storage_deletion_queue as queue
    where (
      queue.bucket_id = new.bucket_id
      and queue.object_name = new.name
    ) or (
      tg_op = 'UPDATE'
      and queue.bucket_id = old.bucket_id
      and queue.object_name = old.name
    )
  ) then
    raise exception using
      errcode = '55000',
      message = 'This Storage path is reserved for a pending retention operation.';
  end if;

  return new;
end;
$function$;

drop trigger if exists bluedeck_guard_queued_storage_path on storage.objects;
create trigger bluedeck_guard_queued_storage_path
before insert or update on storage.objects
for each row execute function private.bluedeck_guard_queued_storage_path();

create or replace function private.bluedeck_run_retention_database_phase(
  p_checklist_limit integer default 200,
  p_orphan_limit integer default 500,
  p_invitation_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage
as $function$
declare
  checklist_limit integer := least(greatest(coalesce(p_checklist_limit, 200), 1), 500);
  orphan_limit integer := least(greatest(coalesce(p_orphan_limit, 500), 1), 1000);
  invitation_limit integer := least(greatest(coalesce(p_invitation_limit, 500), 1), 1000);
  target record;
  purged_checklists integer := 0;
  queued_objects integer := 0;
  purged_invitations integer := 0;
  affected integer;
begin
  for target in
    select checklist.id
    from public.yacht_checklists as checklist
    where lower(btrim(coalesce(checklist.status, ''))) = 'completed'
      and checklist.completed_at is not null
      and checklist.completed_at < statement_timestamp() - interval '6 months'
    order by checklist.completed_at, checklist.id
    for update skip locked
    limit checklist_limit
  loop
    insert into private.bluedeck_storage_deletion_queue (
      storage_object_id,
      bucket_id,
      object_name,
      reason,
      source_id
    )
    select distinct
      object.id,
      object.bucket_id,
      object.name,
      'checklist_retention',
      target.id
    from public.yacht_checklist_items as item
    inner join private.bluedeck_task_photo_bindings as binding
      on binding.item_id = item.id
    inner join storage.objects as object
      on object.bucket_id = 'task-photos'
      and object.name = binding.object_name
    where item.checklist_id = target.id
      and not exists (
        select 1
        from private.bluedeck_task_photo_bindings as other_binding
        inner join public.yacht_checklist_items as other_item
          on other_item.id = other_binding.item_id
        where other_binding.object_name = object.name
          and other_item.checklist_id <> target.id
      )
    on conflict (storage_object_id) do nothing;

    get diagnostics affected = row_count;
    queued_objects := queued_objects + affected;

    -- Preserve the immutable task identifier and its yacht while the parent is
    -- still visible. A cascade delete may otherwise make the child trigger's
    -- parent lookup return NULL.
    insert into private.bluedeck_checklist_item_tombstones (
      item_id,
      yacht_id,
      deleted_by,
      source
    )
    select
      item.id,
      checklist.yacht_id,
      null,
      'item-delete'
    from public.yacht_checklist_items as item
    inner join public.yacht_checklists as checklist
      on checklist.id = item.checklist_id
    where checklist.id = target.id
    on conflict (item_id) do nothing;

    delete from public.yacht_checklists as checklist
    where checklist.id = target.id;

    get diagnostics affected = row_count;
    purged_checklists := purged_checklists + affected;
  end loop;

  insert into private.bluedeck_storage_deletion_queue (
    storage_object_id,
    bucket_id,
    object_name,
    reason,
    source_id
  )
  select
    object.id,
    object.bucket_id,
    object.name,
    'legacy_task_orphan',
    tombstone.item_id
  from storage.objects as object
  inner join private.bluedeck_checklist_item_tombstones as tombstone
    on tombstone.item_id = private.bluedeck_storage_path_task_id(object.name)
  where object.bucket_id = 'task-photos'
    and object.created_at < statement_timestamp() - interval '30 days'
    and not exists (
      select 1
      from private.bluedeck_storage_deletion_queue as queued
      where queued.storage_object_id = object.id
    )
    and not exists (
      select 1
      from private.bluedeck_task_photo_bindings as binding
      where binding.object_name = object.name
    )
  order by object.created_at, object.id
  limit orphan_limit
  on conflict (storage_object_id) do nothing;

  get diagnostics affected = row_count;
  queued_objects := queued_objects + affected;

  with expired as (
    select invitation.id
    from public.crew_invitations as invitation
    where (
      lower(btrim(invitation.status)) = 'pending'
      and invitation.expires_at
        < statement_timestamp() - interval '30 days'
    ) or (
      lower(btrim(invitation.status)) <> 'pending'
      and greatest(
        invitation.created_at,
        invitation.expires_at,
        coalesce(invitation.accepted_at, '-infinity'::timestamptz),
        coalesce(invitation.revoked_at, '-infinity'::timestamptz)
      )
        < statement_timestamp() - interval '1 year'
    )
    order by invitation.created_at, invitation.id
    for update skip locked
    limit invitation_limit
  )
  delete from public.crew_invitations as invitation
  using expired
  where invitation.id = expired.id;

  get diagnostics purged_invitations = row_count;

  delete from private.bluedeck_checklist_item_tombstones as tombstone
  where tombstone.deleted_at < statement_timestamp() - interval '2 years'
    and not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'task-photos'
        and private.bluedeck_storage_path_task_id(object.name) = tombstone.item_id
    );

  return jsonb_build_object(
    'purgedChecklists', purged_checklists,
    'queuedObjects', queued_objects,
    'purgedInvitations', purged_invitations
  );
end;
$function$;

create or replace function public.bluedeck_storage_deletion_lease_state(
  p_queue_id bigint,
  p_lease_token uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, private
as $function$
  select coalesce((
    select case
      when exists (
        select 1
        from storage.objects as object
        where object.id = queue.storage_object_id
          and object.bucket_id = queue.bucket_id
          and object.name = queue.object_name
      ) then 'current'
      when exists (
        select 1
        from storage.objects as object
        where object.bucket_id = queue.bucket_id
          and object.name = queue.object_name
      ) then 'replaced'
      else 'gone'
    end
    from private.bluedeck_storage_deletion_queue as queue
    where queue.id = p_queue_id
      and queue.status = 'processing'
      and queue.lease_token = p_lease_token
  ), 'invalid');
$function$;

create or replace function public.bluedeck_queue_canonical_task_photo_repair(
  p_item_id uuid,
  p_old_object_name text,
  p_new_object_name text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage
as $function$
declare
  source_yacht_id uuid;
  reference_paths text[];
  old_lock_key bigint;
  new_lock_key bigint;
begin
  if p_item_id is null
    or p_old_object_name is null
    or p_new_object_name is null
    or p_old_object_name = p_new_object_name
    or char_length(p_old_object_name) not between 1 and 1024
    or char_length(p_new_object_name) not between 1 and 1024
    or position('..' in p_old_object_name) > 0
    or p_old_object_name !~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
  then
    return false;
  end if;

  old_lock_key := private.bluedeck_storage_retention_lock_key(
    'task-photos',
    p_old_object_name
  );
  new_lock_key := private.bluedeck_storage_retention_lock_key(
    'task-photos',
    p_new_object_name
  );
  perform pg_catalog.pg_advisory_xact_lock(least(old_lock_key, new_lock_key));
  if old_lock_key <> new_lock_key then
    perform pg_catalog.pg_advisory_xact_lock(greatest(old_lock_key, new_lock_key));
  end if;

  select
    checklist.yacht_id,
    private.bluedeck_task_photo_item_paths(
      to_jsonb(item) ->> 'before_photo_url',
      to_jsonb(item) ->> 'after_photo_url',
      to_jsonb(item) ->> 'note'
    )
  into source_yacht_id, reference_paths
  from public.yacht_checklist_items as item
  inner join public.yacht_checklists as checklist
    on checklist.id = item.checklist_id
  where item.id = p_item_id
  for update of item;

  if not found
    or private.bluedeck_storage_path_yacht_id(p_new_object_name)
      is distinct from source_yacht_id
    or private.bluedeck_storage_path_task_id(p_new_object_name)
      is distinct from p_item_id
    or p_old_object_name = any(reference_paths)
    or not p_new_object_name = any(reference_paths)
    or not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'task-photos'
        and object.name = p_old_object_name
    )
    or not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'task-photos'
        and object.name = p_new_object_name
    )
    or exists (
      select 1
      from private.bluedeck_task_photo_bindings as binding
      where binding.object_name = p_old_object_name
        and binding.item_id <> p_item_id
    )
    or exists (
      select 1
      from public.yacht_checklist_items as other_item
      where other_item.id <> p_item_id
        and p_old_object_name = any(
          private.bluedeck_task_photo_item_paths(
            to_jsonb(other_item) ->> 'before_photo_url',
            to_jsonb(other_item) ->> 'after_photo_url',
            to_jsonb(other_item) ->> 'note'
          )
        )
    )
  then
    return false;
  end if;

  delete from private.bluedeck_task_photo_bindings as binding
  where binding.object_name = p_old_object_name
    and binding.item_id = p_item_id;

  insert into private.bluedeck_storage_deletion_queue (
    storage_object_id,
    bucket_id,
    object_name,
    reason,
    source_id
  )
  select
    object.id,
    object.bucket_id,
    object.name,
    'canonical_path_repair',
    p_item_id
  from storage.objects as object
  where object.bucket_id = 'task-photos'
    and object.name = p_old_object_name
  on conflict (storage_object_id) do nothing;

  return exists (
    select 1
    from private.bluedeck_storage_deletion_queue as queue
    where queue.bucket_id = 'task-photos'
      and queue.object_name = p_old_object_name
      and queue.source_id = p_item_id
  );
end;
$function$;

create or replace function public.bluedeck_run_retention_database_phase()
returns jsonb
language sql
security definer
set search_path = pg_catalog, private
as $function$
  select private.bluedeck_run_retention_database_phase();
$function$;

create or replace function public.bluedeck_claim_storage_deletions(
  p_worker_id uuid,
  p_limit integer default 100
)
returns table (
  queue_id bigint,
  bucket_id text,
  object_name text,
  lease_token uuid
)
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
begin
  if p_worker_id is null then
    return;
  end if;

  -- A worker can disappear after taking its twentieth and final lease. Move
  -- those rows to a visible terminal state instead of letting them starve the
  -- front of every future batch forever.
  update private.bluedeck_storage_deletion_queue as queue
  set
    status = 'failed',
    leased_at = null,
    lease_token = null,
    worker_id = null,
    last_error_code = 'lease_exhausted',
    updated_at = statement_timestamp()
  where queue.status = 'processing'
    and queue.attempts >= 20
    and queue.leased_at < statement_timestamp() - interval '15 minutes';

  return query
  with candidates as (
    select queue.id
    from private.bluedeck_storage_deletion_queue as queue
    where queue.attempts < 20
      and (
        (
          queue.status in ('pending', 'retry')
          and queue.available_at <= statement_timestamp()
        ) or (
          queue.status = 'processing'
          and queue.leased_at < statement_timestamp() - interval '15 minutes'
        )
      )
    order by queue.available_at, queue.created_at, queue.id
    for update skip locked
    limit safe_limit
  )
  update private.bluedeck_storage_deletion_queue as queue
  set
    status = 'processing',
    attempts = queue.attempts + 1,
    leased_at = statement_timestamp(),
    lease_token = gen_random_uuid(),
    worker_id = p_worker_id,
    updated_at = statement_timestamp()
  from candidates
  where queue.id = candidates.id
    and queue.attempts < 20
  returning queue.id, queue.bucket_id, queue.object_name, queue.lease_token;
end;
$function$;

create or replace function public.bluedeck_finish_storage_deletion(
  p_queue_id bigint,
  p_lease_token uuid,
  p_succeeded boolean,
  p_error_code text default ''
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  normalized_error text := lower(btrim(coalesce(p_error_code, '')));
  affected integer;
begin
  if p_queue_id is null
    or p_lease_token is null
    or p_succeeded is null
    or (
      not p_succeeded
      and normalized_error !~ '^[a-z0-9_]{1,64}$'
    )
  then
    return false;
  end if;

  if p_succeeded then
    delete from private.bluedeck_storage_deletion_queue as queue
    where queue.id = p_queue_id
      and queue.status = 'processing'
      and queue.lease_token = p_lease_token
      and not exists (
        select 1
        from storage.objects as object
        where object.id = queue.storage_object_id
          and object.bucket_id = queue.bucket_id
          and object.name = queue.object_name
      );
  else
    update private.bluedeck_storage_deletion_queue as queue
    set
      status = case when queue.attempts >= 20 then 'failed' else 'retry' end,
      available_at = statement_timestamp()
        + least(
          interval '24 hours',
          interval '5 minutes'
            * power(2, least(queue.attempts, 8))::double precision
        ),
      leased_at = null,
      lease_token = null,
      worker_id = null,
      last_error_code = normalized_error,
      updated_at = statement_timestamp()
    where queue.id = p_queue_id
      and queue.status = 'processing'
      and queue.lease_token = p_lease_token;
  end if;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$function$;

create or replace function public.bluedeck_storage_deletion_queue_health()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, private
as $function$
  select jsonb_build_object(
    'actionable', count(*) filter (
      where queue.status in ('pending', 'retry', 'processing')
    ),
    'failed', count(*) filter (where queue.status = 'failed'),
    'oldestActionableSeconds', coalesce(
      extract(epoch from (
        statement_timestamp() - min(queue.created_at) filter (
          where queue.status in ('pending', 'retry', 'processing')
        )
      ))::bigint,
      0
    )
  )
  from private.bluedeck_storage_deletion_queue as queue;
$function$;

create or replace function public.bluedeck_claim_stale_signup_cleanup(
  p_limit integer default 50
)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  target record;
begin
  for target in
    select provisioning.user_id, provisioning.state
    from private.bluedeck_account_provisioning as provisioning
    where (
      provisioning.state = 'pending'
      and provisioning.created_at < statement_timestamp() - interval '1 hour'
    ) or (
      provisioning.state = 'failed'
      and provisioning.cleanup_attempts < 1000
      and (
        provisioning.cleanup_attempted_at is null
        or provisioning.cleanup_attempted_at < statement_timestamp() - interval '1 hour'
      )
    )
    order by provisioning.created_at, provisioning.user_id
    for update skip locked
    limit safe_limit
  loop
    update private.bluedeck_account_provisioning as provisioning
    set
      state = 'failed',
      failure_code = case
        when target.state = 'pending' then 'stale_untrusted_signup'
        else provisioning.failure_code
      end,
      cleanup_attempts = provisioning.cleanup_attempts + 1,
      cleanup_attempted_at = statement_timestamp(),
      updated_at = statement_timestamp()
    where provisioning.user_id = target.user_id;

    update auth.users as account
    set
      banned_until = statement_timestamp() + interval '100 years',
      updated_at = statement_timestamp()
    where account.id = target.user_id;

    user_id := target.user_id;
    return next;
  end loop;
end;
$function$;

revoke all on function private.bluedeck_run_retention_database_phase(
  integer, integer, integer
) from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_storage_retention_lock_key(text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_lock_storage_deletion_queue_path()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_queued_storage_path()
  from public, anon, authenticated, service_role;
revoke all on function public.bluedeck_run_retention_database_phase()
  from public, anon, authenticated;
grant execute on function public.bluedeck_run_retention_database_phase()
  to service_role;
revoke all on function public.bluedeck_claim_storage_deletions(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.bluedeck_claim_storage_deletions(uuid, integer)
  to service_role;
revoke all on function public.bluedeck_storage_deletion_lease_state(bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.bluedeck_storage_deletion_lease_state(bigint, uuid)
  to service_role;
revoke all on function public.bluedeck_queue_canonical_task_photo_repair(
  uuid, text, text
) from public, anon, authenticated;
grant execute on function public.bluedeck_queue_canonical_task_photo_repair(
  uuid, text, text
) to service_role;
revoke all on function public.bluedeck_finish_storage_deletion(
  bigint, uuid, boolean, text
) from public, anon, authenticated;
grant execute on function public.bluedeck_finish_storage_deletion(
  bigint, uuid, boolean, text
) to service_role;
revoke all on function public.bluedeck_storage_deletion_queue_health()
  from public, anon, authenticated;
grant execute on function public.bluedeck_storage_deletion_queue_health()
  to service_role;
revoke all on function public.bluedeck_claim_stale_signup_cleanup(integer)
  from public, anon, authenticated;
grant execute on function public.bluedeck_claim_stale_signup_cleanup(integer)
  to service_role;

do $schedule$
declare
  existing_job bigint;
begin
  if to_regnamespace('cron') is null or to_regclass('cron.job') is null then
    raise exception using
      errcode = '0A000',
      message = 'pg_cron must be enabled before retention is scheduled.';
  end if;

  for existing_job in
    select jobid
    from cron.job
    where jobname = 'bluedeck-retention-database-phase'
  loop
    perform cron.unschedule(existing_job);
  end loop;

  perform cron.schedule(
    'bluedeck-retention-database-phase',
    '37 2 * * *',
    $command$select private.bluedeck_run_retention_database_phase();$command$
  );
end;
$schedule$;

comment on table private.bluedeck_storage_deletion_queue is
  'Exact private Storage objects awaiting supported Storage API deletion after database retention commits.';

commit;
