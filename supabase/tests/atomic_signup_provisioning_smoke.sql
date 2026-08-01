begin;

do $test$
declare
  account_id uuid := gen_random_uuid();
  account_email text := 'signup-provision-' || gen_random_uuid() || '@example.invalid';
  provisioned boolean;
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    account_id,
    'authenticated',
    'authenticated',
    account_email,
    '',
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object(
      'full_name', 'Atomic Signup',
      'role', 'owner',
      'bluedeck_legal_acceptance', jsonb_build_object(
        'accepted', true,
        'privacyVersion', '2026-08-01',
        'termsVersion', '2026-08-01'
      )
    ),
    statement_timestamp(),
    statement_timestamp()
  );

  if (select role from public.profiles where id = account_id) <> 'crew'
    or (select account_role from public.marketplace_entitlements where user_id = account_id) <> 'crew'
    or (select state from private.bluedeck_account_provisioning where user_id = account_id) <> 'pending'
    or not exists (
      select 1
      from public.crew_profiles
      where user_id = account_id
        and public_crew_id ~ '^BD-[A-F0-9]{32}$'
    )
  then
    raise exception 'Untrusted signup metadata escaped the default Crew role.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = 'auth.users'::regclass
      and trigger.tgname = 'bluedeck_zz_capture_signup_legal_acceptance'
  ) or not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = 'auth.users'::regclass
      and trigger.tgname = 'bluedeck_zzz_provision_default_email_signup'
  ) or 'bluedeck_zz_capture_signup_legal_acceptance'
      >= 'bluedeck_zzz_provision_default_email_signup'
  then
    raise exception 'Signup trigger ordering is not fail-closed.';
  end if;

  provisioned := public.bluedeck_provision_signup_account(
    account_id,
    account_email,
    'Atomic Signup',
    'owner',
    'Owner'
  );
  if provisioned is not true or public.bluedeck_provision_signup_account(
    account_id,
    account_email,
    'Atomic Signup',
    'owner',
    'Owner'
  ) is not true then
    raise exception 'Validated signup provisioning was not idempotent.';
  end if;

  if (select role from public.profiles where id = account_id) <> 'owner'
    or (select account_role from public.marketplace_entitlements where user_id = account_id) <> 'owner'
    or (select current_position from public.crew_profiles where user_id = account_id) <> 'Owner'
    or (select raw_app_meta_data ->> 'bluedeck_account_role' from auth.users where id = account_id) <> 'owner'
    or (select state from private.bluedeck_account_provisioning where user_id = account_id) <> 'ready'
  then
    raise exception 'Validated signup fields were not committed together.';
  end if;

  if public.bluedeck_provision_signup_account(
    account_id,
    'wrong-' || account_email,
    'Atomic Signup',
    'management',
    'Yacht Manager'
  ) then
    raise exception 'A mismatched account email changed signup authority.';
  end if;

  if has_function_privilege(
    'anon',
    'public.bluedeck_provision_signup_account(uuid,text,text,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_provision_signup_account(uuid,text,text,text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.bluedeck_provision_signup_account(uuid,text,text,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_fail_signup_provisioning(uuid,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.bluedeck_account_is_ready(uuid)',
    'EXECUTE'
  ) or has_table_privilege(
    'service_role',
    'private.bluedeck_account_provisioning',
    'SELECT'
  ) or has_function_privilege(
    'service_role',
    'private.bluedeck_ensure_default_signup_account(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Atomic signup provisioning ACLs are unsafe.';
  end if;
end;
$test$;

rollback;
