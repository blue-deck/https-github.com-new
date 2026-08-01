begin;

do $test$
declare
  owner_id uuid := gen_random_uuid();
  crew_user_id uuid := gen_random_uuid();
  replacement_user_id uuid := gen_random_uuid();
  active_rls_user_id uuid := gen_random_uuid();
  unconfirmed_user_id uuid := gen_random_uuid();
  deleted_user_id uuid := gen_random_uuid();
  owner_session_id uuid := gen_random_uuid();
  crew_session_id uuid := gen_random_uuid();
  replacement_session_id uuid := gen_random_uuid();
  active_rls_session_id uuid := gen_random_uuid();
  unconfirmed_session_id uuid := gen_random_uuid();
  deleted_session_id uuid := gen_random_uuid();
  yacht_id uuid := gen_random_uuid();
  owner_profile_id uuid := gen_random_uuid();
  crew_profile_id uuid := gen_random_uuid();
  unlinked_profile_id uuid := gen_random_uuid();
  active_rls_profile_id uuid := gen_random_uuid();
  unconfirmed_profile_id uuid := gen_random_uuid();
  deleted_profile_id uuid := gen_random_uuid();
  active_rls_object_id uuid := gen_random_uuid();
  unconfirmed_object_id uuid := gen_random_uuid();
  deleted_object_id uuid := gen_random_uuid();
  membership_id uuid := gen_random_uuid();
  reused_email text := 'authority-reuse-' || gen_random_uuid() || '@example.invalid';
  unlinked_email text := 'authority-unlinked-' || gen_random_uuid() || '@example.invalid';
  rejected boolean := false;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (
      owner_id, 'authenticated', 'authenticated',
      'authority-owner-' || owner_id || '@example.invalid', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      crew_user_id, 'authenticated', 'authenticated', reused_email, '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      active_rls_user_id, 'authenticated', 'authenticated',
      'authority-active-' || active_rls_user_id || '@example.invalid', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      unconfirmed_user_id, 'authenticated', 'authenticated',
      'authority-unconfirmed-' || unconfirmed_user_id || '@example.invalid', '', null,
      '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      deleted_user_id, 'authenticated', 'authenticated',
      'authority-deleted-' || deleted_user_id || '@example.invalid', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    );

  update auth.users
  set deleted_at = statement_timestamp()
  where id = deleted_user_id;

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values
    (owner_session_id, owner_id, now(), now()),
    (crew_session_id, crew_user_id, now(), now()),
    (active_rls_session_id, active_rls_user_id, now(), now()),
    (unconfirmed_session_id, unconfirmed_user_id, now(), now()),
    (deleted_session_id, deleted_user_id, now(), now());

  insert into public.marketplace_entitlements (
    user_id, account_role, entitlement_source, posting_status
  ) values
    (active_rls_user_id, 'crew', 'self_service', 'enabled'),
    (unconfirmed_user_id, 'crew', 'self_service', 'enabled'),
    (deleted_user_id, 'crew', 'self_service', 'enabled');

  insert into public.crew_profiles (
    id, user_id, full_name, email, status
  ) values
    (
      owner_profile_id, owner_id, 'Authority Owner',
      'authority-owner-' || owner_id || '@example.invalid', 'active'
    ),
    (
      crew_profile_id, crew_user_id, 'Authority Crew', reused_email, 'active'
    ),
    (
      unlinked_profile_id, null, 'Unlinked Legacy', unlinked_email, 'active'
    ),
    (
      active_rls_profile_id, active_rls_user_id, 'Active RLS Account',
      'authority-active-' || active_rls_user_id || '@example.invalid', 'active'
    ),
    (
      unconfirmed_profile_id, unconfirmed_user_id, 'Unconfirmed RLS Account',
      'authority-unconfirmed-' || unconfirmed_user_id || '@example.invalid', 'active'
    ),
    (
      deleted_profile_id, deleted_user_id, 'Deleted RLS Account',
      'authority-deleted-' || deleted_user_id || '@example.invalid', 'active'
    );

  insert into storage.objects (
    id,
    bucket_id,
    name,
    owner,
    owner_id,
    metadata
  ) values
    (
      active_rls_object_id,
      'crew-portfolio',
      active_rls_profile_id::text || '/authority-smoke.jpg',
      active_rls_user_id,
      active_rls_user_id::text,
      '{"mimetype":"image/jpeg","size":1}'::jsonb
    ),
    (
      unconfirmed_object_id,
      'crew-portfolio',
      unconfirmed_profile_id::text || '/authority-smoke.jpg',
      unconfirmed_user_id,
      unconfirmed_user_id::text,
      '{"mimetype":"image/jpeg","size":1}'::jsonb
    ),
    (
      deleted_object_id,
      'crew-portfolio',
      deleted_profile_id::text || '/authority-smoke.jpg',
      deleted_user_id,
      deleted_user_id::text,
      '{"mimetype":"image/jpeg","size":1}'::jsonb
    );

  insert into public.yachts (id, name, model, flag, owner_id)
  values (yacht_id, 'Authority Yacht', 'Test', 'Malta', owner_id);

  insert into public.yacht_crew_memberships (
    id, yacht_id, crew_profile_id, invited_email,
    position, department, status
  ) values (
    membership_id, yacht_id, crew_profile_id, reused_email,
    'Deckhand', 'Deck', 'active'
  );

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', crew_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', crew_user_id,
      'role', 'authenticated',
      'session_id', crew_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );

  if not private.bluedeck_is_active_account()
    or not private.bluedeck_is_own_crew_profile(crew_profile_id)
    or not private.bluedeck_is_own_membership(membership_id)
    or not private.bluedeck_is_active_yacht_member(yacht_id)
    or not private.bluedeck_owns_crew_profile_storage_path(
      crew_profile_id::text || '/document.pdf'
    )
  then
    raise exception 'Active immutable account authority was not recognized.';
  end if;

  update auth.users
  set banned_until = statement_timestamp() + interval '1 day'
  where id = crew_user_id;

  if private.bluedeck_is_active_account()
    or private.bluedeck_is_own_crew_profile(crew_profile_id)
    or private.bluedeck_is_active_yacht_member(yacht_id)
    or exists (
      select 1
      from public.yacht_crew_memberships
      where id = membership_id
        and lower(btrim(coalesce(status, ''))) = 'active'
    )
  then
    raise exception 'Banned account retained direct yacht authority.';
  end if;

  update auth.users
  set banned_until = null
  where id = crew_user_id;

  if not private.bluedeck_is_active_account()
    or private.bluedeck_is_active_yacht_member(yacht_id)
  then
    raise exception 'Membership suspension was silently reversed after unban.';
  end if;

  update public.yacht_crew_memberships
  set status = 'active'
  where id = membership_id;

  delete from auth.users where id = crew_user_id;

  if exists (select 1 from auth.users where id = crew_user_id)
    or exists (
      select 1
      from public.yacht_crew_memberships
      where id = membership_id
        and lower(btrim(coalesce(status, ''))) = 'active'
    )
  then
    raise exception 'Account deletion retained an active yacht membership.';
  end if;

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    replacement_user_id, 'authenticated', 'authenticated', reused_email, '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (replacement_session_id, replacement_user_id, now(), now());

  perform set_config('request.jwt.claim.sub', replacement_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', replacement_user_id,
      'role', 'authenticated',
      'session_id', replacement_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );

  if private.bluedeck_is_own_crew_profile(crew_profile_id)
    or private.bluedeck_is_own_membership(membership_id)
    or private.bluedeck_is_active_yacht_member(yacht_id)
    or private.bluedeck_owns_crew_profile_storage_path(
      crew_profile_id::text || '/document.pdf'
    )
  then
    raise exception 'Replacement email account inherited immutable authority.';
  end if;

  rejected := false;
  begin
    update public.yacht_crew_memberships
    set status = 'active'
    where id = membership_id;
  exception
    when check_violation then rejected := true;
  end;
  if not rejected and exists (
    select 1
    from public.yacht_crew_memberships
    where id = membership_id
      and lower(btrim(coalesce(status, ''))) = 'active'
  ) then
    raise exception 'Deleted-account membership was reactivated.';
  end if;

  rejected := false;
  begin
    insert into public.yacht_crew_memberships (
      yacht_id, crew_profile_id, invited_email,
      position, department, status
    ) values (
      yacht_id, unlinked_profile_id, unlinked_email,
      'Deckhand', 'Deck', 'active'
    );
  exception
    when check_violation then rejected := true;
  end;
  if not rejected then
    raise exception 'A new active membership accepted an unlinked profile.';
  end if;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', owner_id,
      'role', 'authenticated',
      'session_id', owner_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );
  if not private.bluedeck_is_yacht_owner(yacht_id) then
    raise exception 'Active yacht owner authority was not recognized.';
  end if;
  update auth.users
  set banned_until = statement_timestamp() + interval '1 day'
  where id = owner_id;
  if private.bluedeck_is_yacht_owner(yacht_id) then
    raise exception 'Banned yacht owner retained direct authority.';
  end if;

  if has_table_privilege(
    'authenticated',
    'private.membership_authority_quarantine',
    'SELECT'
  ) then
    raise exception 'Private membership quarantine audit is client-readable.';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id = 'crew-portfolio'
      and public
  ) or exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public crew media read'
  ) then
    raise exception 'Legacy public crew portfolio access survived authority hardening.';
  end if;

  perform set_config(
    'bluedeck.test_replacement_user_id',
    replacement_user_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_legacy_profile_id',
    crew_profile_id::text,
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    replacement_user_id::text,
    true
  );

  perform set_config(
    'bluedeck.test_active_rls_user_id',
    active_rls_user_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_active_rls_session_id',
    active_rls_session_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_unconfirmed_user_id',
    unconfirmed_user_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_unconfirmed_session_id',
    unconfirmed_session_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_deleted_user_id',
    deleted_user_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_deleted_session_id',
    deleted_session_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_active_rls_profile_id',
    active_rls_profile_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_unconfirmed_profile_id',
    unconfirmed_profile_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_deleted_profile_id',
    deleted_profile_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_active_rls_object_id',
    active_rls_object_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_unconfirmed_object_id',
    unconfirmed_object_id::text,
    true
  );
  perform set_config(
    'bluedeck.test_deleted_object_id',
    deleted_object_id::text,
    true
  );

  if has_function_privilege(
    'anon',
    'private.bluedeck_is_active_account()',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'private.bluedeck_is_active_account()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'private.bluedeck_has_live_authenticated_session()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'private.bluedeck_guard_active_membership_identity()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'private.bluedeck_suspend_memberships_on_account_loss()',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'private.bluedeck_suspend_memberships_on_profile_identity_change()',
    'EXECUTE'
  ) then
    raise exception 'Active-account helper or trigger function ACLs are unsafe.';
  end if;
end;
$test$;

set local role authenticated;

do $test$
begin
  if exists (
    select 1
    from public.crew_profiles
    where id = current_setting('bluedeck.test_legacy_profile_id')::uuid
  ) then
    raise exception 'RLS exposed a recycled-email legacy profile.';
  end if;
end;
$test$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck.test_active_rls_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck.test_active_rls_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck.test_active_rls_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);

do $test$
begin
  if not private.bluedeck_is_active_account()
    or (
      select count(*)
      from public.crew_profiles
      where id = current_setting('bluedeck.test_active_rls_profile_id')::uuid
    ) <> 1
    or (
      select count(*)
      from storage.objects
      where id = current_setting('bluedeck.test_active_rls_object_id')::uuid
    ) <> 1
  then
    raise exception 'Confirmed active account failed real RLS/storage access.';
  end if;
end;
$test$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck.test_active_rls_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck.test_active_rls_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'recovery'))
  )::text,
  true
);

do $test$
begin
  if private.bluedeck_is_active_account() then
    raise exception 'Recovery-only JWT gained ordinary application authority.';
  end if;
end;
$test$;

reset role;

delete from auth.sessions
where id = current_setting('bluedeck.test_active_rls_session_id')::uuid;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck.test_active_rls_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck.test_active_rls_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);

do $test$
begin
  if private.bluedeck_is_active_account()
    or exists (
      select 1
      from public.crew_profiles
      where id = current_setting('bluedeck.test_active_rls_profile_id')::uuid
    )
  then
    raise exception 'Revoked Auth session retained residual JWT authority.';
  end if;
end;
$test$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck.test_unconfirmed_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck.test_unconfirmed_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck.test_unconfirmed_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);

do $test$
begin
  if private.bluedeck_is_active_account()
    or exists (
      select 1
      from public.crew_profiles
      where id = current_setting('bluedeck.test_unconfirmed_profile_id')::uuid
    )
    or exists (
      select 1
      from storage.objects
      where id = current_setting('bluedeck.test_unconfirmed_object_id')::uuid
    )
  then
    raise exception 'Unconfirmed account passed real RLS/storage access.';
  end if;
end;
$test$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('bluedeck.test_deleted_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('bluedeck.test_deleted_user_id'),
    'role', 'authenticated',
    'session_id', current_setting('bluedeck.test_deleted_session_id'),
    'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
  )::text,
  true
);

do $test$
begin
  if private.bluedeck_is_active_account()
    or exists (
      select 1
      from public.crew_profiles
      where id = current_setting('bluedeck.test_deleted_profile_id')::uuid
    )
    or exists (
      select 1
      from storage.objects
      where id = current_setting('bluedeck.test_deleted_object_id')::uuid
    )
  then
    raise exception 'Deleted account passed real RLS/storage access.';
  end if;
end;
$test$;

reset role;

rollback;
