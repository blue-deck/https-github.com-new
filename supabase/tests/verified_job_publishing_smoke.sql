-- Self-selected account roles must never bypass administrator-reviewed hiring
-- access, and revocation must remove current listings from the public board.

begin;

do $test$
declare
  unverified_user uuid := gen_random_uuid();
  verified_user uuid := gen_random_uuid();
  reviewer_user uuid := gen_random_uuid();
  unverified_yacht uuid := gen_random_uuid();
  verified_yacht uuid := gen_random_uuid();
  access_id uuid;
  published_job uuid;
  unverified_insert_rejected boolean := false;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values
    (
      unverified_user, 'authenticated', 'authenticated',
      'unverified-publisher-' || unverified_user || '@example.invalid', '', now(),
      '{}'::jsonb, '{"role":"owner"}'::jsonb, now(), now()
    ),
    (
      verified_user, 'authenticated', 'authenticated',
      'verified-publisher-' || verified_user || '@example.invalid', '', now(),
      '{}'::jsonb, '{"role":"owner"}'::jsonb, now(), now()
    ),
    (
      reviewer_user, 'authenticated', 'authenticated',
      'publisher-reviewer-' || reviewer_user || '@example.invalid', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    );

  insert into public.marketplace_entitlements (
    user_id, account_role, entitlement_source, posting_status
  )
  values
    (unverified_user, 'owner', 'self_service', 'enabled'),
    (verified_user, 'owner', 'self_service', 'enabled');

  insert into public.yachts (id, name, model, flag, owner_id)
  values
    (unverified_yacht, 'Unverified Publisher Yacht', 'Test', 'Malta', unverified_user),
    (verified_yacht, 'Verified Publisher Yacht', 'Test', 'Malta', verified_user);

  if public.bluedeck_can_publish_jobs(unverified_user) then
    raise exception 'A self-selected owner role gained publishing authority.';
  end if;

  begin
    insert into public.job_posts (
      created_by, updated_by, title, position, department, employment_type,
      location, start_date, yacht_type, yacht_length, yacht_length_unit,
      summary, description, salary_min, salary_currency, salary_period, status
    )
    values (
      unverified_user, unverified_user, 'Unverified Publisher Job', 'Captain',
      'Command', 'permanent', 'Athens, Greece', current_date + 30,
      'motor_yacht', 50, 'm', 'A complete publishing abuse smoke test.',
      'This complete description exists only to verify that an unreviewed account cannot publish a recruitment listing.',
      7000, 'EUR', 'month', 'published'
    );
  exception
    when insufficient_privilege then
      unverified_insert_rejected := true;
  end;

  if not unverified_insert_rejected then
    raise exception 'An unverified employer published a job.';
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

  insert into public.employer_access (
    user_id, yacht_id, requested_role, status, request_note
  )
  values (
    verified_user, verified_yacht, 'owner', 'pending', 'Verification smoke test.'
  )
  returning id into access_id;

  update public.employer_access
  set status = 'verified',
      reviewed_by = reviewer_user,
      review_note = 'Verified for transactional smoke testing.'
  where id = access_id;

  if not public.bluedeck_can_publish_jobs(verified_user) then
    raise exception 'Administrator-reviewed employer lacks publishing authority.';
  end if;

  insert into public.job_posts (
    created_by, updated_by, title, position, department, employment_type,
    location, start_date, yacht_type, yacht_length, yacht_length_unit,
    summary, description, salary_min, salary_currency, salary_period, status
  )
  values (
    verified_user, verified_user, 'Verified Publisher Job', 'Captain',
    'Command', 'permanent', 'Athens, Greece', current_date + 30,
    'motor_yacht', 50, 'm', 'A complete verified publishing smoke test.',
    'This complete description verifies that an administrator-reviewed employer can publish a professional recruitment listing.',
    7000, 'EUR', 'month', 'published'
  )
  returning id into published_job;

  if not exists (
    select 1
    from public.bluedeck_current_public_job_post_ids(array[published_job]) as current_job
    where current_job.job_post_id = published_job
  ) then
    raise exception 'Verified current public job was omitted from batch authority.';
  end if;

  update auth.users
  set banned_until = statement_timestamp() + interval '1 day'
  where id = verified_user;

  if public.bluedeck_can_publish_jobs(verified_user)
    or public.bluedeck_can_manage_job(verified_user, published_job)
    or exists (
      select 1
      from public.bluedeck_current_public_job_post_ids(array[published_job])
    )
  then
    raise exception 'A banned publisher retained current job authority.';
  end if;

  update auth.users set banned_until = null where id = verified_user;

  update public.employer_access
  set status = 'suspended',
      reviewed_by = reviewer_user,
      review_note = 'Suspended for transactional smoke testing.'
  where id = access_id;

  if public.bluedeck_can_publish_jobs(verified_user)
    or exists (
      select 1 from public.job_posts
      where id = published_job and status <> 'closed'
    )
  then
    raise exception 'Employer verification revocation left a current job active.';
  end if;

  if exists (
    select 1
    from public.bluedeck_current_public_job_post_ids(array[published_job])
  ) then
    raise exception 'Revoked job remained visible through batch authority.';
  end if;
end;
$test$;

rollback;
