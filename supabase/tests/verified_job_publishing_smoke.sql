-- Captain, Owner / Employer and Management publishing is self-service while
-- account lifecycle and marketplace suspension remain authoritative.

begin;

do $test$
declare
  owner_user uuid := gen_random_uuid();
  captain_user uuid := gen_random_uuid();
  management_user uuid := gen_random_uuid();
  crew_user uuid := gen_random_uuid();
  unconfirmed_owner uuid := gen_random_uuid();
  banned_owner uuid := gen_random_uuid();
  published_job uuid;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    banned_until, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values
    (
      owner_user, 'authenticated', 'authenticated',
      'self-service-owner-' || owner_user || '@example.invalid', '', now(),
      null, '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      captain_user, 'authenticated', 'authenticated',
      'self-service-captain-' || captain_user || '@example.invalid', '', now(),
      null, '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      management_user, 'authenticated', 'authenticated',
      'self-service-management-' || management_user || '@example.invalid', '', now(),
      null, '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      crew_user, 'authenticated', 'authenticated',
      'self-service-crew-' || crew_user || '@example.invalid', '', now(),
      null, '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      unconfirmed_owner, 'authenticated', 'authenticated',
      'unconfirmed-owner-' || unconfirmed_owner || '@example.invalid', '', null,
      null, '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      banned_owner, 'authenticated', 'authenticated',
      'banned-owner-' || banned_owner || '@example.invalid', '', now(),
      statement_timestamp() + interval '1 day',
      '{}'::jsonb, '{}'::jsonb, now(), now()
    );

  insert into public.marketplace_entitlements (
    user_id, account_role, entitlement_source, posting_status
  )
  values
    (owner_user, 'owner', 'self_service', 'enabled'),
    (captain_user, 'captain', 'self_service', 'enabled'),
    (management_user, 'management', 'self_service', 'enabled'),
    (crew_user, 'crew', 'self_service', 'enabled'),
    (unconfirmed_owner, 'owner', 'self_service', 'enabled'),
    (banned_owner, 'owner', 'self_service', 'enabled');

  if not public.bluedeck_can_publish_jobs(owner_user)
    or not public.bluedeck_can_publish_jobs(captain_user)
    or not public.bluedeck_can_publish_jobs(management_user)
    or public.bluedeck_can_publish_jobs(crew_user)
    or public.bluedeck_can_publish_jobs(unconfirmed_owner)
    or public.bluedeck_can_publish_jobs(banned_owner)
  then
    raise exception 'Self-service job publishing role or account-state matrix failed.';
  end if;

  if exists (
      select 1
      from pg_catalog.pg_trigger as trigger
      where not trigger.tgisinternal
        and trigger.tgname in (
          'employer_access_00_close_job_posts',
          'yachts_00_close_job_posts_on_owner_change'
        )
    )
    or to_regprocedure(
      'private.bluedeck_close_jobs_without_verified_access(uuid)'
    ) is not null
  then
    raise exception 'Legacy employer-verification job closure hooks remain active.';
  end if;

  insert into public.job_posts (
    created_by, updated_by, title, position, department, employment_type,
    location, start_date, yacht_type, yacht_length, yacht_length_unit,
    summary, description, salary_min, salary_currency, salary_period, status
  )
  values (
    owner_user, owner_user, 'Self-Service Publisher Job', 'Captain',
    'Command', 'permanent', 'Athens, Greece', current_date + 30,
    'motor_yacht', 50, 'm', 'A self-service publishing smoke test.',
    'This complete professional description verifies that a publisher role can create and manage its own recruitment listing without administrator review.',
    7000, 'EUR', 'month', 'published'
  )
  returning id into published_job;

  if not public.bluedeck_can_manage_job(owner_user, published_job)
    or public.bluedeck_can_manage_job(captain_user, published_job)
    or public.bluedeck_can_manage_job(crew_user, published_job)
  then
    raise exception 'Job ownership management boundary failed.';
  end if;

  if not exists (
    select 1
    from public.bluedeck_current_public_job_post_ids(array[published_job]) as current_job
    where current_job.job_post_id = published_job
  ) then
    raise exception 'Self-service published job was omitted from the public board.';
  end if;

  if has_function_privilege(
      'anon',
      'public.bluedeck_current_public_job_post_ids(uuid[])',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_current_public_job_post_ids(uuid[])',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_current_public_job_post_ids(uuid[])',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_job_applications_page(uuid,uuid,timestamp with time zone,uuid,integer)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_job_applications_page(uuid,uuid,timestamp with time zone,uuid,integer)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_job_application_counts(uuid)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_job_application_counts(uuid)',
      'execute'
    )
  then
    raise exception 'Public job authority batch RPC grants are unsafe.';
  end if;

  update auth.users
  set banned_until = statement_timestamp() + interval '1 day'
  where id = owner_user;

  if public.bluedeck_can_publish_jobs(owner_user)
    or public.bluedeck_can_manage_job(owner_user, published_job)
    or exists (
      select 1
      from public.bluedeck_current_public_job_post_ids(array[published_job])
    )
  then
    raise exception 'A banned self-service publisher retained current authority.';
  end if;

  update auth.users
  set banned_until = null
  where id = owner_user;

  update public.marketplace_entitlements
  set posting_status = 'suspended',
      suspension_reason = 'Transactional publishing suspension test.'
  where user_id = owner_user;

  if public.bluedeck_can_publish_jobs(owner_user)
    or public.bluedeck_can_manage_job(owner_user, published_job)
    or exists (
      select 1
      from public.job_posts
      where id = published_job and status <> 'closed'
    )
    or exists (
      select 1
      from public.bluedeck_current_public_job_post_ids(array[published_job])
    )
  then
    raise exception 'Marketplace suspension did not revoke publishing cleanly.';
  end if;
end;
$test$;

rollback;
