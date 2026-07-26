-- Transactional production-schema smoke test. No rows survive the rollback.

begin;

do $test$
declare
  access_row public.employer_access%rowtype;
  job_row public.job_posts%rowtype;
  job_id uuid;
  event_count integer;
  transition_rejected boolean := false;
begin
  select access.*
  into access_row
  from public.employer_access as access
  inner join public.yachts as yacht
    on yacht.id = access.yacht_id
   and yacht.owner_id = access.user_id
  where access.status = 'verified'
    and access.can_post_jobs = true
  order by access.created_at
  limit 1;

  if access_row.id is null then
    raise exception 'No verified employer access is available for smoke test.';
  end if;

  if has_table_privilege('anon', 'public.job_posts', 'select')
    or has_table_privilege('authenticated', 'public.job_posts', 'select')
  then
    raise exception 'Direct browser-role job post reads must remain revoked.';
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
    summary,
    description,
    responsibilities,
    requirements,
    show_yacht_name,
    status
  )
  values (
    access_row.yacht_id,
    access_row.user_id,
    access_row.user_id,
    'Smoke Test Deckhand',
    'Deckhand',
    'Deck',
    'seasonal',
    'Palma, Spain',
    'A temporary BlueDeck job-post lifecycle verification role.',
    'This record validates verified-employer enforcement, publishing, audit logging and closure.',
    array['Support daily deck operations.'],
    array['Hold valid STCW certificates.'],
    false,
    'draft'
  )
  returning id into job_id;

  update public.job_posts
  set status = 'published',
      updated_by = access_row.user_id
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
      updated_by = access_row.user_id
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
        updated_by = access_row.user_id
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
