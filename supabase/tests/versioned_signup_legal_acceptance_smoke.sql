begin;

select set_config(
  'bluedeck.test_legal_acceptance_user',
  gen_random_uuid()::text,
  true
);
select set_config(
  'bluedeck.test_historical_legal_acceptance_user',
  gen_random_uuid()::text,
  true
);

set local role supabase_auth_admin;

do $test$
declare
  accepted_user uuid := current_setting(
    'bluedeck.test_legal_acceptance_user'
  )::uuid;
  missing_acceptance_rejected boolean := false;
  empty_acceptance_rejected boolean := false;
  partial_acceptance_rejected boolean := false;
  string_acceptance_rejected boolean := false;
  stale_acceptance_rejected boolean := false;
begin
  begin
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    values (
      accepted_user,
      'authenticated',
      'authenticated',
      'missing-legal-acceptance-' || accepted_user || '@example.invalid',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );
  exception
    when check_violation then
      missing_acceptance_rejected := true;
  end;

  if not missing_acceptance_rejected then
    raise exception 'A public email signup bypassed legal acceptance.';
  end if;

  begin
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    values (
      accepted_user,
      'authenticated',
      'authenticated',
      'empty-legal-acceptance-' || accepted_user || '@example.invalid',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'bluedeck_legal_acceptance', '{}'::jsonb
      ),
      now(),
      now()
    );
  exception
    when check_violation then
      empty_acceptance_rejected := true;
  end;

  if not empty_acceptance_rejected then
    raise exception 'An empty legal acceptance object bypassed validation.';
  end if;

  begin
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    values (
      accepted_user,
      'authenticated',
      'authenticated',
      'partial-legal-acceptance-' || accepted_user || '@example.invalid',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'bluedeck_legal_acceptance',
        jsonb_build_object(
          'accepted', true,
          'privacyVersion', '2026-08-08'
        )
      ),
      now(),
      now()
    );
  exception
    when check_violation then
      partial_acceptance_rejected := true;
  end;

  if not partial_acceptance_rejected then
    raise exception 'A partial legal acceptance object bypassed validation.';
  end if;

  begin
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    values (
      accepted_user,
      'authenticated',
      'authenticated',
      'string-legal-acceptance-' || accepted_user || '@example.invalid',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'bluedeck_legal_acceptance',
        jsonb_build_object(
          'accepted', 'true',
          'privacyVersion', '2026-08-08',
          'termsVersion', '2026-08-08'
        )
      ),
      now(),
      now()
    );
  exception
    when check_violation then
      string_acceptance_rejected := true;
  end;

  if not string_acceptance_rejected then
    raise exception 'A string-valued legal acceptance bypassed validation.';
  end if;

  begin
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    values (
      accepted_user,
      'authenticated',
      'authenticated',
      'stale-legal-acceptance-' || accepted_user || '@example.invalid',
      '',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'bluedeck_legal_acceptance',
        jsonb_build_object(
          'accepted', true,
          'privacyVersion', '2026-08-01',
          'termsVersion', '2026-08-01'
        )
      ),
      now(),
      now()
    );
  exception
    when check_violation then
      stale_acceptance_rejected := true;
  end;

  if not stale_acceptance_rejected then
    raise exception 'A public email signup accepted stale policy versions.';
  end if;

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    accepted_user,
    'authenticated',
    'authenticated',
    'legal-acceptance-' || accepted_user || '@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'bluedeck_legal_acceptance',
      jsonb_build_object(
        'accepted', true,
        'privacyVersion', '2026-08-08',
        'termsVersion', '2026-08-08'
      )
    ),
    now(),
    now()
  );

end;
$test$;

reset role;

do $test$
declare
  accepted_user uuid := current_setting(
    'bluedeck.test_legal_acceptance_user'
  )::uuid;
  historical_user uuid := current_setting(
    'bluedeck.test_historical_legal_acceptance_user'
  )::uuid;
  historical_email text :=
    'historical-legal-acceptance-' || historical_user || '@example.invalid';
begin
  if not exists (
    select 1
    from private.bluedeck_legal_acceptances as acceptance
    where acceptance.user_id = accepted_user
      and acceptance.privacy_policy_version = '2026-08-08'
      and acceptance.terms_of_use_version = '2026-08-08'
      and acceptance.source = 'account_signup'
      and acceptance.accepted_at <= statement_timestamp()
  ) then
    raise exception 'Versioned legal acceptance was not captured.';
  end if;

  if exists (
    select 1
    from (
      values
        ('anon', 'SELECT'),
        ('anon', 'INSERT'),
        ('anon', 'UPDATE'),
        ('anon', 'DELETE'),
        ('authenticated', 'SELECT'),
        ('authenticated', 'INSERT'),
        ('authenticated', 'UPDATE'),
        ('authenticated', 'DELETE')
    ) as forbidden(role_name, privilege_name)
    where has_table_privilege(
      forbidden.role_name,
      'private.bluedeck_legal_acceptances',
      forbidden.privilege_name
    )
  )
  then
    raise exception 'Browser roles can access private acceptance evidence.';
  end if;

  if not has_table_privilege(
      'service_role',
      'private.bluedeck_legal_acceptances',
      'SELECT'
    ) or exists (
      select 1
      from (
        values ('INSERT'), ('UPDATE'), ('DELETE')
      ) as forbidden(privilege_name)
      where has_table_privilege(
        'service_role',
        'private.bluedeck_legal_acceptances',
        forbidden.privilege_name
      )
    )
  then
    raise exception 'Service legal-acceptance evidence ACLs are unsafe.';
  end if;

  if has_function_privilege(
      'anon',
      'private.bluedeck_capture_signup_legal_acceptance()',
      'EXECUTE'
    ) or has_function_privilege(
      'authenticated',
      'private.bluedeck_capture_signup_legal_acceptance()',
      'EXECUTE'
    ) or has_function_privilege(
      'service_role',
      'private.bluedeck_capture_signup_legal_acceptance()',
      'EXECUTE'
    )
  then
    raise exception 'Legal-acceptance capture function ACLs are unsafe.';
  end if;

  -- Model an account that accepted the previous policy before this migration.
  -- The fixture is transaction-local and must remain valid without fabricating
  -- a 2026-08-08 acceptance record.
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    historical_user,
    'authenticated',
    'authenticated',
    historical_email,
    '',
    statement_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'Historical Legal Acceptance'),
    statement_timestamp(),
    statement_timestamp()
  );

  insert into private.bluedeck_legal_acceptances (
    user_id,
    privacy_policy_version,
    terms_of_use_version,
    accepted_at,
    source
  ) values (
    historical_user,
    '2026-08-01',
    '2026-08-01',
    statement_timestamp() - interval '7 days',
    'account_signup'
  );

  if not public.bluedeck_provision_signup_account(
    historical_user,
    historical_email,
    'Historical Legal Acceptance',
    'crew',
    'Deckhand'
  ) or not exists (
    select 1
    from private.bluedeck_account_provisioning as provisioning
    where provisioning.user_id = historical_user
      and provisioning.state = 'ready'
  ) or not exists (
    select 1
    from public.crew_profiles as profile
    where profile.user_id = historical_user
  ) or exists (
    select 1
    from private.bluedeck_legal_acceptances as acceptance
    where acceptance.user_id = historical_user
      and acceptance.privacy_policy_version = '2026-08-08'
  )
  then
    raise exception 'Historical legal acceptance provisioning compatibility is broken.';
  end if;
end;
$test$;

rollback;
