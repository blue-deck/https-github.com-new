-- Application-time candidate data and media references must remain immutable,
-- expire predictably and never reopen access to a later profile revision.

begin;

do $test$
declare
  publisher_id uuid := gen_random_uuid();
  applicant_id uuid := gen_random_uuid();
  reviewer_id uuid := gen_random_uuid();
  yacht_id uuid := gen_random_uuid();
  fixture_profile_id uuid := gen_random_uuid();
  gallery_id uuid := gen_random_uuid();
  access_id uuid;
  job_id uuid;
  application public.job_applications%rowtype;
  candidate_before jsonb;
  media_before jsonb;
  rejected_expiry timestamptz;
  reopened_expiry timestamptz;
  snapshot_captured_at timestamptz;
  bounded_candidate jsonb;
  bounded_media jsonb;
  old_avatar_path text := fixture_profile_id || '/profile-avatar.jpg';
  old_gallery_path text := fixture_profile_id || '/gallery-photo.jpg';
  expired_reopen_rejected boolean := false;
begin
  if has_table_privilege(
      'authenticated',
      'public.job_application_snapshots',
      'select'
    )
    or not has_table_privilege(
      'service_role',
      'public.job_application_snapshots',
      'select'
    )
    or has_function_privilege(
      'anon',
      'public.bluedeck_job_application_media_path_locked(text)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.bluedeck_job_application_media_path_locked(text)',
      'execute'
    )
  then
    raise exception 'Application snapshot grants are unsafe.';
  end if;

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values
    (
      publisher_id, 'authenticated', 'authenticated',
      'snapshot-publisher-' || publisher_id || '@example.invalid', '', now(),
      '{}'::jsonb, '{"role":"owner","full_name":"Snapshot Publisher"}'::jsonb,
      now(), now()
    ),
    (
      applicant_id, 'authenticated', 'authenticated',
      'snapshot-applicant-' || applicant_id || '@example.invalid', '', now(),
      '{}'::jsonb, '{"role":"crew","full_name":"Snapshot Applicant"}'::jsonb,
      now(), now()
    ),
    (
      reviewer_id, 'authenticated', 'authenticated',
      'snapshot-reviewer-' || reviewer_id || '@example.invalid', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    );

  insert into public.marketplace_entitlements (
    user_id, account_role, entitlement_source, posting_status
  )
  values
    (publisher_id, 'owner', 'self_service', 'enabled'),
    (applicant_id, 'crew', 'self_service', 'enabled');

  insert into public.yachts (id, name, model, flag, owner_id)
  values (yacht_id, 'Snapshot Test Yacht', 'Test 50', 'Malta', publisher_id);

  insert into public.employer_access (
    user_id, yacht_id, requested_role, status, request_note
  )
  values (
    publisher_id, yacht_id, 'owner', 'pending',
    'Immutable application snapshot test.'
  )
  returning id into access_id;

  update public.employer_access
  set status = 'verified',
      reviewed_by = reviewer_id,
      review_note = 'Verified for immutable snapshot testing.'
  where id = access_id;

  insert into public.crew_profiles (
    id, user_id, public_crew_id, full_name, email, current_position,
    profile_photo_url, bio, notes, status
  )
  values (
    fixture_profile_id,
    applicant_id,
    'SNAP-' || left(applicant_id::text, 8),
    'Original Applicant',
    'snapshot-applicant-' || applicant_id || '@example.invalid',
    'Deckhand',
    old_avatar_path,
    'Original professional summary.',
    'Original private notes.',
    'active'
  );

  insert into public.crew_portfolio_photos (
    id, crew_profile_id, title, image_url
  )
  values (gallery_id, fixture_profile_id, 'Original gallery photo', old_gallery_path);

  insert into public.job_posts (
    created_by, updated_by, title, position, department, employment_type,
    location, start_date, yacht_type, yacht_length, yacht_length_unit,
    summary, description, salary_min, salary_currency, salary_period, status
  )
  values (
    publisher_id, publisher_id, 'Snapshot Test Deckhand', 'Deckhand', 'Deck',
    'seasonal', 'Athens, Greece', current_date + 30, 'motor_yacht', 50, 'm',
    'A complete immutable application snapshot test listing.',
    'This complete description verifies immutable candidate data, media references, lifecycle retention and final purge behavior.',
    5000, 'EUR', 'month', 'published'
  )
  returning id into job_id;

  select *
  into application
  from public.bluedeck_submit_job_application(
    job_id,
    applicant_id,
    'Snapshot the candidate at this exact submission revision.'
  );

  select
    snapshot.candidate_snapshot,
    snapshot.media_snapshot,
    snapshot.captured_at
  into candidate_before, media_before, snapshot_captured_at
  from public.job_application_snapshots as snapshot
  where snapshot.application_id = application.id;

  if candidate_before -> 'profile' ->> 'full_name' <> 'provided'
    or media_before ->> 'avatar_source' <> old_avatar_path
    or media_before -> 'gallery' -> 0 ->> 'image_url' <> old_gallery_path
    or candidate_before::text like '%Original private notes%'
    or candidate_before::text like '%snapshot-applicant-%@example.invalid%'
  then
    raise exception 'Application-time candidate/media capture is incomplete.';
  end if;

  update public.crew_profiles
  set full_name = 'Later Applicant Revision',
      bio = 'Later professional summary.',
      profile_photo_url = fixture_profile_id || '/later-avatar.jpg'
  where id = fixture_profile_id;
  update public.crew_portfolio_photos
  set image_url = fixture_profile_id || '/later-gallery.jpg'
  where id = gallery_id;

  if exists (
    select 1
    from public.job_application_snapshots as snapshot
    where snapshot.application_id = application.id
      and (
        snapshot.candidate_snapshot is distinct from candidate_before
        or snapshot.media_snapshot is distinct from media_before
      )
  ) then
    raise exception 'Later profile changes mutated an application snapshot.';
  end if;

  -- Emulate an oversized row created before the bounded-career rollout. The
  -- surrounding transaction restores these constraints on rollback; current
  -- writes remain covered by the dedicated bounded-career smoke test.
  alter table public.crew_profiles
    drop constraint crew_profiles_bounded_text_check;
  alter table public.crew_profiles
    drop constraint crew_profiles_bounded_collections_check;
  alter table public.crew_portfolio_photos
    drop constraint crew_portfolio_photos_bounded_payload_check;

  update public.crew_profiles
  set bio = repeat('b', 2000000),
      profile_photo_url = fixture_profile_id || '/' || repeat('a', 300000),
      personal_skills = (
        select array_agg(repeat('s', 10000))
        from generate_series(1, 200)
      ),
      personal_characteristics = (
        select array_agg(repeat('c', 10000))
        from generate_series(1, 200)
      ),
      work_preferences = (
        select array_agg(repeat('w', 10000))
        from generate_series(1, 200)
      ),
      languages = jsonb_build_array(
        jsonb_build_object(
          'name', repeat('n', 10000),
          'level', repeat('l', 10000),
          'private', repeat('p', 100000)
        )
      )
  where id = fixture_profile_id;
  update public.crew_portfolio_photos
  set image_url = fixture_profile_id || '/' || repeat('g', 300000)
  where id = gallery_id;

  select
    private.bluedeck_job_application_candidate_snapshot(application),
    private.bluedeck_job_application_media_snapshot(application)
  into bounded_candidate, bounded_media;

  if octet_length(bounded_candidate::text) > 100000
    or octet_length(bounded_media::text) > 10000
    or bounded_media ->> 'avatar_source' <> ''
    or jsonb_array_length(bounded_media -> 'gallery') <> 0
    or jsonb_array_length(bounded_candidate -> 'profile' -> 'personal_skills') > 30
    or length(
      bounded_candidate -> 'profile' -> 'personal_skills' ->> 0
    ) > 120
    or bounded_candidate::text like '%"private"%'
  then
    raise exception 'Oversized legacy profile data was not safely bounded.';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', publisher_id::text, true);
  if public.bluedeck_job_application_media_path_locked(old_avatar_path) then
    raise exception 'Application media lock leaked across crew tenants.';
  end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  if not public.bluedeck_job_application_media_path_locked(old_avatar_path)
    or not public.bluedeck_job_application_media_path_locked(old_gallery_path)
    or public.bluedeck_job_application_media_path_locked(
      fixture_profile_id || '/later-avatar.jpg'
    )
  then
    raise exception 'Snapshot media path locking failed.';
  end if;

  select *
  into application
  from public.bluedeck_update_job_application_status(
    application.id, publisher_id, 'rejected', application.version
  );
  select expires_at into rejected_expiry
  from public.job_application_snapshots
  where application_id = application.id;

  select *
  into application
  from public.bluedeck_update_job_application_status(
    application.id, publisher_id, 'reviewing', application.version
  );
  select expires_at into reopened_expiry
  from public.job_application_snapshots
  where application_id = application.id;

  if reopened_expiry <= rejected_expiry
    or reopened_expiry > snapshot_captured_at + interval '1 year'
  then
    raise exception 'Rejected application reopen retention is invalid.';
  end if;

  update public.job_application_snapshots
  set expires_at = greatest(snapshot_captured_at, statement_timestamp())
  where application_id = application.id;
  perform private.bluedeck_purge_expired_job_application_snapshots();

  if not exists (
    select 1
    from public.job_application_snapshots
    where application_id = application.id
      and purged_at is not null
      and candidate_snapshot = '{}'::jsonb
      and media_snapshot = '{}'::jsonb
  )
    or public.bluedeck_job_application_media_path_locked(old_avatar_path)
  then
    raise exception 'Expired application snapshot purge failed.';
  end if;

  update public.job_applications
  set status = 'rejected',
      updated_by = publisher_id
  where id = application.id;
  begin
    update public.job_applications
    set status = 'reviewing',
        updated_by = publisher_id
    where id = application.id;
  exception
    when check_violation then
      expired_reopen_rejected := true;
  end;
  if not expired_reopen_rejected then
    raise exception 'A purged rejected application was reopened.';
  end if;
end;
$test$;

rollback;
