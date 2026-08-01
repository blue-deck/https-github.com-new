begin;

do $test$
declare
  issuer_id uuid := gen_random_uuid();
  reviewer_id uuid := gen_random_uuid();
  victim_id uuid := gen_random_uuid();
  attacker_id uuid := gen_random_uuid();
  deletion_victim_id uuid := gen_random_uuid();
  replacement_id uuid := gen_random_uuid();
  preaccount_id uuid := gen_random_uuid();
  preaccount_replacement_id uuid := gen_random_uuid();
  attacker_session_id uuid := gen_random_uuid();
  replacement_session_id uuid := gen_random_uuid();
  preaccount_session_id uuid := gen_random_uuid();
  preaccount_replacement_session_id uuid := gen_random_uuid();
  fixture_yacht_id uuid := gen_random_uuid();
  victim_profile uuid := gen_random_uuid();
  attacker_profile uuid := gen_random_uuid();
  deletion_victim_profile uuid := gen_random_uuid();
  legacy_email_profile uuid := gen_random_uuid();
  poisoned_email_profile uuid := gen_random_uuid();
  access_id uuid;
  invitation jsonb;
  second_invitation jsonb;
  placeholder_invitation jsonb;
  acceptance jsonb;
  token text := gen_random_uuid()::text;
  second_token text := gen_random_uuid()::text;
  blocked_token text := gen_random_uuid()::text;
  deletion_token text := gen_random_uuid()::text;
  legacy_token text := gen_random_uuid()::text;
  reissue_token text := gen_random_uuid()::text;
  second_reissue_token text := gen_random_uuid()::text;
  poison_token text := gen_random_uuid()::text;
  preaccount_token text := gen_random_uuid()::text;
  deletion_invitation jsonb;
  reissued_invitation jsonb;
  second_reissued_invitation jsonb;
  legacy_email text := 'legacy-reissue-' || gen_random_uuid() || '@example.invalid';
  poisoned_email text := 'poisoned-' || gen_random_uuid() || '@example.invalid';
  preaccount_email text := 'preaccount-' || gen_random_uuid() || '@example.invalid';
  banned_issue_rejected boolean := false;
  legacy_insert_rejected boolean := false;
  poisoned_email_rejected boolean := false;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values
    (issuer_id, 'authenticated', 'authenticated', 'invite-issuer-' || issuer_id || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (reviewer_id, 'authenticated', 'authenticated', 'invite-reviewer-' || reviewer_id || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (victim_id, 'authenticated', 'authenticated', 'invite-victim-' || victim_id || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (attacker_id, 'authenticated', 'authenticated', 'invite-attacker-' || attacker_id || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (deletion_victim_id, 'authenticated', 'authenticated', 'invite-delete-' || deletion_victim_id || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.marketplace_entitlements (
    user_id, account_role, entitlement_source, posting_status
  )
  values
    (issuer_id, 'owner', 'self_service', 'enabled'),
    (victim_id, 'crew', 'self_service', 'enabled'),
    (attacker_id, 'crew', 'self_service', 'enabled'),
    (deletion_victim_id, 'crew', 'self_service', 'enabled');

  insert into private.bluedeck_account_provisioning (
    user_id, state, failure_code
  ) values (
    attacker_id, 'ready', ''
  );

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (attacker_session_id, attacker_id, now(), now());

  insert into public.yachts (id, name, model, flag, owner_id)
  values (fixture_yacht_id, 'Invitation Integrity Yacht', 'Test', 'Malta', issuer_id);

  insert into public.employer_access (
    user_id, yacht_id, requested_role, status, request_note
  )
  values (
    issuer_id, fixture_yacht_id, 'owner', 'pending',
    'Atomic invitation issuance smoke test.'
  )
  returning id into access_id;
  update public.employer_access
  set status = 'verified', reviewed_by = reviewer_id, review_note = 'Verified.'
  where id = access_id;

  insert into public.crew_profiles (
    id, user_id, full_name, email, current_position, notes, status
  )
  values
    (
      victim_profile,
      victim_id,
      'Invitation Victim',
      'invite-victim-' || victim_id || '@example.invalid',
      'Deckhand',
      '__BLUDECK_FIND_CREW__{"discoverable":true,"availabilityStatus":"Available","preferredLocations":[],"employmentTypes":[],"contactVisibility":"request_only"}',
      'active'
    ),
    (
      attacker_profile,
      attacker_id,
      'Invitation Attacker',
      'invite-attacker-profile-' || attacker_id || '@example.invalid',
      'Deckhand',
      '__BLUDECK_FIND_CREW__{"discoverable":false,"availabilityStatus":"Available","preferredLocations":[],"employmentTypes":[],"contactVisibility":"request_only"}',
      'active'
    ),
    (
      deletion_victim_profile,
      deletion_victim_id,
      'Invitation Deletion Victim',
      'invite-delete-' || deletion_victim_id || '@example.invalid',
      'Deckhand',
      '__BLUDECK_FIND_CREW__{"discoverable":false,"availabilityStatus":"Available","preferredLocations":[],"employmentTypes":[],"contactVisibility":"request_only"}',
      'active'
    );

  insert into public.crew_profiles (
    id, email, full_name, current_position, status
  ) values
    (
      legacy_email_profile,
      legacy_email,
      'Legacy Email Placeholder',
      'Deckhand',
      'active'
    ),
    (
      poisoned_email_profile,
      poisoned_email,
      'Untrusted Email Profile',
      'Deckhand',
      'active'
    );

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );
  select public.bluedeck_issue_crew_invitation(
    issuer_id,
    fixture_yacht_id,
    null,
    'invite-victim-' || victim_id || '@example.invalid',
    'Deckhand',
    'Deck',
    token,
    'https://www.bluedeck.app/invitations/' || token
  ) into invitation;

  if invitation ->> 'crew_profile_id' <> victim_profile::text
    or not exists (
      select 1
      from public.crew_invitations as row
      inner join private.crew_invitation_targets as target
        on target.invitation_id = row.id
      where row.id = (invitation ->> 'id')::uuid
        and row.identity_mode = 'email'
        and target.target_user_id = victim_id
        and row.crew_profile_id = victim_profile
    )
  then
    raise exception 'Email invitation resolved through mutable profile email.';
  end if;

  -- Repoint the victim's mutable profile email at the attacker's immutable
  -- Auth email after issuance. The private UUID target must remain unchanged.
  update public.crew_profiles
  set email = 'invite-attacker-' || attacker_id || '@example.invalid'
  where id = victim_profile;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'crew_invitations'
      and column_name = 'target_user_id'
  ) or has_table_privilege(
    'authenticated',
    'private.crew_invitation_targets',
    'SELECT'
  ) or has_table_privilege(
    'authenticated',
    'private.crew_invitation_placeholders',
    'SELECT'
  ) then
    raise exception 'Canonical invitation target identity is exposed publicly.';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', attacker_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', attacker_id,
      'role', 'authenticated',
      'session_id', attacker_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );
  if not private.bluedeck_is_active_account() then
    raise exception 'Attacker fixture did not have a ready password session.';
  end if;
  if private.bluedeck_is_own_invitation((invitation ->> 'id')::uuid) then
    raise exception 'Attacker can read a victim email invitation.';
  end if;
  select public.bluedeck_accept_crew_invitation(
    token, attacker_id, 'Invitation Attacker'
  ) into acceptance;
  if acceptance ->> 'reason' <> 'forbidden' then
    raise exception 'Attacker accepted a victim email invitation.';
  end if;

  select public.bluedeck_accept_crew_invitation(
    token, victim_id, 'Invitation Victim'
  ) into acceptance;
  if acceptance ->> 'ok' <> 'true'
    or not exists (
      select 1
      from public.yacht_crew_memberships as membership
      where membership.yacht_id = fixture_yacht_id
        and membership.crew_profile_id = victim_profile
        and membership.status = 'active'
    )
  then
    raise exception 'Canonical email owner could not accept invitation.';
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );
  begin
    select public.bluedeck_issue_crew_invitation(
      issuer_id,
      fixture_yacht_id,
      null,
      poisoned_email,
      'Deckhand',
      'Deck',
      poison_token,
      'https://www.bluedeck.app/invitations/' || poison_token
    ) into placeholder_invitation;
  exception
    when unique_violation then poisoned_email_rejected := true;
  end;

  if not poisoned_email_rejected
    and (placeholder_invitation ->> 'crew_profile_id') =
      poisoned_email_profile::text
  then
    raise exception 'Arbitrary unlinked profile email was trusted as provenance.';
  end if;

  -- Fail closed during the short database-first rollout window. An old app
  -- instance cannot supply the private provenance required by the new RPC.
  begin
    insert into public.crew_invitations (
      yacht_id, crew_profile_id, invited_by, invited_email, position,
      department, status, token, invite_link, expires_at
    ) values (
      fixture_yacht_id,
      legacy_email_profile,
      issuer_id,
      legacy_email,
      'Deckhand',
      'Deck',
      'pending',
      legacy_token,
      'https://www.bluedeck.app/invitations/' || legacy_token,
      statement_timestamp() + interval '14 days'
    );
  exception
    when insufficient_privilege then legacy_insert_rejected := true;
  end;

  if not legacy_insert_rejected then
    raise exception 'Legacy invitation insert bypassed canonical issuance.';
  end if;

  select public.bluedeck_issue_crew_invitation(
    issuer_id,
    fixture_yacht_id,
    null,
    legacy_email,
    'Deckhand',
    'Deck',
    reissue_token,
    'https://www.bluedeck.app/invitations/' || reissue_token
  ) into placeholder_invitation;

  if placeholder_invitation ->> 'crew_profile_id' = legacy_email_profile::text
  then
    raise exception 'Canonical issuance trusted an arbitrary unlinked profile.';
  end if;

  if not exists (
    select 1
    from private.crew_invitation_placeholders as placeholder
    where placeholder.yacht_id = fixture_yacht_id
      and placeholder.normalized_email = legacy_email
      and placeholder.crew_profile_id =
        (placeholder_invitation ->> 'crew_profile_id')::uuid
  ) then
    raise exception 'Issued placeholder was not registered privately.';
  end if;

  update public.crew_invitations
  set status = 'expired'
  where id = (placeholder_invitation ->> 'id')::uuid;

  select public.bluedeck_issue_crew_invitation(
    issuer_id,
    fixture_yacht_id,
    null,
    legacy_email,
    'Deckhand',
    'Deck',
    second_reissue_token,
    'https://www.bluedeck.app/invitations/' || second_reissue_token
  ) into second_reissued_invitation;

  if (second_reissued_invitation ->> 'crew_profile_id') =
      (placeholder_invitation ->> 'crew_profile_id')
    or not exists (
      select 1
      from public.crew_invitations
      where id = (placeholder_invitation ->> 'id')::uuid
        and status = 'expired'
        and crew_profile_id =
          (placeholder_invitation ->> 'crew_profile_id')::uuid
    )
    or not exists (
      select 1
      from private.crew_invitation_placeholders as placeholder
      where placeholder.yacht_id = fixture_yacht_id
        and placeholder.normalized_email = legacy_email
        and placeholder.crew_profile_id =
          (second_reissued_invitation ->> 'crew_profile_id')::uuid
    )
  then
    raise exception 'Terminal invitation history was reused by a fresh reissue.';
  end if;

  select public.bluedeck_issue_crew_invitation(
    issuer_id,
    fixture_yacht_id,
    null,
    'invite-delete-' || deletion_victim_id || '@example.invalid',
    'Deckhand',
    'Deck',
    deletion_token,
    'https://www.bluedeck.app/invitations/' || deletion_token
  ) into deletion_invitation;

  delete from auth.users where id = deletion_victim_id;

  if exists (select 1 from auth.users where id = deletion_victim_id)
    or not exists (
      select 1
      from public.crew_invitations
      where id = (deletion_invitation ->> 'id')::uuid
        and status = 'expired'
    )
    or not exists (
      select 1
      from private.crew_invitation_targets
      where invitation_id = (deletion_invitation ->> 'id')::uuid
        and target_user_id = deletion_victim_id
    )
  then
    raise exception 'Target deletion failed to expire while preserving immutable identity.';
  end if;

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    replacement_id,
    'authenticated',
    'authenticated',
    'invite-delete-' || deletion_victim_id || '@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  insert into private.bluedeck_account_provisioning (
    user_id, state, failure_code
  ) values (
    replacement_id, 'ready', ''
  );

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (replacement_session_id, replacement_id, now(), now());

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', replacement_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', replacement_id,
      'role', 'authenticated',
      'session_id', replacement_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );
  if not private.bluedeck_is_active_account() then
    raise exception 'Replacement fixture did not have a ready password session.';
  end if;
  if private.bluedeck_is_own_invitation(
    (deletion_invitation ->> 'id')::uuid
  ) then
    raise exception 'Replacement email account inherited deleted-account history.';
  end if;
  select public.bluedeck_accept_crew_invitation(
    deletion_token, replacement_id, 'Replacement Account'
  ) into acceptance;
  if acceptance ->> 'reason' <> 'forbidden' then
    raise exception 'Replacement account bypassed permanent target binding.';
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );

  select public.bluedeck_issue_crew_invitation(
    issuer_id,
    fixture_yacht_id,
    null,
    preaccount_email,
    'Bosun',
    'Deck',
    preaccount_token,
    'https://www.bluedeck.app/invitations/' || preaccount_token
  ) into reissued_invitation;

  if exists (
    select 1
    from private.crew_invitation_targets
    where invitation_id = (reissued_invitation ->> 'id')::uuid
  ) then
    raise exception 'Unregistered email invitation received a phantom target.';
  end if;

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    preaccount_id,
    'authenticated',
    'authenticated',
    preaccount_email,
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  insert into private.bluedeck_account_provisioning (
    user_id, state, failure_code
  ) values (
    preaccount_id, 'ready', ''
  );

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (preaccount_session_id, preaccount_id, now(), now());

  if not exists (
    select 1
    from private.crew_invitation_targets
    where invitation_id = (reissued_invitation ->> 'id')::uuid
      and target_user_id = preaccount_id
  ) then
    raise exception 'Confirmed signup was not durably bound to its invitation.';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', preaccount_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', preaccount_id,
      'role', 'authenticated',
      'session_id', preaccount_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );
  if not private.bluedeck_is_active_account() then
    raise exception 'Pre-account fixture did not have a ready password session.';
  end if;
  if not private.bluedeck_is_own_invitation(
    (reissued_invitation ->> 'id')::uuid
  ) then
    raise exception 'Bound pre-account invitation was not visible to its owner.';
  end if;

  delete from auth.users where id = preaccount_id;
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    preaccount_replacement_id,
    'authenticated',
    'authenticated',
    preaccount_email,
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  insert into private.bluedeck_account_provisioning (
    user_id, state, failure_code
  ) values (
    preaccount_replacement_id, 'ready', ''
  );

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (
    preaccount_replacement_session_id,
    preaccount_replacement_id,
    now(),
    now()
  );

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', preaccount_replacement_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', preaccount_replacement_id,
      'role', 'authenticated',
      'session_id', preaccount_replacement_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );
  if not private.bluedeck_is_active_account() then
    raise exception 'Pre-account replacement fixture did not have a ready password session.';
  end if;
  if private.bluedeck_is_own_invitation(
    (reissued_invitation ->> 'id')::uuid
  ) then
    raise exception 'Pre-account invitation history was inherited after deletion.';
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::text,
    true
  );
  select public.bluedeck_issue_crew_invitation(
    issuer_id,
    fixture_yacht_id,
    null,
    'future-crew-' || gen_random_uuid() || '@example.invalid',
    'Stewardess',
    'Interior',
    second_token,
    'https://www.bluedeck.app/invitations/' || second_token
  ) into second_invitation;

  update public.marketplace_entitlements
  set posting_status = 'suspended',
      suspension_reason = 'Invitation smoke suspension',
      suspended_at = statement_timestamp(),
      suspended_by = reviewer_id
  where user_id = issuer_id;

  if not exists (
    select 1
    from public.crew_invitations
    where id = (second_invitation ->> 'id')::uuid
      and status = 'revoked'
  ) then
    raise exception 'Entitlement suspension left a pending invitation active.';
  end if;

  update public.marketplace_entitlements
  set posting_status = 'enabled',
      suspension_reason = '',
      suspended_at = null,
      suspended_by = null
  where user_id = issuer_id;
  update auth.users
  set banned_until = statement_timestamp() + interval '1 day'
  where id = issuer_id;

  begin
    perform public.bluedeck_issue_crew_invitation(
      issuer_id,
      fixture_yacht_id,
      null,
      'blocked-crew-' || gen_random_uuid() || '@example.invalid',
      'Deckhand',
      'Deck',
      blocked_token,
      'https://www.bluedeck.app/invitations/' || blocked_token
    );
  exception
    when insufficient_privilege then banned_issue_rejected := true;
  end;
  if not banned_issue_rejected then
    raise exception 'Banned issuer retained crew invitation authority.';
  end if;

  -- Yacht ownership is a durable business relationship. Transfer it before
  -- deleting the issuer account so the identity-integrity RESTRICT boundary
  -- is exercised without erasing invitation audit history.
  update public.yachts
  set owner_id = reviewer_id
  where id = fixture_yacht_id
    and owner_id = issuer_id;
  if not found then
    raise exception 'Issuer yacht ownership was not transferred before account deletion.';
  end if;

  delete from auth.users where id = issuer_id;
  if exists (select 1 from auth.users where id = issuer_id)
    or exists (
      select 1
      from public.crew_invitations
      where invited_by = issuer_id
        and status = 'pending'
    )
    or not exists (
      select 1
      from public.crew_invitations
      where id = (invitation ->> 'id')::uuid
        and invited_by = issuer_id
    )
  then
    raise exception 'Issuer deletion was blocked or erased invitation audit identity.';
  end if;
end;
$test$;

do $test$
begin
  if has_function_privilege(
    'authenticated',
    'public.bluedeck_accept_crew_invitation(text,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated clients retained direct invitation acceptance access.';
  end if;
end;
$test$;

set local role authenticated;

do $test$
declare
  rejected boolean := false;
begin
  begin
    perform public.bluedeck_accept_crew_invitation(
      gen_random_uuid()::text,
      gen_random_uuid(),
      'Unauthorized Caller'
    );
  exception
    when sqlstate '42501' then
      rejected := true;
  end;

  if not rejected then
    raise exception 'Direct authenticated acceptance did not fail with SQLSTATE 42501.';
  end if;
end;
$test$;

reset role;

rollback;
