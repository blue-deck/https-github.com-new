begin;

select set_config(
  'bluedeck.test_legal_acceptance_user',
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
        'privacyVersion', '2026-08-01',
        'termsVersion', '2026-08-01'
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
begin
  if not exists (
    select 1
    from private.bluedeck_legal_acceptances as acceptance
    where acceptance.user_id = accepted_user
      and acceptance.privacy_policy_version = '2026-08-01'
      and acceptance.terms_of_use_version = '2026-08-01'
      and acceptance.source = 'account_signup'
      and acceptance.accepted_at <= statement_timestamp()
  ) then
    raise exception 'Versioned legal acceptance was not captured.';
  end if;

  if has_table_privilege(
      'authenticated',
      'private.bluedeck_legal_acceptances',
      'select'
    )
  then
    raise exception 'Authenticated users can read private acceptance evidence.';
  end if;
end;
$test$;

rollback;
