-- Transactional production-schema smoke test. No rows survive the rollback.

begin;

do $test$
declare
  entitlement_row public.marketplace_entitlements%rowtype;
  job_row public.job_posts%rowtype;
  job_id uuid;
  event_count integer;
  transition_rejected boolean := false;
begin
  select entitlement.*
  into entitlement_row
  from public.marketplace_entitlements as entitlement
  inner join auth.users as account
    on account.id = entitlement.user_id
  where entitlement.account_role in ('captain', 'owner', 'management')
    and entitlement.posting_status = 'enabled'
    and account.email_confirmed_at is not null
    and account.deleted_at is null
    and public.bluedeck_can_publish_jobs(entitlement.user_id)
  order by entitlement.created_at
  limit 1;

  if entitlement_row.user_id is null then
    raise exception 'No account-level job publisher entitlement is available for smoke test.';
  end if;

  if has_table_privilege('anon', 'public.job_posts', 'select')
    or has_table_privilege('authenticated', 'public.job_posts', 'select')
  then
    raise exception 'Direct browser-role job post reads must remain revoked.';
  end if;

  insert into public.job_posts (
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
    responsibilities,
    requirements,
    salary_min,
    salary_currency,
    salary_period,
    status
  )
  values (
    entitlement_row.user_id,
    entitlement_row.user_id,
    'Smoke Test Deckhand',
    'Deckhand',
    'Deck',
    'seasonal',
    'Palma, Spain',
    current_date + 14,
    'motor_yacht',
    42.5,
    'm',
    'A temporary BlueDeck job-post lifecycle verification role.',
    'This record validates account-level publisher enforcement, publishing, audit logging and closure.',
    array['Support daily deck operations.'],
    array['Hold valid STCW certificates.'],
    4200,
    'EUR',
    'month',
    'draft'
  )
  returning id into job_id;

  select *
  into job_row
  from public.job_posts
  where id = job_id;

  if job_row.yacht_id is not null
    or job_row.position is distinct from 'Deckhand'
    or job_row.employment_type is distinct from 'seasonal'
    or job_row.location is distinct from 'Palma, Spain'
    or job_row.start_date is distinct from current_date + 14
    or job_row.salary_min is distinct from 4200
    or job_row.salary_currency is distinct from 'EUR'
    or job_row.salary_period is distinct from 'month'
    or job_row.yacht_type is distinct from 'motor_yacht'
    or job_row.yacht_length is distinct from 42.5
    or job_row.yacht_length_unit is distinct from 'm'
  then
    raise exception 'Independent job card fields were not persisted correctly.';
  end if;

  if not public.bluedeck_can_publish_jobs(entitlement_row.user_id)
    or not public.bluedeck_can_manage_job(entitlement_row.user_id, job_id)
    or public.bluedeck_can_manage_job(gen_random_uuid(), job_id)
  then
    raise exception 'Creator-owned job publishing authority failed.';
  end if;

  update public.job_posts
  set status = 'published',
      updated_by = entitlement_row.user_id
  where id = job_id
  returning * into job_row;

  if job_row.status is distinct from 'published'
    or job_row.published_at is null
    or job_row.closes_at is distinct from (
      (
        job_row.published_at at time zone 'UTC' + interval '1 month'
      ) at time zone 'UTC'
    )
    or job_row.closure_reason is not null
    or job_row.version is distinct from 2
  then
    raise exception 'Draft-to-published transition was not prepared correctly.';
  end if;

  update public.job_posts
  set status = 'closed',
      updated_by = entitlement_row.user_id
  where id = job_id;

  select *
  into job_row
  from public.job_posts
  where id = job_id;

  if job_row.status is distinct from 'closed'
    or job_row.closed_at is null
    or job_row.closure_reason is distinct from 'cancelled'
    or job_row.version is distinct from 3
  then
    raise exception 'Publisher cancellation did not archive the job post.';
  end if;

  begin
    update public.job_posts
    set status = 'published',
        updated_by = entitlement_row.user_id
    where id = job_id;
  exception
    when check_violation then
      transition_rejected := true;
  end;

  if not transition_rejected then
    raise exception 'Closed-to-published transition bypassed the lifecycle.';
  end if;

  select count(*)
  into event_count
  from public.job_post_events
  where job_post_id = job_id;

  if event_count is distinct from 3 then
    raise exception 'Expected exactly three append-only lifecycle events.';
  end if;
end;
$test$;

rollback;
