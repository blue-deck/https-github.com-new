-- Transactional smoke test for the self-service marketplace migration.
-- It creates isolated actors and rolls every row back at the end.

begin;

do $test$
declare
  owner_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  captain_a uuid := gen_random_uuid();
  management_a uuid := gen_random_uuid();
  crew_a uuid := gen_random_uuid();
  crew_b uuid := gen_random_uuid();
  metadata_only uuid := gen_random_uuid();
  owner_b_profile uuid := gen_random_uuid();
  captain_profile uuid := gen_random_uuid();
  management_profile uuid := gen_random_uuid();
  crew_profile_a uuid := gen_random_uuid();
  crew_profile_b uuid := gen_random_uuid();
  yacht_a uuid := gen_random_uuid();
  yacht_b uuid := gen_random_uuid();
  captain_membership uuid := gen_random_uuid();
  job_a uuid;
  job_b uuid;
  captain_job uuid;
  ownership_job uuid;
  management_role_job uuid;
  management_delete_job uuid;
  application_a public.job_applications%rowtype;
  application_b public.job_applications%rowtype;
  stored_job public.job_posts%rowtype;
  event_count integer;
  result_count integer;
  duplicate_rejected boolean := false;
  owner_apply_rejected boolean := false;
  management_apply_rejected boolean := false;
  long_note_rejected boolean := false;
  stale_version_rejected boolean := false;
  terminal_transition_rejected boolean := false;
  isolated_publisher_rejected boolean := false;
  isolated_list_rejected boolean := false;
  profile_escalation_rejected boolean := false;
  captain_managed_apply_rejected boolean := false;
  suspended_publisher_list_rejected boolean := false;
begin
  if has_table_privilege('anon', 'public.marketplace_entitlements', 'select')
    or has_table_privilege('authenticated', 'public.marketplace_entitlements', 'select')
    or has_table_privilege('authenticated', 'public.marketplace_entitlements', 'insert')
    or has_table_privilege('authenticated', 'public.marketplace_entitlements', 'update')
  then
    raise exception 'Browser roles may not read or escalate marketplace entitlements.';
  end if;

  if has_table_privilege('anon', 'public.job_applications', 'select')
    or has_table_privilege('authenticated', 'public.job_applications', 'select')
    or has_table_privilege('authenticated', 'public.job_applications', 'insert')
    or has_table_privilege('authenticated', 'public.job_applications', 'update')
  then
    raise exception 'Browser roles may not access private job applications directly.';
  end if;

  if has_function_privilege(
      'authenticated',
      'public.bluedeck_ensure_marketplace_entitlement(uuid,text,text)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_submit_job_application(uuid,uuid,text)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_submit_job_application(uuid,uuid,text)',
      'execute'
    )
  then
    raise exception 'Marketplace RPC grants are not service-role-only.';
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
      owner_a,
      'authenticated',
      'authenticated',
      'market-owner-a-' || owner_a || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      jsonb_build_object('role', 'owner', 'full_name', 'Owner A'),
      now(),
      now()
    ),
    (
      owner_b,
      'authenticated',
      'authenticated',
      'market-owner-b-' || owner_b || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      jsonb_build_object('role', 'owner', 'full_name', 'Owner B'),
      now(),
      now()
    ),
    (
      captain_a,
      'authenticated',
      'authenticated',
      'market-captain-' || captain_a || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      jsonb_build_object(
        'role', 'captain',
        'full_name', 'Captain A',
        'position', 'Captain'
      ),
      now(),
      now()
    ),
    (
      management_a,
      'authenticated',
      'authenticated',
      'market-management-' || management_a || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      jsonb_build_object(
        'role', 'management',
        'full_name', 'Management A',
        'position', 'Yacht Manager'
      ),
      now(),
      now()
    ),
    (
      crew_a,
      'authenticated',
      'authenticated',
      'market-crew-a-' || crew_a || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      jsonb_build_object(
        'role', 'crew',
        'full_name', 'Crew A',
        'position', 'Deckhand'
      ),
      now(),
      now()
    ),
    (
      crew_b,
      'authenticated',
      'authenticated',
      'market-crew-b-' || crew_b || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      jsonb_build_object(
        'role', 'crew',
        'full_name', 'Crew B',
        'position', 'Stewardess'
      ),
      now(),
      now()
    ),
    (
      metadata_only,
      'authenticated',
      'authenticated',
      'market-metadata-only-' || metadata_only || '@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      jsonb_build_object(
        'role', 'owner',
        'full_name', 'Metadata Only Account'
      ),
      now(),
      now()
    );

  insert into public.profiles (id, email, full_name, role)
  select
    account.id,
    account.email,
    account.raw_user_meta_data ->> 'full_name',
    account.raw_user_meta_data ->> 'role'
  from auth.users as account
  where account.id in (
    owner_a,
    owner_b,
    captain_a,
    management_a,
    crew_a,
    crew_b
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
      owner_b_profile,
      owner_b,
      'SMOKE-OWN-' || left(owner_b::text, 8),
      'Owner B',
      'market-owner-b-' || owner_b || '@example.invalid',
      'Owner',
      'active'
    ),
    (
      captain_profile,
      captain_a,
      'SMOKE-CAP-' || left(captain_a::text, 8),
      'Captain A',
      'market-captain-' || captain_a || '@example.invalid',
      'Captain',
      'active'
    ),
    (
      management_profile,
      management_a,
      'SMOKE-MGT-' || left(management_a::text, 8),
      'Management A',
      'market-management-' || management_a || '@example.invalid',
      'Yacht Manager',
      'active'
    ),
    (
      crew_profile_a,
      crew_a,
      'SMOKE-CRA-' || left(crew_a::text, 8),
      'Crew A',
      'market-crew-a-' || crew_a || '@example.invalid',
      'Deckhand',
      'active'
    ),
    (
      crew_profile_b,
      crew_b,
      'SMOKE-CRB-' || left(crew_b::text, 8),
      'Crew B',
      'market-crew-b-' || crew_b || '@example.invalid',
      'Stewardess',
      'active'
    );

  insert into public.yachts (id, name, model, flag, owner_id)
  values
    (yacht_a, 'Marketplace Smoke A', 'Test 50', 'Malta', owner_a),
    (yacht_b, 'Marketplace Smoke B', 'Test 60', 'Cayman Islands', owner_b);

  insert into public.yacht_crew_memberships (
    id,
    yacht_id,
    crew_profile_id,
    position,
    department,
    status
  )
  values
    (
      captain_membership,
      yacht_a,
      captain_profile,
      'Captain',
      'Command',
      'active'
    ),
    (
      gen_random_uuid(),
      yacht_a,
      management_profile,
      'Yacht Manager',
      'Command',
      'active'
    ),
    (
      gen_random_uuid(),
      yacht_a,
      owner_b_profile,
      'Owner',
      'Command',
      'active'
    ),
    (
      gen_random_uuid(),
      yacht_a,
      crew_profile_a,
      'Deckhand',
      'Deck',
      'active'
    ),
    (
      gen_random_uuid(),
      yacht_b,
      crew_profile_b,
      'Stewardess',
      'Interior',
      'active'
    );

  -- A mutable user-metadata claim and a browser profile write cannot promote a
  -- crew account before its durable entitlement is first created.
  update auth.users
  set raw_user_meta_data = raw_user_meta_data || '{"role":"owner"}'::jsonb
  where id = crew_a;

  perform set_config('request.jwt.claim.sub', crew_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    update public.profiles
    set role = 'owner'
    where id = crew_a;
  exception
    when insufficient_privilege then
      profile_escalation_rejected := true;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  if not profile_escalation_rejected
    or public.bluedeck_resolve_account_role(crew_a) <> 'crew'
  then
    raise exception 'Mutable client claims escalated the canonical account role.';
  end if;

  if public.bluedeck_resolve_account_role(metadata_only) <> 'crew' then
    raise exception 'Mutable metadata-only role was treated as canonical.';
  end if;

  perform public.bluedeck_ensure_marketplace_entitlement(
    metadata_only,
    null,
    'self_service'
  );

  if not exists (
    select 1
    from public.marketplace_entitlements as entitlement
    where entitlement.user_id = metadata_only
      and entitlement.account_role = 'crew'
  ) then
    raise exception 'Lazy entitlement creation trusted mutable user metadata.';
  end if;

  perform public.bluedeck_ensure_marketplace_entitlement(
    owner_a,
    'owner',
    'self_service'
  );
  perform public.bluedeck_ensure_marketplace_entitlement(
    owner_b,
    'owner',
    'self_service'
  );
  perform public.bluedeck_ensure_marketplace_entitlement(
    captain_a,
    'captain',
    'self_service'
  );
  perform public.bluedeck_ensure_marketplace_entitlement(
    management_a,
    'management',
    'self_service'
  );
  perform public.bluedeck_ensure_marketplace_entitlement(
    crew_a,
    'crew',
    'self_service'
  );
  perform public.bluedeck_ensure_marketplace_entitlement(
    crew_b,
    'crew',
    'self_service'
  );

  -- Exact role capability matrix.
  if not public.bluedeck_can_manage_yacht_marketplace(owner_a, yacht_a)
    or not public.bluedeck_can_manage_yacht_marketplace(captain_a, yacht_a)
    or not public.bluedeck_can_manage_yacht_marketplace(management_a, yacht_a)
    or public.bluedeck_can_manage_yacht_marketplace(crew_a, yacht_a)
    or public.bluedeck_can_manage_yacht_marketplace(owner_b, yacht_a)
  then
    raise exception 'Publisher role/yacht authority matrix failed.';
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
    summary,
    description,
    responsibilities,
    requirements,
    show_yacht_name,
    status,
    closes_at
  )
  values (
    yacht_a,
    owner_a,
    owner_a,
    'Marketplace Smoke Deckhand',
    'Deckhand',
    'Deck',
    'seasonal',
    'Palma, Spain',
    current_date + 14,
    'A complete temporary role used to verify the application marketplace.',
    'This temporary posting validates self-service publishing, start dates, applications, authorization and lifecycle transitions.',
    array['Support safe daily deck operations.'],
    array['Hold valid STCW certification.'],
    false,
    'published',
    now() + interval '30 days'
  )
  returning id into job_a;

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
    summary,
    description,
    responsibilities,
    requirements,
    show_yacht_name,
    status,
    closes_at
  )
  values (
    yacht_b,
    owner_b,
    owner_b,
    'Isolated Marketplace Smoke Stewardess',
    'Stewardess',
    'Interior',
    'permanent',
    'Antibes, France',
    current_date + 21,
    'A second complete temporary role used to verify publisher isolation.',
    'This separate temporary posting ensures one yacht publisher cannot review or mutate applications belonging to another yacht.',
    array['Support interior guest operations.'],
    array['Hold valid STCW certification.'],
    false,
    'published',
    now() + interval '30 days'
  )
  returning id into job_b;

  if not public.bluedeck_can_apply_to_job(crew_a, job_a)
    or public.bluedeck_can_apply_to_job(captain_a, job_a)
    or not public.bluedeck_can_apply_to_job(captain_a, job_b)
    or public.bluedeck_can_apply_to_job(owner_a, job_a)
    or public.bluedeck_can_apply_to_job(management_a, job_a)
  then
    raise exception 'Applicant role matrix failed.';
  end if;

  if not exists (
    select 1
    from public.job_posts as post
    where post.id = job_a
      and post.start_date = current_date + 14
  ) then
    raise exception 'Job start_date was not persisted.';
  end if;

  select *
  into application_a
  from public.bluedeck_submit_job_application(
    job_a,
    crew_a,
    'I am available for the advertised start date.'
  );

  if application_a.status <> 'submitted'
    or application_a.version <> 1
    or application_a.applicant_role <> 'crew'
    or application_a.crew_profile_id is distinct from crew_profile_a
    or application_a.applicant_position_snapshot <> 'Deckhand'
  then
    raise exception 'Application snapshot or initial lifecycle state failed.';
  end if;

  begin
    perform public.bluedeck_submit_job_application(job_a, crew_a, 'Duplicate');
  exception
    when unique_violation then
      duplicate_rejected := true;
  end;
  if not duplicate_rejected then
    raise exception 'Duplicate job application was accepted.';
  end if;

  begin
    perform public.bluedeck_submit_job_application(
      job_a,
      owner_a,
      'Owner accounts must not apply.'
    );
  exception
    when insufficient_privilege then
      owner_apply_rejected := true;
  end;
  if not owner_apply_rejected then
    raise exception 'Owner account was allowed to apply.';
  end if;

  begin
    perform public.bluedeck_submit_job_application(
      job_a,
      management_a,
      'Management accounts must not apply.'
    );
  exception
    when insufficient_privilege then
      management_apply_rejected := true;
  end;
  if not management_apply_rejected then
    raise exception 'Management account was allowed to apply.';
  end if;

  begin
    perform public.bluedeck_submit_job_application(
      job_a,
      captain_a,
      'A captain must not apply to a yacht they currently manage.'
    );
  exception
    when insufficient_privilege then
      captain_managed_apply_rejected := true;
  end;
  if not captain_managed_apply_rejected then
    raise exception 'Captain applied to a job on their managed yacht.';
  end if;

  begin
    perform public.bluedeck_submit_job_application(
      job_a,
      crew_b,
      repeat('x', 2001)
    );
  exception
    when check_violation then
      long_note_rejected := true;
  end;
  if not long_note_rejected then
    raise exception 'Oversized application cover note was accepted.';
  end if;

  select *
  into application_a
  from public.bluedeck_update_job_application_status(
    application_a.id,
    owner_a,
    'reviewing',
    1
  );

  if application_a.status <> 'reviewing' or application_a.version <> 2 then
    raise exception 'Submitted-to-reviewing lifecycle transition failed.';
  end if;

  begin
    perform public.bluedeck_update_job_application_status(
      application_a.id,
      owner_a,
      'shortlisted',
      1
    );
  exception
    when serialization_failure then
      stale_version_rejected := true;
  end;
  if not stale_version_rejected then
    raise exception 'A stale optimistic-concurrency version was accepted.';
  end if;

  begin
    perform public.bluedeck_update_job_application_status(
      application_a.id,
      owner_b,
      'shortlisted',
      2
    );
  exception
    when insufficient_privilege then
      isolated_publisher_rejected := true;
  end;
  if not isolated_publisher_rejected then
    raise exception 'A publisher from another yacht changed the application.';
  end if;

  begin
    perform public.bluedeck_list_job_applications(owner_b, job_a);
  exception
    when insufficient_privilege then
      isolated_list_rejected := true;
  end;
  if not isolated_list_rejected then
    raise exception 'A publisher from another yacht listed private applications.';
  end if;

  select count(*)
  into result_count
  from public.bluedeck_list_job_applications(crew_a, job_a)
  where id = application_a.id;
  if result_count <> 1 then
    raise exception 'Applicant could not read their own application.';
  end if;

  select *
  into application_a
  from public.bluedeck_update_job_application_status(
    application_a.id,
    owner_a,
    'shortlisted',
    2
  );

  select *
  into application_a
  from public.bluedeck_withdraw_job_application(
    application_a.id,
    crew_a,
    3
  );

  if application_a.status <> 'withdrawn'
    or application_a.withdrawn_at is null
    or application_a.version <> 4
  then
    raise exception 'Applicant withdrawal lifecycle failed.';
  end if;

  begin
    perform public.bluedeck_update_job_application_status(
      application_a.id,
      owner_a,
      'hired',
      4
    );
  exception
    when check_violation then
      terminal_transition_rejected := true;
  end;
  if not terminal_transition_rejected then
    raise exception 'A terminal application was reopened.';
  end if;

  select count(*)
  into event_count
  from public.job_application_events as event
  where event.application_id = application_a.id;
  if event_count <> 4 then
    raise exception 'Expected four append-only application lifecycle events.';
  end if;

  select *
  into application_b
  from public.bluedeck_submit_job_application(
    job_b,
    crew_b,
    'Available for the advertised permanent position.'
  );

  select *
  into application_b
  from public.bluedeck_update_job_application_status(
    application_b.id,
    owner_b,
    'hired',
    1
  );

  if application_b.status <> 'hired' or application_b.version <> 2 then
    raise exception 'Publisher hire lifecycle failed.';
  end if;

  -- Membership authority loss automatically closes captain-created posts.
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
    status
  )
  values (
    yacht_a,
    captain_a,
    captain_a,
    'Captain Authority Loss Smoke',
    'Bosun',
    'Deck',
    'temporary',
    'Palma, Spain',
    'A complete temporary role used to verify membership authority loss.',
    'This temporary posting must close atomically when the captain membership that supplies yacht authority becomes inactive.',
    'published'
  )
  returning id into captain_job;

  update public.yacht_crew_memberships
  set status = 'inactive'
  where id = captain_membership;

  select * into stored_job
  from public.job_posts
  where id = captain_job;
  if stored_job.status <> 'closed' then
    raise exception 'Captain membership loss did not close the job.';
  end if;

  -- A posting-role switch must re-evaluate the position-specific membership,
  -- even when both the old and new account roles can normally publish.
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
    status
  )
  values (
    yacht_a,
    management_a,
    management_a,
    'Management Role Switch Smoke',
    'Purser',
    'Purser',
    'temporary',
    'Palma, Spain',
    'A complete temporary role used to verify role-position revalidation.',
    'This temporary posting must close when a Yacht Manager entitlement changes to captain without a Captain membership position.',
    'published'
  )
  returning id into management_role_job;

  update public.marketplace_entitlements
  set account_role = 'captain'
  where user_id = management_a;

  select * into stored_job
  from public.job_posts
  where id = management_role_job;
  if stored_job.status <> 'closed' then
    raise exception 'Role-to-role membership invalidation did not close the job.';
  end if;

  update public.marketplace_entitlements
  set account_role = 'management'
  where user_id = management_a;

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
    status
  )
  values (
    yacht_a,
    management_a,
    management_a,
    'Entitlement Delete Smoke',
    'Purser',
    'Purser',
    'temporary',
    'Palma, Spain',
    'A complete temporary role used to verify entitlement deletion cleanup.',
    'This temporary posting must close when its durable marketplace entitlement is removed from the publisher account.',
    'published'
  )
  returning id into management_delete_job;

  delete from public.marketplace_entitlements
  where user_id = management_a;

  select * into stored_job
  from public.job_posts
  where id = management_delete_job;
  if stored_job.status <> 'closed' then
    raise exception 'Entitlement deletion left a current job active.';
  end if;

  -- Entitlement suspension closes current posts but does not remove the
  -- captain role's ability to apply elsewhere.
  update public.marketplace_entitlements
  set posting_status = 'suspended',
      suspension_reason = 'Transactional billing suspension smoke test.',
      suspended_by = owner_a,
      entitlement_source = 'billing'
  where user_id = owner_a;

  select * into stored_job
  from public.job_posts
  where id = job_a;
  if stored_job.status <> 'closed' then
    raise exception 'Posting entitlement suspension did not close the job.';
  end if;

  if public.bluedeck_can_manage_job(owner_a, job_a) then
    raise exception 'Suspended publisher retained application-management authority.';
  end if;

  begin
    perform public.bluedeck_list_job_applications(owner_a, job_a);
  exception
    when insufficient_privilege then
      suspended_publisher_list_rejected := true;
  end;
  if not suspended_publisher_list_rejected then
    raise exception 'Suspended publisher could still list applicant PII.';
  end if;

  -- Existing yacht owner-change protection remains effective under the new
  -- prepare_job_post_write authorization gate.
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
    status
  )
  values (
    yacht_b,
    owner_b,
    owner_b,
    'Ownership Authority Loss Smoke',
    'Engineer',
    'Engineering',
    'temporary',
    'Antibes, France',
    'A complete temporary role used to verify yacht ownership authority loss.',
    'This temporary posting must close atomically before the yacht ownership relationship is transferred to another account.',
    'published'
  )
  returning id into ownership_job;

  update public.yachts
  set owner_id = captain_a
  where id = yacht_b;

  select * into stored_job
  from public.job_posts
  where id = ownership_job;
  if stored_job.status <> 'closed' then
    raise exception 'Yacht ownership loss did not close the job.';
  end if;
end;
$test$;

rollback;
