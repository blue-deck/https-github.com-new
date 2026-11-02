-- All fixtures and writes are rolled back. No email or storage API is invoked.
begin;

do $test$
declare
  scenario text;
  account_id uuid;
  session_id uuid;
  foreign_account_id uuid := gen_random_uuid();
  account_email text;
  profile_before jsonb;
  crew_before jsonb;
  entitlement_before jsonb;
  metadata_before jsonb;
  provisioning_before jsonb;
  recovered boolean;
begin
  if has_function_privilege('anon', 'public.bluedeck_recover_signup_account(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.bluedeck_recover_signup_account(uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.bluedeck_recover_signup_account(uuid,uuid)', 'EXECUTE')
  then
    raise exception 'Recovery RPC must remain service-only.';
  end if;

  insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (foreign_account_id,'authenticated','authenticated',
    'recovery-foreign-' || foreign_account_id || '@example.invalid','',
    statement_timestamp(),statement_timestamp(),statement_timestamp());

  foreach scenario in array array[
    'crew', 'trusted_captain', 'unconfirmed', 'banned', 'deleted',
    'wrong_session', 'expired_session', 'missing_session', 'recovery', 'otp',
    'signup', 'missing_amr', 'missing_acceptance', 'failed', 'legacy',
    'missing_crew_profile', 'inconsistent_roles', 'inconsistent_app_role'
  ] loop
    perform set_config('request.jwt.claims','{}',true);
    account_id := gen_random_uuid();
    session_id := gen_random_uuid();
    account_email := 'recovery-' || account_id || '@example.invalid';

    insert into auth.users (
      id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at
    ) values (
      account_id,'authenticated','authenticated',account_email,'',
      case when scenario = 'unconfirmed' then null else statement_timestamp() end,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name','Recovery Fixture','role','owner','position','Owner',
        'bluedeck_legal_acceptance',jsonb_build_object(
          'accepted',true,'privacyVersion','2026-08-08','termsVersion','2026-08-08'
        )
      ),statement_timestamp(),statement_timestamp()
    );

    if scenario = 'trusted_captain' then
      update public.profiles set role = 'captain' where id = account_id;
      update public.marketplace_entitlements set account_role = 'captain' where user_id = account_id;
      update auth.users set raw_app_meta_data = raw_app_meta_data ||
        '{"role":"captain","bluedeck_account_role":"captain"}'::jsonb where id = account_id;
    elsif scenario = 'banned' then
      update auth.users set banned_until = statement_timestamp() + interval '1 day' where id = account_id;
    elsif scenario = 'deleted' then
      update auth.users set deleted_at = statement_timestamp() where id = account_id;
    elsif scenario = 'failed' then
      update private.bluedeck_account_provisioning set state = 'failed', failure_code = 'test_failure' where user_id = account_id;
    elsif scenario = 'legacy' then
      delete from private.bluedeck_account_provisioning where user_id = account_id;
    elsif scenario = 'missing_acceptance' then
      delete from private.bluedeck_legal_acceptances where user_id = account_id;
    elsif scenario = 'missing_crew_profile' then
      delete from public.crew_profiles where user_id = account_id;
    elsif scenario = 'inconsistent_roles' then
      update public.profiles set role = 'owner' where id = account_id;
    elsif scenario = 'inconsistent_app_role' then
      update auth.users set raw_app_meta_data = raw_app_meta_data || '{"bluedeck_account_role":"owner"}'::jsonb where id = account_id;
    end if;

    if scenario <> 'missing_session' then
      insert into auth.sessions(id,user_id,created_at,updated_at,not_after)
      values (session_id,
        case when scenario = 'wrong_session' then foreign_account_id else account_id end,
        statement_timestamp(),statement_timestamp(),
        case when scenario = 'expired_session' then statement_timestamp() - interval '1 minute' else null end);
      if scenario <> 'missing_amr' then
        insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at)
        values (gen_random_uuid(),session_id,'password',statement_timestamp(),statement_timestamp());
        if scenario in ('recovery','otp','signup') then
          insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at)
          values (gen_random_uuid(),session_id,scenario,statement_timestamp(),statement_timestamp());
        end if;
      end if;
    end if;

    select to_jsonb(p) into profile_before from public.profiles p where id = account_id;
    select to_jsonb(p) into crew_before from public.crew_profiles p where user_id = account_id;
    select to_jsonb(p) into entitlement_before from public.marketplace_entitlements p where user_id = account_id;
    select raw_app_meta_data into metadata_before from auth.users where id = account_id;
    select to_jsonb(p) into provisioning_before from private.bluedeck_account_provisioning p where user_id = account_id;

    -- A confirmed pending account reproduces both the API denial and the
    -- account gate used by profile and avatar RLS before recovery.
    if scenario in ('crew','trusted_captain') and public.bluedeck_account_is_ready(account_id) then
      raise exception 'Pending fixture unexpectedly has account access.';
    end if;
    if scenario = 'crew' and public.bluedeck_provision_signup_account(
      account_id,account_email,'Anonymous Replacement','owner','Owner'
    ) then
      raise exception 'Anonymous signup promoted an existing confirmed pending account.';
    end if;
    recovered := public.bluedeck_recover_signup_account(account_id,session_id);
    if recovered is distinct from (scenario in ('crew','trusted_captain')) then
      raise exception 'Unexpected recovery result for scenario %: %',scenario,recovered;
    end if;
    if recovered then
      if not public.bluedeck_account_is_ready(account_id)
        or not public.bluedeck_bearer_session_is_live(account_id,session_id)
        or not public.bluedeck_recover_signup_account(account_id,session_id)
      then
        raise exception 'Recovered account is unavailable or recovery is not idempotent.';
      end if;
      perform set_config('request.jwt.claims',jsonb_build_object(
        'sub',account_id,'role','authenticated','session_id',session_id,
        'amr',jsonb_build_array(jsonb_build_object('method','password'))
      )::text,true);
      if not private.bluedeck_is_active_account() then
        raise exception 'Recovered account is still blocked by profile/storage RLS gate.';
      end if;
    elsif provisioning_before is distinct from (
      select to_jsonb(p) from private.bluedeck_account_provisioning p where user_id = account_id
    ) then
      raise exception 'Denied recovery mutated provisioning state for scenario %.',scenario;
    end if;

    if profile_before is distinct from (select to_jsonb(p) from public.profiles p where id = account_id)
      or crew_before is distinct from (select to_jsonb(p) from public.crew_profiles p where user_id = account_id)
      or entitlement_before is distinct from (select to_jsonb(p) from public.marketplace_entitlements p where user_id = account_id)
      or metadata_before is distinct from (select raw_app_meta_data from auth.users where id = account_id)
    then
      raise exception 'Recovery overwrote existing account data for scenario %.',scenario;
    end if;
  end loop;

  perform set_config('request.jwt.claims','{}',true);

  -- A repeated anonymous signup cannot overwrite a completed account even if
  -- Auth returns its real ID because it has not confirmed its email yet.
  account_id := gen_random_uuid();
  account_email := 'signup-retry-' || account_id || '@example.invalid';
  insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values (account_id,'authenticated','authenticated',account_email,'','{"provider":"email"}'::jsonb,
    jsonb_build_object('full_name','Original Member','bluedeck_legal_acceptance',jsonb_build_object(
      'accepted',true,'privacyVersion','2026-08-08','termsVersion','2026-08-08'
    )),statement_timestamp(),statement_timestamp());
  if not public.bluedeck_provision_signup_account(account_id,account_email,'Original Member','crew','Deckhand') then
    raise exception 'Initial provisioning failed.';
  end if;
  select to_jsonb(p) into profile_before from public.profiles p where id = account_id;
  select to_jsonb(p) into crew_before from public.crew_profiles p where user_id = account_id;
  select to_jsonb(p) into entitlement_before from public.marketplace_entitlements p where user_id = account_id;
  select raw_app_meta_data into metadata_before from auth.users where id = account_id;
  if not public.bluedeck_provision_signup_account(account_id,account_email,'Replacement','owner','Owner')
    or profile_before is distinct from (select to_jsonb(p) from public.profiles p where id = account_id)
    or crew_before is distinct from (select to_jsonb(p) from public.crew_profiles p where user_id = account_id)
    or entitlement_before is distinct from (select to_jsonb(p) from public.marketplace_entitlements p where user_id = account_id)
    or metadata_before is distinct from (select raw_app_meta_data from auth.users where id = account_id)
  then
    raise exception 'Completed signup retry overwrote account data.';
  end if;
end;
$test$;

rollback;
