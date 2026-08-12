-- Transactional Team/Couple relationship and grouped-application smoke test.
-- Every temporary account and row is rolled back.

begin;

do $test$
declare
  owner_user uuid := gen_random_uuid();
  crew_a uuid := gen_random_uuid();
  crew_b uuid := gen_random_uuid();
  crew_c uuid := gen_random_uuid();
  crew_profile_a uuid := gen_random_uuid();
  crew_profile_b uuid := gen_random_uuid();
  crew_profile_c uuid := gen_random_uuid();
  crew_id_b text;
  crew_id_c text;
  relationship_ab uuid;
  relationship_bc uuid;
  relationship_ac_pending uuid;
  team_job uuid;
  individual_job uuid;
  team_application public.job_applications%rowtype;
  solo_application public.job_applications%rowtype;
  withdrawn_team_application_id uuid;
  dashboard jsonb;
  frozen_b_snapshot jsonb;
  member_count integer;
  duplicate_relationship_rejected boolean := false;
  duplicate_application_rejected boolean := false;
  individual_job_team_rejected boolean := false;
  secondary_withdraw_rejected boolean := false;
  stale_accept_rejected boolean := false;
  stale_cancel_rejected boolean := false;
  primary_identity_change_rejected boolean := false;
begin
  if has_table_privilege(
      'anon',
      'public.crew_team_relationships',
      'select'
    )
    or has_table_privilege(
      'authenticated',
      'public.crew_team_relationships',
      'select'
    )
    or has_table_privilege(
      'authenticated',
      'public.job_application_team_members',
      'select'
    )
    or has_table_privilege(
      'authenticated',
      'public.job_application_team_members',
      'insert'
    )
    or has_table_privilege(
      'service_role',
      'private.bluedeck_job_application_member_reservations',
      'select'
    )
  then
    raise exception 'Browser roles can access private Team/Couple tables.';
  end if;

  if has_function_privilege(
      'authenticated',
      'public.bluedeck_team_couple_dashboard(uuid)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_invite_team_couple(uuid,text)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_submit_job_application_v2(uuid,uuid,text,boolean)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_current_job_application_membership(uuid,uuid)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_respond_team_couple(uuid,uuid,integer)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_remove_team_couple(uuid,uuid,text,integer)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'private.bluedeck_lock_team_couple_pair(uuid,uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'private.bluedeck_team_couple_person_payload(uuid,uuid,integer,timestamptz)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_team_couple_dashboard(uuid)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_submit_job_application_v2(uuid,uuid,text,boolean)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_current_job_application_membership(uuid,uuid)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_respond_team_couple(uuid,uuid,integer)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_remove_team_couple(uuid,uuid,text,integer)',
      'execute'
    )
  then
    raise exception 'Team/Couple RPC grants do not match the service boundary.';
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
      owner_user,
      'authenticated',
      'authenticated',
      'team-owner-' || owner_user || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      jsonb_build_object('role', 'owner', 'full_name', 'Team Owner'),
      statement_timestamp(),
      statement_timestamp()
    ),
    (
      crew_a,
      'authenticated',
      'authenticated',
      'team-crew-a-' || crew_a || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      jsonb_build_object('role', 'crew', 'full_name', 'Crew Alpha'),
      statement_timestamp(),
      statement_timestamp()
    ),
    (
      crew_b,
      'authenticated',
      'authenticated',
      'team-crew-b-' || crew_b || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      jsonb_build_object('role', 'crew', 'full_name', 'Crew Bravo'),
      statement_timestamp(),
      statement_timestamp()
    ),
    (
      crew_c,
      'authenticated',
      'authenticated',
      'team-crew-c-' || crew_c || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      jsonb_build_object('role', 'captain', 'full_name', 'Crew Charlie'),
      statement_timestamp(),
      statement_timestamp()
    );

  insert into public.profiles (id, email, full_name, role)
  values
    (
      owner_user,
      'team-owner-' || owner_user || '@example.invalid',
      'Team Owner',
      'owner'
    ),
    (
      crew_a,
      'team-crew-a-' || crew_a || '@example.invalid',
      'Crew Alpha',
      'crew'
    ),
    (
      crew_b,
      'team-crew-b-' || crew_b || '@example.invalid',
      'Crew Bravo',
      'crew'
    ),
    (
      crew_c,
      'team-crew-c-' || crew_c || '@example.invalid',
      'Crew Charlie',
      'captain'
    );

  insert into public.marketplace_entitlements (
    user_id,
    account_role,
    entitlement_source,
    posting_status
  )
  values
    (owner_user, 'owner', 'self_service', 'enabled'),
    (crew_a, 'crew', 'self_service', 'enabled'),
    (crew_b, 'crew', 'self_service', 'enabled'),
    (crew_c, 'captain', 'self_service', 'enabled');

  insert into public.crew_profiles (
    id,
    user_id,
    full_name,
    email,
    current_position,
    profile_photo_url,
    status
  )
  values
    (
      crew_profile_a,
      crew_a,
      'Crew Alpha',
      'team-crew-a-' || crew_a || '@example.invalid',
      'Deckhand',
      crew_profile_a::text || '/alpha-avatar.jpg',
      'active'
    ),
    (
      crew_profile_b,
      crew_b,
      'Crew Bravo',
      'team-crew-b-' || crew_b || '@example.invalid',
      'Stewardess',
      crew_b::text || '/bravo-avatar.jpg',
      'active'
    ),
    (
      crew_profile_c,
      crew_c,
      'Crew Charlie',
      'team-crew-c-' || crew_c || '@example.invalid',
      'Captain',
      crew_profile_c::text || '/charlie-avatar.jpg',
      'active'
    );

  -- A and B exist in storage; C intentionally references a missing object so
  -- the delete-first side of lock-then-existence snapshot finalization can be
  -- asserted below.
  insert into storage.objects (
    id,
    bucket_id,
    name,
    owner,
    owner_id,
    metadata
  )
  values
    (
      gen_random_uuid(),
      'crew-portfolio',
      crew_profile_a::text || '/alpha-avatar.jpg',
      crew_a,
      crew_a::text,
      '{"size":1,"mimetype":"image/jpeg"}'::jsonb
    ),
    (
      gen_random_uuid(),
      'crew-portfolio',
      crew_b::text || '/bravo-avatar.jpg',
      crew_b,
      crew_b::text,
      '{"size":1,"mimetype":"image/jpeg"}'::jsonb
    );

  select public_crew_id into crew_id_b
  from public.crew_profiles
  where id = crew_profile_b;

  select public_crew_id into crew_id_c
  from public.crew_profiles
  where id = crew_profile_c;

  relationship_ab := public.bluedeck_invite_team_couple(crew_a, crew_id_b);

  dashboard := public.bluedeck_team_couple_dashboard(crew_b);
  if jsonb_array_length(dashboard -> 'incomingInvites') <> 1
    or dashboard #>> '{incomingInvites,0,fullName}' <> 'Crew Alpha'
    or (dashboard #>> '{incomingInvites,0,version}')::integer <> 1
    or (dashboard #>> '{incomingInvites,0,isAvailable}')::boolean is not true
  then
    raise exception 'The recipient dashboard did not expose the sender invite.';
  end if;

  begin
    perform public.bluedeck_invite_team_couple(
      crew_b,
      (
        select public_crew_id
        from public.crew_profiles
        where id = crew_profile_a
      )
    );
  exception
    when unique_violation then
      duplicate_relationship_rejected := true;
  end;
  if not duplicate_relationship_rejected then
    raise exception 'A reverse duplicate Team/Couple invite was accepted.';
  end if;

  perform public.bluedeck_respond_team_couple(
    crew_b,
    relationship_ab,
    1
  );

  begin
    perform public.bluedeck_remove_team_couple(
      crew_a,
      relationship_ab,
      'cancel',
      1
    );
  exception
    when insufficient_privilege then
      stale_cancel_rejected := true;
  end;
  if not stale_cancel_rejected then
    raise exception 'A stale pending cancel removed an accepted relationship.';
  end if;

  relationship_bc := public.bluedeck_invite_team_couple(crew_b, crew_id_c);
  begin
    perform public.bluedeck_respond_team_couple(
      crew_c,
      relationship_bc,
      99
    );
  exception
    when insufficient_privilege then
      stale_accept_rejected := true;
  end;
  if not stale_accept_rejected then
    raise exception 'A stale invitation version was accepted.';
  end if;
  perform public.bluedeck_respond_team_couple(
    crew_c,
    relationship_bc,
    1
  );
  relationship_ac_pending := public.bluedeck_invite_team_couple(
    crew_a,
    crew_id_c
  );

  update public.crew_profiles
  set full_name = repeat('Ç', 200),
      current_position = repeat('K', 200)
  where id = crew_profile_c;
  update auth.users
  set banned_until = statement_timestamp() + interval '1 hour'
  where id = crew_c;

  dashboard := public.bluedeck_team_couple_dashboard(crew_a);
  if jsonb_array_length(dashboard -> 'members') <> 1
    or dashboard #>> '{members,0,fullName}' <> 'Crew Bravo'
    or jsonb_array_length(dashboard -> 'outgoingInvites') <> 1
    or (dashboard #>> '{outgoingInvites,0,isAvailable}')::boolean is not false
    or (dashboard #>> '{outgoingInvites,0,version}')::integer <> 1
    or char_length(dashboard #>> '{outgoingInvites,0,fullName}') <> 120
    or char_length(dashboard #>> '{outgoingInvites,0,currentPosition}') <> 120
  then
    raise exception 'Accepted and pending Team/Couple state was not isolated.';
  end if;

  update auth.users
  set banned_until = null
  where id = crew_c;

  perform public.bluedeck_respond_team_couple(
    crew_c,
    relationship_ac_pending,
    1
  );
  update auth.users
  set banned_until = statement_timestamp() + interval '1 hour'
  where id = crew_c;

  dashboard := public.bluedeck_team_couple_dashboard(crew_a);
  if not exists (
    select 1
    from jsonb_array_elements(dashboard -> 'members') as member(payload)
    where member.payload ->> 'relationshipId' = relationship_ac_pending::text
      and (member.payload ->> 'isAvailable')::boolean is false
      and (member.payload ->> 'version')::integer = 2
  ) then
    raise exception 'An unavailable accepted member was not manageable.';
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
    candidate_type,
    salary_min,
    salary_currency,
    salary_period,
    status
  )
  values (
    owner_user,
    owner_user,
    'Team/Couple Smoke Job',
    'Deck and Interior Team',
    'Deck',
    'seasonal',
    'Palma, Spain',
    current_date + 14,
    'motor_yacht',
    50,
    'm',
    'A grouped application workflow smoke test.',
    'This complete temporary role validates a single immutable Team/Couple application and employer lifecycle decision.',
    array['Work together as a professional yacht team.'],
    array['Maintain active BlueDeck profiles.'],
    'team',
    5000,
    'EUR',
    'month',
    'published'
  )
  returning id into team_job;

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
    candidate_type,
    salary_min,
    salary_currency,
    salary_period,
    status
  )
  values (
    owner_user,
    owner_user,
    'Individual Smoke Job',
    'Captain',
    'Command',
    'permanent',
    'Athens, Greece',
    current_date + 21,
    'sailing_yacht',
    45,
    'm',
    'An individual application workflow smoke test.',
    'This complete temporary role validates that Team/Couple submission is blocked when the listing explicitly requests an individual.',
    array['Lead safe yacht operations.'],
    array['Maintain an active Captain profile.'],
    'individual',
    7000,
    'EUR',
    'month',
    'published'
  )
  returning id into individual_job;

  select * into team_application
  from public.bluedeck_submit_job_application_v2(
    team_job,
    crew_a,
    'We are applying together.',
    true
  );

  select count(*) into member_count
  from public.job_application_team_members
  where application_id = team_application.id;

  if team_application.application_mode <> 'team_couple'
    or member_count <> 2
    or not exists (
      select 1
      from public.job_application_team_members
      where application_id = team_application.id
        and member_user_id = crew_a
        and is_primary
    )
    or not exists (
      select 1
      from public.job_application_team_members
      where application_id = team_application.id
        and member_user_id = crew_b
        and not is_primary
    )
    or exists (
      select 1
      from public.job_application_team_members
      where application_id = team_application.id
        and member_user_id = crew_c
    )
    or exists (
      select 1
      from public.job_application_team_members
      where application_id = team_application.id
        and is_primary
        and member_user_id <> team_application.applicant_user_id
    )
  then
    raise exception 'The grouped application member snapshot is incorrect.';
  end if;

  if not exists (
    select 1
    from private.bluedeck_resource_quota_locks as quota_lock
    where quota_lock.quota_scope = 'job-applications:applicant'
      and quota_lock.resource_key = crew_b::text
  ) then
    raise exception 'A secondary member did not consume the applicant quota lock.';
  end if;

  begin
    update public.job_application_team_members
    set is_primary = false
    where application_id = team_application.id
      and member_user_id = team_application.applicant_user_id;
  exception
    when invalid_parameter_value then
      primary_identity_change_rejected := true;
  end;
  if not primary_identity_change_rejected then
    raise exception 'A submitted primary member identity was mutable.';
  end if;

  withdrawn_team_application_id := team_application.id;
  select * into team_application
  from public.bluedeck_withdraw_job_application(
    team_application.id,
    crew_a,
    team_application.version
  );

  if team_application.status <> 'withdrawn'
    or (
      public.bluedeck_job_applications_page(
        owner_user,
        team_job,
        null,
        null,
        50
      ) ->> 'total'
    )::integer <> 0
    or exists (
      select 1
      from private.bluedeck_job_application_member_reservations
      where application_id = withdrawn_team_application_id
    )
    or (
      select count(*)
      from public.job_application_team_members
      where application_id = withdrawn_team_application_id
    ) <> 2
  then
    raise exception 'Team withdrawal did not hide and release the retained attempt.';
  end if;

  select * into team_application
  from public.bluedeck_submit_job_application_v2(
    team_job,
    crew_a,
    'We are applying together again.',
    true
  );

  if team_application.id = withdrawn_team_application_id
    or team_application.status <> 'submitted'
    or team_application.version <> 1
    or (
      select count(*)
      from private.bluedeck_job_application_member_reservations
      where application_id = team_application.id
    ) <> 2
    or (
      public.bluedeck_job_applications_page(
        owner_user,
        team_job,
        null,
        null,
        50
      ) ->> 'total'
    )::integer <> 1
  then
    raise exception 'Team members did not receive a fresh application cycle.';
  end if;

  -- C was accepted but unavailable at submit time; it must remain manageable
  -- on the dashboard without blocking or joining A+B's grouped application.
  update auth.users
  set banned_until = null
  where id = crew_c;

  select candidate_snapshot into frozen_b_snapshot
  from public.job_application_team_members
  where application_id = team_application.id
    and member_user_id = crew_b;

  perform public.bluedeck_remove_team_couple(
    crew_a,
    relationship_ab,
    'remove',
    2
  );
  update public.crew_profiles
  set full_name = 'Crew Bravo Changed',
      current_position = 'Chief Stewardess'
  where id = crew_profile_b;

  if (
    select candidate_snapshot
    from public.job_application_team_members
    where application_id = team_application.id
      and member_user_id = crew_b
  ) is distinct from frozen_b_snapshot
  then
    raise exception 'A relationship/profile change mutated an old application.';
  end if;

  begin
    perform public.bluedeck_submit_job_application_v2(
      team_job,
      crew_b,
      '',
      false
    );
  exception
    when unique_violation then
      duplicate_application_rejected := true;
  end;
  if not duplicate_application_rejected then
    raise exception 'A snapshotted member applied to the same job twice.';
  end if;

  begin
    perform public.bluedeck_submit_job_application_v2(
      individual_job,
      crew_b,
      '',
      true
    );
  exception
    when invalid_parameter_value then
      individual_job_team_rejected := true;
  end;
  if not individual_job_team_rejected then
    raise exception 'A Team/Couple submission was accepted by a No listing.';
  end if;

  select * into solo_application
  from public.bluedeck_submit_job_application_v2(
    individual_job,
    crew_c,
    'Applying individually.',
    false
  );

  if solo_application.application_mode <> 'individual'
    or (
      select count(*)
      from public.job_application_team_members
      where application_id = solo_application.id
    ) <> 1
    or not exists (
      select 1
      from public.job_application_team_members
      where application_id = solo_application.id
        and member_user_id = crew_c
        and is_primary
    )
    or coalesce(
      (
        select member.media_snapshot ->> 'avatar_source'
        from public.job_application_team_members as member
        where member.application_id = solo_application.id
          and member.member_user_id = crew_c
      ),
      '__missing__'
    ) <> ''
    or coalesce(
      (
        select snapshot.media_snapshot ->> 'avatar_source'
        from public.job_application_snapshots as snapshot
        where snapshot.application_id = solo_application.id
      ),
      '__missing__'
    ) <> ''
  then
    raise exception 'A solo application or delete-first media finalization is incorrect.';
  end if;

  if (
    public.bluedeck_job_applications_page(
      owner_user,
      team_job,
      null,
      null,
      50
    ) ->> 'total'
  )::integer <> 1
  then
    raise exception 'One grouped application was counted more than once.';
  end if;

  begin
    perform public.bluedeck_withdraw_job_application(
      team_application.id,
      crew_b,
      team_application.version
    );
  exception
    when insufficient_privilege then
      secondary_withdraw_rejected := true;
  end;
  if not secondary_withdraw_rejected then
    raise exception 'A secondary member withdrew the canonical application.';
  end if;

  select * into team_application
  from public.bluedeck_update_job_application_status(
    team_application.id,
    owner_user,
    'reviewing',
    team_application.version
  );
  select * into team_application
  from public.bluedeck_update_job_application_status(
    team_application.id,
    owner_user,
    'rejected',
    team_application.version
  );

  if exists (
    select 1
    from public.job_application_team_members
    where application_id = team_application.id
      and expires_at > team_application.status_changed_at + interval '30 days'
  )
  then
    raise exception 'Team member snapshot retention was not shortened.';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', crew_b::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'sub', crew_b)::text,
    true
  );
  -- Submit-first half of the media race: once the snapshot commits its logical
  -- write boundary, the same authenticated owner path is reported as locked.
  if not public.bluedeck_job_application_media_path_locked(
    crew_b::text || '/bravo-avatar.jpg'
  ) then
    raise exception 'A secondary member media snapshot path was not locked.';
  end if;

  -- A retained secondary snapshot must not block account erasure. The live
  -- profile reference is nulled, while the immutable historical UUID remains.
  delete from auth.users where id = crew_b;
  if not exists (
    select 1
    from public.job_application_team_members as member
    where member.application_id = team_application.id
      and member.member_user_id = crew_b
      and member.crew_profile_id is null
  )
  or exists (
    select 1
    from public.crew_team_relationships as relationship
    where crew_b in (
      relationship.requester_user_id,
      relationship.recipient_user_id
    )
  )
  then
    raise exception 'Snapshot retention blocked erasure or left a relationship orphan.';
  end if;

  update public.job_application_team_members
  set expires_at = captured_at
  where application_id = team_application.id;

  perform private.bluedeck_purge_expired_job_application_team_members();
  if exists (
    select 1
    from public.job_application_team_members
    where application_id = team_application.id
      and (
        purged_at is null
        or candidate_snapshot <> '{}'::jsonb
        or media_snapshot <> '{}'::jsonb
      )
  )
  then
    raise exception 'Expired Team/Couple snapshots were not purged.';
  end if;

  -- The accepted-but-unavailable A -> C row was deliberately excluded from
  -- A's old application and remains independently removable.
  perform public.bluedeck_remove_team_couple(
    crew_a,
    relationship_ac_pending,
    'remove',
    2
  );
end;
$test$;

rollback;
