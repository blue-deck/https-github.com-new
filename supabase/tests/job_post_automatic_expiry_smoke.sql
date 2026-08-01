-- Transactional smoke test for server-owned job-post expiry.
-- All actors, posts, lifecycle changes and temporary trigger changes roll back.

begin;

set local timezone = 'UTC';

create temporary table job_post_expiry_smoke_ids (
  record_kind text primary key,
  record_id uuid not null,
  actor_id uuid not null
) on commit drop;

do $test$
declare
  owner_id uuid := gen_random_uuid();
  crew_id uuid := gen_random_uuid();
  yacht_id uuid := gen_random_uuid();
  access_id uuid;
  manual_job_id uuid;
  due_job_id uuid;
  original_deadline timestamptz;
  job_row public.job_posts%rowtype;
  transition_rejected boolean := false;
  reopen_rejected boolean := false;
  closed_edit_rejected boolean := false;
begin
  if has_function_privilege(
      'authenticated',
      'private.bluedeck_expire_due_job_posts()',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'private.bluedeck_expire_due_job_posts()',
      'execute'
    )
  then
    raise exception 'The private expiry function is callable by a runtime role.';
  end if;

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
      owner_id,
      'authenticated',
      'authenticated',
      'expiry-owner-' || owner_id || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      jsonb_build_object('role', 'owner', 'full_name', 'Expiry Owner'),
      statement_timestamp(),
      statement_timestamp()
    ),
    (
      crew_id,
      'authenticated',
      'authenticated',
      'expiry-crew-' || crew_id || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      jsonb_build_object('role', 'crew', 'full_name', 'Expiry Crew'),
      statement_timestamp(),
      statement_timestamp()
    );

  insert into public.profiles (id, email, full_name, role)
  values
    (
      owner_id,
      'expiry-owner-' || owner_id || '@example.invalid',
      'Expiry Owner',
      'owner'
    ),
    (
      crew_id,
      'expiry-crew-' || crew_id || '@example.invalid',
      'Expiry Crew',
      'crew'
    );

  insert into public.yachts (id, name, model, flag, owner_id)
  values (
    yacht_id,
    'Automatic Expiry Smoke Yacht',
    'Test 50',
    'Malta',
    owner_id
  );

  insert into public.employer_access (
    user_id, yacht_id, requested_role, status, request_note
  ) values (
    owner_id, yacht_id, 'owner', 'pending',
    'Automatic job-expiry smoke verification.'
  ) returning id into access_id;

  update public.employer_access
  set status = 'verified',
      reviewed_by = crew_id,
      review_note = 'Verified for automatic job-expiry smoke testing.'
  where id = access_id;

  perform public.bluedeck_ensure_marketplace_entitlement(
    owner_id,
    'owner',
    'self_service'
  );
  perform public.bluedeck_ensure_marketplace_entitlement(
    crew_id,
    'crew',
    'self_service'
  );

  insert into public.job_posts (
    yacht_id,
    created_by,
    updated_by,
    title,
    position,
    department,
    employment_type,
    location,
    start_date,
    yacht_type,
    yacht_length,
    yacht_length_unit,
    summary,
    description,
    salary_min,
    salary_currency,
    salary_period,
    status,
    closes_at,
    closure_reason
  )
  values (
    yacht_id,
    owner_id,
    owner_id,
    'Manual Expiry Smoke Deckhand',
    'Deckhand',
    'Deck',
    'seasonal',
    'Palma, Spain',
    current_date + 14,
    'motor_yacht',
    50,
    'm',
    'A complete role used to verify publisher cancellation semantics.',
    'This temporary posting verifies server-owned calendar-month expiry, cancellation and terminal lifecycle enforcement.',
    5000,
    'EUR',
    'month',
    'published',
    statement_timestamp() + interval '10 years',
    'expired'
  )
  returning * into job_row;

  manual_job_id := job_row.id;
  original_deadline := job_row.closes_at;

  if job_row.closes_at is distinct from (
      (
        job_row.published_at at time zone 'UTC' + interval '1 month'
      ) at time zone 'UTC'
    )
    or job_row.closure_reason is not null
  then
    raise exception 'A caller controlled the initial expiry or closure reason.';
  end if;

  update public.job_posts
  set summary = 'A changed summary that must not extend the system deadline.',
      closes_at = statement_timestamp() + interval '20 years',
      closure_reason = 'expired',
      updated_by = owner_id
  where id = manual_job_id
  returning * into job_row;

  if job_row.closes_at is distinct from original_deadline
    or job_row.closure_reason is not null
  then
    raise exception 'A live edit changed the system-owned expiry state.';
  end if;

  begin
    update public.job_posts
    set status = 'draft',
        updated_by = owner_id
    where id = manual_job_id;
  exception
    when check_violation then
      transition_rejected := true;
  end;

  if not transition_rejected then
    raise exception 'A published post returned to draft and resettable lifetime.';
  end if;

  update public.job_posts
  set status = 'closed',
      closure_reason = 'expired',
      updated_by = owner_id
  where id = manual_job_id
  returning * into job_row;

  if job_row.status <> 'closed'
    or job_row.closure_reason <> 'cancelled'
    or job_row.closes_at is distinct from original_deadline
  then
    raise exception 'A manual terminal transition was not persisted as cancelled.';
  end if;

  begin
    update public.job_posts
    set status = 'draft',
        updated_by = owner_id
    where id = manual_job_id;
  exception
    when check_violation then
      reopen_rejected := true;
  end;

  if not reopen_rejected then
    raise exception 'A closed post was reopened.';
  end if;

  begin
    update public.job_posts
    set summary = 'A terminal record must not accept content edits.',
        updated_by = owner_id
    where id = manual_job_id;
  exception
    when check_violation then
      closed_edit_rejected := true;
  end;

  if not closed_edit_rejected then
    raise exception 'A closed post accepted a same-status content edit.';
  end if;

  insert into public.job_posts (
    yacht_id,
    created_by,
    updated_by,
    title,
    position,
    department,
    employment_type,
    location,
    start_date,
    yacht_type,
    yacht_length,
    yacht_length_unit,
    summary,
    description,
    salary_min,
    salary_currency,
    salary_period,
    status
  )
  values (
    yacht_id,
    owner_id,
    owner_id,
    'Automatic Expiry Smoke Bosun',
    'Bosun',
    'Deck',
    'temporary',
    'Antibes, France',
    current_date + 21,
    'sailing_yacht',
    148,
    'ft',
    'A complete role used to verify automatic terminal expiry semantics.',
    'This temporary posting verifies exact cutoff, scheduled archival, audit history and idempotent processing.',
    5500,
    'EUR',
    'month',
    'published'
  )
  returning id into due_job_id;

  insert into job_post_expiry_smoke_ids (
    record_kind,
    record_id,
    actor_id
  )
  values
    ('manual', manual_job_id, owner_id),
    ('due', due_job_id, crew_id);
end;
$test$;

-- Backdate only the isolated due record so the real scheduler path can be
-- exercised without a one-month wait. Both lifecycle triggers are disabled
-- together under this transaction's table lock and are restored immediately.
alter table public.job_posts
  disable trigger job_posts_prepare_write;
alter table public.job_posts
  disable trigger job_posts_log_event;

update public.job_posts as post
set created_at = statement_timestamp() - interval '2 months 1 day',
    published_at = statement_timestamp() - interval '2 months',
    closes_at = (
      (
        (statement_timestamp() - interval '2 months') at time zone 'UTC'
        + interval '1 month'
      ) at time zone 'UTC'
    ),
    updated_at = statement_timestamp() - interval '2 months',
    version = 1
from job_post_expiry_smoke_ids as smoke
where smoke.record_kind = 'due'
  and smoke.record_id = post.id;

alter table public.job_posts
  enable trigger job_posts_prepare_write;
alter table public.job_posts
  enable trigger job_posts_log_event;

do $test$
declare
  due_job_id uuid;
  crew_id uuid;
  first_run_count integer;
  second_run_count integer;
  job_row public.job_posts%rowtype;
  close_event public.job_post_events%rowtype;
  application_insert_rejected boolean := false;
  due_edit_rejected boolean := false;
begin
  select smoke.record_id, smoke.actor_id
  into due_job_id, crew_id
  from job_post_expiry_smoke_ids as smoke
  where smoke.record_kind = 'due';

  select *
  into job_row
  from public.job_posts
  where id = due_job_id;

  if job_row.status <> 'published'
    or job_row.closes_at > statement_timestamp()
  then
    raise exception 'The isolated due post was not prepared correctly.';
  end if;

  begin
    update public.job_posts
    set summary = 'A due post must be archived instead of edited.',
        updated_by = job_row.created_by
    where id = due_job_id;
  exception
    when check_violation then
      due_edit_rejected := true;
  end;

  if not due_edit_rejected then
    raise exception 'A due published post accepted a same-status edit.';
  end if;

  if public.bluedeck_can_apply_to_job(crew_id, due_job_id) then
    raise exception 'A due-but-not-yet-archived post still accepted applications.';
  end if;

  begin
    perform public.bluedeck_submit_job_application(
      due_job_id,
      crew_id,
      'This due application must never be stored.'
    );
  exception
    when insufficient_privilege then
      application_insert_rejected := true;
  end;

  if not application_insert_rejected then
    raise exception 'The application INSERT deadline guard failed open.';
  end if;

  if exists (
    select 1
    from public.job_posts as post
    where post.id = due_job_id
      and post.status = 'published'
      and post.closes_at is not null
      and post.closes_at > statement_timestamp()
  ) then
    raise exception 'A due post passed the exact public cutoff predicate.';
  end if;

  first_run_count := private.bluedeck_expire_due_job_posts();

  if first_run_count < 1 then
    raise exception 'The expiry worker did not archive the isolated due post.';
  end if;

  select *
  into job_row
  from public.job_posts
  where id = due_job_id;

  if job_row.status <> 'closed'
    or job_row.closure_reason <> 'expired'
    or job_row.closed_at is null
    or job_row.closed_at < job_row.closes_at
    or job_row.version <> 2
  then
    raise exception 'The due post did not receive a valid expired terminal state.';
  end if;

  select event.*
  into close_event
  from public.job_post_events as event
  where event.job_post_id = due_job_id
    and event.action = 'closed'
  order by event.created_at desc, event.id desc
  limit 1;

  if close_event.id is null
    or close_event.from_status <> 'published'
    or close_event.to_status <> 'closed'
    or close_event.version <> 2
    or close_event.actor_user_id is not null
  then
    raise exception 'Automatic expiry did not create a system audit event.';
  end if;

  second_run_count := private.bluedeck_expire_due_job_posts();
  if second_run_count <> 0 then
    raise exception 'The expiry worker was not idempotent after reconciliation.';
  end if;

  if not exists (
    select 1
    from cron.job as job
    where job.jobname = 'bluedeck-expire-job-posts'
      and job.schedule = '*/5 * * * *'
      and job.active is true
      and job.command like '%private.bluedeck_expire_due_job_posts()%'
  ) then
    raise exception 'The stable five-minute expiry cron job is missing.';
  end if;
end;
$test$;

rollback;
