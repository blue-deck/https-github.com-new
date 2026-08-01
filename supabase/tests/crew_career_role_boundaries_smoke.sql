-- Transactional smoke test for Crew/Captain-only career data policies.
-- Every fixture and storage object is rolled back at the end.

begin;

select set_config(
  'bluedeck_smoke.crew_user_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.captain_user_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.owner_user_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.management_user_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.crew_session_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.captain_session_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.owner_session_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.management_session_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.crew_profile_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.captain_profile_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.owner_profile_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.management_profile_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.yacht_id',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck_smoke.management_membership_id',
  gen_random_uuid()::text,
  true
);

do $setup$
declare
  crew_user_id uuid := current_setting('bluedeck_smoke.crew_user_id')::uuid;
  captain_user_id uuid := current_setting('bluedeck_smoke.captain_user_id')::uuid;
  owner_user_id uuid := current_setting('bluedeck_smoke.owner_user_id')::uuid;
  management_user_id uuid := current_setting('bluedeck_smoke.management_user_id')::uuid;
  crew_session_id uuid := current_setting('bluedeck_smoke.crew_session_id')::uuid;
  captain_session_id uuid := current_setting('bluedeck_smoke.captain_session_id')::uuid;
  owner_session_id uuid := current_setting('bluedeck_smoke.owner_session_id')::uuid;
  management_session_id uuid := current_setting('bluedeck_smoke.management_session_id')::uuid;
begin
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
      crew_user_id,
      'authenticated',
      'authenticated',
      'career-crew-' || crew_user_id || '@example.invalid',
      '',
      now(),
      jsonb_build_object('role', 'crew'),
      jsonb_build_object('full_name', 'Career Crew'),
      now(),
      now()
    ),
    (
      captain_user_id,
      'authenticated',
      'authenticated',
      'career-captain-' || captain_user_id || '@example.invalid',
      '',
      now(),
      jsonb_build_object('role', 'captain'),
      jsonb_build_object('full_name', 'Career Captain'),
      now(),
      now()
    ),
    (
      owner_user_id,
      'authenticated',
      'authenticated',
      'career-owner-' || owner_user_id || '@example.invalid',
      '',
      now(),
      jsonb_build_object('role', 'owner'),
      jsonb_build_object('full_name', 'Career Owner'),
      now(),
      now()
    ),
    (
      management_user_id,
      'authenticated',
      'authenticated',
      'career-management-' || management_user_id || '@example.invalid',
      '',
      now(),
      jsonb_build_object('role', 'management'),
      jsonb_build_object('full_name', 'Career Management'),
      now(),
      now()
    );

  insert into private.bluedeck_account_provisioning (
    user_id,
    state,
    failure_code
  ) values
    (crew_user_id, 'ready', ''),
    (captain_user_id, 'ready', ''),
    (owner_user_id, 'ready', ''),
    (management_user_id, 'ready', '');

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values
    (crew_session_id, crew_user_id, now(), now()),
    (captain_session_id, captain_user_id, now(), now()),
    (owner_session_id, owner_user_id, now(), now()),
    (management_session_id, management_user_id, now(), now());

  insert into public.profiles (id, email, full_name, role)
  values
    (
      crew_user_id,
      'career-crew-' || crew_user_id || '@example.invalid',
      'Career Crew',
      'crew'
    ),
    (
      captain_user_id,
      'career-captain-' || captain_user_id || '@example.invalid',
      'Career Captain',
      'captain'
    ),
    (
      owner_user_id,
      'career-owner-' || owner_user_id || '@example.invalid',
      'Career Owner',
      'owner'
    ),
    (
      management_user_id,
      'career-management-' || management_user_id || '@example.invalid',
      'Career Management',
      'management'
    );

  insert into public.marketplace_entitlements (
    user_id,
    account_role,
    plan_code,
    entitlement_source,
    posting_status
  )
  values
    (crew_user_id, 'crew', 'free', 'self_service', 'enabled'),
    (captain_user_id, 'captain', 'free', 'self_service', 'enabled'),
    (owner_user_id, 'owner', 'free', 'self_service', 'enabled'),
    (
      management_user_id,
      'management',
      'free',
      'self_service',
      'enabled'
    );
end;
$setup$;

create function pg_temp.assert_profile_insert_denied(
  actor_id uuid,
  profile_id uuid,
  actor_label text
)
returns void
language plpgsql
as $function$
declare
  rejected boolean := false;
begin
  if auth.uid() is distinct from actor_id then
    raise exception '% smoke actor was not authenticated correctly.', actor_label;
  end if;

  if private.bluedeck_has_crew_career_access() then
    raise exception '% unexpectedly received crew career access.', actor_label;
  end if;

  begin
    insert into public.crew_profiles (
      id,
      user_id,
      public_crew_id,
      full_name,
      email,
      status
    )
    values (
      profile_id,
      actor_id,
      'DENIED-' || left(profile_id::text, 8),
      actor_label,
      'denied-' || actor_id || '@example.invalid',
      'active'
    );
  exception
    when insufficient_privilege then
      rejected := true;
  end;

  if not rejected then
    raise exception '% created a crew profile without career access.', actor_label;
  end if;

  if exists (
    select 1
    from public.crew_profiles as profile
    where profile.id = profile_id
  ) then
    raise exception '% denied crew profile insert persisted a row.', actor_label;
  end if;
end;
$function$;

create function pg_temp.assert_career_actor_allowed(
  actor_id uuid,
  profile_id uuid,
  actor_label text
)
returns void
language plpgsql
as $function$
declare
  portfolio_object_id uuid := gen_random_uuid();
  document_object_id uuid := gen_random_uuid();
  affected integer;
begin
  if auth.uid() is distinct from actor_id then
    raise exception '% smoke actor was not authenticated correctly.', actor_label;
  end if;

  if not private.bluedeck_has_crew_career_access() then
    raise exception '% did not receive crew career access.', actor_label;
  end if;

  insert into public.crew_profiles (
    id,
    user_id,
    public_crew_id,
    full_name,
    email,
    status
  )
  values (
    profile_id,
    actor_id,
    upper(actor_label) || '-' || left(profile_id::text, 8),
    actor_label,
    lower(actor_label) || '-' || actor_id || '@example.invalid',
    'active'
  );

  update public.crew_profiles
  set bio = actor_label || ' career profile'
  where id = profile_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception '% could not update its crew profile.', actor_label;
  end if;

  -- Related career rows are application-owned after the bounded-career
  -- migration. Crew/Captain browsers retain self-service reads, but every
  -- mutation must pass through the authenticated API's service-role path.
  if has_table_privilege('authenticated', 'public.crew_documents', 'INSERT')
    or has_table_privilege('authenticated', 'public.crew_documents', 'UPDATE')
    or has_table_privilege('authenticated', 'public.crew_documents', 'DELETE')
    or has_table_privilege('authenticated', 'public.crew_experiences', 'INSERT')
    or has_table_privilege('authenticated', 'public.crew_experiences', 'UPDATE')
    or has_table_privilege('authenticated', 'public.crew_experiences', 'DELETE')
    or has_table_privilege('authenticated', 'public.crew_references', 'INSERT')
    or has_table_privilege('authenticated', 'public.crew_references', 'UPDATE')
    or has_table_privilege('authenticated', 'public.crew_references', 'DELETE')
    or has_table_privilege('authenticated', 'public.crew_portfolio_photos', 'INSERT')
    or has_table_privilege('authenticated', 'public.crew_portfolio_photos', 'UPDATE')
    or has_table_privilege('authenticated', 'public.crew_portfolio_photos', 'DELETE')
  then
    raise exception '% retained a direct career-child mutation privilege.', actor_label;
  end if;

  insert into storage.objects (id, bucket_id, name, owner, metadata)
  values (
    portfolio_object_id,
    'crew-portfolio',
    profile_id::text || '/career-smoke.jpg',
    actor_id,
    '{"size":0}'::jsonb
  );
  insert into storage.objects (id, bucket_id, name, owner, metadata)
  values (
    document_object_id,
    'crew-documents',
    profile_id::text || '/career-smoke.pdf',
    actor_id,
    '{"size":0}'::jsonb
  );

  -- Portfolio bytes are immutable once uploaded; documents retain their
  -- owner-scoped metadata update path.
  update storage.objects
  set metadata = metadata || '{"verified":true}'::jsonb
  where id = document_object_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception '% could not update its document media.', actor_label;
  end if;

  update storage.objects
  set metadata = metadata || '{"overwritten":true}'::jsonb
  where id = portfolio_object_id;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception '% overwrote immutable portfolio media.', actor_label;
  end if;
end;
$function$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_smoke.owner_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_smoke.owner_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_smoke.owner_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);
select pg_temp.assert_profile_insert_denied(
  current_setting('bluedeck_smoke.owner_user_id')::uuid,
  current_setting('bluedeck_smoke.owner_profile_id')::uuid,
  'Owner'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_smoke.management_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_smoke.management_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_smoke.management_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);
select pg_temp.assert_profile_insert_denied(
  current_setting('bluedeck_smoke.management_user_id')::uuid,
  current_setting('bluedeck_smoke.management_profile_id')::uuid,
  'Management'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_smoke.crew_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_smoke.crew_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_smoke.crew_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);
select pg_temp.assert_career_actor_allowed(
  current_setting('bluedeck_smoke.crew_user_id')::uuid,
  current_setting('bluedeck_smoke.crew_profile_id')::uuid,
  'Crew'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_smoke.captain_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_smoke.captain_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_smoke.captain_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);
select pg_temp.assert_career_actor_allowed(
  current_setting('bluedeck_smoke.captain_user_id')::uuid,
  current_setting('bluedeck_smoke.captain_profile_id')::uuid,
  'Captain'
);
reset role;

do $seed_noncareer$
declare
  owner_user_id uuid := current_setting('bluedeck_smoke.owner_user_id')::uuid;
  management_user_id uuid := current_setting('bluedeck_smoke.management_user_id')::uuid;
  owner_profile_id uuid := current_setting('bluedeck_smoke.owner_profile_id')::uuid;
  management_profile_id uuid := current_setting('bluedeck_smoke.management_profile_id')::uuid;
  yacht_id uuid := current_setting('bluedeck_smoke.yacht_id')::uuid;
  membership_id uuid := current_setting(
    'bluedeck_smoke.management_membership_id'
  )::uuid;
begin
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
      owner_profile_id,
      owner_user_id,
      'OWNER-' || left(owner_profile_id::text, 8),
      'Preserved Owner Identity',
      'career-owner-' || owner_user_id || '@example.invalid',
      'Owner',
      'active'
    ),
    (
      management_profile_id,
      management_user_id,
      'MGMT-' || left(management_profile_id::text, 8),
      'Preserved Management Identity',
      'career-management-' || management_user_id || '@example.invalid',
      'Yacht Manager',
      'active'
    );

  insert into public.crew_documents (id, crew_profile_id, document_type)
  values
    (gen_random_uuid(), owner_profile_id, 'Owner private document'),
    (gen_random_uuid(), management_profile_id, 'Management private document');
  insert into public.crew_experiences (id, crew_profile_id, yacht_name)
  values
    (gen_random_uuid(), owner_profile_id, 'Owner private experience'),
    (gen_random_uuid(), management_profile_id, 'Management private experience');
  insert into public.crew_references (id, crew_profile_id, name)
  values
    (gen_random_uuid(), owner_profile_id, 'Owner private reference'),
    (gen_random_uuid(), management_profile_id, 'Management private reference');
  insert into public.crew_portfolio_photos (
    id,
    crew_profile_id,
    title,
    image_url
  )
  values
    (
      gen_random_uuid(),
      owner_profile_id,
      'Owner private photo',
      'https://example.invalid/owner-private.jpg'
    ),
    (
      gen_random_uuid(),
      management_profile_id,
      'Management private photo',
      'https://example.invalid/management-private.jpg'
    );

  insert into public.yachts (id, name, model, flag, owner_id)
  values (
    yacht_id,
    'Career Boundary Smoke Yacht',
    'Test 50',
    'Malta',
    owner_user_id
  );
  insert into public.yacht_crew_memberships (
    id,
    yacht_id,
    crew_profile_id,
    position,
    department,
    status
  )
  values (
    membership_id,
    yacht_id,
    management_profile_id,
    'Yacht Manager',
    'Management',
    'active'
  );
end;
$seed_noncareer$;

create function pg_temp.assert_noncareer_actor_denied(
  actor_id uuid,
  profile_id uuid,
  actor_label text,
  expected_membership_id uuid default null
)
returns void
language plpgsql
as $function$
declare
  inserted_id uuid;
  avatar_object_id uuid := gen_random_uuid();
  rejected_inserts integer := 0;
  affected integer;
begin
  if auth.uid() is distinct from actor_id then
    raise exception '% smoke actor was not authenticated correctly.', actor_label;
  end if;

  if private.bluedeck_has_crew_career_access() then
    raise exception '% unexpectedly received crew career access.', actor_label;
  end if;

  if (select count(*) from public.crew_profiles where id = profile_id) <> 1 then
    raise exception '% could not read its preserved internal profile.', actor_label;
  end if;

  if expected_membership_id is not null
    and (
      select count(*)
      from public.yacht_crew_memberships
      where id = expected_membership_id
        and crew_profile_id = profile_id
        and status = 'active'
    ) <> 1
  then
    raise exception '% lost its internal yacht membership access.', actor_label;
  end if;

  update public.crew_profiles
  set bio = 'This update must be filtered by career role policy.'
  where id = profile_id;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception '% updated its internal profile as a career CV.', actor_label;
  end if;

  if (select count(*) from public.crew_documents where crew_profile_id = profile_id) <> 0
    or (select count(*) from public.crew_experiences where crew_profile_id = profile_id) <> 0
    or (select count(*) from public.crew_references where crew_profile_id = profile_id) <> 0
    or (select count(*) from public.crew_portfolio_photos where crew_profile_id = profile_id) <> 0
  then
    raise exception '% could read crew career child records.', actor_label;
  end if;

  begin
    inserted_id := gen_random_uuid();
    insert into public.crew_documents (id, crew_profile_id, document_type)
    values (inserted_id, profile_id, actor_label || ' denied document');
  exception
    when insufficient_privilege then
      rejected_inserts := rejected_inserts + 1;
  end;
  begin
    inserted_id := gen_random_uuid();
    insert into public.crew_experiences (id, crew_profile_id, yacht_name)
    values (inserted_id, profile_id, actor_label || ' denied experience');
  exception
    when insufficient_privilege then
      rejected_inserts := rejected_inserts + 1;
  end;
  begin
    inserted_id := gen_random_uuid();
    insert into public.crew_references (id, crew_profile_id, name)
    values (inserted_id, profile_id, actor_label || ' denied reference');
  exception
    when insufficient_privilege then
      rejected_inserts := rejected_inserts + 1;
  end;
  begin
    inserted_id := gen_random_uuid();
    insert into public.crew_portfolio_photos (
      id,
      crew_profile_id,
      title,
      image_url
    )
    values (
      inserted_id,
      profile_id,
      actor_label || ' denied photo',
      'https://example.invalid/denied.jpg'
    );
  exception
    when insufficient_privilege then
      rejected_inserts := rejected_inserts + 1;
  end;

  if rejected_inserts <> 4 then
    raise exception '% inserted one or more crew career child records.', actor_label;
  end if;

  -- UPDATE and DELETE are covered by the same table-level revocation asserted
  -- for Crew/Captain above. The rejected INSERTs prove this actor cannot enter
  -- the application-owned mutation path either.

  begin
    insert into storage.objects (id, bucket_id, name, owner, metadata)
    values (
      gen_random_uuid(),
      'crew-portfolio',
      profile_id::text || '/career-denied.jpg',
      actor_id,
      '{"size":0}'::jsonb
    );
  exception
    when insufficient_privilege then
      rejected_inserts := rejected_inserts + 1;
  end;
  begin
    insert into storage.objects (id, bucket_id, name, owner, metadata)
    values (
      gen_random_uuid(),
      'crew-documents',
      profile_id::text || '/career-denied.pdf',
      actor_id,
      '{"size":0}'::jsonb
    );
  exception
    when insufficient_privilege then
      rejected_inserts := rejected_inserts + 1;
  end;

  if rejected_inserts <> 6 then
    raise exception '% inserted crew career media.', actor_label;
  end if;

  -- Dashboard avatars are account identity media, not career/CV media. Every
  -- active authenticated role keeps this exact self-owned upload path, while
  -- the bucket-wide immutable-object rule still forbids in-place overwrite.
  insert into storage.objects (id, bucket_id, name, owner, metadata)
  values (
    avatar_object_id,
    'crew-portfolio',
    actor_id::text || '/dashboard-smoke.jpg',
    actor_id,
    '{"size":0}'::jsonb
  );

  update storage.objects
  set metadata = metadata || '{"dashboard":true}'::jsonb
  where id = avatar_object_id;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception '% overwrote an immutable dashboard avatar.', actor_label;
  end if;

  -- storage.protect_delete intentionally forbids direct SQL deletion even
  -- when RLS permits it. The DELETE policy expression is verified below;
  -- production deletion continues through the Storage API.
end;
$function$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_smoke.owner_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_smoke.owner_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_smoke.owner_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);
select pg_temp.assert_noncareer_actor_denied(
  current_setting('bluedeck_smoke.owner_user_id')::uuid,
  current_setting('bluedeck_smoke.owner_profile_id')::uuid,
  'Owner',
  null
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck_smoke.management_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck_smoke.management_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck_smoke.management_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);
select pg_temp.assert_noncareer_actor_denied(
  current_setting('bluedeck_smoke.management_user_id')::uuid,
  current_setting('bluedeck_smoke.management_profile_id')::uuid,
  'Management',
  current_setting('bluedeck_smoke.management_membership_id')::uuid
);
reset role;

do $verify_preserved$
declare
  owner_profile_id uuid := current_setting('bluedeck_smoke.owner_profile_id')::uuid;
  management_profile_id uuid := current_setting('bluedeck_smoke.management_profile_id')::uuid;
  membership_id uuid := current_setting(
    'bluedeck_smoke.management_membership_id'
  )::uuid;
begin
  if not exists (
    select 1
    from public.crew_profiles as profile
    where profile.id = owner_profile_id
      and profile.full_name = 'Preserved Owner Identity'
      and profile.bio is null
  ) then
    raise exception 'Owner internal profile was changed or removed.';
  end if;

  if not exists (
    select 1
    from public.crew_profiles as profile
    where profile.id = management_profile_id
      and profile.full_name = 'Preserved Management Identity'
      and profile.bio is null
  ) then
    raise exception 'Management internal profile was changed or removed.';
  end if;

  if not exists (
    select 1
    from public.yacht_crew_memberships as membership
    where membership.id = membership_id
      and membership.crew_profile_id = management_profile_id
      and membership.status = 'active'
  ) then
    raise exception 'Management internal yacht membership was changed or removed.';
  end if;

  if (select count(*) from public.crew_documents where crew_profile_id in (
      owner_profile_id,
      management_profile_id
    )) <> 2
    or (select count(*) from public.crew_experiences where crew_profile_id in (
      owner_profile_id,
      management_profile_id
    )) <> 2
    or (select count(*) from public.crew_references where crew_profile_id in (
      owner_profile_id,
      management_profile_id
    )) <> 2
    or (select count(*) from public.crew_portfolio_photos where crew_profile_id in (
      owner_profile_id,
      management_profile_id
    )) <> 2
  then
    raise exception 'A denied career operation mutated existing records.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.policyname = 'Authenticated crew portfolio deletes'
      and policy.cmd = 'DELETE'
      and policy.qual like '%bluedeck_has_crew_career_access%'
      and policy.qual like '%dashboard-%%'
  ) then
    raise exception 'Dashboard avatar DELETE policy exception is missing.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'storage'
      and policy.tablename = 'objects'
      and policy.policyname = 'Crew document owner deletes'
      and policy.cmd = 'DELETE'
      and policy.qual like '%bluedeck_has_crew_career_access%'
  ) then
    raise exception 'Crew-document DELETE policy lacks career-role enforcement.';
  end if;
end;
$verify_preserved$;

rollback;
